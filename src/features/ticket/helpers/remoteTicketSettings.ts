import type { TicketSettings } from "@/features/ticket/types/ticket";
import type {
  RemotePosTicketSettings,
  RemotePosTicketSettingsPayload,
} from "@/lib/types/deviceEnrollment";

export function mapRemoteTicketSettings(
  remote: RemotePosTicketSettings,
): TicketSettings {
  return {
    paperSize: remote.paper_size,
    ticketHeightMm: remote.ticket_height_mm,
    storeName: remote.store_name,
    ticketTitle: remote.ticket_title,
    subtitle: remote.subtitle,
    instructions: remote.instructions,
    footerMessage: remote.footer_message,
    logoDataUrl: remote.logo_data_url,
    logoWidthMm: remote.logo_width_mm,
    logoMaxHeightMm: remote.logo_max_height_mm,
    logoContrastPercent: remote.logo_contrast_percent,
    qrSizeMm: remote.qr_size_mm,
    titleFontSizePt: remote.title_font_size_pt,
    productFontSizePt: remote.product_font_size_pt,
    bodyFontSizePt: remote.body_font_size_pt,
    fontWeight: remote.font_weight,
    showLogo: remote.show_logo,
    showOrderCode: remote.show_order_code,
    showIssuedAt: remote.show_issued_at,
    showPrice: remote.show_price,
    showSequence: remote.show_sequence,
    autoPrintAfterPayment: remote.auto_print_after_payment,
  };
}

export function mapTicketSettingsToRemote(
  settings: TicketSettings,
): RemotePosTicketSettingsPayload {
  return {
    paper_size: settings.paperSize,
    ticket_height_mm: settings.ticketHeightMm,
    store_name: settings.storeName,
    ticket_title: settings.ticketTitle,
    subtitle: settings.subtitle,
    instructions: settings.instructions,
    footer_message: settings.footerMessage,
    logo_data_url: settings.logoDataUrl,
    logo_width_mm: settings.logoWidthMm,
    logo_max_height_mm: settings.logoMaxHeightMm,
    logo_contrast_percent: settings.logoContrastPercent,
    qr_size_mm: settings.qrSizeMm,
    title_font_size_pt: settings.titleFontSizePt,
    product_font_size_pt: settings.productFontSizePt,
    body_font_size_pt: settings.bodyFontSizePt,
    font_weight: settings.fontWeight,
    show_logo: settings.showLogo,
    show_order_code: settings.showOrderCode,
    show_issued_at: settings.showIssuedAt,
    show_price: settings.showPrice,
    show_sequence: settings.showSequence,
    auto_print_after_payment: settings.autoPrintAfterPayment,
  };
}
