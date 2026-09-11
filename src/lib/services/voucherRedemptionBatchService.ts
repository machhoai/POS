import { printReceiptSilently } from "@/features/receipt/components/ReceiptPrintButton";
import type { ReceiptSettings } from "@/features/receipt/types/receipt";
import { printTicketsSilently } from "@/features/ticket/components/TicketPrintButton";
import type { TicketSettings } from "@/features/ticket/types/ticket";
import {
  checkoutOrder,
  fetchOrderForReceipt,
  generateLocalOrderId,
} from "@/lib/services/orderService";
import type { PosOrder } from "@/lib/types/order";
import type { PosVoucherResolution } from "@/lib/types/voucher";
import { aggregateVoucherProducts } from "@/lib/utils/voucherRedemptionBatch";

export type VoucherBatchPrintFailure = "RECEIPT" | "TICKETS";

interface CompleteVoucherBatchInput {
  vouchers: readonly PosVoucherResolution[];
  shopId: number;
  warehouseId: string;
  receiptSettings: ReceiptSettings;
  ticketSettings: TicketSettings;
}

export interface CompleteVoucherBatchResult {
  order: PosOrder;
  printFailures: VoucherBatchPrintFailure[];
}

export async function completeVoucherRedemptionBatch({
  vouchers,
  shopId,
  warehouseId,
  receiptSettings,
  ticketSettings,
}: CompleteVoucherBatchInput): Promise<CompleteVoucherBatchResult> {
  const localOrderId = generateLocalOrderId();
  await checkoutOrder({
    localOrderId,
    shopId,
    warehouseId,
    items: aggregateVoucherProducts(vouchers),
    voucherCodes: vouchers.map((voucher) => voucher.code),
    paymentMethodId: "CASH",
  });

  const order = await fetchOrderForReceipt(localOrderId);
  const printFailures: VoucherBatchPrintFailure[] = [];
  try {
    await printReceiptSilently(order, receiptSettings);
  } catch (error) {
    console.error("[Voucher] Không thể in bill của lô voucher:", error);
    printFailures.push("RECEIPT");
  }
  try {
    await printTicketsSilently(order, ticketSettings);
  } catch (error) {
    console.error("[Voucher] Không thể in vé của lô voucher:", error);
    printFailures.push("TICKETS");
  }
  return { order, printFailures };
}
