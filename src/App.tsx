import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StudentLoginPanel } from './components/StudentLoginPanel';
import { BookTestList } from './components/BookTestList';
import { StudentQuizView } from './components/StudentQuizView';
import { AdminPasscodeModal } from './components/AdminPasscodeModal';
import { AdminPanel } from './components/AdminPanel';
import { Book, StudentInfo, TestDeliveryConfig, StudentTestResult } from './types';
import { INITIAL_BOOKS } from './data/initialBooks';
import {
  subscribeToBooks,
  subscribeToResults,
  fetchResultsFromFirestore,
  subscribeToDeliveryConfig,
  pushAllBooksToFirestore,
  saveResultToFirestore,
  deleteResultFromFirestore,
  clearAllResultsFromFirestore,
  saveDeliveryConfigToFirestore,
  testFirestoreConnection,
} from './services/firebase';

const STORAGE_KEYS = {
  BOOKS: 'maktab_kitoblar_v2',
  RESULTS: 'maktab_kitob_natijalar_v2',
  DELIVERY_CONFIG: 'maktab_test_delivery_config_v2',
  STUDENT: 'maktab_student_info_v2',
  ADMIN_TOKEN: 'maktab_admin_token',
};

export default function App() {
  // Books state
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOOKS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_BOOKS;
  });

  // Student info state - resets when test finishes so student name/class disappears on return
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({ fullName: '', grade: '' });

  // Delivery config state (Admin can configure)
  const [deliveryConfig, setDeliveryConfig] = useState<TestDeliveryConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELIVERY_CONFIG);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      totalQuestions: 20,
      multipleChoiceCount: 15,
      writtenCount: 5,
      timeLimitMinutes: 25,
    };
  });

  // Student test results
  const [results, setResults] = useState<StudentTestResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Admin authentication state
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [activeTestBook, setActiveTestBook] = useState<Book | null>(null);
  const [showStudentValidationToast, setShowStudentValidationToast] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DELIVERY_CONFIG, JSON.stringify(deliveryConfig));
  }, [deliveryConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
  }, [results]);

  // Global Real-time Multi-Computer Synchronization (Google Firebase Firestore + SSE Backup)
  useEffect(() => {
    // 1. Initial Firestore connection test and immediate results load
    testFirestoreConnection();
    fetchResultsFromFirestore().then((initialResults) => {
      if (Array.isArray(initialResults) && initialResults.length > 0) {
        setResults((prev) => {
          // Merge or set newest results
          const map = new Map<string, StudentTestResult>();
          initialResults.forEach((r) => map.set(r.id, r));
          prev.forEach((r) => { if (!map.has(r.id)) map.set(r.id, r); });
          return Array.from(map.values()).sort((a, b) => {
            const timeA = a.submittedAt || (a.completedAt ? new Date(a.completedAt).getTime() : 0);
            const timeB = b.submittedAt || (b.completedAt ? new Date(b.completedAt).getTime() : 0);
            return timeB - timeA;
          });
        });
      }
    }).catch((err) => console.warn("Initial results fetch warning:", err));

    // 2. Firebase Firestore Real-Time Subscriptions (Master Global Source)
    const unsubscribeBooks = subscribeToBooks((firestoreBooks) => {
      if (Array.isArray(firestoreBooks) && firestoreBooks.length > 0) {
        setBooks(firestoreBooks);
        setIsLiveConnected(true);
      }
    });

    const unsubscribeResults = subscribeToResults((firestoreResults) => {
      if (Array.isArray(firestoreResults)) {
        setResults(firestoreResults);
      }
    });

    const unsubscribeConfig = subscribeToDeliveryConfig((firestoreConfig) => {
      if (firestoreConfig) {
        setDeliveryConfig((prev) => ({ ...prev, ...firestoreConfig }));
      }
    });

    // 3. Fallback SSE & Polling
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime/events');
        eventSource.onopen = () => setIsLiveConnected(true);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              if (Array.isArray(data.books) && data.books.length > 0) {
                setBooks((prev) => (prev.length === 0 ? data.books : prev));
              }
              if (Array.isArray(data.results)) {
                setResults((prev) => (prev.length === 0 ? data.results : prev));
              }
            }
          } catch {
            // Ignore parse errors
          }
        };
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      unsubscribeBooks();
      unsubscribeResults();
      unsubscribeConfig();
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Update books and synchronize globally across ALL computers via Firebase
  const handleUpdateBooks = (newBooks: Book[] | ((prev: Book[]) => Book[])) => {
    setBooks((prev) => {
      const updated = typeof newBooks === 'function' ? newBooks(prev) : newBooks;
      // 1. Google Firebase Firestore Real-Time Global Push
      pushAllBooksToFirestore(updated).catch((err) =>
        console.warn("Firestore push notice:", err)
      );
      // 2. Also keep backend in sync
      queueMicrotask(() => {
        fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ books: updated }),
        }).catch((err) => console.warn("Local sync warning:", err));
      });
      return updated;
    });
  };

  // Update delivery config and synchronize globally
  const handleUpdateDeliveryConfig = (newConfig: TestDeliveryConfig | ((prev: TestDeliveryConfig) => TestDeliveryConfig)) => {
    setDeliveryConfig((prev) => {
      const updated = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
      saveDeliveryConfigToFirestore(updated).catch((err) =>
        console.warn("Firestore config save notice:", err)
      );
      queueMicrotask(() => {
        fetch('/api/delivery-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: updated }),
        }).catch((err) => console.warn("Local config sync warning:", err));
      });
      return updated;
    });
  };

  // Clear all results globally
  const handleClearResults = async () => {
    setResults([]);
    clearAllResultsFromFirestore().catch((err) =>
      console.warn("Firestore clear notice:", err)
    );
    try {
      await fetch('/api/results', { method: 'DELETE' });
    } catch (e) {
      console.warn("Local clear notice:", e);
    }
  };

  // Delete single result globally
  const handleDeleteResult = async (resId: string) => {
    setResults((prev) => prev.filter((r) => r.id !== resId));
    deleteResultFromFirestore(resId).catch((err) =>
      console.warn("Firestore delete notice:", err)
    );
    try {
      await fetch(`/api/results/${resId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Local delete notice:", e);
    }
  };

  // URL-based Admin Navigation (/admin)
  // "adminga kirish uchun ham brauzerda urlda /admin deb yozsa kiradigan qil interfeysda tugma qo'yma"
  const checkAdminRoute = useCallback(async () => {
    const pathname = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const isAdminRequested =
      pathname === '/admin' ||
      pathname === '/admin/' ||
      pathname.endsWith('/admin') ||
      hash === '#admin';

    if (isAdminRequested) {
      const existingToken = sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (existingToken) {
        try {
          const res = await fetch('/api/admin/verify', {
            headers: { Authorization: `Bearer ${existingToken}` },
          });
          const data = await res.json();
          if (res.ok && data.valid) {
            setAdminToken(existingToken);
            setIsAdmin(true);
            setIsPasscodeModalOpen(false);
            return;
          }
        } catch {
          // Fallback if offline/local
          if (existingToken.startsWith('local-admin-')) {
            setAdminToken(existingToken);
            setIsAdmin(true);
            setIsPasscodeModalOpen(false);
            return;
          }
        }
      }

      // No valid session token - prompt login modal
      setIsAdmin(false);
      setIsPasscodeModalOpen(true);
    }
  }, []);

  // Listen to URL changes and route initialization
  useEffect(() => {
    checkAdminRoute();

    const handleLocationChange = () => {
      checkAdminRoute();
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Periodic check to capture direct manual address bar typing in iframes or browsers
    const interval = setInterval(() => {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if ((pathname === '/admin' || pathname.endsWith('/admin') || hash === '#admin') && !isAdmin && !isPasscodeModalOpen) {
        checkAdminRoute();
      }
    }, 1000);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      clearInterval(interval);
    };
  }, [checkAdminRoute, isAdmin, isPasscodeModalOpen]);

  const handleAdminLoginSuccess = (token: string) => {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    setAdminToken(token);
    setIsAdmin(true);
    setIsPasscodeModalOpen(false);
    if (!window.location.pathname.toLowerCase().includes('/admin')) {
      window.history.pushState({}, '', '/admin');
    }
  };

  const handleCloseAdminModal = () => {
    setIsPasscodeModalOpen(false);
    // If not authenticated, clean up URL back to root
    const pathname = window.location.pathname.toLowerCase();
    if (pathname === '/admin' || pathname.endsWith('/admin') || window.location.hash === '#admin') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleExitAdmin = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    setAdminToken(null);
    setIsAdmin(false);
    window.history.pushState({}, '', '/');
  };

  const isStudentReady = Boolean(
    studentInfo.fullName.trim() && studentInfo.grade.trim()
  );

  const handleTestComplete = (newResult: StudentTestResult) => {
    setResults((prev) => [newResult, ...prev]);
    // 1. Save to Google Firebase Firestore globally (Teacher's analytics updates instantly)
    saveResultToFirestore(newResult).catch((err) =>
      console.warn("Firestore result save notice:", err)
    );
    // 2. Also send to local backend
    fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: newResult }),
    }).catch((err) => console.warn("Local result sync notice:", err));

    // Clear saved student so next entry starts completely clean
    setStudentInfo({ fullName: '', grade: '' });
    localStorage.removeItem(STORAGE_KEYS.STUDENT);
  };

  // Exit test and clear student info so next student starts fresh
  const handleExitTest = () => {
    setActiveTestBook(null);
    setStudentInfo({ fullName: '', grade: '' });
    localStorage.removeItem(STORAGE_KEYS.STUDENT);
  };

  const handlePromptStudentInfo = () => {
    setShowStudentValidationToast(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setShowStudentValidationToast(false), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col antialiased">
      {/* Top Navbar: Admin button is accessible via small header link or /admin URL */}
      <Header
        isAdmin={isAdmin}
        onAdminClick={() => setIsPasscodeModalOpen(true)}
        onExitAdmin={handleExitAdmin}
        studentName={studentInfo.fullName}
        studentGrade={studentInfo.grade}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Toast for student prompt */}
        {showStudentValidationToast && (
          <div className="mb-6 p-4 bg-amber-500 text-white font-medium text-sm rounded-xl shadow-md flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <span>
              ⚠️ Iltimos, oldin chap tomonda ism-familiyangiz va sinfingizni (5-A dan 11-D gacha) tanlang!
            </span>
            <button
              onClick={() => setShowStudentValidationToast(false)}
              className="text-white/80 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. ACTIVE STUDENT TEST VIEW */}
        {activeTestBook ? (
          <StudentQuizView
            book={activeTestBook}
            studentInfo={studentInfo}
            deliveryConfig={deliveryConfig}
            onComplete={handleTestComplete}
            onCancel={handleExitTest}
          />
        ) : isAdmin ? (
          /* 2. ADMIN PANEL VIEW (Protected by Session Token) */
          <AdminPanel
            books={books}
            onUpdateBooks={handleUpdateBooks}
            deliveryConfig={deliveryConfig}
            onUpdateDeliveryConfig={handleUpdateDeliveryConfig}
            results={results}
            onClearResults={handleClearResults}
            onDeleteResult={handleDeleteResult}
            onUpdateResults={setResults}
            onResetToInitialBooks={() => handleUpdateBooks(INITIAL_BOOKS)}
            adminToken={adminToken || undefined}
          />
        ) : (
          /* 3. DEFAULT STUDENT VIEW: Left (Name & Class), Right (Available Tests) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left side: Student Name & Class ONLY */}
            <div className="lg:col-span-4">
              <StudentLoginPanel
                studentInfo={studentInfo}
                onChange={setStudentInfo}
                isReady={isStudentReady}
              />
            </div>

            {/* Right side: Available Book Tests */}
            <div className="lg:col-span-8">
              <BookTestList
                books={books}
                deliveryConfig={deliveryConfig}
                isStudentReady={isStudentReady}
                onStartTest={(book) => {
                  if (book.isActive === false) return;
                  setActiveTestBook(book);
                }}
                onNeedStudentInfo={handlePromptStudentInfo}
              />
            </div>
          </div>
        )}
      </main>

      {/* Admin Login Modal (Triggered via /admin URL, Login: aistudio, Password: salom7852qaz) */}
      <AdminPasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={handleCloseAdminModal}
        onSuccess={handleAdminLoginSuccess}
      />
    </div>
  );
}
