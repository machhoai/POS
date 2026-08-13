"use client";

import { useCallback, useState } from "react";
import { Printer } from "lucide-react";
import { printCurrentDocumentSilently } from "@/features/printer/services/printerService";
import ReceiptDocument from "@/features/receipt/components/ReceiptDocument";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import { buildInvoiceRequestUrl } from "@/features/receipt/helpers/invoiceRequestUrl";
import { useReceiptSettingsStore } from "@/features/receipt/store/useReceiptSettingsStore";
import type { ReceiptLanguage, ReceiptSettings } from "@/features/receipt/types/receipt";
import { fetchOrderForReceipt } from "@/lib/services/orderService";
import type { PosOrder } from "@/lib/types/order";
import { showError } from "@/lib/utils/toast";

type ReceiptPrintMode = "silent" | "dialog";

interface ReceiptPrintButtonProps {
  order: PosOrder;
  settings?: ReceiptSettings;
  label?: string;
  className?: string;
  invoiceRequestUrlOverride?: string;
  printMode?: ReceiptPrintMode;
  language?: ReceiptLanguage;
}

async function waitForImages(container: ParentNode): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

async function waitForReceiptAssets(container: ParentNode): Promise<void> {
  const ownerDocument = container.nodeType === 9
    ? (container as Document)
    : (container as Node).ownerDocument;
  if (!ownerDocument) {
    throw new Error("Không thể xác định tài liệu chứa biên lai.");
  }

  await new Promise((resolve) => window.setTimeout(resolve, 120));
  await Promise.all([ownerDocument.fonts?.ready, waitForImages(container)]);
  await new Promise<void>((resolve) => {
    (ownerDocument.defaultView ?? window).requestAnimationFrame(() => resolve());
  });
}

async function resolveOrderForPrint(
  order: PosOrder,
  settings: ReceiptSettings,
  invoiceRequestUrlOverride?: string,
): Promise<PosOrder> {
  if (
    invoiceRequestUrlOverride ||
    !settings.showInvoiceRequestQr ||
    buildInvoiceRequestUrl(order)
  ) {
    return order;
  }

  let refreshedOrder: PosOrder;
  try {
    refreshedOrder = await fetchOrderForReceipt(order.localOrderId);
  } catch (error: unknown) {
    console.error("[Biên lai] Không thể tải lại đơn để tạo mã QR:", error);
    throw new Error(
      "Không thể tải mã QR yêu cầu xuất hóa đơn. Vui lòng kiểm tra kết nối và thử lại.",
    );
  }

  if (!buildInvoiceRequestUrl(refreshedOrder)) {
    throw new Error(
      "Đơn hàng chưa có mã QR yêu cầu xuất hóa đơn hợp lệ.",
    );
  }
  return refreshedOrder;
}

export function describeReceiptPrintError(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

/** Open the operating-system print dialog. Reserved for receipt test printing. */
export async function printReceiptWithDialog(
  order: PosOrder,
  settings: ReceiptSettings,
  invoiceRequestUrlOverride?: string,
  language: ReceiptLanguage = "vi",
): Promise<void> {
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Biên lai đang in thử");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error("Không thể khởi tạo vùng in thử biên lai.");
  }

  printDocument.open();
  printDocument.write(`<!doctype html><html lang="${language === "zh" ? "zh-CN" : language}"><head><meta charset="utf-8"><style>
    @page { size: ${profile.paperWidthMm}mm auto; margin: 0; }
    html, body { width: ${profile.paperWidthMm}mm; margin: 0; padding: 0; background: #fff; }
    *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style></head><body></body></html>`);
  printDocument.close();

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(printDocument.body);
  root.render(
    <ReceiptDocument
      order={order}
      settings={settings}
      language={language}
      invoiceRequestUrlOverride={invoiceRequestUrlOverride}
    />,
  );

  await waitForReceiptAssets(printDocument);
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    root.unmount();
    frame.remove();
  };
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.focus();
  printWindow.print();
  window.setTimeout(cleanup, 300_000);
}

/** Print directly to the Windows default printer without opening print UI. */
export async function printReceiptSilently(
  order: PosOrder,
  settings: ReceiptSettings,
  invoiceRequestUrlOverride?: string,
  language: ReceiptLanguage = "vi",
): Promise<void> {
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const rootId = `pos-silent-receipt-${crypto.randomUUID()}`;
  const rootElement = document.createElement("div");
  const printStyle = document.createElement("style");
  rootElement.id = rootId;
  rootElement.setAttribute("aria-hidden", "true");
  rootElement.style.position = "fixed";
  rootElement.style.left = "-10000px";
  rootElement.style.top = "0";
  rootElement.style.width = `${profile.paperWidthMm}mm`;
  rootElement.style.background = "#fff";
  document.body.appendChild(rootElement);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(rootElement);

  try {
    root.render(
      <ReceiptDocument
        order={order}
        settings={settings}
        language={language}
        invoiceRequestUrlOverride={invoiceRequestUrlOverride}
      />,
    );
    await waitForReceiptAssets(rootElement);

    const receiptHeightPx = Math.max(
      rootElement.scrollHeight,
      rootElement.getBoundingClientRect().height,
    );
    const pageHeightMm = Math.max(
      30,
      Math.min(2_000, receiptHeightPx * (25.4 / 96) + 3),
    );

    printStyle.textContent = `
      @page { size: ${profile.paperWidthMm}mm ${pageHeightMm}mm; margin: 0; }
      @media print {
        html, body {
          width: ${profile.paperWidthMm}mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
        }
        body > * { display: none !important; }
        body > #${rootId} {
          display: block !important;
          position: static !important;
          width: ${profile.paperWidthMm}mm !important;
          margin: 0 !important;
          background: #fff !important;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `;
    document.head.appendChild(printStyle);

    console.info("[Biên lai] Gửi lệnh in trực tiếp", {
      localOrderId: order.localOrderId,
      paperSize: settings.paperSize,
      pageHeightMm,
    });
    const dispatch = await printCurrentDocumentSilently({
      pageWidthMm: profile.paperWidthMm,
      pageHeightMm,
    });
    console.info("[Biên lai] Máy in đã nhận lệnh", {
      localOrderId: order.localOrderId,
      printerName: dispatch.effectivePrinterName,
      usedFallback: dispatch.usedFallback,
    });
  } finally {
    root.unmount();
    printStyle.remove();
    rootElement.remove();
  }
}

const ReceiptPrintButton: React.FC<ReceiptPrintButtonProps> = ({
  order,
  settings: settingsOverride,
  label = "In biên lai",
  className = "",
  invoiceRequestUrlOverride,
  printMode = "silent",
  language = "vi",
}) => {
  const storedSettings = useReceiptSettingsStore((state) => state.settings);
  const [isPrinting, setIsPrinting] = useState(false);
  const settings = settingsOverride || storedSettings;

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      const printableOrder = await resolveOrderForPrint(
        order,
        settings,
        invoiceRequestUrlOverride,
      );
      if (printMode === "dialog") {
        await printReceiptWithDialog(
          printableOrder,
          settings,
          invoiceRequestUrlOverride,
          language,
        );
      } else {
        await printReceiptSilently(
          printableOrder,
          settings,
          invoiceRequestUrlOverride,
          language,
        );
      }
    } catch (error: unknown) {
      console.error("[Biên lai] Không thể in:", error);
      showError(
        printMode === "dialog" ? "Không thể mở bản in thử" : "Không thể in biên lai",
        describeReceiptPrintError(
          error,
          printMode === "dialog"
            ? "Không thể chuẩn bị bản in thử. Vui lòng thử lại."
            : "Không thể gửi biên lai tới máy in. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsPrinting(false);
    }
  }, [invoiceRequestUrlOverride, language, order, printMode, settings]);

  return (
    <button
      type="button"
      onClick={() => void handlePrint()}
      disabled={isPrinting}
      className={className}
    >
      <Printer className="size-4" aria-hidden="true" />
      {isPrinting
        ? printMode === "dialog"
          ? "Đang mở bản in thử..."
          : "Đang in..."
        : label}
    </button>
  );
};

export default ReceiptPrintButton;
