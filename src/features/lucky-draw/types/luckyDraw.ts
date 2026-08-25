import type { ReceiptPaperSize } from "@/features/receipt/types/receipt";
import type { PosOrder } from "@/lib/types/order";

export interface LuckyDrawSettingsInput {
  warehouseId: string;
  enabled: boolean;
  paperSize: ReceiptPaperSize;
  programName: string;
  ticketTitle: string;
  message: string;
  footerMessage: string;
  packageTicketCounts: Record<string, number>;
}

export interface LuckyDrawSettings extends LuckyDrawSettingsInput {
  version: number;
  updatedAt: string;
  updatedByUid: string;
}

export interface PrintableLuckyDrawTicket {
  orderId: string;
  customerName: string;
  customerPhone: string;
  purchasedAt: string;
  goodsName: string;
  sequence: number;
  totalForOrder: number;
}

export interface LuckyDrawTicketDocumentProps {
  ticket: PrintableLuckyDrawTicket;
  settings: LuckyDrawSettingsInput;
  printableWidthMm?: number;
  topMarginMm?: number;
}

export interface LuckyDrawBatchDocumentProps {
  order: PosOrder;
  settings: LuckyDrawSettingsInput;
  printableWidthMm?: number;
  topMarginMm?: number;
}
