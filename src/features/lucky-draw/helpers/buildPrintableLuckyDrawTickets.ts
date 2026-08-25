import type { PrintableLuckyDrawTicket } from "@/features/lucky-draw/types/luckyDraw";
import type { PosOrder } from "@/lib/types/order";
import { getOrderCustomerDisplay } from "@/lib/utils/orderCustomer";

export function buildPrintableLuckyDrawTickets(
  order: PosOrder,
): PrintableLuckyDrawTicket[] {
  const customer = getOrderCustomerDisplay(order);
  const purchasedAt = order.paidAt || order.createdAt;
  const entries = order.items.flatMap((item) => {
    const perUnit = Number(item.luckyDrawTicketsPerUnit);
    const count = Number.isInteger(perUnit) && perUnit > 0
      ? perUnit * item.quantity
      : 0;
    return Array.from({ length: count }, () => ({
      goodsName: item.goodsName,
    }));
  });

  return entries.map((entry, index) => ({
    orderId: order.localOrderId,
    customerName: customer.name || "Khách hàng",
    customerPhone: customer.phone || "—",
    purchasedAt,
    goodsName: entry.goodsName,
    sequence: index + 1,
    totalForOrder: entries.length,
  }));
}
