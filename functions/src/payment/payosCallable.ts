import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  payosApiKeySecret,
  payosChecksumKeySecret,
  payosClientIdSecret,
} from "../services/payosService";
import {
  cancelPayOSPaymentForUser,
  confirmPayOSPaymentManuallyForUser,
  createPayOSPaymentForUser,
  getPayOSPaymentStatusForUser,
  handlePayOSPaymentTimeoutForUser,
  recreatePayOSPaymentForUser,
  resumePayOSPaymentForUser,
} from "./payosFunctions";

export const payosPayment = onCall(
  {
    region: "asia-southeast1",
    cors: true,
    timeoutSeconds: 60,
    maxInstances: 20,
    secrets: [
      payosClientIdSecret,
      payosApiKeySecret,
      payosChecksumKeySecret,
    ],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để sử dụng thanh toán PayOS.",
      );
    }

    const action = request.data?.action;
    const payload = request.data?.payload;
    try {
      if (action === "create") {
        return await createPayOSPaymentForUser(request.auth.uid, payload);
      }
      if (action === "status") {
        return await getPayOSPaymentStatusForUser(request.auth.uid, payload);
      }
      if (action === "timeout") {
        return await handlePayOSPaymentTimeoutForUser(
          request.auth.uid,
          payload,
        );
      }
      if (action === "resume") {
        return await resumePayOSPaymentForUser(request.auth.uid, payload);
      }
      if (action === "recreate") {
        return await recreatePayOSPaymentForUser(request.auth.uid, payload);
      }
      if (action === "cancel") {
        return await cancelPayOSPaymentForUser(request.auth.uid, payload);
      }
      if (action === "manual-confirm") {
        return await confirmPayOSPaymentManuallyForUser(
          request.auth.uid,
          payload,
        );
      }
      throw new HttpsError("invalid-argument", "Thao tác PayOS không hợp lệ.");
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      logger.error("[PayOS callable] Xử lý thanh toán thất bại", {
        uid: request.auth.uid,
        action,
        error,
      });
      throw new HttpsError(
        "internal",
        "Không thể xử lý thanh toán PayOS. Vui lòng thử lại.",
      );
    }
  },
);
