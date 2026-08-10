import type {
  CheckoutJournalRecord,
  PendingPosFailure,
  PosFailureKind,
} from "@/lib/types/checkoutRecovery";

const DATABASE_NAME = "jpos_resilience";
const DATABASE_VERSION = 1;
const JOURNAL_STORE = "checkout_journal";
const FAILURE_STORE = "pending_failures";
const ACTIVE_CHECKOUT_ID = "active-checkout";
const MAX_PENDING_FAILURES = 200;

let databasePromise: Promise<IDBDatabase> | null = null;
let journalWriteChain: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB không khả dụng."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(JOURNAL_STORE)) {
        database.createObjectStore(JOURNAL_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(FAILURE_STORE)) {
        database.createObjectStore(FAILURE_STORE, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => {
      databasePromise = null;
      reject(request.error || new Error("Không thể mở kho phục hồi JPOS."));
    });
  });

  return databasePromise;
}

async function runStoreRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
}

export async function loadCheckoutJournal(): Promise<CheckoutJournalRecord | null> {
  try {
    const record = await runStoreRequest<CheckoutJournalRecord | undefined>(
      JOURNAL_STORE,
      "readonly",
      (store) => store.get(ACTIVE_CHECKOUT_ID),
    );
    return record ?? null;
  } catch (error: unknown) {
    console.error("[Phục hồi] Không thể đọc journal thanh toán:", error);
    return null;
  }
}

export function saveCheckoutJournal(record: CheckoutJournalRecord): Promise<void> {
  journalWriteChain = journalWriteChain
    .catch(() => undefined)
    .then(async () => {
      await runStoreRequest<IDBValidKey>(JOURNAL_STORE, "readwrite", (store) =>
        store.put(record),
      );
    })
    .catch((error: unknown) => {
      console.error("[Phục hồi] Không thể lưu journal thanh toán:", error);
    });
  return journalWriteChain;
}

export function clearCheckoutJournal(): Promise<void> {
  journalWriteChain = journalWriteChain
    .catch(() => undefined)
    .then(async () => {
      await runStoreRequest<undefined>(JOURNAL_STORE, "readwrite", (store) =>
        store.delete(ACTIVE_CHECKOUT_ID),
      );
    })
    .catch((error: unknown) => {
      console.error("[Phục hồi] Không thể xóa journal đã hoàn tất:", error);
    });
  return journalWriteChain;
}

function normalizeFailure(error: unknown): Pick<PendingPosFailure, "message" | "stack"> {
  if (error instanceof Error) {
    return {
      message: error.message.slice(0, 500),
      stack: error.stack?.slice(0, 4000) ?? null,
    };
  }
  return { message: String(error).slice(0, 500), stack: null };
}

export async function recordPendingFailure(
  kind: PosFailureKind,
  error: unknown,
  metadata: PendingPosFailure["metadata"] = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = normalizeFailure(error);
  const failure: PendingPosFailure = {
    id: crypto.randomUUID(),
    kind,
    ...normalized,
    route: window.location.pathname || null,
    actionTime: new Date().toISOString(),
    metadata,
  };

  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(FAILURE_STORE, "readwrite");
      const store = transaction.objectStore(FAILURE_STORE);
      store.put(failure);
      const allKeysRequest = store.getAllKeys();
      allKeysRequest.addEventListener("success", () => {
        const overflow = allKeysRequest.result.length - MAX_PENDING_FAILURES;
        if (overflow > 0) {
          allKeysRequest.result.slice(0, overflow).forEach((key) => store.delete(key));
        }
      });
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("abort", () => reject(transaction.error));
      transaction.addEventListener("error", () => reject(transaction.error));
    });
  } catch (writeError: unknown) {
    console.error("[Phục hồi] Không thể lưu lỗi cục bộ:", writeError);
  }
}
