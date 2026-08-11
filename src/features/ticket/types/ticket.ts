import type { ReceiptFontWeight, ReceiptPaperSize } from "@/features/receipt/types/receipt";
import type { PosOrder } from "@/lib/types/order";

export interface TicketSettings {
  paperSize: ReceiptPaperSize;
  ticketHeightMm: number;
  storeName: string;
  ticketTitle: string;
  subtitle: string;
  instructions: string;
  footerMessage: string;
  logoDataUrl: string | null;
  logoWidthMm: number;
  logoMaxHeightMm: number;
  logoContrastPercent: number;
  qrSizeMm: number;
  titleFontSizePt: number;
  productFontSizePt: number;
  bodyFontSizePt: number;
  fontWeight: ReceiptFontWeight;
  showLogo: boolean;
  showOrderCode: boolean;
  showIssuedAt: boolean;
  showPrice: boolean;
  showSequence: boolean;
  autoPrintAfterPayment: boolean;
}

export interface PrintableTicket {
  ticketCode: string;
  goodsName: string;
  price: number;
  orderId: string;
  issuedAt: string;
  sequence: number;
  totalForItem: number;
}

export interface TicketDocumentProps {
  ticket: PrintableTicket;
  settings: TicketSettings;
}

export interface TicketBatchDocumentProps {
  order: PosOrder;
  settings: TicketSettings;
}
