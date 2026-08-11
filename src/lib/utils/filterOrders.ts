import type { OrderFilterState } from "@/components/orders/OrderFilters";
import type { PosOrder } from "@/lib/types/order";
import { getOrderCustomerDisplay } from "@/lib/utils/orderCustomer";

export function filterAndSortOrders(
  orders: PosOrder[],
  filters: OrderFilterState,
): PosOrder[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  let result = orders.filter((order) => {
    const createdAt = new Date(order.createdAt).getTime();
    return createdAt >= startOfToday && createdAt < startOfTomorrow;
  });

  if (filters.statusFilter !== "all") {
    result = result.filter(
      (order) => order.status === filters.statusFilter,
    );
  }

  const query = filters.searchQuery.toLowerCase().trim();
  if (query) {
    result = result.filter((order) => {
      const customer = getOrderCustomerDisplay(order);
      return (
        order.localOrderId.toLowerCase().includes(query) ||
        order.hkOrderNumber?.toLowerCase().includes(query) ||
        order.items.some((item) =>
          item.goodsName.toLowerCase().includes(query)
        ) ||
        customer.name.toLowerCase().includes(query) ||
        customer.phone.includes(query) ||
        customer.memberCode.toLowerCase().includes(query) ||
        customer.levelName.toLowerCase().includes(query) ||
        customer.uid.toLowerCase().includes(query)
      );
    });
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
