import type { PosOrder } from "@/lib/types/order";

export interface OrderCustomerDisplay {
  isMember: boolean;
  name: string;
  phone: string;
  memberCode: string;
  levelName: string;
  uid: string;
}

/**
 * Prefer the immutable member snapshot stored with the order, while keeping
 * legacy customer fields readable for orders created before member snapshots.
 */
export function getOrderCustomerDisplay(
  order: PosOrder,
): OrderCustomerDisplay {
  const isMember = Boolean(order.member || order.uid);

  return {
    isMember,
    name: order.member?.fullName || order.customerName || "",
    phone: order.member?.phone || order.customerPhone || "",
    memberCode: order.member?.memberCode || "",
    levelName: order.member?.levelName || "",
    uid: order.member?.uid || order.uid || "",
  };
}
