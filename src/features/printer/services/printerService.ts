import { usePrinterSettingsStore } from "@/features/printer/store/usePrinterSettingsStore";
import type {
  LocalPrinter,
  PrintDispatchResult,
  SilentPrintPage,
} from "@/features/printer/types/printer";
import { showWarning } from "@/lib/utils/toast";

const FALLBACK_NOTICE_COOLDOWN_MS = 10_000;
let lastFallbackNoticeAt = 0;
let lastFallbackPrinterName = "";

export async function listLocalPrinters(): Promise<LocalPrinter[]> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) {
    throw new Error("Danh sách máy in chỉ khả dụng trong ứng dụng JPOS desktop.");
  }
  return invoke<LocalPrinter[]>("list_printers");
}

export async function printCurrentDocumentSilently({
  pageWidthMm,
  pageHeightMm,
}: SilentPrintPage): Promise<PrintDispatchResult> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) {
    throw new Error("In trực tiếp chỉ khả dụng trong ứng dụng JPOS desktop.");
  }

  const printerName = usePrinterSettingsStore.getState().selectedPrinterName;
  const result = await invoke<PrintDispatchResult>("print_receipt_silent", {
    pageWidthMm,
    pageHeightMm,
    printerName,
  });

  if (result.usedFallback && result.requestedPrinterName) {
    const now = Date.now();
    const isDuplicate =
      result.effectivePrinterName === lastFallbackPrinterName
      && now - lastFallbackNoticeAt < FALLBACK_NOTICE_COOLDOWN_MS;
    if (!isDuplicate) {
      lastFallbackNoticeAt = now;
      lastFallbackPrinterName = result.effectivePrinterName;
      showWarning(
        "Máy in đã chọn mất kết nối",
        `Tài liệu đã được chuyển sang máy in mặc định “${result.effectivePrinterName}”.`,
      );
    }
  }

  return result;
}
