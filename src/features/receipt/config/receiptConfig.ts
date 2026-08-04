import type {
  ReceiptPaperProfile,
  ReceiptPaperSize,
  ReceiptFontWeight,
  ReceiptSettings,
  ReceiptTheme,
} from "@/features/receipt/types/receipt";

export const RECEIPT_PAPER_PROFILES: Record<ReceiptPaperSize, ReceiptPaperProfile> = {
  POS58: {
    id: "POS58",
    label: "POS58",
    paperWidthMm: 58,
    printableWidthMm: 58,
    description: "Nhỏ gọn · vùng in 58 mm",
  },
  POS80: {
    id: "POS80",
    label: "POS80",
    paperWidthMm: 80,
    printableWidthMm: 80,
    description: "Phổ biến · vùng in 80 mm",
  },
  POS82: {
    id: "POS82",
    label: "POS82",
    paperWidthMm: 82,
    printableWidthMm: 82,
    description: "Khổ rộng · vùng in tối đa 82 mm",
  },
};

export const RECEIPT_THEMES: Array<{
  id: ReceiptTheme;
  label: string;
  description: string;
  defaultMessage: string;
}> = [
  {
    id: "CLASSIC",
    label: "Mặc định",
    description: "Sạch, rõ và tiết kiệm giấy",
    defaultMessage: "",
  },
  {
    id: "NATIONAL_DAY",
    label: "Quốc khánh 2/9",
    description: "Ngôi sao và khung đôi đơn sắc",
    defaultMessage: "Chúc mừng ngày Quốc khánh 2/9",
  },
  {
    id: "TET",
    label: "Tết",
    description: "Hoa văn hình thoi tối giản",
    defaultMessage: "Chúc mừng năm mới – An khang thịnh vượng",
  },
];

export const RECEIPT_FONT_WEIGHT_OPTIONS: Array<{
  value: ReceiptFontWeight;
  label: string;
}> = [
  { value: 400, label: "Mảnh" },
  { value: 500, label: "Vừa" },
  { value: 600, label: "Hơi đậm" },
  { value: 700, label: "Đậm" },
  { value: 800, label: "Rất đậm" },
  { value: 900, label: "Đậm tối đa" },
];

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperSize: "POS80",
  theme: "CLASSIC",
  themeMessages: {
    CLASSIC: "",
    NATIONAL_DAY: "Chúc mừng ngày Quốc khánh 2/9",
    TET: "Chúc mừng năm mới – An khang thịnh vượng",
  },
  themeMessageFontSizePt: 10,
  storeName: "JOY POS",
  storeAddress: "Địa chỉ cửa hàng",
  hotline: "1900 0000",
  afterSalesText: "Hỗ trợ sau bán hàng: vui lòng giữ lại biên lai này.",
  footerMessage: "Cảm ơn Quý khách và hẹn gặp lại!",
  logoDataUrl: null,
  logoWidthMm: 24,
  logoMaxHeightMm: 18,
  logoContrastPercent: 125,
  invoiceQrSizeMm: 34,
  invoiceQrTitleFontSizePt: 9,
  invoiceQrHintFontSizePt: 8,
  fontWeights: {
    storeName: 800,
    storeDetails: 400,
    receiptTitle: 800,
    orderInfo: 400,
    tableHeader: 800,
    itemName: 700,
    itemDetails: 400,
    itemTax: 400,
    summary: 400,
    taxTotal: 700,
    grandTotal: 900,
    invoiceQrTitle: 700,
    invoiceQrHint: 400,
    themeMessage: 700,
    footer: 700,
    decoration: 700,
  },
  showLogo: true,
  showCashier: true,
  showContact: true,
  showItemTax: true,
  showInvoiceRequestQr: true,
  showThemeMessage: true,
  defaultTaxRate: 10,
};
