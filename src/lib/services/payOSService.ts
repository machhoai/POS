import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type {
  OrderItem,
} from "@/lib/types/order";
import type { PayOSPaymentResult } from "@/lib/types/payment";

export interface CreatePayOSPaymentInput {
  localOrderId: string;
  shopId: number;
  warehouseId: string;
  items: Array<Pick<OrderItem, "goodsId" | "quantity">>;
}

type PayOSPaymentAction =
  | "create"
  | "status"
  | "timeout"
  | "resume"
  | "recreate"
  | "cancel"
  | "manual-confirm";

interface PayOSCallableRequest {
  action: PayOSPaymentAction;
  payload: CreatePayOSPaymentInput | { localOrderId: string };
}

const callPayOSPayment = httpsCallable<
  PayOSCallableRequest,
  PayOSPaymentResult
>(functions, "payosPayment");

async function callOrderAction(
  action: Exclude<PayOSPaymentAction, "create">,
  localOrderId: string,
): Promise<PayOSPaymentResult> {
  const response = await callPayOSPayment({
    action,
    payload: { localOrderId },
  });
  return response.data;
}

export async function createPayOSPayment(
  input: CreatePayOSPaymentInput,
): Promise<PayOSPaymentResult> {
  const response = await callPayOSPayment({ action: "create", payload: input });
  return response.data;
}

export const fetchPayOSPaymentStatus = (localOrderId: string) =>
  callOrderAction("status", localOrderId);

export const handlePayOSPaymentTimeout = (localOrderId: string) =>
  callOrderAction("timeout", localOrderId);

export const resumePayOSPayment = (localOrderId: string) =>
  callOrderAction("resume", localOrderId);

export const recreatePayOSPayment = (localOrderId: string) =>
  callOrderAction("recreate", localOrderId);

export const cancelPayOSPayment = (localOrderId: string) =>
  callOrderAction("cancel", localOrderId);

export const confirmPayOSPaymentManually = (localOrderId: string) =>
  callOrderAction("manual-confirm", localOrderId);
