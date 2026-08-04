"use client";

import { useCallback, useState } from "react";
import { Printer } from "lucide-react";
import ReceiptDocument from "@/features/receipt/components/ReceiptDocument";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import { useReceiptSettingsStore } from "@/features/receipt/store/useReceiptSettingsStore";
import type { ReceiptSettings } from "@/features/receipt/types/receipt";
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
  const ownerDocument = container instanceof Document
    ? container
    : (container as Element).ownerDocument;
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  await Promise.all([ownerDocument.fonts?.ready, waitForImages(container)]);
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

/** Open the operating-system print dialog. Reserved for receipt test printing. */
export async function printReceiptWithDialog(
  order: PosOrder,
  settings: ReceiptSettings,
  invoiceRequestUrlOverride?: string,
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
  printDocument.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
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
      invoiceRequestUrlOverride={invoiceRequestUrlOverride}
    />,
  );

  await waitForReceiptAssets(printDocument);
  printWindow.focus();
  printWindow.print();

  window.setTimeout(() => {
    root.unmount();
    frame.remove();
  }, 1_000);
}

/** Print directly to the Windows default printer without opening print UI. */
export async function printReceiptSilently(
  order: PosOrder,
  settings: ReceiptSettings,
  invoiceRequestUrlOverride?: string,
): Promise<void> {
  const { invoke, isTauri } = await import("@tauri-apps/api/core");
  if (!isTauri()) {
    throw new Error("In trực tiếp chỉ khả dụng trong ứng dụng Tauri.");
  }

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
    await invoke("print_receipt_silent", {
      pageWidthMm: profile.paperWidthMm,
      pageHeightMm,
    });
    console.info("[Biên lai] Máy in đã nhận lệnh", {
      localOrderId: order.localOrderId,
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
}) => {
  const storedSettings = useReceiptSettingsStore((state) => state.settings);
  const [isPrinting, setIsPrinting] = useState(false);
  const settings = settingsOverride || storedSettings;

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      if (printMode === "dialog") {
        await printReceiptWithDialog(order, settings, invoiceRequestUrlOverride);
      } else {
        await printReceiptSilently(order, settings, invoiceRequestUrlOverride);
      }
    } catch (error: unknown) {
      console.error("[Biên lai] Không thể in:", error);
      showError(
        printMode === "dialog" ? "Không thể mở bản in thử" : "Không thể in biên lai",
        printMode === "dialog"
          ? "Vui lòng kiểm tra trình in của Windows và thử lại."
          : "Vui lòng kiểm tra máy in mặc định của Windows và thử lại.",
      );
    } finally {
      setIsPrinting(false);
    }
  }, [invoiceRequestUrlOverride, order, printMode, settings]);

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
