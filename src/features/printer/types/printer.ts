export type PrinterStatus = "READY" | "BUSY" | "PAUSED" | "OFFLINE" | "ERROR";

export interface LocalPrinter {
  name: string;
  isDefault: boolean;
  isAvailable: boolean;
  status: PrinterStatus;
}

export interface PrintDispatchResult {
  requestedPrinterName: string | null;
  effectivePrinterName: string;
  usedFallback: boolean;
}

export interface SilentPrintPage {
  pageWidthMm: number;
  pageHeightMm: number;
}
