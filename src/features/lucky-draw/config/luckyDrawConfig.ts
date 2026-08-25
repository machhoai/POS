import type { LuckyDrawSettingsInput } from "@/features/lucky-draw/types/luckyDraw";

export const MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE = 50;
export const LUCKY_DRAW_TICKET_HEIGHT_MM = 90;

export function createDefaultLuckyDrawSettings(
    warehouseId = "",
): LuckyDrawSettingsInput {
    return {
        warehouseId,
        enabled: false,
        paperSize: "POS80",
        programName: "CHƯƠNG TRÌNH BỐC THĂM MAY MẮN",
        ticketTitle: "Phiếu bốc thăm",
        message: "Vui lòng kiểm tra thông tin trước khi bỏ vào thùng. Mọi thông tin sai sót sau khi bỏ vào thùng chúng tôi không chịu trách nhiệm.",
        footerMessage: "Chúc Quý khách may mắn!",
        packageTicketCounts: {},
    };
}
