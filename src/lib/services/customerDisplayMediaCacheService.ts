import type { CustomerDisplayAdvertisingMedia } from "@/lib/types/customerDisplayAdvertising";
import { loadDeviceCredential } from "@/lib/services/deviceEnrollmentService";

const DB_NAME = "jpos-customer-display-media";
const STORE_NAME = "media";
const DB_VERSION = 1;
const API_BASE_URL = process.env.NEXT_PUBLIC_JPULSE_API_URL || "http://api.wms.localhost";

interface CachedMedia {
  id: string;
  checksum: string;
  blob: Blob;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    operation(transaction.objectStore(STORE_NAME), resolve, reject);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getCachedCustomerDisplayMedia = (id: string): Promise<CachedMedia | null> =>
  runTransaction("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as CachedMedia | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

const saveCachedMedia = (value: CachedMedia): Promise<void> =>
  runTransaction("readwrite", (store, resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

export async function cacheCustomerDisplayMedia(media: CustomerDisplayAdvertisingMedia): Promise<void> {
  const current = await getCachedCustomerDisplayMedia(media.id);
  if (current?.checksum === media.checksum_sha256) return;
  const credential = await loadDeviceCredential();
  if (!credential) throw new Error("Máy JPOS chưa được kích hoạt để tải quảng cáo.");
  const response = await fetch(
    `${API_BASE_URL}/api/pos/devices/customer-display-media/${media.id}/content`,
    {
      cache: "no-store",
      headers: {
        "X-Pos-Device-Id": credential.device_id,
        "X-Pos-Device-Credential": credential.device_credential,
      },
    },
  );
  if (!response.ok) throw new Error(`Không thể tải media quảng cáo ${media.file_name}.`);
  await saveCachedMedia({ id: media.id, checksum: media.checksum_sha256, blob: await response.blob() });
}

export async function removeObsoleteCustomerDisplayMedia(activeIds: Set<string>): Promise<void> {
  await runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve();
      if (!activeIds.has(String(cursor.key))) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}
