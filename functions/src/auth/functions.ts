import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  getPosAuthSession as loadPosAuthSession,
  PosAuthDomainError,
  resolvePosLoginEmail,
} from "../services/posAuthService";

const CALLABLE_OPTIONS = {
  region: "asia-southeast1",
  cors: true,
  timeoutSeconds: 15,
  maxInstances: 20,
} as const;

export const resolvePosLoginIdentifier = onCall(
  CALLABLE_OPTIONS,
  async (request) => {
    const identifier = request.data?.identifier;
    if (
      typeof identifier !== "string" ||
      identifier.trim().length === 0 ||
      identifier.length > 160
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Thông tin đăng nhập không hợp lệ.",
      );
    }

    try {
      const email = await resolvePosLoginEmail(identifier);
      if (!email) {
        throw new HttpsError(
          "not-found",
          "Thông tin đăng nhập không chính xác.",
        );
      }
      return { email };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      logger.error("[resolvePosLoginIdentifier] Failed", error);
      throw new HttpsError(
        "internal",
        "Không thể xử lý yêu cầu đăng nhập.",
      );
    }
  },
);

export const getPosAuthSession = onCall(
  CALLABLE_OPTIONS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để xác minh phiên POS.",
      );
    }

    try {
      return await loadPosAuthSession(request.auth.uid);
    } catch (error: unknown) {
      if (error instanceof PosAuthDomainError) {
        if (error.code === "USER_NOT_FOUND") {
          throw new HttpsError("not-found", "Không tìm thấy hồ sơ người dùng.");
        }
        if (error.code === "USER_ACCOUNT_NOT_ACTIVE") {
          throw new HttpsError(
            "permission-denied",
            "Tài khoản đã bị vô hiệu hóa hoặc tạm khóa.",
          );
        }
        throw new HttpsError(
          "failed-precondition",
          "Hồ sơ người dùng không đúng định dạng của bduck-system.",
        );
      }

      logger.error("[getPosAuthSession] Failed", {
        uid: request.auth.uid,
        error,
      });
      throw new HttpsError(
        "internal",
        "Không thể xác minh phiên đăng nhập POS.",
      );
    }
  },
);
