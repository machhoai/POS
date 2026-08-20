import { usePrinterSettingsStore } from "@/features/printer/store/usePrinterSettingsStore";
import type {
  LocalPrinter,
  PrintDispatchResult,
  SilentPrintPage,
} from "@/features/printer/types/printer";
import { showWarning } from "@/lib/utils/toast";

const FALLBACK_NOTICE_COOLDOWN_MS = 10_000;
const CALIBRATION_PAGE_WIDTH_MM = 80;
const SP01_MAX_CUSTOM_MEDIA_WIDTH_MM = 72;
// Keep the page taller than it is wide. A landscape-shaped custom page can
// make some Windows thermal-printer drivers rotate it despite WebView2 being
// configured for portrait printing.
const CALIBRATION_PAGE_HEIGHT_MM = 100;
let lastFallbackNoticeAt = 0;
let lastFallbackPrinterName = "";

function isSp01Printer(printerName: string): boolean {
  return /(?:sapo\s*)?sp[\s_-]*0?1|xp[\s_-]*80c|bt[\s_-]*t080/i.test(printerName);
}

/**
 * XP-80C exposes only 72.07 mm of custom media on a physical 80 mm roll.
 * Other printers retain their configured width unchanged.
 */
export function resolveLocalPrinterPageWidthMm(configuredWidthMm: number): number {
  const printerName = usePrinterSettingsStore.getState().selectedPrinterName;
  if (!printerName || !isSp01Printer(printerName)) return configuredWidthMm;
  return Math.min(configuredWidthMm, SP01_MAX_CUSTOM_MEDIA_WIDTH_MM);
}

async function waitForPrintLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

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

/**
 * Prints a diagnostic sheet whose first black bar starts at page Y=0.
 * Any paper before that bar is introduced by the Windows driver or the
 * physical distance between the print head and cutter, not by JPOS layout.
 */
export async function printTopMarginCalibration(): Promise<PrintDispatchResult> {
  const pageWidthMm = resolveLocalPrinterPageWidthMm(CALIBRATION_PAGE_WIDTH_MM);
  const rootId = `pos-printer-calibration-${crypto.randomUUID()}`;
  const rootElement = document.createElement("div");
  const printStyle = document.createElement("style");

  rootElement.id = rootId;
  rootElement.setAttribute("aria-hidden", "true");
  Object.assign(rootElement.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${pageWidthMm}mm`,
    height: `${CALIBRATION_PAGE_HEIGHT_MM}mm`,
    margin: "0",
    padding: "0",
    overflow: "hidden",
    background: "#fff",
    color: "#000",
    fontFamily: "Arial, Helvetica, sans-serif",
  });

  const markerLines = [10, 20, 30, 40]
    .map((positionMm) => `
      <div style="position:absolute;left:3mm;right:3mm;top:${positionMm}mm;border-top:0.3mm dashed #000">
        <span style="position:absolute;right:0;top:0.8mm;background:#fff;padding-left:1mm;font-size:7pt;font-weight:700">
          ${positionMm} mm tính từ vạch 0
        </span>
      </div>
    `)
    .join("");

  rootElement.innerHTML = `
    <div style="position:absolute;inset:0 auto auto 0;width:100%;height:2mm;background:#000"></div>
    <div style="position:absolute;left:3mm;right:3mm;top:3mm;text-align:center;font-size:9pt;font-weight:800;line-height:1.2">
      VẠCH ĐEN PHÍA TRÊN ĐƯỢC ĐẶT TẠI 0 MM
    </div>
    ${markerLines}
    <div style="position:absolute;left:3mm;right:3mm;bottom:3mm;text-align:center;font-size:7pt;line-height:1.25">
      Đo khoảng trắng từ mép cắt đến vạch đen.<br />JPOS không thêm lề vào mẫu kiểm tra này.
    </div>
  `;

  printStyle.textContent = `
    @page { size: ${pageWidthMm}mm ${CALIBRATION_PAGE_HEIGHT_MM}mm; margin: 0; }
    @media print {
      html, body {
        width: ${pageWidthMm}mm !important;
        height: ${CALIBRATION_PAGE_HEIGHT_MM}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      body > * { display: none !important; }
      body > #${rootId} {
        display: block !important;
        position: static !important;
        width: ${pageWidthMm}mm !important;
        height: ${CALIBRATION_PAGE_HEIGHT_MM}mm !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        background: #fff !important;
      }
      *, *::before, *::after {
        box-sizing: border-box;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `;

  document.body.appendChild(rootElement);
  document.head.appendChild(printStyle);

  try {
    await waitForPrintLayout();
    return await printCurrentDocumentSilently({
      pageWidthMm,
      pageHeightMm: CALIBRATION_PAGE_HEIGHT_MM,
    });
  } finally {
    printStyle.remove();
    rootElement.remove();
  }
}
