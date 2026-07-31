import type { PaymentMethodOption } from "@/lib/types/payment";

/** Payment methods recorded by JPOS for accounting in Vietnam. */
export const JPOS_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "CASH",
    methodName: "Tiền mặt",
    description: "Nhận tiền trực tiếp tại quầy",
    kind: "cash",
  },
  {
    id: "QR_CODE",
    methodName: "Chuyển khoản",
    description: "Xác nhận giao dịch chuyển khoản",
    kind: "transfer",
  },
];
