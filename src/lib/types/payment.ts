import type { PaymentMethod } from "@/lib/types/order";

export interface PaymentMethodOption {
  id: PaymentMethod;
  methodName: string;
  description: string;
  kind: "cash" | "transfer";
}
