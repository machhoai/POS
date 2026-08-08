import type { PosOrder } from "@/lib/types/order";

export const SAMPLE_RECEIPT_ORDER: PosOrder = {
  localOrderId: "ORD-1770002900-A29F8C",
  hkOrderNumber: "HK-20260902-0088",
  invoiceRequestToken: "sampleInvoiceRequestToken000000000000000000",
  invoiceRequestCreatedAt: "2026-09-02T08:08:00.000Z",
  shopId: 1,
  operatorName: "Nguyễn Minh Anh",
  status: "SYNC_SUCCESS",
  paymentMethod: "CASH",
  paymentMethodName: "Tiền mặt",
  totalAmount: 328_900,
  items: [
    {
      goodsId: "sample-ticket",
      goodsName: "Vé vui chơi trọn gói",
      price: 220_000,
      quantity: 1,
      unitPriceBeforeTax: 200_000,
      taxRate: 10,
      taxAmount: 20_000,
    },
    {
      goodsId: "sample-gift",
      goodsName: "Gấu bông B.Duck mini",
      price: 54_450,
      quantity: 2,
      unitPriceBeforeTax: 49_500,
      taxRate: 10,
      taxAmount: 9_900,
    },
  ],
  sync: { retryCount: 0, lastError: null, syncedAt: "2026-09-02T03:12:00.000Z" },
  createdAt: "2026-09-02T03:10:00.000Z",
  paidAt: "2026-09-02T03:11:00.000Z",
};
