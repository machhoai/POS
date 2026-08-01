import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  getPosAuthSession as loadPosAuthSession,
  PosAuthDomainError,
  resolvePosLoginEmail,
} from "../services/posAuthService";
import {
  loadPosProductCatalog,
  synchronizePosProducts,
} from "../services/productSyncService";
import {
  joyworldPassSecret,
  joyworldUserSecret,
} from "../services/joyworldCatalogService";
import {
  checkoutPosOrderForUser,
  getLatestPosOrderForUser,
  getPosOrderStatusForUser,
  listPosOrdersForUser,
  preparePosOrderForUser,
  retryPosOrderSyncForUser,
} from "../order/functions";
const CALLABLE_OPTIONS = {
  region: "asia-southeast1",
  cors: true,
  timeoutSeconds: 120,
  maxInstances: 20,
  secrets: [joyworldUserSecret, joyworldPassSecret],
};

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

    const action = request.data?.action;
    if (
      action === "prepareOrder" ||
      action === "checkoutOrder" ||
      action === "getOrderStatus" ||
      action === "getOrders" ||
      action === "getLatestOrder" ||
      action === "retryOrderSync"
    ) {
      try {
        if (action === "prepareOrder") {
          return await preparePosOrderForUser(
            request.auth.uid,
            request.data?.payload,
          );
        }
        if (action === "checkoutOrder") {
          return await checkoutPosOrderForUser(
            request.auth.uid,
            request.data?.payload,
          );
        }
        if (action === "getOrders") {
          return await listPosOrdersForUser(
            request.auth.uid,
            request.data?.payload,
          );
        }
        if (action === "getLatestOrder") {
          return await getLatestPosOrderForUser(
            request.auth.uid,
            request.data?.payload,
          );
        }
        if (action === "retryOrderSync") {
          return await retryPosOrderSyncForUser(
            request.auth.uid,
            request.data?.payload,
          );
        }
        return await getPosOrderStatusForUser(
          request.auth.uid,
          request.data?.payload,
        );
      } catch (error: unknown) {
        if (error instanceof HttpsError) throw error;
        logger.error("[getPosAuthSession] Xử lý đơn hàng thất bại", {
          uid: request.auth.uid,
          action,
          error,
        });
        throw new HttpsError(
          "internal",
          "Không thể xử lý đơn hàng. Vui lòng thử lại.",
        );
      }
    }

    if (action === "getProducts") {
      try {
        return await loadPosProductCatalog();
      } catch (error: unknown) {
        logger.error("[getPosAuthSession] Product catalog load failed", {
          uid: request.auth.uid,
          error,
        });
        throw new HttpsError(
          "internal",
          "Không thể tải danh sách sản phẩm POS.",
        );
      }
    }

    if (action === "syncProducts") {
      try {
        return await synchronizePosProducts(request.auth.uid);
      } catch (error: unknown) {
        logger.error("[getPosAuthSession] Product synchronization failed", {
          uid: request.auth.uid,
          error,
        });
        throw new HttpsError(
          "internal",
          "Đồng bộ sản phẩm thất bại. Vui lòng thử lại.",
        );
      }
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
