import { randomInt } from "node:crypto";
import {
  NotFoundError,
  type PaymentLink,
  type PaymentLinkStatus,
} from "@payos/node";
import type { DocumentReference } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import { stagePosOrderForPayOS } from "../order/functions";
import { buildPayOSRedirectUrls, getPayOS } from "../services/payosService";
import { getPosAuthSession } from "../services/posAuthService";
import type {
  PayOSPaymentAttempt,
  PayOSPaymentDetails,
  PayOSPaymentStatus,
  PosOrder,
} from "../types/order";
import {
  buildPayOSPaymentDescription,
  canManuallyConfirmPayOSPayment,
  decidePayOSWebhookPayment,
  inferPayOSNextAction,
  isCompletedOrderStatus,
  isPayOSPaymentAmountValid,
  PAYOS_DISPLAY_WINDOW_MS,
  type PayOSNextAction,
} from "./payosPolicy";
import {
  activateFixedTransferForOrder,
  cancelFixedTransferForOrder,
  confirmFixedTransferForOrder,
  isFixedTransferActive,
} from "./fixedTransferFunctions";

const PAYMENT_LINK_LIFETIME_SECONDS = 15 * 60;
const STALE_CREATION_MS = 2 * 60 * 1000;
const LOCAL_ORDER_ID_PATTERN = /^ORD-\d{10,13}-[A-Z0-9]{6}$/;

function hasScopedPermission(
  permissions: Record<string, Record<string, unknown>>,
  permission: string,
  warehouseId: string,
): boolean {
  return (
    permissions.global?.["*"] === true ||
    permissions.global?.[permission] === true ||
    permissions[warehouseId]?.["*"] === true ||
    permissions[warehouseId]?.[permission] === true
  );
}

interface VerifiedPayment {
  code: string;
  orderCode: number;
  amount: number;
  currency: string;
  paymentLinkId: string;
  reference?: string;
  transactionDateTime?: string;
}

function readLocalOrderId(data: unknown): string {
  const localOrderId = data && typeof data === "object"
    ? (data as { localOrderId?: unknown }).localOrderId
    : undefined;
  if (
    typeof localOrderId !== "string" ||
    !LOCAL_ORDER_ID_PATTERN.test(localOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Mã đơn hàng không hợp lệ.");
  }
  return localOrderId;
}

function getCurrentAttempt(order: PosOrder): PayOSPaymentAttempt | null {
  const details = order.paymentDetails;
  if (!details || details.provider !== "payos") return null;
  return details.attempts.find(
    (attempt) => attempt.orderCode === details.currentOrderCode,
  ) ?? null;
}

function isPayOSActive(status: PayOSPaymentStatus): boolean {
  return ["CREATING", "PENDING", "PROCESSING", "UNDERPAID"].includes(status);
}

function replaceAttempt(
  details: PayOSPaymentDetails,
  nextAttempt: PayOSPaymentAttempt,
): PayOSPaymentDetails {
  return {
    ...details,
    attempts: details.attempts.map((attempt) =>
      attempt.orderCode === nextAttempt.orderCode ? nextAttempt : attempt
    ),
  };
}

function inferNextAction(
  order: PosOrder,
  attempt: PayOSPaymentAttempt | null,
): PayOSNextAction {
  if (isCompletedOrderStatus(order.status)) return "COMPLETED";
  if (isFixedTransferActive(order)) return "FALLBACK";
  return inferPayOSNextAction({
    orderStatus: order.status,
    paymentStatus: attempt?.status,
    linkExpiresAt: attempt?.linkExpiresAt,
    displayExpiresAt: attempt?.displayExpiresAt,
    nowMs: Date.now(),
  });
}

function buildPaymentResult(order: PosOrder) {
  const attempt = getCurrentAttempt(order);
  const serverTime = new Date().toISOString();
  return {
    localOrderId: order.localOrderId,
    orderStatus: order.status,
    totalAmount: order.totalAmount,
    payment: attempt ? {
      orderCode: attempt.orderCode,
      status: attempt.status,
      amount: attempt.amount,
      description: attempt.description,
      paymentLinkId: attempt.paymentLinkId ?? null,
      checkoutUrl: attempt.checkoutUrl ?? null,
      qrCode: attempt.qrCode ?? null,
      bin: attempt.bin ?? null,
      accountNumber: attempt.accountNumber ?? null,
      accountName: attempt.accountName ?? null,
      currency: attempt.currency ?? "VND",
      createdAt: attempt.createdAt,
      linkExpiresAt: attempt.linkExpiresAt,
      displayExpiresAt: attempt.displayExpiresAt,
      paidAt: attempt.paidAt ?? null,
      paidAmount: attempt.paidAmount ?? null,
      reference: attempt.reference ?? null,
      error: attempt.error ?? null,
    } : null,
    fixedTransfer: order.fixedTransferDetails ?? null,
    paymentVerificationStatus:
      order.paymentVerificationStatus ?? "VERIFIED",
    nextAction: inferNextAction(order, attempt),
    serverTime,
    manualConfirmation: order.paymentDetails?.manualConfirmation ?? null,
  };
}

async function getAuthorizedOrder(
  userId: string,
  localOrderId: string,
): Promise<{
  docRef: DocumentReference;
  order: PosOrder;
  operatorName: string;
}> {
  const [session, snapshot] = await Promise.all([
    getPosAuthSession(userId),
    db.collection(POS_COLLECTIONS.orders).doc(localOrderId).get(),
  ]);
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
  }
  const order = snapshot.data() as PosOrder;
  const canAccess = order.createdBy === userId || session.warehouses.some(
    (warehouse) => warehouse.id === order.warehouseId,
  );
  if (!canAccess) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền truy cập thanh toán của đơn hàng này.",
    );
  }
  return {
    docRef: snapshot.ref,
    order,
    operatorName: session.user.full_name,
  };
}

async function recordPayOSConnectionError(
  docRef: DocumentReference,
  error: unknown,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) return;
      const order = snapshot.data() as PosOrder;
      if (!order.paymentDetails || order.status !== "DRAFT") return;
      const now = new Date().toISOString();
      transaction.update(docRef, {
        paymentDetails: {
          ...order.paymentDetails,
          lastCheckedAt: now,
          lastConnectionErrorAt: now,
          lastError: "Không thể kết nối PayOS để kiểm tra trạng thái.",
        },
        updatedAt: now,
      });
    });
  } catch (recordError: unknown) {
    logger.error("[PayOS] Không thể lưu lỗi kết nối để kiểm toán", {
      error: recordError,
    });
    return;
  }
  logger.warn("[PayOS] Đã ghi nhận lỗi kết nối để cho phép đối soát thủ công", {
    error: errorMessage,
  });
}

function generatePayOSOrderCode(): number {
  return Date.now() * 100 + randomInt(0, 100);
}

async function reservePaymentAttempt(
  docRef: DocumentReference,
  userId: string,
): Promise<{ order: PosOrder; attempt: PayOSPaymentAttempt }> {
  const session = await getPosAuthSession(userId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
    }
    const order = snapshot.data() as PosOrder;
    if (order.createdBy !== userId) {
      throw new HttpsError(
        "permission-denied",
        "Chỉ thu ngân tạo đơn mới được khởi tạo mã thanh toán.",
      );
    }
    const warehouse = session.warehouses.find(
      (candidate) => candidate.id === order.warehouseId,
    );
    if (!warehouse) {
      throw new HttpsError(
        "permission-denied",
        "Bạn không có quyền tạo mã thanh toán tại điểm bán này.",
      );
    }
    if (!warehouse.code.trim()) {
      throw new HttpsError(
        "failed-precondition",
        "Điểm bán chưa được cấu hình mã cửa hàng để tạo nội dung chuyển khoản.",
      );
    }
    if (order.status !== "DRAFT") {
      throw new HttpsError(
        "failed-precondition",
        "Đơn hàng không còn ở trạng thái chờ thanh toán.",
      );
    }

    const currentAttempt = getCurrentAttempt(order);
    if (currentAttempt && isPayOSActive(currentAttempt.status)) {
      const createdAt = new Date(currentAttempt.createdAt).getTime();
      const creationIsStale = currentAttempt.status === "CREATING" &&
        Date.now() - createdAt >= STALE_CREATION_MS;
      const linkExpired = new Date(currentAttempt.linkExpiresAt).getTime() <= Date.now();
      if (!creationIsStale && !linkExpired) {
        throw new HttpsError(
          "aborted",
          "Đơn hàng đang có một mã thanh toán PayOS còn hiệu lực.",
        );
      }
    }

    const now = new Date();
    const orderCode = generatePayOSOrderCode();
    const description = buildPayOSPaymentDescription(
      warehouse.code,
      order.localOrderId,
    );

    const attempt: PayOSPaymentAttempt = {
      orderCode,
      status: "CREATING",
      amount: order.totalAmount,
      description,
      createdAt: now.toISOString(),
      linkExpiresAt: new Date(
        now.getTime() + PAYMENT_LINK_LIFETIME_SECONDS * 1000,
      ).toISOString(),
      displayExpiresAt: new Date(
        now.getTime() + PAYOS_DISPLAY_WINDOW_MS,
      ).toISOString(),
    };
    const previousAttempts = order.paymentDetails?.attempts ?? [];
    const paymentDetails: PayOSPaymentDetails = {
      provider: "payos",
      currentOrderCode: orderCode,
      attempts: [...previousAttempts, attempt],
      lastCheckedAt: now.toISOString(),
      lastError: null,
    };
    const payosOrderCodes = Array.from(new Set([
      ...(order.payosOrderCodes ?? []),
      orderCode,
    ]));
    const nextOrder: PosOrder = {
      ...order,
      payosOrderCodes,
      paymentDetails,
      updatedAt: now.toISOString(),
    };
    transaction.update(docRef, {
      payosOrderCodes,
      paymentDetails,
      updatedAt: nextOrder.updatedAt,
    });
    return { order: nextOrder, attempt };
  });
}

async function storeCreatedPaymentLink(
  docRef: DocumentReference,
  reservedAttempt: PayOSPaymentAttempt,
) {
  const payos = getPayOS();
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
  }
  const order = snapshot.data() as PosOrder;
  const { returnUrl, cancelUrl } = buildPayOSRedirectUrls(order.localOrderId);

  try {
    const paymentLink = await payos.paymentRequests.create({
      orderCode: reservedAttempt.orderCode,
      amount: reservedAttempt.amount,
      description: reservedAttempt.description,
      returnUrl,
      cancelUrl,
      expiredAt: Math.floor(
        new Date(reservedAttempt.linkExpiresAt).getTime() / 1000,
      ),
      items: order.items.map((item) => ({
        name: item.goodsName.slice(0, 50),
        quantity: item.quantity,
        price: item.price,
      })),
    });

    return db.runTransaction(async (transaction) => {
      const freshSnapshot = await transaction.get(docRef);
      if (!freshSnapshot.exists) {
        throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
      }
      const freshOrder = freshSnapshot.data() as PosOrder;
      const details = freshOrder.paymentDetails;
      if (!details || details.currentOrderCode !== reservedAttempt.orderCode) {
        throw new HttpsError(
          "aborted",
          "Phiên thanh toán PayOS đã được thay thế.",
        );
      }
      const freshAttempt = getCurrentAttempt(freshOrder);
      if (
        isCompletedOrderStatus(freshOrder.status) ||
        freshAttempt?.status === "PAID"
      ) {
        return freshOrder;
      }
      const now = new Date().toISOString();
      const createdAttempt: PayOSPaymentAttempt = {
        ...reservedAttempt,
        status: paymentLink.status,
        amount: paymentLink.amount,
        description: paymentLink.description,
        paymentLinkId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        bin: paymentLink.bin,
        accountNumber: paymentLink.accountNumber,
        accountName: paymentLink.accountName,
        currency: paymentLink.currency,
        linkExpiresAt: paymentLink.expiredAt
          ? new Date(paymentLink.expiredAt * 1000).toISOString()
          : reservedAttempt.linkExpiresAt,
        // The first five-minute window starts only after the QR is ready.
        displayExpiresAt: new Date(
          Date.now() + PAYOS_DISPLAY_WINDOW_MS,
        ).toISOString(),
        updatedAt: now,
      };
      const paymentDetails = {
        ...replaceAttempt(details, createdAttempt),
        lastCheckedAt: now,
        lastError: null,
      };
      const nextOrder: PosOrder = {
        ...freshOrder,
        paymentDetails,
        updatedAt: now,
      };
      transaction.update(docRef, { paymentDetails, updatedAt: now });
      return nextOrder;
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markAttemptFailed(docRef, reservedAttempt.orderCode, errorMessage);
    logger.error("[PayOS] Không thể tạo link thanh toán", {
      localOrderId: order.localOrderId,
      orderCode: reservedAttempt.orderCode,
      error: errorMessage,
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "unavailable",
      "Không thể tạo mã thanh toán PayOS. Vui lòng thử lại.",
    );
  }
}

async function markAttemptFailed(
  docRef: DocumentReference,
  orderCode: number,
  errorMessage: string,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) return;
    const order = snapshot.data() as PosOrder;
    const details = order.paymentDetails;
    const attempt = details?.attempts.find((item) => item.orderCode === orderCode);
    if (!details || !attempt || attempt.status !== "CREATING") return;
    const now = new Date().toISOString();
    const failedAttempt: PayOSPaymentAttempt = {
      ...attempt,
      status: "FAILED",
      updatedAt: now,
      error: errorMessage,
    };
    transaction.update(docRef, {
      paymentDetails: {
        ...replaceAttempt(details, failedAttempt),
        lastCheckedAt: now,
        lastError: errorMessage,
      },
      updatedAt: now,
    });
  });
}

async function updateAttemptStatus(
  docRef: DocumentReference,
  orderCode: number,
  status: PaymentLinkStatus,
  allowCompletedOrder = false,
): Promise<PosOrder> {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
    }
    const order = snapshot.data() as PosOrder;
    const details = order.paymentDetails;
    const attempt = details?.attempts.find((item) => item.orderCode === orderCode);
    if (!details || !attempt) return order;
    if (
      (!allowCompletedOrder && isCompletedOrderStatus(order.status)) ||
      attempt.status === "PAID"
    ) {
      return order;
    }
    const now = new Date().toISOString();
    const nextAttempt: PayOSPaymentAttempt = {
      ...attempt,
      status,
      updatedAt: now,
    };
    const paymentDetails = {
      ...replaceAttempt(details, nextAttempt),
      lastCheckedAt: now,
      lastError: null,
    };
    const nextOrder: PosOrder = { ...order, paymentDetails, updatedAt: now };
    transaction.update(docRef, { paymentDetails, updatedAt: now });
    return nextOrder;
  });
}

export async function markPayOSPaymentPaid(
  docRef: DocumentReference,
  orderCode: number,
  payment: VerifiedPayment,
): Promise<"PAID" | "ALREADY_COMPLETED" | "REJECTED"> {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) return "REJECTED";
    const order = snapshot.data() as PosOrder;
    const details = order.paymentDetails;
    const attempt = details?.attempts.find((item) => item.orderCode === orderCode);
    if (!details || !attempt) return "REJECTED";
    const decision = decidePayOSWebhookPayment({
      orderStatus: order.status,
      expectedOrderCode: attempt.orderCode,
      expectedPaymentLinkId: attempt.paymentLinkId,
      expectedAmount: order.totalAmount,
      attemptAmount: attempt.amount,
      webhookCode: payment.code,
      webhookOrderCode: payment.orderCode,
      webhookPaymentLinkId: payment.paymentLinkId,
      webhookAmount: payment.amount,
      webhookCurrency: payment.currency,
    });
    if (decision === "REJECT") return "REJECTED";
    if (!isPayOSPaymentAmountValid(
      order.totalAmount,
      attempt.amount,
      payment.amount,
    )) {
      logger.error("[PayOS] Số tiền webhook không khớp đơn hàng", {
        localOrderId: order.localOrderId,
        orderCode,
        expectedAmount: order.totalAmount,
        receivedAmount: payment.amount,
      });
      return "REJECTED";
    }

    const paidAt = new Date().toISOString();
    const paidAttempt: PayOSPaymentAttempt = {
      ...attempt,
      status: "PAID",
      paidAt,
      paidAmount: payment.amount,
      updatedAt: paidAt,
      ...(payment.reference ? { reference: payment.reference } : {}),
      ...(payment.transactionDateTime
        ? { transactionDateTime: payment.transactionDateTime }
        : {}),
    };
    const paymentDetails = {
      ...replaceAttempt(details, paidAttempt),
      lastCheckedAt: paidAt,
      lastError: null,
    };
    if (decision === "ALREADY_COMPLETED") {
      if (attempt.status !== "PAID") {
        transaction.update(docRef, { paymentDetails, updatedAt: paidAt });
      }
      return "ALREADY_COMPLETED";
    }
    transaction.update(docRef, {
      status: "LOCAL_PAID",
      paymentMethod: "QR_CODE",
      paymentMethodId: "QR_CODE",
      paymentMethodName: "Chuyển khoản",
      paymentDetails,
      paidAt,
      updatedAt: paidAt,
    });
    return "PAID";
  });
}

async function syncPayOSOrder(
  docRef: DocumentReference,
  order: PosOrder,
): Promise<PosOrder> {
  const attempt = getCurrentAttempt(order);
  if (!attempt || !isPayOSActive(attempt.status) || attempt.status === "CREATING") {
    return order;
  }
  const info = await getPayOS().paymentRequests.get(attempt.orderCode);
  if (info.status === "PAID") {
    const transaction = info.transactions[0];
    const paymentResult = await markPayOSPaymentPaid(docRef, attempt.orderCode, {
      code: "00",
      orderCode: attempt.orderCode,
      amount: info.amountPaid,
      currency: "VND",
      paymentLinkId: info.id,
      reference: transaction?.reference,
      transactionDateTime: transaction?.transactionDateTime,
    });
    if (paymentResult === "REJECTED") {
      throw new HttpsError(
        "data-loss",
        "PayOS báo đã thanh toán nhưng số tiền không khớp đơn hàng.",
      );
    }
    const paidSnapshot = await docRef.get();
    return paidSnapshot.data() as PosOrder;
  }
  return updateAttemptStatus(docRef, attempt.orderCode, info.status);
}

async function createPaymentLinkForOrder(
  userId: string,
  order: PosOrder,
): Promise<PosOrder> {
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(order.localOrderId);
  const { attempt } = await reservePaymentAttempt(docRef, userId);
  const createdOrder = await storeCreatedPaymentLink(docRef, attempt);
  const createdAttempt = getCurrentAttempt(createdOrder);
  if (createdOrder.status === "DRAFT" && createdAttempt?.status === "PAID") {
    await markPayOSPaymentPaid(docRef, createdAttempt.orderCode, {
      code: "00",
      orderCode: createdAttempt.orderCode,
      amount: createdAttempt.amount,
      currency: createdAttempt.currency ?? "VND",
      paymentLinkId: createdAttempt.paymentLinkId ?? "",
    });
    const paidSnapshot = await docRef.get();
    return paidSnapshot.data() as PosOrder;
  }
  return createdOrder;
}

async function createPayOSOrFallback(
  userId: string,
  order: PosOrder,
): Promise<PosOrder> {
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(order.localOrderId);
  let createdOrder: PosOrder;
  try {
    createdOrder = await createPaymentLinkForOrder(userId, order);
  } catch (error: unknown) {
    if (!(error instanceof HttpsError) || error.code !== "unavailable") {
      throw error;
    }
    logger.warn("[PayOS] Chuyển sang QR tài khoản cố định", {
      localOrderId: order.localOrderId,
      reason: "PAYOS_CREATE_FAILED",
    });
    return activateFixedTransferForOrder(
      userId,
      docRef,
      "PAYOS_CREATE_FAILED",
    );
  }

  const attempt = getCurrentAttempt(createdOrder);
  if (!attempt || attempt.qrCode) return createdOrder;

  if (isPayOSActive(attempt.status)) {
    try {
      createdOrder = await cancelAttemptSafely(
        docRef,
        attempt,
        "PayOS không trả về dữ liệu QR; chuyển sang tài khoản cố định",
      );
      if (isCompletedOrderStatus(createdOrder.status)) return createdOrder;
    } catch (error: unknown) {
      logger.warn("[PayOS] Không thể hủy attempt thiếu dữ liệu QR", {
        localOrderId: order.localOrderId,
        error,
      });
    }
  }

  return activateFixedTransferForOrder(
    userId,
    docRef,
    "PAYOS_QR_MISSING",
  );
}

export async function createPayOSPaymentForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const existingSnapshot = await db
    .collection(POS_COLLECTIONS.orders)
    .doc(localOrderId)
    .get();
  if (existingSnapshot.exists) {
    const { docRef, order } = await getAuthorizedOrder(userId, localOrderId);
    if (isCompletedOrderStatus(order.status)) {
      return buildPaymentResult(order);
    }
    if (isFixedTransferActive(order)) return buildPaymentResult(order);
    const currentAttempt = getCurrentAttempt(order);
    if (currentAttempt && isPayOSActive(currentAttempt.status)) {
      const synchronized = await syncPayOSOrder(docRef, order);
      const synchronizedAttempt = getCurrentAttempt(synchronized);
      if (
        synchronizedAttempt &&
        isPayOSActive(synchronizedAttempt.status) &&
        new Date(synchronizedAttempt.linkExpiresAt).getTime() > Date.now()
      ) {
        return buildPaymentResult(synchronized);
      }
    }
  }

  const stagedOrder = await stagePosOrderForPayOS(userId, data);
  const createdOrder = await createPayOSOrFallback(userId, stagedOrder);
  return buildPaymentResult(createdOrder);
}

export async function getPayOSPaymentStatusForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const { docRef, order } = await getAuthorizedOrder(userId, localOrderId);
  if (isFixedTransferActive(order)) return buildPaymentResult(order);
  try {
    const synchronized = await syncPayOSOrder(docRef, order);
    return buildPaymentResult(synchronized);
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    await recordPayOSConnectionError(docRef, error);
    logger.error("[PayOS] Không thể kiểm tra trạng thái thanh toán", {
      localOrderId,
      error,
    });
    throw new HttpsError(
      "unavailable",
      "Chưa thể kiểm tra trạng thái PayOS. Vui lòng thử lại.",
    );
  }
}

/**
 * Final PayOS check when a five-minute display window ends.
 * A UI timeout never changes an active bank transaction into a failed one;
 * the verified PayOS status decides whether the UI retries or recreates.
 */
export async function handlePayOSPaymentTimeoutForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const { docRef, order } = await getAuthorizedOrder(userId, localOrderId);
  if (isFixedTransferActive(order)) return buildPaymentResult(order);
  try {
    const synchronized = await syncPayOSOrder(docRef, order);
    return buildPaymentResult(synchronized);
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    await recordPayOSConnectionError(docRef, error);
    logger.error("[PayOS] Không thể kiểm tra lần cuối khi hết lượt hiển thị", {
      localOrderId,
      error,
    });
    throw new HttpsError(
      "unavailable",
      "Chưa thể xác nhận trạng thái PayOS. Vui lòng thử lại.",
    );
  }
}

export async function confirmPayOSPaymentManuallyForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const authorized = await getAuthorizedOrder(userId, localOrderId);
  const session = await getPosAuthSession(userId);
  if (
    !hasScopedPermission(
      session.permissions,
      "pos.payments.manual_confirm",
      authorized.order.warehouseId,
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền xác nhận thanh toán chuyển khoản thủ công.",
    );
  }
  if (isFixedTransferActive(authorized.order)) {
    const confirmedOrder = await confirmFixedTransferForOrder(
      userId,
      authorized.docRef,
      authorized.operatorName,
    );
    return buildPaymentResult(confirmedOrder);
  }
  const confirmedOrder = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(authorized.docRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
    }
    const order = snapshot.data() as PosOrder;
    const details = order.paymentDetails;
    const attempt = getCurrentAttempt(order);
    if (!details || !attempt) {
      throw new HttpsError(
        "failed-precondition",
        "Đơn hàng chưa có phiên thanh toán chuyển khoản.",
      );
    }
    if (isCompletedOrderStatus(order.status)) return order;
    if (!canManuallyConfirmPayOSPayment({
      orderStatus: order.status,
      isOrderCreator: order.createdBy === userId,
      paymentStatus: attempt.status,
      lastConnectionErrorAt: details.lastConnectionErrorAt,
      nowMs: Date.now(),
    })) {
      throw new HttpsError(
        "failed-precondition",
        "Chỉ được xác nhận thủ công sau khi không thể kết nối PayOS để kiểm tra.",
      );
    }

    const confirmedAt = new Date().toISOString();
    const paymentDetails: PayOSPaymentDetails = {
      ...details,
      lastCheckedAt: confirmedAt,
      manualConfirmation: {
        confirmedAt,
        confirmedByUid: userId,
        confirmedByName: authorized.operatorName,
        reason: "PAYOS_UNAVAILABLE",
        note: "Khách đã chuyển khoản; thu ngân xác nhận thủ công khi PayOS không khả dụng.",
        previousPaymentStatus: attempt.status,
      },
    };
    const nextOrder: PosOrder = {
      ...order,
      status: "LOCAL_PAID",
      paymentMethod: "QR_CODE",
      paymentMethodId: "QR_CODE",
      paymentMethodName: "Chuyển khoản (xác nhận thủ công)",
      paymentVerificationStatus: "UNVERIFIED",
      paymentDetails,
      paidAt: confirmedAt,
      updatedAt: confirmedAt,
    };
    transaction.update(authorized.docRef, {
      status: nextOrder.status,
      paymentMethod: nextOrder.paymentMethod,
      paymentMethodId: nextOrder.paymentMethodId,
      paymentMethodName: nextOrder.paymentMethodName,
      paymentVerificationStatus: nextOrder.paymentVerificationStatus,
      paymentDetails,
      paidAt: confirmedAt,
      updatedAt: confirmedAt,
    });
    return nextOrder;
  });
  return buildPaymentResult(confirmedOrder);
}

export async function resumePayOSPaymentForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const authorized = await getAuthorizedOrder(userId, localOrderId);
  if (isFixedTransferActive(authorized.order)) {
    return buildPaymentResult(authorized.order);
  }
  const synchronized = await syncPayOSOrder(authorized.docRef, authorized.order);
  const attempt = getCurrentAttempt(synchronized);
  if (!attempt || inferNextAction(synchronized, attempt) === "RECREATE") {
    throw new HttpsError(
      "failed-precondition",
      "Mã thanh toán đã hết hạn. Vui lòng tạo lại mã.",
    );
  }
  if (inferNextAction(synchronized, attempt) === "COMPLETED") {
    return buildPaymentResult(synchronized);
  }

  const displayExpiresAt = new Date(
    Date.now() + PAYOS_DISPLAY_WINDOW_MS,
  ).toISOString();
  const nextOrder = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(authorized.docRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
    }
    const order = snapshot.data() as PosOrder;
    const details = order.paymentDetails;
    const current = getCurrentAttempt(order);
    if (!details || !current || current.orderCode !== attempt.orderCode) {
      throw new HttpsError("aborted", "Phiên thanh toán đã thay đổi.");
    }
    const resumedAttempt = { ...current, displayExpiresAt };
    const paymentDetails = replaceAttempt(details, resumedAttempt);
    const updatedAt = new Date().toISOString();
    transaction.update(authorized.docRef, { paymentDetails, updatedAt });
    return { ...order, paymentDetails, updatedAt } as PosOrder;
  });
  return buildPaymentResult(nextOrder);
}

async function cancelRemotePayOSAttempt(
  attempt: PayOSPaymentAttempt,
  reason: string,
): Promise<PaymentLink | null> {
  if (["CANCELLED", "EXPIRED"].includes(attempt.status)) return null;
  try {
    if (attempt.paymentLinkId) {
      return await getPayOS().paymentRequests.cancel(
        attempt.paymentLinkId,
        reason,
      );
    }
    return await getPayOS().paymentRequests.cancel(attempt.orderCode, reason);
  } catch (error: unknown) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

async function cancelAttemptSafely(
  docRef: DocumentReference,
  attempt: PayOSPaymentAttempt,
  reason: string,
  allowCompletedOrder = false,
): Promise<PosOrder> {
  if (["CANCELLED", "EXPIRED"].includes(attempt.status)) {
    const snapshot = await docRef.get();
    return snapshot.data() as PosOrder;
  }
  const cancellation = await cancelRemotePayOSAttempt(attempt, reason);
  if (cancellation?.status === "PAID") {
    const transaction = cancellation.transactions[0];
    const paymentResult = await markPayOSPaymentPaid(docRef, attempt.orderCode, {
      code: "00",
      orderCode: attempt.orderCode,
      amount: cancellation.amountPaid,
      currency: "VND",
      paymentLinkId: cancellation.id,
      reference: transaction?.reference,
      transactionDateTime: transaction?.transactionDateTime,
    });
    if (paymentResult === "REJECTED") {
      throw new HttpsError(
        "data-loss",
        "PayOS báo đã thanh toán nhưng dữ liệu giao dịch không khớp đơn hàng.",
      );
    }
    const paidSnapshot = await docRef.get();
    return paidSnapshot.data() as PosOrder;
  }
  if (
    cancellation &&
    !["CANCELLED", "EXPIRED"].includes(cancellation.status)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "PayOS chưa xác nhận mã thanh toán đã được hủy.",
    );
  }
  return updateAttemptStatus(
    docRef,
    attempt.orderCode,
    cancellation?.status ?? "CANCELLED",
    allowCompletedOrder,
  );
}

export async function cancelSupersededPayOSAttempt(
  docRef: DocumentReference,
  paidOrderCode: number,
): Promise<void> {
  const snapshot = await docRef.get();
  if (!snapshot.exists) return;
  const order = snapshot.data() as PosOrder;
  const currentAttempt = getCurrentAttempt(order);
  if (
    !currentAttempt ||
    currentAttempt.orderCode === paidOrderCode ||
    !isPayOSActive(currentAttempt.status)
  ) {
    return;
  }
  await cancelAttemptSafely(
    docRef,
    currentAttempt,
    "Đơn đã được thanh toán bằng mã PayOS trước đó",
    true,
  );
}

export async function recreatePayOSPaymentForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const authorized = await getAuthorizedOrder(userId, localOrderId);
  if (isFixedTransferActive(authorized.order)) {
    return buildPaymentResult(authorized.order);
  }
  const synchronized = await syncPayOSOrder(authorized.docRef, authorized.order);
  const attempt = getCurrentAttempt(synchronized);
  const action = inferNextAction(synchronized, attempt);
  if (action === "COMPLETED") return buildPaymentResult(synchronized);
  if (action !== "RECREATE") {
    throw new HttpsError(
      "failed-precondition",
      "Mã thanh toán vẫn còn hiệu lực. Vui lòng chọn thử lại.",
    );
  }
  if (attempt) {
    const cancelledOrder = await cancelAttemptSafely(
      authorized.docRef,
      attempt,
      "Tạo lại mã thanh toán tại quầy POS",
    );
    if (isCompletedOrderStatus(cancelledOrder.status)) {
      return buildPaymentResult(cancelledOrder);
    }
  }
  const freshSnapshot = await authorized.docRef.get();
  const createdOrder = await createPayOSOrFallback(
    userId,
    freshSnapshot.data() as PosOrder,
  );
  return buildPaymentResult(createdOrder);
}

export async function cancelPayOSPaymentForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId = readLocalOrderId(data);
  const authorized = await getAuthorizedOrder(userId, localOrderId);
  if (isFixedTransferActive(authorized.order)) {
    const cancelledOrder = await cancelFixedTransferForOrder(
      userId,
      authorized.docRef,
    );
    return buildPaymentResult(cancelledOrder);
  }
  const synchronized = await syncPayOSOrder(authorized.docRef, authorized.order);
  const attempt = getCurrentAttempt(synchronized);
  if (!attempt || inferNextAction(synchronized, attempt) === "COMPLETED") {
    return buildPaymentResult(synchronized);
  }
  const cancelledOrder = await cancelAttemptSafely(
    authorized.docRef,
    attempt,
    "Thu ngân hủy thanh toán tại quầy POS",
  );
  return buildPaymentResult(cancelledOrder);
}
