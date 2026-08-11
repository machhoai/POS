import type { PosOrder } from "@/lib/types/order";

export type ReceiptPaperSize = "POS58" | "POS80" | "POS82";
export type ReceiptTheme = "CLASSIC" | "NATIONAL_DAY" | "TET";
export type ReceiptFontWeight = 400 | 500 | 600 | 700 | 800 | 900;
export type ReceiptLanguage = "vi" | "en" | "zh";

export interface ReceiptFontWeights {
  storeName: ReceiptFontWeight;
  storeDetails: ReceiptFontWeight;
  receiptTitle: ReceiptFontWeight;
  orderInfo: ReceiptFontWeight;
  tableHeader: ReceiptFontWeight;
  itemName: ReceiptFontWeight;
  itemDetails: ReceiptFontWeight;
  itemTax: ReceiptFontWeight;
  summary: ReceiptFontWeight;
  taxTotal: ReceiptFontWeight;
  grandTotal: ReceiptFontWeight;
  invoiceQrTitle: ReceiptFontWeight;
  invoiceQrHint: ReceiptFontWeight;
  themeMessage: ReceiptFontWeight;
  footer: ReceiptFontWeight;
  decoration: ReceiptFontWeight;
}

export interface ReceiptPaperProfile {
  id: ReceiptPaperSize;
  label: string;
  paperWidthMm: number;
  printableWidthMm: number;
  description: string;
}

export interface ReceiptSettings {
  paperSize: ReceiptPaperSize;
  theme: ReceiptTheme;
  themeMessages: Record<ReceiptTheme, string>;
  themeMessageFontSizePt: number;
  storeName: string;
  storeAddress: string;
  hotline: string;
  afterSalesText: string;
  footerMessage: string;
  logoDataUrl: string | null;
  logoWidthMm: number;
  logoMaxHeightMm: number;
  logoContrastPercent: number;
  invoiceQrSizeMm: number;
  invoiceQrTitleFontSizePt: number;
  invoiceQrHintFontSizePt: number;
  fontWeights: ReceiptFontWeights;
  showLogo: boolean;
  showCashier: boolean;
  showContact: boolean;
  showItemTax: boolean;
  showInvoiceRequestQr: boolean;
  showThemeMessage: boolean;
  defaultTaxRate: number;
}

export interface ReceiptDocumentProps {
  order: PosOrder;
  settings: ReceiptSettings;
  language?: ReceiptLanguage;
  /** Chỉ dùng cho bản xem trước; đơn thật tự dựng URL từ token đã ký. */
  invoiceRequestUrlOverride?: string;
}
