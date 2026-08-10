import type { ReceiptSettings, ReceiptTheme } from "@/features/receipt/types/receipt";
import type {
  RemotePosReceiptSettings,
  RemotePosReceiptSettingsPayload,
} from "@/lib/types/deviceEnrollment";

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

export function mapReceiptSettingsToRemote(
  settings: ReceiptSettings,
): RemotePosReceiptSettingsPayload {
  return {
    paper_size: settings.paperSize,
    theme: settings.theme,
    theme_messages: settings.themeMessages,
    theme_message_font_size_pt: settings.themeMessageFontSizePt,
    store_name: settings.storeName,
    store_address: settings.storeAddress,
    hotline: settings.hotline,
    after_sales_text: settings.afterSalesText,
    footer_message: settings.footerMessage,
    logo_data_url: settings.logoDataUrl,
    logo_width_mm: settings.logoWidthMm,
    logo_max_height_mm: settings.logoMaxHeightMm,
    logo_contrast_percent: settings.logoContrastPercent,
    invoice_qr_size_mm: settings.invoiceQrSizeMm,
    invoice_qr_title_font_size_pt: settings.invoiceQrTitleFontSizePt,
    invoice_qr_hint_font_size_pt: settings.invoiceQrHintFontSizePt,
    font_weights: settings.fontWeights,
    show_logo: settings.showLogo,
    show_cashier: settings.showCashier,
    show_contact: settings.showContact,
    show_item_tax: settings.showItemTax,
    show_invoice_request_qr: settings.showInvoiceRequestQr,
    show_theme_message: settings.showThemeMessage,
    default_tax_rate: settings.defaultTaxRate,
  };
}
