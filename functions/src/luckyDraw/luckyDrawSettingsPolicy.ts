import type {
  LuckyDrawPaperSize,
  LuckyDrawSettingsInput,
} from "../types/luckyDrawSettings";

const PAPER_SIZES = new Set<LuckyDrawPaperSize>(["POS58", "POS80", "POS82"]);
export const MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE = 50;

function requiredText(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== "string") throw new Error(`${label} không hợp lệ.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return normalized;
}

function normalizePackageTicketCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Mapping số phiếu theo gói không hợp lệ.");
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([rawGoodsId, rawCount]) => {
      const goodsId = rawGoodsId.trim();
      const count = Number(rawCount);
      if (!goodsId || goodsId.length > 128) {
        throw new Error("Mã gói trong mapping phiếu không hợp lệ.");
      }
      if (
        !Number.isInteger(count) ||
        count < 0 ||
        count > MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE
      ) {
        throw new Error(
          `Số phiếu của mỗi gói phải từ 0 đến ${MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE}.`,
        );
      }
      return count > 0 ? [[goodsId, count]] : [];
    }),
  );
}

export function normalizeLuckyDrawSettings(
  value: unknown,
): LuckyDrawSettingsInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cấu hình phiếu bốc thăm không hợp lệ.");
  }
  const input = value as Record<string, unknown>;
  const paperSize = input.paperSize;
  if (typeof paperSize !== "string" || !PAPER_SIZES.has(paperSize as LuckyDrawPaperSize)) {
    throw new Error("Khổ giấy phiếu bốc thăm không hợp lệ.");
  }

  return {
    warehouseId: requiredText(input.warehouseId, "Điểm bán", 128),
    enabled: input.enabled === true,
    paperSize: paperSize as LuckyDrawPaperSize,
    programName: requiredText(input.programName, "Tên chương trình", 100),
    ticketTitle: requiredText(input.ticketTitle, "Tiêu đề phiếu", 80),
    message: requiredText(input.message, "Nội dung phiếu", 240),
    footerMessage: requiredText(input.footerMessage, "Nội dung cuối phiếu", 160),
    packageTicketCounts: normalizePackageTicketCounts(input.packageTicketCounts),
  };
}

export function resolveLuckyDrawTicketCount(
  settings: LuckyDrawSettingsInput | null,
  goodsId: string,
  category: number | undefined,
): number {
  if (!settings?.enabled || ![1, 2, 6].includes(category ?? -1)) return 0;
  return settings.packageTicketCounts[goodsId] ?? 0;
}
