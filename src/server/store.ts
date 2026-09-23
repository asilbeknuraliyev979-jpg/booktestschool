import fs from "fs";
import path from "path";
import { Book, StudentTestResult, TestDeliveryConfig } from "../types";
import { INITIAL_BOOKS } from "../data/initialBooks";

interface AppStorageData {
  books: Book[];
  results: StudentTestResult[];
  deliveryConfig: TestDeliveryConfig;
  version: number;
}

const DEFAULT_CONFIG: TestDeliveryConfig = {
  totalQuestions: 20,
  multipleChoiceCount: 15,
  writtenCount: 5,
  timeLimitMinutes: 25,
};

let inMemoryData: AppStorageData = {
  books: INITIAL_BOOKS,
  results: [],
  deliveryConfig: DEFAULT_CONFIG,
  version: Date.now(),
};

// Determine storage path (supports local Node, Cloud Run, and serverless /tmp fallback)
let resolvedStoragePath: string | null = null;

function getStorageFilePath(): string {
  if (resolvedStoragePath) return resolvedStoragePath;

  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // Test write permission in dataDir
    const testFile = path.join(dataDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, "ok", "utf-8");
    fs.unlinkSync(testFile);
    resolvedStoragePath = path.join(dataDir, "maktab_store.json");
    return resolvedStoragePath;
  } catch {
    // If process.cwd()/data is read-only (common in Cloud Run containers), safely fall back to /tmp
    resolvedStoragePath = path.join("/tmp", "maktab_store.json");
    return resolvedStoragePath;
  }
}

// Load storage on module initialization
function loadFromDisk(): void {
  try {
    const filePath = getStorageFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.books) && parsed.books.length > 0) {
          inMemoryData.books = parsed.books;
        } else {
          inMemoryData.books = INITIAL_BOOKS;
        }
        if (Array.isArray(parsed.results)) {
          inMemoryData.results = parsed.results;
        }
        if (parsed.deliveryConfig) {
          inMemoryData.deliveryConfig = { ...DEFAULT_CONFIG, ...parsed.deliveryConfig };
        }
        if (typeof parsed.version === 'number') {
          inMemoryData.version = parsed.version;
        }
      }
    } else {
      inMemoryData.books = INITIAL_BOOKS;
      saveToDisk();
    }
  } catch (err) {
    console.warn("Could not load storage from disk, using in-memory state:", err);
    inMemoryData.books = INITIAL_BOOKS;
  }
}

// Save storage to disk safely without throwing
function saveToDisk(): void {
  try {
    const filePath = getStorageFilePath();
    fs.writeFileSync(filePath, JSON.stringify(inMemoryData, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist storage to disk, staying in-memory:", err);
  }
}

// Initialize on start
loadFromDisk();

export const storage = {
  getVersion(): number {
    return inMemoryData.version || Date.now();
  },
  getBooks(): Book[] {
    if (!Array.isArray(inMemoryData.books) || inMemoryData.books.length === 0) {
      inMemoryData.books = INITIAL_BOOKS;
      inMemoryData.version = Date.now();
      saveToDisk();
    }
    return inMemoryData.books;
  },
  saveBooks(books: Book[]): Book[] {
    try {
      if (!Array.isArray(books) || books.length === 0) {
        inMemoryData.books = INITIAL_BOOKS;
      } else {
        // Sanitize books to ensure completely clean, serializable objects
        inMemoryData.books = books.map((b, index) => ({
          id: String(b.id || `book-${Date.now()}-${index}`),
          title: String(b.title || '').trim(),
          author: String(b.author || 'Noma\'lum').trim(),
          grade: String(b.grade || '5-sinf'),
          coverColor: String(b.coverColor || 'from-blue-600 to-indigo-800'),
          description: String(b.description || ''),
          createdAt: b.createdAt || new Date().toISOString(),
          isActive: b.isActive !== false,
          questions: Array.isArray(b.questions)
            ? b.questions.map((q, qIndex) => ({
                id: String(q.id || `q-${index}-${qIndex}`),
                type: q.type === 'written' ? 'written' : 'multiple-choice',
                question: String(q.question || ''),
                options: Array.isArray(q.options) ? q.options.map(String) : ['A', 'B', 'C', 'D'],
                correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
                explanation: String(q.explanation || ''),
                expectedAnswer: q.expectedAnswer ? String(q.expectedAnswer) : undefined,
                keywords: Array.isArray(q.keywords) ? q.keywords.map(String) : undefined,
              }))
            : [],
        }));
      }
      inMemoryData.version = Date.now();
      saveToDisk();
    } catch (err) {
      console.warn("Storage saveBooks error, keeping current memory:", err);
    }
    return inMemoryData.books;
  },
  getResults(): StudentTestResult[] {
    return inMemoryData.results;
  },
  addResult(result: StudentTestResult): StudentTestResult {
    try {
      inMemoryData.results = [result, ...inMemoryData.results];
      inMemoryData.version = Date.now();
      saveToDisk();
    } catch (err) {
      console.warn("Storage addResult error:", err);
    }
    return result;
  },
  clearResults(): void {
    try {
      inMemoryData.results = [];
      inMemoryData.version = Date.now();
      saveToDisk();
    } catch (err) {
      console.warn("Storage clearResults error:", err);
    }
  },
  deleteResult(resultId: string): void {
    try {
      inMemoryData.results = inMemoryData.results.filter((r) => r.id !== resultId);
      inMemoryData.version = Date.now();
      saveToDisk();
    } catch (err) {
      console.warn("Storage deleteResult error:", err);
    }
  },
  getDeliveryConfig(): TestDeliveryConfig {
    return inMemoryData.deliveryConfig;
  },
  saveDeliveryConfig(config: TestDeliveryConfig): TestDeliveryConfig {
    try {
      inMemoryData.deliveryConfig = { ...inMemoryData.deliveryConfig, ...config };
      inMemoryData.version = Date.now();
      saveToDisk();
    } catch (err) {
      console.warn("Storage saveDeliveryConfig error:", err);
    }
    return inMemoryData.deliveryConfig;
  },
};
