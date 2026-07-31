import type { OrderFilterState } from "@/components/orders/OrderFilters";
import type { PosOrder } from "@/lib/types/order";

export function filterAndSortOrders(
  orders: PosOrder[],
  filters: OrderFilterState,
): PosOrder[] {
  let result = [...orders];

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    from.setHours(0, 0, 0, 0);
    result = result.filter((order) => new Date(order.createdAt) >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    result = result.filter((order) => new Date(order.createdAt) <= to);
  }

  if (filters.hourFrom) {
    const [hour, minute] = filters.hourFrom.split(":").map(Number);
    result = result.filter((order) => {
      const date = new Date(order.createdAt);
      return date.getHours() > hour ||
        (date.getHours() === hour && date.getMinutes() >= minute);
    });
  }
  if (filters.hourTo) {
    const [hour, minute] = filters.hourTo.split(":").map(Number);
    result = result.filter((order) => {
      const date = new Date(order.createdAt);
      return date.getHours() < hour ||
        (date.getHours() === hour && date.getMinutes() <= minute);
    });
  }

  if (filters.statusFilter !== "all") {
    result = result.filter(
      (order) => order.status === filters.statusFilter,
    );
  }

  const query = filters.searchQuery.toLowerCase().trim();
  if (query) {
    result = result.filter(
      (order) =>
        order.localOrderId.toLowerCase().includes(query) ||
        order.hkOrderNumber?.toLowerCase().includes(query) ||
        order.items.some((item) =>
          item.goodsName.toLowerCase().includes(query)
        ) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.customerPhone?.includes(query),
    );
  }

  return result.sort((left, right) => {
    if (filters.sortBy === "oldest") {
      return new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime();
    }
    if (filters.sortBy === "highest") {
      return right.totalAmount - left.totalAmount;
    }
    if (filters.sortBy === "lowest") {
      return left.totalAmount - right.totalAmount;
    }
    return new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime();
  });
}
