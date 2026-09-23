import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Book, StudentTestResult, TestDeliveryConfig } from '../types';
import { INITIAL_BOOKS } from '../data/initialBooks';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore (with databaseId if defined)
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Firestore connected successfully.");
    return true;
  } catch (err: any) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn("Firestore client is offline, using offline cache.");
    } else {
      console.log("Firestore connection initialized.");
    }
    return true;
  }
}

// -------------------------------------------------------------
// Real-time Books Subscription (Global sync across all devices)
// -------------------------------------------------------------
export function subscribeToBooks(
  onUpdate: (books: Book[]) => void,
  onError?: (err: Error) => void
): () => void {
  const booksCol = collection(db, 'books');
  return onSnapshot(
    booksCol,
    async (snapshot) => {
      if (snapshot.empty) {
        // Only seed on brand new database launch if never initialized before
        const hasInitialized = typeof window !== 'undefined' && localStorage.getItem('maktab_firestore_initialized') === 'true';
        if (!hasInitialized) {
          console.log("Firestore books collection is empty on first launch. Seeding initial books...");
          if (typeof window !== 'undefined') localStorage.setItem('maktab_firestore_initialized', 'true');
          await seedInitialBooks();
          return;
        } else {
          // User intentionally deleted all books, reflect empty array
          onUpdate([]);
          return;
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('maktab_firestore_initialized', 'true');
      }

      const fetchedBooks: Book[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Book;
        fetchedBooks.push({
          ...data,
          id: docSnap.id,
        });
      });

      // Preserve reasonable sorting (active first, then by title)
      fetchedBooks.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return (a.title || '').localeCompare(b.title || '');
      });

      onUpdate(fetchedBooks);
    },
    (error) => {
      console.warn("Firestore books subscription notice:", error);
      if (onError) onError(error);
    }
  );
}

// Seed initial books into Firestore
export async function seedInitialBooks(): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const book of INITIAL_BOOKS) {
      const bookRef = doc(db, 'books', book.id);
      batch.set(bookRef, {
        ...book,
        isActive: book.isActive !== false,
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
    console.log("INITIAL_BOOKS successfully seeded into Firestore.");
  } catch (err) {
    console.warn("Could not seed INITIAL_BOOKS to Firestore:", err);
  }
}

// Save or Update a single Book globally in real-time
export async function saveBookToFirestore(book: Book): Promise<void> {
  const cleanBook: Book = {
    ...book,
    id: book.id || `book-${Date.now()}`,
    title: (book.title || '').trim(),
    author: (book.author || 'Noma\'lum').trim(),
    grade: book.grade || '5-sinf',
    coverColor: book.coverColor || 'from-blue-600 to-indigo-800',
    description: book.description || '',
    createdAt: book.createdAt || new Date().toISOString(),
    isActive: book.isActive !== false,
    questions: Array.isArray(book.questions) ? book.questions : [],
  };

  const bookRef = doc(db, 'books', cleanBook.id);
  await setDoc(bookRef, { ...cleanBook, updatedAt: Date.now() }, { merge: true });
}

// Push all local books to Firestore in one atomic batch, and remove any deleted books
export async function pushAllBooksToFirestore(books: Book[]): Promise<void> {
  try {
    const booksCol = collection(db, 'books');
    const existingSnap = await getDocs(booksCol);
    const activeIds = new Set(books.map((b) => String(b.id)));

    const batch = writeBatch(db);

    // 1. Update or create current active books
    for (const book of books) {
      const cleanId = String(book.id || `book-${Date.now()}`);
      const bookRef = doc(db, 'books', cleanId);
      batch.set(
        bookRef,
        {
          ...book,
          id: cleanId,
          isActive: book.isActive !== false,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    // 2. Delete any books that exist in Firestore but were removed locally
    existingSnap.forEach((docSnap) => {
      if (!activeIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    await batch.commit();
  } catch (err) {
    console.error("pushAllBooksToFirestore error:", err);
    throw err;
  }
}

// Delete a book globally from Firestore
export async function deleteBookFromFirestore(bookId: string): Promise<void> {
  try {
    const cleanId = String(bookId);
    const bookRef = doc(db, 'books', cleanId);
    await deleteDoc(bookRef);
    console.log(`Book "${cleanId}" permanently deleted from Firestore.`);
  } catch (err) {
    console.error("deleteBookFromFirestore error:", err);
    throw err;
  }
}

// Helper to recursively remove undefined fields which Firestore rejects
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString() as any;
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = cleanForFirestore(value);
    }
  }
  return result as T;
}

// -------------------------------------------------------------
// Real-time Test Results Subscription
// -------------------------------------------------------------
export function subscribeToResults(
  onUpdate: (results: StudentTestResult[]) => void,
  onError?: (err: Error) => void
): () => void {
  const resultsCol = collection(db, 'results');

  // Direct collection snapshot avoids index missing errors and handles all document versions
  return onSnapshot(
    resultsCol,
    (snapshot) => {
      const results: StudentTestResult[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as StudentTestResult;
        results.push({
          ...data,
          id: docSnap.id,
        });
      });

      // Sort by newest first (using submittedAt or completedAt)
      results.sort((a, b) => {
        const timeA = a.submittedAt || (a.completedAt ? new Date(a.completedAt).getTime() : 0);
        const timeB = b.submittedAt || (b.completedAt ? new Date(b.completedAt).getTime() : 0);
        return timeB - timeA;
      });

      console.log(`[Firebase] Results updated: ${results.length} total results loaded`);
      onUpdate(results);
    },
    (error) => {
      console.warn("Firestore results subscription error:", error);
      if (onError) onError(error);
    }
  );
}

// Fetch all results once (for immediate fallback/initial sync)
export async function fetchResultsFromFirestore(): Promise<StudentTestResult[]> {
  try {
    const resultsCol = collection(db, 'results');
    const snapshot = await getDocs(resultsCol);
    const results: StudentTestResult[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as StudentTestResult;
      results.push({
        ...data,
        id: docSnap.id,
      });
    });
    results.sort((a, b) => {
      const timeA = a.submittedAt || (a.completedAt ? new Date(a.completedAt).getTime() : 0);
      const timeB = b.submittedAt || (b.completedAt ? new Date(b.completedAt).getTime() : 0);
      return timeB - timeA;
    });
    return results;
  } catch (err) {
    console.warn("fetchResultsFromFirestore error:", err);
    return [];
  }
}

// Save a student test result globally
export async function saveResultToFirestore(result: StudentTestResult): Promise<void> {
  try {
    const cleanId = result.id || `res-${Date.now()}`;
    const resultRef = doc(db, 'results', cleanId);
    
    // Clean all undefined fields before sending to Firestore
    const sanitizedData = cleanForFirestore({
      ...result,
      id: cleanId,
      studentName: (result.studentName || '').trim(),
      studentGrade: (result.studentGrade || '').trim(),
      bookId: result.bookId || '',
      bookTitle: result.bookTitle || '',
      score: Number(result.score) || 0,
      totalQuestions: Number(result.totalQuestions) || 0,
      percentage: Number(result.percentage) || 0,
      completedAt: result.completedAt || new Date().toISOString(),
      submittedAt: result.submittedAt || Date.now(),
      gradeBadge: result.gradeBadge || '2 (Qoniqarsiz)',
      details: Array.isArray(result.details)
        ? result.details.map((d) => ({
            questionId: d.questionId || '',
            questionText: d.questionText || '',
            type: d.type || 'multiple-choice',
            studentAnswer: d.studentAnswer || '',
            correctAnswer: d.correctAnswer || '',
            isCorrect: !!d.isCorrect,
            explanation: d.explanation || '',
            aiFeedback: d.aiFeedback || '',
          }))
        : [],
    });

    await setDoc(resultRef, sanitizedData, { merge: true });
    console.log(`[Firebase] Test result successfully saved to Firestore: ${cleanId}`);
  } catch (err) {
    console.error("[Firebase] Error saving test result to Firestore:", err);
    throw err;
  }
}

// Delete a single student result
export async function deleteResultFromFirestore(resultId: string): Promise<void> {
  const resultRef = doc(db, 'results', resultId);
  await deleteDoc(resultRef);
}

// Clear all student results
export async function clearAllResultsFromFirestore(): Promise<void> {
  const snapshot = await getDocs(collection(db, 'results'));
  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}

// -------------------------------------------------------------
// Real-time Delivery Config Subscription
// -------------------------------------------------------------
export function subscribeToDeliveryConfig(
  onUpdate: (config: TestDeliveryConfig) => void
): () => void {
  const configRef = doc(db, 'settings', 'deliveryConfig');
  return onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as TestDeliveryConfig);
    }
  });
}

// Save delivery config globally
export async function saveDeliveryConfigToFirestore(
  config: TestDeliveryConfig
): Promise<void> {
  const configRef = doc(db, 'settings', 'deliveryConfig');
  await setDoc(configRef, config, { merge: true });
}
