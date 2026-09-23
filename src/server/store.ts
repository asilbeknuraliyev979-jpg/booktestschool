import fs from "fs";
import path from "path";
import { Book, StudentTestResult, TestDeliveryConfig } from "../types";
import { INITIAL_BOOKS } from "../data/initialBooks";

interface AppStorageData {
  books: Book[];
  results: StudentTestResult[];
  deliveryConfig: TestDeliveryConfig;
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
        }
        if (Array.isArray(parsed.results)) {
          inMemoryData.results = parsed.results;
        }
        if (parsed.deliveryConfig) {
          inMemoryData.deliveryConfig = { ...DEFAULT_CONFIG, ...parsed.deliveryConfig };
        }
      }
    }
  } catch (err) {
    console.warn("Could not load storage from disk, using in-memory state:", err);
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
  getBooks(): Book[] {
    return inMemoryData.books;
  },
  saveBooks(books: Book[]): Book[] {
    inMemoryData.books = books;
    saveToDisk();
    return inMemoryData.books;
  },
  getResults(): StudentTestResult[] {
    return inMemoryData.results;
  },
  addResult(result: StudentTestResult): StudentTestResult {
    inMemoryData.results = [result, ...inMemoryData.results];
    saveToDisk();
    return result;
  },
  clearResults(): void {
    inMemoryData.results = [];
    saveToDisk();
  },
  deleteResult(resultId: string): void {
    inMemoryData.results = inMemoryData.results.filter((r) => r.id !== resultId);
    saveToDisk();
  },
  getDeliveryConfig(): TestDeliveryConfig {
    return inMemoryData.deliveryConfig;
  },
  saveDeliveryConfig(config: TestDeliveryConfig): TestDeliveryConfig {
    inMemoryData.deliveryConfig = { ...inMemoryData.deliveryConfig, ...config };
    saveToDisk();
    return inMemoryData.deliveryConfig;
  },
};
