"use client";

import { useCallback, useState } from "react";
import { TicketCheck } from "lucide-react";
import { printCurrentDocumentSilently } from "@/features/printer/services/printerService";
import TicketBatchDocument from "@/features/ticket/components/TicketBatchDocument";
import TicketDocument from "@/features/ticket/components/TicketDocument";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import { buildPrintableTickets } from "@/features/ticket/helpers/buildPrintableTickets";
import { useTicketSettingsStore } from "@/features/ticket/store/useTicketSettingsStore";
import type { PrintableTicket, TicketSettings } from "@/features/ticket/types/ticket";
import type { PosOrder } from "@/lib/types/order";
import { showError } from "@/lib/utils/toast";

type TicketPrintMode = "silent" | "dialog";

interface TicketPrintButtonProps {
  order: PosOrder;
  settings?: TicketSettings;
  label?: string;
  className?: string;
  printMode?: TicketPrintMode;
}

async function waitForAssets(container: ParentNode): Promise<void> {
  const ownerDocument = container.nodeType === 9
    ? (container as Document)
    : (container as Node).ownerDocument;
  if (!ownerDocument) throw new Error("Không thể xác định tài liệu chứa vé.");
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all([
    ownerDocument.fonts?.ready,
    ...images.map(async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  ]);
  await new Promise<void>((resolve) => {
    (ownerDocument.defaultView ?? window).requestAnimationFrame(() => resolve());
  });
}

async function printWithDialog(
  content: React.ReactNode,
  settings: TicketSettings,
): Promise<void> {
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "Vé đang in thử");
  Object.assign(frame.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    right: "0",
    bottom: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error("Không thể khởi tạo vùng in thử vé.");
  }

  printDocument.open();
  printDocument.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
    @page { size: ${profile.paperWidthMm}mm ${settings.ticketHeightMm}mm; margin: 0; }
    html, body { width: ${profile.paperWidthMm}mm; margin: 0; padding: 0; background: #fff; }
    *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    [data-ticket-page]:last-child { page-break-after: auto !important; break-after: auto !important; }
  </style></head><body></body></html>`);
  printDocument.close();

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(printDocument.body);
  root.render(content);
  await waitForAssets(printDocument);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.unmount();
    frame.remove();
  };
  printWindow.addEventListener("afterprint", cleanup, { once: true });
  printWindow.focus();
  printWindow.print();
  window.setTimeout(cleanup, 300_000);
}

export async function printTicketPreviewWithDialog(
  ticket: PrintableTicket,
  settings: TicketSettings,
): Promise<void> {
  await printWithDialog(<TicketDocument ticket={ticket} settings={settings} />, settings);
}

export async function printTicketsWithDialog(
  order: PosOrder,
  settings: TicketSettings,
): Promise<void> {
  if (buildPrintableTickets(order).length === 0) {
    throw new Error("Đơn hàng này không có vé để in.");
  }
  await printWithDialog(<TicketBatchDocument order={order} settings={settings} />, settings);
}

export async function printTicketsSilently(
  order: PosOrder,
  settings: TicketSettings,
): Promise<void> {
  const ticketCount = buildPrintableTickets(order).length;
  if (ticketCount === 0) return;

  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const rootId = `pos-silent-tickets-${crypto.randomUUID()}`;
  const rootElement = document.createElement("div");
  const printStyle = document.createElement("style");
  rootElement.id = rootId;
  rootElement.setAttribute("aria-hidden", "true");
  Object.assign(rootElement.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${profile.paperWidthMm}mm`,
    background: "#fff",
  });
  document.body.appendChild(rootElement);

  const { createRoot } = await import("react-dom/client");
  const root = createRoot(rootElement);
  try {
    root.render(<TicketBatchDocument order={order} settings={settings} />);
    await waitForAssets(rootElement);
    printStyle.textContent = `
      @page { size: ${profile.paperWidthMm}mm ${settings.ticketHeightMm}mm; margin: 0; }
      @media print {
        html, body { width: ${profile.paperWidthMm}mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
        body > * { display: none !important; }
        body > #${rootId} { display: block !important; position: static !important; width: ${profile.paperWidthMm}mm !important; margin: 0 !important; background: #fff !important; }
        [data-ticket-page] { page-break-after: always !important; break-after: page !important; }
        [data-ticket-page]:last-child { page-break-after: auto !important; break-after: auto !important; }
        *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `;
    document.head.appendChild(printStyle);
    const dispatch = await printCurrentDocumentSilently({
      pageWidthMm: profile.paperWidthMm,
      pageHeightMm: settings.ticketHeightMm,
    });
    console.info("[Vé] Máy in đã nhận lệnh", {
      localOrderId: order.localOrderId,
      ticketCount,
      printerName: dispatch.effectivePrinterName,
      usedFallback: dispatch.usedFallback,
    });
  } finally {
    root.unmount();
    printStyle.remove();
    rootElement.remove();
  }
}

const TicketPrintButton: React.FC<TicketPrintButtonProps> = ({
  order,
  settings: settingsOverride,
  label = "In vé",
  className = "",
  printMode = "silent",
}) => {
  const storedSettings = useTicketSettingsStore((state) => state.settings);
  const [isPrinting, setIsPrinting] = useState(false);
  const settings = settingsOverride || storedSettings;
  const ticketCount = buildPrintableTickets(order).length;

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      if (printMode === "dialog") await printTicketsWithDialog(order, settings);
      else await printTicketsSilently(order, settings);
    } catch (error: unknown) {
      console.error("[Vé] Không thể in:", error);
      showError(
        printMode === "dialog" ? "Không thể mở bản in thử" : "Không thể in vé",
        error instanceof Error ? error.message : "Vui lòng kiểm tra máy in và thử lại.",
      );
    } finally {
      setIsPrinting(false);
    }
  }, [order, printMode, settings]);

  return (
    <button
      type="button"
      onClick={() => void handlePrint()}
      disabled={isPrinting || ticketCount === 0}
      className={className}
      title={ticketCount === 0 ? "Đơn hàng không có vé" : `In ${ticketCount} vé`}
    >
      <TicketCheck className="size-4" aria-hidden="true" />
      {isPrinting ? "Đang in vé..." : `${label}${ticketCount > 0 ? ` (${ticketCount})` : ""}`}
    </button>
  );
};

export default TicketPrintButton;
