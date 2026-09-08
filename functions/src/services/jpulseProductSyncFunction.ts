import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

import { synchronizePosProducts } from "./productSyncService";
import { ProductSyncInProgressError } from "./productSyncCoordinator";
import {
  createProductSyncSignature,
  productSyncSignaturesMatch,
} from "./productSyncAuthentication";

export const jpulseProductSyncSecret = defineSecret(
  "JPOS_PRODUCT_SYNC_SECRET",
);

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

interface JpulseSyncBody {
  actor_id: string;
  action_time: string;
  request_id: string;
  warehouse_id: string;
}

const parseBody = (value: unknown): JpulseSyncBody => {
  if (!value || typeof value !== "object") throw new Error("INVALID_BODY");
  const body = value as Record<string, unknown>;
  const actorId = typeof body.actor_id === "string" ? body.actor_id.trim() : "";
  const actionTime = typeof body.action_time === "string"
    ? body.action_time.trim()
    : "";
  const requestId = typeof body.request_id === "string"
    ? body.request_id.trim()
    : "";
  const warehouseId = typeof body.warehouse_id === "string"
    ? body.warehouse_id.trim()
    : "";
  if (
    !SAFE_ID.test(actorId) ||
    !SAFE_ID.test(requestId) ||
    !SAFE_ID.test(warehouseId) ||
    !Number.isFinite(Date.parse(actionTime))
  ) {
    throw new Error("INVALID_BODY");
  }
  return {
    actor_id: actorId,
    action_time: actionTime,
    request_id: requestId,
    warehouse_id: warehouseId,
  };
};

export const syncProductsFromJpulse = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 300,
    maxInstances: 10,
    secrets: [
      jpulseProductSyncSecret,
      // synchronizePosProducts reads the JoyWorld secrets transitively.
      "JOYWORLD_USER",
      "JOYWORLD_PASS",
    ],
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({
        success: false,
        data: null,
        messages: { vi: "Phương thức không hợp lệ.", zh: "请求方法无效。" },
      });
      return;
    }

    try {
      const timestamp = request.header("x-jpulse-timestamp") || "";
      const signature = request.header("x-jpulse-signature") || "";
      const requestId = request.header("x-jpulse-request-id") || "";
      const timestampNumber = Number(timestamp);
      if (
        !Number.isFinite(timestampNumber) ||
        Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS ||
        !SAFE_ID.test(requestId)
      ) {
        throw new Error("INVALID_SIGNATURE");
      }
      const rawBody = request.rawBody.toString("utf8");
      const expected = createProductSyncSignature(
        jpulseProductSyncSecret.value(),
        timestamp,
        requestId,
        rawBody,
      );
      if (!productSyncSignaturesMatch(signature, expected)) {
        throw new Error("INVALID_SIGNATURE");
      }

      const body = parseBody(request.body);
      if (body.request_id !== requestId) throw new Error("INVALID_SIGNATURE");
      const result = await synchronizePosProducts({
        actorId: body.actor_id,
        actionTime: body.action_time,
        requestId: body.request_id,
        source: "JPULSE",
        warehouseId: body.warehouse_id,
      });
      response.status(200).json({
        success: true,
        data: result,
        messages: {
          vi: "Đã đồng bộ danh mục sản phẩm JPOS.",
          zh: "JPOS 商品目录已同步。",
        },
      });
    } catch (error: unknown) {
      const inProgress = error instanceof ProductSyncInProgressError;
      const errorCode = error instanceof Error ? error.message : "";
      const invalidSignature = errorCode === "INVALID_SIGNATURE";
      const invalidBody = errorCode === "INVALID_BODY";
      const status = inProgress ? 409 : invalidSignature ? 401 : invalidBody ? 400 : 500;
      logger.error("[syncProductsFromJpulse] Failed", {
        error: errorCode || String(error),
      });
      response.status(status).json({
        success: false,
        data: null,
        messages: inProgress
          ? {
            vi: "Một lượt đồng bộ sản phẩm khác đang chạy.",
            zh: "另一个商品同步任务正在运行。",
          }
          : invalidSignature
            ? {
              vi: "Yêu cầu đồng bộ không hợp lệ.",
              zh: "同步请求验证失败。",
            }
            : invalidBody
              ? {
                vi: "Dữ liệu đồng bộ không hợp lệ.",
                zh: "同步数据无效。",
              }
          : {
            vi: "Không thể đồng bộ sản phẩm JPOS.",
            zh: "无法同步 JPOS 商品。",
          },
      });
    }
  },
);
