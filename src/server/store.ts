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

// Determine storage path (supports local Node and serverless /tmp fallback)
function getStorageFilePath(): string {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, "maktab_store.json");
  } catch {
    return path.join("/tmp", "maktab_store.json");
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

// Save storage asynchronously to disk
function saveToDisk(): void {
  try {
    const filePath = getStorageFilePath();
    fs.writeFileSync(filePath, JSON.stringify(inMemoryData, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist storage to disk:", err);
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
    if (!Array.isArray(books) || books.length === 0) {
      inMemoryData.books = INITIAL_BOOKS;
    } else {
      inMemoryData.books = books;
    }
    inMemoryData.version = Date.now();
    saveToDisk();
    return inMemoryData.books;
  },
  getResults(): StudentTestResult[] {
    return inMemoryData.results;
  },
  addResult(result: StudentTestResult): StudentTestResult {
    inMemoryData.results = [result, ...inMemoryData.results];
    inMemoryData.version = Date.now();
    saveToDisk();
    return result;
  },
  clearResults(): void {
    inMemoryData.results = [];
    inMemoryData.version = Date.now();
    saveToDisk();
  },
  deleteResult(resultId: string): void {
    inMemoryData.results = inMemoryData.results.filter((r) => r.id !== resultId);
    inMemoryData.version = Date.now();
    saveToDisk();
  },
  getDeliveryConfig(): TestDeliveryConfig {
    return inMemoryData.deliveryConfig;
  },
  saveDeliveryConfig(config: TestDeliveryConfig): TestDeliveryConfig {
    inMemoryData.deliveryConfig = { ...inMemoryData.deliveryConfig, ...config };
    inMemoryData.version = Date.now();
    saveToDisk();
    return inMemoryData.deliveryConfig;
  },
};
