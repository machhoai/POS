import type { ReceiptSettings, ReceiptTheme } from "@/features/receipt/types/receipt";
import type { RemotePosReceiptSettings } from "@/lib/types/deviceEnrollment";

export function mapRemoteReceiptSettings(
  remote: RemotePosReceiptSettings,
): ReceiptSettings {
  return {
    paperSize: remote.paper_size,
    theme: remote.theme,
    themeMessages: remote.theme_messages as Record<ReceiptTheme, string>,
    themeMessageFontSizePt: remote.theme_message_font_size_pt,
    storeName: remote.store_name,
    storeAddress: remote.store_address,
    hotline: remote.hotline,
    afterSalesText: remote.after_sales_text,
    footerMessage: remote.footer_message,
    logoDataUrl: remote.logo_data_url,
    logoWidthMm: remote.logo_width_mm,
    logoMaxHeightMm: remote.logo_max_height_mm,
    logoContrastPercent: remote.logo_contrast_percent,
    invoiceQrSizeMm: remote.invoice_qr_size_mm,
    invoiceQrTitleFontSizePt: remote.invoice_qr_title_font_size_pt,
    invoiceQrHintFontSizePt: remote.invoice_qr_hint_font_size_pt,
    fontWeights: remote.font_weights,
    showLogo: remote.show_logo,
    showCashier: remote.show_cashier,
    showContact: remote.show_contact,
    showItemTax: remote.show_item_tax,
    showInvoiceRequestQr: remote.show_invoice_request_qr,
    showThemeMessage: remote.show_theme_message,
    defaultTaxRate: remote.default_tax_rate,
  };
}
