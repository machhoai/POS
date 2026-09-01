"use client";

import { useCallback, useState } from "react";
import { Gift } from "lucide-react";
import LuckyDrawBatchDocument from "@/features/lucky-draw/components/LuckyDrawBatchDocument";
import LuckyDrawTicketDocument from "@/features/lucky-draw/components/LuckyDrawTicketDocument";
import { LUCKY_DRAW_TICKET_HEIGHT_MM } from "@/features/lucky-draw/config/luckyDrawConfig";
import { buildPrintableLuckyDrawTickets } from "@/features/lucky-draw/helpers/buildPrintableLuckyDrawTickets";
import { useLuckyDrawSettingsStore } from "@/features/lucky-draw/store/useLuckyDrawSettingsStore";
import type {
  LuckyDrawSettingsInput,
  PrintableLuckyDrawTicket,
} from "@/features/lucky-draw/types/luckyDraw";
import {
  printCurrentDocumentSilently,
  resolveLocalPrinterPageWidthMm,
} from "@/features/printer/services/printerService";
import { usePrinterSettingsStore } from "@/features/printer/store/usePrinterSettingsStore";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import type { PosOrder } from "@/lib/types/order";
import { logCheckoutTelemetry } from "@/lib/services/checkoutTelemetryService";
import { showError } from "@/lib/utils/toast";

type LuckyDrawPrintMode = "silent" | "dialog";

interface LuckyDrawPrintButtonProps {
  order: PosOrder;
  settings?: LuckyDrawSettingsInput;
  label?: string;
  className?: string;
  printMode?: LuckyDrawPrintMode;
}

async function waitForAssets(container: ParentNode): Promise<void> {
  const ownerDocument = container.nodeType === 9
    ? container as Document
    : (container as Node).ownerDocument;
  if (!ownerDocument) throw new Error("Không thể xác định tài liệu chứa phiếu.");
  await ownerDocument.fonts?.ready;
  await new Promise<void>((resolve) => {
    (ownerDocument.defaultView ?? window).requestAnimationFrame(() => resolve());
  });
}

async function printWithDialog(
  content: (printableWidthMm: number) => React.ReactNode,
  settings: LuckyDrawSettingsInput,
): Promise<void> {
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const pageWidthMm = resolveLocalPrinterPageWidthMm(profile.printableWidthMm);
  const frame = document.createElement("iframe");
  frame.title = "Phiếu bốc thăm đang in thử";
  Object.assign(frame.style, { position: "fixed", width: "1px", height: "1px", right: "0", bottom: "0", opacity: "0" });
  document.body.appendChild(frame);
  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error("Không thể khởi tạo vùng in phiếu bốc thăm.");
  }
  printDocument.open();
  printDocument.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
    @page { size: ${pageWidthMm}mm ${LUCKY_DRAW_TICKET_HEIGHT_MM}mm; margin: 0; }
    html, body { width: ${pageWidthMm}mm; margin: 0; padding: 0; background: #fff; }
    *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    [data-lucky-draw-ticket-page]:last-child { page-break-after: auto !important; break-after: auto !important; }
  </style></head><body></body></html>`);
  printDocument.close();
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(printDocument.body);
  root.render(content(pageWidthMm));
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

export async function printLuckyDrawPreviewWithDialog(
  ticket: PrintableLuckyDrawTicket,
  settings: LuckyDrawSettingsInput,
): Promise<void> {
  const topMarginMm = usePrinterSettingsStore.getState().topMarginMm;
  await printWithDialog((printableWidthMm) => (
    <LuckyDrawTicketDocument
      ticket={ticket}
      settings={settings}
      printableWidthMm={printableWidthMm}
      topMarginMm={topMarginMm}
    />
  ), settings);
}

export async function printLuckyDrawTicketsWithDialog(
  order: PosOrder,
  settings: LuckyDrawSettingsInput,
): Promise<void> {
  if (buildPrintableLuckyDrawTickets(order).length === 0) {
    throw new Error("Đơn hàng này không có phiếu bốc thăm.");
  }
  const topMarginMm = usePrinterSettingsStore.getState().topMarginMm;
  await printWithDialog((printableWidthMm) => (
    <LuckyDrawBatchDocument
      order={order}
      settings={settings}
      printableWidthMm={printableWidthMm}
      topMarginMm={topMarginMm}
    />
  ), settings);
}

export async function printLuckyDrawTicketsSilently(
  order: PosOrder,
  settings: LuckyDrawSettingsInput,
): Promise<void> {
  const tickets = buildPrintableLuckyDrawTickets(order);
  if (tickets.length === 0) return;
  const profile = RECEIPT_PAPER_PROFILES[settings.paperSize];
  const pageWidthMm = resolveLocalPrinterPageWidthMm(profile.printableWidthMm);
  const topMarginMm = usePrinterSettingsStore.getState().topMarginMm;
  const { createRoot } = await import("react-dom/client");

  for (const ticket of tickets) {
    const rootId = `pos-lucky-draw-${crypto.randomUUID()}`;
    const rootElement = document.createElement("div");
    const printStyle = document.createElement("style");
    rootElement.id = rootId;
    rootElement.setAttribute("aria-hidden", "true");
    Object.assign(rootElement.style, { position: "fixed", left: "-10000px", top: "0", width: `${pageWidthMm}mm`, background: "#fff" });
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);
    try {
      root.render(<LuckyDrawTicketDocument ticket={ticket} settings={settings} printableWidthMm={pageWidthMm} topMarginMm={topMarginMm} />);
      await waitForAssets(rootElement);
      printStyle.textContent = `
        @page { size: ${pageWidthMm}mm ${LUCKY_DRAW_TICKET_HEIGHT_MM}mm; margin: 0; }
        @media print {
          html, body { width: ${pageWidthMm}mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
          body > * { display: none !important; }
          body > #${rootId} { display: block !important; position: static !important; width: ${pageWidthMm}mm !important; margin: 0 !important; background: #fff !important; }
          [data-lucky-draw-ticket-page] { page-break-after: auto !important; break-after: auto !important; }
          *, *::before, *::after { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }`;
      document.head.appendChild(printStyle);
      logCheckoutTelemetry("raffle_dispatched", {
        localOrderId: order.localOrderId,
        orderKind: order.orderKind ?? "MEMBER_PACKAGE",
        warehouseId: order.warehouseId,
        details: {
          sequence: ticket.sequence,
          total: ticket.totalForOrder,
        },
      });
      try {
        const dispatch = await printCurrentDocumentSilently({ pageWidthMm, pageHeightMm: LUCKY_DRAW_TICKET_HEIGHT_MM });
        logCheckoutTelemetry("raffle_completed", {
          localOrderId: order.localOrderId,
          orderKind: order.orderKind ?? "MEMBER_PACKAGE",
          warehouseId: order.warehouseId,
          details: {
            sequence: ticket.sequence,
            total: ticket.totalForOrder,
            printerName: dispatch.effectivePrinterName,
          },
        });
        console.info("[Bốc thăm] Máy in đã nhận phiếu", {
          localOrderId: order.localOrderId,
          sequence: ticket.sequence,
          total: ticket.totalForOrder,
          printerName: dispatch.effectivePrinterName,
        });
      } catch (error: unknown) {
        logCheckoutTelemetry("raffle_failed", {
          localOrderId: order.localOrderId,
          orderKind: order.orderKind ?? "MEMBER_PACKAGE",
          warehouseId: order.warehouseId,
          details: {
            sequence: ticket.sequence,
            total: ticket.totalForOrder,
            errorType: error instanceof Error ? error.name : "UNKNOWN",
          },
        });
        throw error;
      }
    } finally {
      root.unmount();
      printStyle.remove();
      rootElement.remove();
    }
  }
}

const LuckyDrawPrintButton: React.FC<LuckyDrawPrintButtonProps> = ({
  order,
  settings: settingsOverride,
  label = "In phiếu bốc thăm",
  className = "",
  printMode = "silent",
}) => {
  const storedSettings = useLuckyDrawSettingsStore((state) => state.settings);
  const [isPrinting, setIsPrinting] = useState(false);
  const settings = settingsOverride ?? storedSettings;
  const count = buildPrintableLuckyDrawTickets(order).length;
  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      if (printMode === "dialog") await printLuckyDrawTicketsWithDialog(order, settings);
      else await printLuckyDrawTicketsSilently(order, settings);
    } catch (error: unknown) {
      showError(
        "Không thể in phiếu bốc thăm",
        error instanceof Error ? error.message : "Vui lòng kiểm tra máy in và thử lại.",
      );
    } finally {
      setIsPrinting(false);
    }
  }, [order, printMode, settings]);

  return (
    <button type="button" onClick={() => void handlePrint()} disabled={isPrinting || count === 0} className={className} title={count === 0 ? "Đơn hàng không có phiếu bốc thăm" : `In ${count} phiếu bốc thăm`}>
      <Gift className="size-4" aria-hidden="true" />
      {isPrinting ? "Đang in phiếu..." : `${label}${count ? ` (${count})` : ""}`}
    </button>
  );
};

export default LuckyDrawPrintButton;
