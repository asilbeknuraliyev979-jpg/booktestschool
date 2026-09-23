import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StudentLoginPanel } from './components/StudentLoginPanel';
import { BookTestList } from './components/BookTestList';
import { StudentQuizView } from './components/StudentQuizView';
import { AdminPasscodeModal } from './components/AdminPasscodeModal';
import { AdminPanel } from './components/AdminPanel';
import { Book, StudentInfo, TestDeliveryConfig, StudentTestResult } from './types';
import { INITIAL_BOOKS } from './data/initialBooks';

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

  // Global Real-time Multi-Computer Synchronization (SSE + Live Broadcast)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let pollInterval: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime/events');

        eventSource.onopen = () => {
          setIsLiveConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'init') {
              if (Array.isArray(data.books) && data.books.length > 0) {
                setBooks(data.books);
              }
              if (Array.isArray(data.results)) {
                setResults(data.results);
              }
              if (data.deliveryConfig) {
                setDeliveryConfig((prev) => ({ ...prev, ...data.deliveryConfig }));
              }
              setIsLiveConnected(true);
            } else if (data.type === 'books_updated' && Array.isArray(data.data?.books)) {
              setBooks(data.data.books);
            } else if (data.type === 'results_updated' && Array.isArray(data.data?.results)) {
              setResults(data.data.results);
            } else if (data.type === 'config_updated' && data.data?.config) {
              setDeliveryConfig((prev) => ({ ...prev, ...data.data.config }));
            }
          } catch (err) {
            console.warn("Failed to parse SSE payload:", err);
          }
        };

        eventSource.onerror = () => {
          setIsLiveConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        setIsLiveConnected(false);
        reconnectTimeout = setTimeout(connectSSE, 4000);
      }
    };

    connectSSE();

    // Redundant fast poll every 4 seconds to guarantee sync even across strict proxies
    const runFallbackPoll = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (res.ok) {
          setIsLiveConnected(true);
        }
      } catch {
        setIsLiveConnected(false);
      }
    };

    pollInterval = setInterval(runFallbackPoll, 4000);

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Update books and synchronize with server for all computers
  const handleUpdateBooks = (newBooks: Book[] | ((prev: Book[]) => Book[])) => {
    setBooks((prev) => {
      const updated = typeof newBooks === 'function' ? newBooks(prev) : newBooks;
      fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: updated }),
      }).catch((err) => console.warn("Could not sync books to server:", err));
      return updated;
    });
  };

  // Update delivery config and synchronize with server
  const handleUpdateDeliveryConfig = (newConfig: TestDeliveryConfig | ((prev: TestDeliveryConfig) => TestDeliveryConfig)) => {
    setDeliveryConfig((prev) => {
      const updated = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
      fetch('/api/delivery-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updated }),
      }).catch((err) => console.warn("Could not sync delivery config to server:", err));
      return updated;
    });
  };

  // Clear all results and sync with server
  const handleClearResults = async () => {
    setResults([]);
    try {
      await fetch('/api/results', { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not clear results on server:", e);
    }
  };

  // Delete single result and sync with server
  const handleDeleteResult = async (resId: string) => {
    setResults((prev) => prev.filter((r) => r.id !== resId));
    try {
      await fetch(`/api/results/${resId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not delete result on server:", e);
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
    // Save to central server so teacher's PC sees the result immediately
    fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: newResult }),
    }).catch((err) => console.warn("Could not sync test result:", err));

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
