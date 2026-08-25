export type LuckyDrawPaperSize = "POS58" | "POS80" | "POS82";

export interface LuckyDrawSettingsInput {
  warehouseId: string;
  enabled: boolean;
  paperSize: LuckyDrawPaperSize;
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
