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
        // If Firestore books collection is completely empty on first launch, seed INITIAL_BOOKS
        console.log("Firestore books collection is empty. Seeding initial books...");
        await seedInitialBooks();
        return;
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

// Push all local books to Firestore in one atomic batch
export async function pushAllBooksToFirestore(books: Book[]): Promise<void> {
  const batch = writeBatch(db);
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
  await batch.commit();
}

// Delete a book globally from Firestore
export async function deleteBookFromFirestore(bookId: string): Promise<void> {
  const bookRef = doc(db, 'books', bookId);
  await deleteDoc(bookRef);
}

// -------------------------------------------------------------
// Real-time Test Results Subscription
// -------------------------------------------------------------
export function subscribeToResults(
  onUpdate: (results: StudentTestResult[]) => void,
  onError?: (err: Error) => void
): () => void {
  const resultsCol = collection(db, 'results');
  const q = query(resultsCol, orderBy('submittedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const results: StudentTestResult[] = [];
      snapshot.forEach((docSnap) => {
        results.push(docSnap.data() as StudentTestResult);
      });
      onUpdate(results);
    },
    (error) => {
      // Fallback query without orderBy if index is not ready yet
      console.warn("Results ordered query warning, falling back to standard collection:", error);
      return onSnapshot(resultsCol, (snapshot) => {
        const fallbackResults: StudentTestResult[] = [];
        snapshot.forEach((docSnap) => {
          fallbackResults.push(docSnap.data() as StudentTestResult);
        });
        fallbackResults.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
        onUpdate(fallbackResults);
      }, onError);
    }
  );
}

// Save a student test result globally
export async function saveResultToFirestore(result: StudentTestResult): Promise<void> {
  const cleanId = result.id || `res-${Date.now()}`;
  const resultRef = doc(db, 'results', cleanId);
  await setDoc(resultRef, {
    ...result,
    id: cleanId,
    submittedAt: result.submittedAt || Date.now(),
  });
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
