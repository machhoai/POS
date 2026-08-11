import type { PrintableTicket } from "@/features/ticket/types/ticket";
import type { PosOrder } from "@/lib/types/order";

export function buildPrintableTickets(order: PosOrder): PrintableTicket[] {
  return order.items.flatMap((item) => {
    const ticketCodes = Array.isArray(item.ticketCodes) ? item.ticketCodes : [];
    return ticketCodes.map((ticketCode, index) => ({
      ticketCode,
      goodsName: item.goodsName,
      price: item.price,
      orderId: order.localOrderId,
      issuedAt: order.paidAt || order.createdAt,
      sequence: index + 1,
      totalForItem: ticketCodes.length,
    }));
  });
}
