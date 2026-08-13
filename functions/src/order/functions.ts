import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  onDocumentUpdated,
  type Change,
  type FirestoreEvent,
} from "firebase-functions/v2/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { DocumentReference } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { POS_COLLECTIONS } from "../config/collections";
import {
  confirmRemotePayment,
  createRemoteOrder,
  queryPaymentStatus,
} from "../services/hkApiService";
import { getPosAuthSession } from "../services/posAuthService";
import { shouldSynchronizeRemoteOrder } from "./orderLifecycle";
import {
  createInvoiceRequestToken,
  isInvoiceRequestToken,
} from "./invoiceRequestToken";
import type {
  OrderItem,
  OrderMemberSnapshot,
  PosOrder,
} from "../types/order";

interface OrderItemInput {
  goodsId: string;
  quantity: number;
}

interface OrderInput {
  localOrderId: string;
  shopId: number;
  warehouseId: string;
  uid?: string;
  member?: OrderMemberSnapshot;
  deviceId?: string;
  items: OrderItemInput[];
}

interface CheckoutInput extends OrderInput {
  paymentMethodId: string;
}

interface OrderListInput {
  limit?: number;
}

interface CloseoutOrderListInput {
  startAt: string;
  endAt: string;
  warehouseId: string;
  scope: "CURRENT_USER" | "ALL_USERS";
}

interface LatestOrderInput {
  shopId: number;
  status?: "DRAFT";
}

interface OperatorInfo {
  employeeId: string;
  firebaseUid: string;
  name: string;
}

interface LocalPaymentMethod {
  id: "CASH" | "QR_CODE";
  methodName: string;
}

const JPOS_PAYMENT_METHODS: Record<string, LocalPaymentMethod> = {
  CASH: { id: "CASH", methodName: "Tiền mặt" },
  QR_CODE: { id: "QR_CODE", methodName: "Chuyển khoản" },
};

const TICKET_PRODUCT_CATEGORY = 4;
const MAX_TICKETS_PER_ORDER = 1_000;

function createTicketCode(): string {
  return `JT-${crypto.randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function resolveJposPaymentMethod(paymentMethodId: string): LocalPaymentMethod {
  const method = JPOS_PAYMENT_METHODS[paymentMethodId];
  if (!method) {
    throw new HttpsError(
      "invalid-argument",
      "Phương thức thanh toán JPOS không hợp lệ.",
    );
  }
  return method;
}

function validateOrderInput(data: unknown): OrderInput {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Dữ liệu đơn hàng không hợp lệ.");
  }

  const input = data as Partial<OrderInput>;
  if (
    typeof input.localOrderId !== "string" ||
    !/^ORD-\d{10,13}-[A-Z0-9]{6}$/.test(input.localOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Mã đơn hàng không hợp lệ.");
  }
  if (!Number.isInteger(input.shopId) || Number(input.shopId) <= 0) {
    throw new HttpsError("invalid-argument", "Mã cửa hàng không hợp lệ.");
  }
  if (
    typeof input.warehouseId !== "string" ||
    input.warehouseId.trim().length === 0
  ) {
    throw new HttpsError("invalid-argument", "Điểm bán không hợp lệ.");
  }
  if (
    input.uid !== undefined &&
    (typeof input.uid !== "string" ||
      input.uid.trim().length === 0 ||
      input.uid.trim().length > 128)
  ) {
    throw new HttpsError("invalid-argument", "UID thành viên không hợp lệ.");
  }
  const uid = typeof input.uid === "string" ? input.uid.trim() : undefined;
  let member: OrderMemberSnapshot | undefined;
  if (input.member !== undefined) {
    if (!input.member || typeof input.member !== "object") {
      throw new HttpsError("invalid-argument", "Thông tin thành viên không hợp lệ.");
    }
    const candidate = input.member as Partial<OrderMemberSnapshot>;
    const memberCode = candidate.memberCode;
    if (
      typeof candidate.uid !== "string" ||
      candidate.uid.trim() !== uid ||
      (memberCode !== null &&
        (typeof memberCode !== "string" || memberCode.trim().length > 128)) ||
      typeof candidate.fullName !== "string" ||
      candidate.fullName.trim().length > 120 ||
      typeof candidate.phone !== "string" ||
      candidate.phone.trim().length > 32 ||
      typeof candidate.levelName !== "string" ||
      candidate.levelName.trim().length > 120
    ) {
      throw new HttpsError("invalid-argument", "Thông tin thành viên không hợp lệ.");
    }
    member = {
      uid: candidate.uid.trim(),
      memberCode: memberCode?.trim() || null,
      fullName: candidate.fullName.trim(),
      phone: candidate.phone.trim(),
      levelName: candidate.levelName.trim(),
    };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpsError("invalid-argument", "Đơn hàng chưa có sản phẩm.");
  }

  const seenGoodsIds = new Set<string>();
  const items = input.items.map((item) => {
    if (
      !item ||
      typeof item.goodsId !== "string" ||
      item.goodsId.trim().length === 0 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Sản phẩm hoặc số lượng không hợp lệ.",
      );
    }
    if (seenGoodsIds.has(item.goodsId)) {
      throw new HttpsError(
        "invalid-argument",
        "Đơn hàng chứa sản phẩm bị trùng.",
      );
    }
    seenGoodsIds.add(item.goodsId);
    return { goodsId: item.goodsId, quantity: item.quantity };
  });

  return {
    localOrderId: input.localOrderId,
    shopId: Number(input.shopId),
    warehouseId: input.warehouseId.trim(),
    ...(uid ? { uid } : {}),
    ...(member ? { member } : {}),
    deviceId:
      typeof input.deviceId === "string" && input.deviceId.length <= 80
        ? input.deviceId
        : undefined,
    items,
  };
}

async function assertWarehouseAccess(
  userId: string,
  warehouseId: string,
): Promise<OperatorInfo> {
  const session = await getPosAuthSession(userId);
  if (
    !session.warehouses.some((warehouse) => warehouse.id === warehouseId) ||
    !hasScopedPermission(session.permissions, "pos.sales.create", warehouseId)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền tạo đơn tại điểm bán này.",
    );
  }
  return {
    employeeId: session.user.employee_id,
    firebaseUid: userId,
    name: session.user.full_name,
  };
}

async function loadAuthoritativeItems(
  itemInputs: OrderItemInput[],
): Promise<OrderItem[]> {
  const refs = itemInputs.map((item) =>
    db.collection(POS_COLLECTIONS.products).doc(item.goodsId),
  );
  const snapshots = await db.getAll(...refs);

  const items = snapshots.map((snapshot, index) => {
    if (!snapshot.exists) {
      throw new HttpsError(
        "failed-precondition",
        `Sản phẩm ${itemInputs[index].goodsId} không còn tồn tại.`,
      );
    }

    const product = snapshot.data();
    const basePrice = Number(product?.price);
    const storedAfterTaxPrice = Number(product?.afterTaxPrice);
    const price = Number.isFinite(storedAfterTaxPrice) && storedAfterTaxPrice > 0
      ? storedAfterTaxPrice
      : basePrice;
    const goodsName = product?.goodsName;
    if (
      typeof goodsName !== "string" ||
      goodsName.length === 0 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Dữ liệu sản phẩm ${itemInputs[index].goodsId} không hợp lệ.`,
      );
    }

    const unitPriceBeforeTax = Number.isFinite(basePrice) && basePrice >= 0
      ? basePrice
      : price;
    const unitTaxAmount = Math.max(0, price - unitPriceBeforeTax);
    const taxRate = unitPriceBeforeTax > 0
      ? Number(((unitTaxAmount / unitPriceBeforeTax) * 100).toFixed(2))
      : 0;
    const category = Number(product?.category);
    const rawTicketsPerUnit = Number(product?.ticketsPerUnit);
    const ticketsPerUnit = category === TICKET_PRODUCT_CATEGORY &&
      Number.isInteger(rawTicketsPerUnit) &&
      rawTicketsPerUnit >= 0
      ? rawTicketsPerUnit
      : 0;
    const ticketCount = ticketsPerUnit * itemInputs[index].quantity;
    if (ticketCount > MAX_TICKETS_PER_ORDER) {
      throw new HttpsError(
        "failed-precondition",
        `Sản phẩm ${goodsName} tạo quá nhiều vé. Vui lòng giảm số lượng hoặc tách đơn.`,
      );
    }

    return {
      goodsId: snapshot.id,
      goodsName,
      price,
      quantity: itemInputs[index].quantity,
      unitPriceBeforeTax,
      taxRate,
      taxAmount: Math.round(unitTaxAmount * itemInputs[index].quantity),
      ticketsPerUnit,
      ...(ticketCount > 0
        ? { ticketCodes: Array.from({ length: ticketCount }, createTicketCode) }
        : {}),
    };
  });

  const totalTicketCount = items.reduce(
    (total, item) => total + (item.ticketCodes?.length ?? 0),
    0,
  );
  if (totalTicketCount > MAX_TICKETS_PER_ORDER) {
    throw new HttpsError(
      "failed-precondition",
      `Đơn hàng vượt quá giới hạn ${MAX_TICKETS_PER_ORDER} vé. Vui lòng tách thành nhiều đơn.`,
    );
  }

  return items;
}

function calculateTotal(items: OrderItem[]): number {
  return items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
}

function createDraftOrder(
  input: OrderInput,
  items: OrderItem[],
  operator: OperatorInfo,
): PosOrder {
  const now = new Date().toISOString();
  return {
    localOrderId: input.localOrderId,
    hkOrderNumber: null,
    invoiceRequestToken: createInvoiceRequestToken(),
    invoiceRequestCreatedAt: now,
    shopId: input.shopId,
    warehouseId: input.warehouseId,
    ...(input.uid ? { uid: input.uid } : {}),
    ...(input.member ? { member: input.member } : {}),
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    createdBy: operator.firebaseUid,
    operatorId: operator.employeeId,
    operatorFirebaseUid: operator.firebaseUid,
    operatorName: operator.name,
    status: "DRAFT",
    paymentMethod: "CASH",
    paymentMethodId: "CASH",
    paymentMethodName: "Tiền mặt",
    totalAmount: calculateTotal(items),
    items,
    sync: {
      retryCount: 0,
      lastError: null,
      syncedAt: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function assertMemberAssociation(order: PosOrder, input: OrderInput): void {
  if (order.uid && input.uid && order.uid !== input.uid) {
    throw new HttpsError(
      "failed-precondition",
      "Đơn hàng đã được gắn với một thành viên khác.",
    );
  }
  if (order.member && input.member && order.member.uid !== input.member.uid) {
    throw new HttpsError(
      "failed-precondition",
      "Đơn hàng đã được gắn với một thành viên khác.",
    );
  }
}

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

/**
 * Validate prices and stage an order for PayOS without marking it as paid.
 * The caller must create the PayOS link and wait for a verified payment before
 * transitioning the order from DRAFT to LOCAL_PAID.
 */
export async function stagePosOrderForPayOS(
  userId: string,
  data: unknown,
): Promise<PosOrder> {
  const input = validateOrderInput(data);
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(input.localOrderId);
  const existingSnapshot = await docRef.get();
  if (existingSnapshot.exists) {
    const existing = existingSnapshot.data() as PosOrder;
    if (existing.orderKind === "MEMBER_PACKAGE") {
      await assertWarehouseAccess(userId, input.warehouseId);
      if (existing.createdBy !== userId) {
        throw new HttpsError(
          "permission-denied",
          "Bạn không có quyền tạo thanh toán cho đơn bán gói này.",
        );
      }
      if (
        existing.status !== "DRAFT" ||
        existing.shopId !== input.shopId ||
        existing.warehouseId !== input.warehouseId ||
        existing.items.length !== 1 ||
        input.items.length !== 1 ||
        existing.items[0].goodsId !== input.items[0].goodsId ||
        input.items[0].quantity !== 1
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Đơn bán gói không còn phù hợp để tạo mã chuyển khoản.",
        );
      }
      const updatedAt = new Date().toISOString();
      await docRef.update({
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        paymentMethod: "QR_CODE",
        paymentMethodId: "QR_CODE",
        paymentMethodName: "Chuyển khoản",
        updatedAt,
      });
      return {
        ...existing,
        ...(input.deviceId ? { deviceId: input.deviceId } : {}),
        paymentMethod: "QR_CODE",
        paymentMethodId: "QR_CODE",
        paymentMethodName: "Chuyển khoản",
        updatedAt,
      };
    }
  }
  const [operator, items] = await Promise.all([
    assertWarehouseAccess(userId, input.warehouseId),
    loadAuthoritativeItems(input.items),
  ]);
  const totalAmount = calculateTotal(items);
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "Tổng tiền thanh toán PayOS phải là số nguyên dương.",
    );
  }

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const now = new Date().toISOString();

    if (!snapshot.exists) {
      const draft: PosOrder = {
        ...createDraftOrder(input, items, operator),
        paymentMethod: "QR_CODE",
        paymentMethodId: "QR_CODE",
        paymentMethodName: "Chuyển khoản",
        totalAmount,
        updatedAt: now,
      };
      transaction.create(docRef, draft);
      return draft;
    }

    const existing = snapshot.data() as PosOrder;
    assertMemberAssociation(existing, input);
    if (existing.createdBy !== userId) {
      throw new HttpsError(
        "permission-denied",
        "Bạn không có quyền tạo thanh toán cho đơn hàng này.",
      );
    }
    if (existing.status !== "DRAFT") {
      throw new HttpsError(
        "failed-precondition",
        "Đơn hàng không còn ở trạng thái chờ thanh toán.",
      );
    }

    const stagedOrder: PosOrder = {
      ...existing,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      invoiceRequestToken: isInvoiceRequestToken(existing.invoiceRequestToken)
        ? existing.invoiceRequestToken
        : createInvoiceRequestToken(),
      invoiceRequestCreatedAt:
        existing.invoiceRequestCreatedAt ?? now,
      shopId: input.shopId,
      warehouseId: input.warehouseId,
      uid: input.uid ?? existing.uid,
      member: input.member ?? existing.member,
      operatorId: operator.employeeId,
      operatorFirebaseUid: operator.firebaseUid,
      operatorName: operator.name,
      paymentMethod: "QR_CODE",
      paymentMethodId: "QR_CODE",
      paymentMethodName: "Chuyển khoản",
      totalAmount,
      items,
      updatedAt: now,
    };
    transaction.update(docRef, {
      ...(stagedOrder.deviceId ? { deviceId: stagedOrder.deviceId } : {}),
      shopId: stagedOrder.shopId,
      warehouseId: stagedOrder.warehouseId,
      ...(stagedOrder.uid ? { uid: stagedOrder.uid } : {}),
      ...(stagedOrder.member ? { member: stagedOrder.member } : {}),
      operatorId: stagedOrder.operatorId,
      operatorFirebaseUid: stagedOrder.operatorFirebaseUid,
      operatorName: stagedOrder.operatorName,
      invoiceRequestToken: stagedOrder.invoiceRequestToken,
      invoiceRequestCreatedAt: stagedOrder.invoiceRequestCreatedAt,
      paymentMethod: stagedOrder.paymentMethod,
      paymentMethodId: stagedOrder.paymentMethodId,
      paymentMethodName: stagedOrder.paymentMethodName,
      totalAmount: stagedOrder.totalAmount,
      items: stagedOrder.items,
      updatedAt: stagedOrder.updatedAt,
    });
    return stagedOrder;
  });
}

export async function preparePosOrderForUser(
  userId: string,
  data: unknown,
) {
  const input = validateOrderInput(data);
  const operator = await assertWarehouseAccess(userId, input.warehouseId);
  const items = await loadAuthoritativeItems(input.items);
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(input.localOrderId);

  try {
    const order = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (snapshot.exists) {
        const existing = snapshot.data() as PosOrder;
        if (existing.createdBy !== userId) {
          throw new HttpsError(
            "permission-denied",
            "Mã đơn hàng đã thuộc về một phiên khác.",
          );
        }
        assertMemberAssociation(existing, input);
        if ((input.uid && !existing.uid) || input.member) {
          const updatedAt = new Date().toISOString();
          transaction.update(docRef, {
            ...(input.uid ? { uid: input.uid } : {}),
            ...(input.member ? { member: input.member } : {}),
            updatedAt,
          });
          return {
            ...existing,
            ...(input.uid ? { uid: input.uid } : {}),
            ...(input.member ? { member: input.member } : {}),
            updatedAt,
          };
        }
        return existing;
      }

      const draft = createDraftOrder(input, items, operator);
      transaction.create(docRef, draft);
      return draft;
    });

    return {
      localOrderId: order.localOrderId,
      status: order.status,
      totalAmount: order.totalAmount,
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    logger.error("[preparePosOrder] Không thể tạo đơn nháp", {
      userId,
      localOrderId: input.localOrderId,
      error,
    });
    throw new HttpsError(
      "internal",
      "Không thể chuẩn bị đơn hàng trên Firebase.",
    );
  }
}

export async function checkoutPosOrderForUser(
  userId: string,
  data: unknown,
) {
  const input = validateOrderInput(data);
  const paymentMethodId = (data as Partial<CheckoutInput>).paymentMethodId;
  if (
    typeof paymentMethodId !== "string" ||
    paymentMethodId.trim().length === 0 ||
    paymentMethodId.length > 128
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Phương thức thanh toán không hợp lệ.",
    );
  }

  const selectedPaymentMethod = resolveJposPaymentMethod(
    paymentMethodId.trim(),
  );
  if (selectedPaymentMethod.id === "QR_CODE") {
    throw new HttpsError(
      "failed-precondition",
      "Thanh toán chuyển khoản phải được xác nhận qua PayOS.",
    );
  }
  const [operator, items] = await Promise.all([
    assertWarehouseAccess(userId, input.warehouseId),
    loadAuthoritativeItems(input.items),
  ]);
  const totalAmount = calculateTotal(items);
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(input.localOrderId);

  try {
    const shouldMarkPaid = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const now = new Date().toISOString();

      if (!snapshot.exists) {
        transaction.create(docRef, {
          ...createDraftOrder(input, items, operator),
          paymentMethod: selectedPaymentMethod.id,
          paymentMethodId: selectedPaymentMethod.id,
          paymentMethodName: selectedPaymentMethod.methodName,
          totalAmount,
          updatedAt: now,
        });
        return true;
      }

      const existing = snapshot.data() as PosOrder;
      if (existing.createdBy !== userId) {
        throw new HttpsError(
          "permission-denied",
          "Bạn không có quyền thanh toán đơn hàng này.",
        );
      }
      assertMemberAssociation(existing, input);
      if (existing.status !== "DRAFT") {
        return false;
      }

      transaction.update(docRef, {
        shopId: input.shopId,
        warehouseId: input.warehouseId,
        ...(input.uid ? { uid: input.uid } : {}),
        ...(input.member ? { member: input.member } : {}),
        operatorId: operator.employeeId,
        operatorFirebaseUid: operator.firebaseUid,
        operatorName: operator.name,
        invoiceRequestToken: isInvoiceRequestToken(existing.invoiceRequestToken)
          ? existing.invoiceRequestToken
          : createInvoiceRequestToken(),
        invoiceRequestCreatedAt:
          existing.invoiceRequestCreatedAt ?? now,
        paymentMethod: selectedPaymentMethod.id,
        paymentMethodId: selectedPaymentMethod.id,
        paymentMethodName: selectedPaymentMethod.methodName,
        totalAmount,
        items,
        updatedAt: now,
      });
      return true;
    });

    if (shouldMarkPaid) {
      const paidAt = new Date().toISOString();
      await docRef.update({
        status: "LOCAL_PAID",
        paidAt,
        updatedAt: paidAt,
      });
    }

    const paidSnapshot = await docRef.get();
    const paidOrder = paidSnapshot.data() as PosOrder;
    return {
      localOrderId: paidOrder.localOrderId,
      hkOrderNumber: paidOrder.hkOrderNumber,
      status: paidOrder.status,
      totalAmount: paidOrder.totalAmount,
      paidAt: paidOrder.paidAt ?? null,
    };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    logger.error("[checkoutPosOrder] Thanh toán Firebase thất bại", {
      userId,
      localOrderId: input.localOrderId,
      error,
    });
    throw new HttpsError(
      "internal",
      "Không thể ghi nhận thanh toán trên Firebase.",
    );
  }
}

export async function getPosOrderStatusForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId =
    data && typeof data === "object"
      ? (data as { localOrderId?: unknown }).localOrderId
      : undefined;
  if (
    typeof localOrderId !== "string" ||
    !/^ORD-\d{10,13}-[A-Z0-9]{6}$/.test(localOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Mã đơn hàng không hợp lệ.");
  }

  const snapshot = await db
    .collection(POS_COLLECTIONS.orders)
    .doc(localOrderId)
    .get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
  }

  const order = snapshot.data() as PosOrder;
  if (order.createdBy !== userId) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền xem đơn hàng này.",
    );
  }

  return {
    localOrderId: order.localOrderId,
    hkOrderNumber: order.hkOrderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    lastError: order.sync?.lastError ?? null,
    updatedAt: order.updatedAt,
  };
}

export async function getPosOrderForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId =
    data && typeof data === "object"
      ? (data as { localOrderId?: unknown }).localOrderId
      : undefined;
  if (
    typeof localOrderId !== "string" ||
    !/^ORD-\d{10,13}-[A-Z0-9]{6}$/.test(localOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Mã đơn hàng không hợp lệ.");
  }

  const [session, snapshot] = await Promise.all([
    getPosAuthSession(userId),
    db.collection(POS_COLLECTIONS.orders).doc(localOrderId).get(),
  ]);
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
  }

  const order = snapshot.data() as PosOrder;
  const warehouseIds = new Set(
    session.warehouses.map((warehouse) => warehouse.id),
  );
  if (
    order.createdBy !== userId &&
    (!warehouseIds.has(order.warehouseId) ||
      !hasScopedPermission(session.permissions, "pos.orders.read", order.warehouseId))
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền xem đơn hàng này.",
    );
  }

  if (isInvoiceRequestToken(order.invoiceRequestToken)) {
    return { order };
  }

  const orderWithInvoiceToken = await db.runTransaction(async (transaction) => {
    const latestSnapshot = await transaction.get(snapshot.ref);
    if (!latestSnapshot.exists) {
      throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
    }

    const latestOrder = latestSnapshot.data() as PosOrder;
    if (isInvoiceRequestToken(latestOrder.invoiceRequestToken)) {
      return latestOrder;
    }

    const invoiceRequestToken = createInvoiceRequestToken();
    const invoiceRequestCreatedAt = new Date().toISOString();
    transaction.update(latestSnapshot.ref, {
      invoiceRequestToken,
      invoiceRequestCreatedAt,
    });

    return {
      ...latestOrder,
      invoiceRequestToken,
      invoiceRequestCreatedAt,
    };
  });

  logger.info("[Biên lai] Đã bổ sung mã yêu cầu hóa đơn cho đơn cũ", {
    localOrderId,
    requestedBy: userId,
  });
  return { order: orderWithInvoiceToken };
}

async function loadAccessibleOrders(
  userId: string,
  requestedLimit: number,
): Promise<PosOrder[]> {
  const session = await getPosAuthSession(userId);
  const warehouseIds = new Set(
    session.warehouses
      .filter((warehouse) =>
        hasScopedPermission(session.permissions, "pos.orders.read", warehouse.id),
      )
      .map((warehouse) => warehouse.id),
  );
  const snapshot = await db
    .collection(POS_COLLECTIONS.orders)
    .orderBy("createdAt", "desc")
    .limit(requestedLimit)
    .get();

  return snapshot.docs
    .map((document) => document.data() as PosOrder)
    .filter(
      (order) =>
        order.createdBy === userId ||
        warehouseIds.has(order.warehouseId),
    );
}

export async function listPosOrdersForUser(
  userId: string,
  data: unknown,
) {
  const rawLimit =
    data && typeof data === "object"
      ? (data as OrderListInput).limit
      : undefined;
  const requestedLimit = Number.isInteger(rawLimit)
    ? Math.min(Math.max(Number(rawLimit), 1), 500)
    : 500;
  const orders = await loadAccessibleOrders(userId, requestedLimit);

  return {
    orders,
    fetchedAt: new Date().toISOString(),
  };
}

function validateCloseoutOrderListInput(data: unknown): CloseoutOrderListInput {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Khoảng thời gian báo cáo không hợp lệ.");
  }

  const input = data as Partial<CloseoutOrderListInput>;
  const startAt = typeof input.startAt === "string" ? input.startAt : "";
  const endAt = typeof input.endAt === "string" ? input.endAt : "";
  const warehouseId = typeof input.warehouseId === "string"
    ? input.warehouseId.trim()
    : "";
  const startTime = Date.parse(startAt);
  const endTime = Date.parse(endAt);

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime >= endTime ||
    endTime - startTime > 48 * 60 * 60 * 1000
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Báo cáo phải có thời gian bắt đầu trước thời gian kết thúc và không dài quá 48 giờ.",
    );
  }
  if (!warehouseId) {
    throw new HttpsError("invalid-argument", "Điểm bán không hợp lệ.");
  }
  if (input.scope !== "CURRENT_USER" && input.scope !== "ALL_USERS") {
    throw new HttpsError("invalid-argument", "Phạm vi tài khoản không hợp lệ.");
  }

  return {
    startAt: new Date(startTime).toISOString(),
    endAt: new Date(endTime).toISOString(),
    warehouseId,
    scope: input.scope,
  };
}

/**
 * Load every paid order in a closeout period. This intentionally uses the
 * authoritative paidAt timestamp and fails instead of silently truncating a
 * financial report.
 */
export async function listCloseoutOrdersForUser(
  userId: string,
  data: unknown,
) {
  const input = validateCloseoutOrderListInput(data);
  const session = await getPosAuthSession(userId);
  if (
    !session.warehouses.some((warehouse) => warehouse.id === input.warehouseId) ||
    !hasScopedPermission(session.permissions, "pos.shift.close", input.warehouseId)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền xem báo cáo tại điểm bán này.",
    );
  }

  const snapshot = await db
    .collection(POS_COLLECTIONS.orders)
    .where("paidAt", ">=", input.startAt)
    .where("paidAt", "<", input.endAt)
    .orderBy("paidAt", "desc")
    .limit(5_001)
    .get();

  if (snapshot.size > 5_000) {
    throw new HttpsError(
      "resource-exhausted",
      "Báo cáo có quá nhiều đơn hàng. Vui lòng chia nhỏ khoảng thời gian.",
    );
  }

  const orders = snapshot.docs
    .map((document) => document.data() as PosOrder)
    .filter((order) =>
      order.warehouseId === input.warehouseId &&
      order.status !== "DRAFT" &&
      (input.scope === "ALL_USERS" || order.createdBy === userId)
    );

  return {
    orders,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getLatestPosOrderForUser(
  userId: string,
  data: unknown,
) {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Điểm bán không hợp lệ.");
  }
  const input = data as Partial<LatestOrderInput>;
  if (!Number.isInteger(input.shopId) || Number(input.shopId) <= 0) {
    throw new HttpsError("invalid-argument", "Điểm bán không hợp lệ.");
  }
  if (input.status !== undefined && input.status !== "DRAFT") {
    throw new HttpsError("invalid-argument", "Trạng thái đơn không hợp lệ.");
  }

  const orders = await loadAccessibleOrders(userId, 200);
  const order = orders.find(
    (candidate) =>
      candidate.shopId === Number(input.shopId) &&
      (!input.status || candidate.status === input.status),
  );

  return { order: order ?? null };
}

export async function retryPosOrderSyncForUser(
  userId: string,
  data: unknown,
) {
  const localOrderId =
    data && typeof data === "object"
      ? (data as { localOrderId?: unknown }).localOrderId
      : undefined;
  if (
    typeof localOrderId !== "string" ||
    !/^ORD-\d{10,13}-[A-Z0-9]{6}$/.test(localOrderId)
  ) {
    throw new HttpsError("invalid-argument", "Mã đơn hàng không hợp lệ.");
  }

  const session = await getPosAuthSession(userId);
  const warehouseIds = new Set(
    session.warehouses.map((warehouse) => warehouse.id),
  );
  const docRef = db.collection(POS_COLLECTIONS.orders).doc(localOrderId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Không tìm thấy đơn hàng.");
  }

  const order = snapshot.data() as PosOrder;
  if (
    !warehouseIds.has(order.warehouseId) ||
    !hasScopedPermission(
      session.permissions,
      "pos.orders.retry_sync",
      order.warehouseId,
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Bạn không có quyền đồng bộ lại đơn hàng này.",
    );
  }
  if (order.status !== "SYNC_FAILED") {
    return {
      localOrderId,
      status: order.status,
      queued: false,
    };
  }

  const updatedAt = new Date().toISOString();
  await docRef.update({
    status: "LOCAL_PAID",
    updatedAt,
    "sync.retryCount": 0,
    "sync.lastError": null,
  });
  return {
    localOrderId,
    status: "LOCAL_PAID",
    queued: true,
  };
}

function isRemotePaymentConfirmed(response: {
  success: boolean;
  data: Record<string, unknown> | null;
}): boolean {
  return response.success && Number(response.data?.payStatus) === 2;
}

async function synchronizeRemoteOrder(
  docRef: DocumentReference,
  orderId: string,
  order: PosOrder,
): Promise<void> {
  await docRef.update({
    status: "SYNCING",
    updatedAt: new Date().toISOString(),
  });

  let hkOrderNumber = order.hkOrderNumber;
  try {
    if (!hkOrderNumber) {
      const createResponse = await createRemoteOrder({
        uid: order.uid || "",
        goodsItems: order.items.map((item) => ({
          goodsId: item.goodsId,
          quantity: String(item.quantity),
        })),
      });
      if (!createResponse.success) {
        throw new Error(
          `order_create thất bại: [${createResponse.code}] ${createResponse.msg}`,
        );
      }

      hkOrderNumber =
        typeof createResponse.data?.orderNumber === "string"
          ? createResponse.data.orderNumber
          : null;
      if (!hkOrderNumber) {
        throw new Error("order_create không trả về orderNumber.");
      }

      await docRef.update({
        hkOrderNumber,
        updatedAt: new Date().toISOString(),
      });
    }

    let statusResponse = order.hkOrderNumber
      ? await queryPaymentStatus({ orderNumber: hkOrderNumber })
      : null;

    if (!statusResponse || !isRemotePaymentConfirmed(statusResponse)) {
      const payResponse = await confirmRemotePayment({
        orderNumber: hkOrderNumber,
      });
      statusResponse = await queryPaymentStatus({
        orderNumber: hkOrderNumber,
      });

      if (
        !payResponse.success &&
        !isRemotePaymentConfirmed(statusResponse)
      ) {
        throw new Error(
          `order_pay thất bại: [${payResponse.code}] ${payResponse.msg}`,
        );
      }
    }

    if (!isRemotePaymentConfirmed(statusResponse)) {
      throw new Error(
        `order_pay_query chưa xác nhận đã thanh toán: ${statusResponse.msg}`,
      );
    }

    const syncedAt = new Date().toISOString();
    await docRef.update({
      status: "SYNC_SUCCESS",
      hkOrderNumber,
      updatedAt: syncedAt,
      sync: {
        retryCount: order.sync?.retryCount || 0,
        lastError: null,
        syncedAt,
      },
    });
    logger.info("[Đồng bộ đơn] Hoàn tất", { orderId, hkOrderNumber });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const updatedAt = new Date().toISOString();
    await docRef.update({
      status: "SYNC_FAILED",
      hkOrderNumber: hkOrderNumber || null,
      updatedAt,
      sync: {
        retryCount: (order.sync?.retryCount || 0) + 1,
        lastError: errorMessage,
        syncedAt: null,
      },
    });
    logger.error("[Đồng bộ đơn] Thất bại, thanh toán local vẫn hợp lệ", {
      orderId,
      hkOrderNumber,
      error: errorMessage,
    });
  }
}

async function recordPosOrderAudit(
  orderId: string,
  before: PosOrder,
  after: PosOrder,
): Promise<void> {
  const initialPayment = before.status === "DRAFT";
  const auditId = initialPayment
    ? `pos-order-paid-${orderId}`
    : `pos-order-retry-${orderId}-${after.sync?.retryCount ?? 0}`;
  try {
    await db.collection("audit_logs").doc(auditId).create({
      id: auditId,
      entity_type: "POS_ORDER",
      entity_id: orderId,
      entity_name: orderId,
      warehouse_id: after.warehouseId,
      action: initialPayment ? "CREATE" : "UPDATE",
      user_id: after.createdBy,
      user_name: after.operatorName,
      action_time: new Date(after.updatedAt),
      sync_time: new Date(),
      old_value: {
        status: before.status,
        payment_method: before.paymentMethodId,
      },
      new_value: {
        status: after.status,
        payment_method: after.paymentMethodId,
        total_amount: after.totalAmount,
        payment_verification_status: after.paymentVerificationStatus ?? "VERIFIED",
      },
      ip_address: null,
      device_id: after.deviceId ?? null,
      session_token: null,
      notes: initialPayment
        ? "Completed basic JPOS checkout"
        : "Queued JPOS order synchronization retry",
    });
  } catch (error: unknown) {
    const code = (error as { code?: number | string }).code;
    if (code === 6 || code === "already-exists") return;
    throw error;
  }
}

export const onOrderLocalPaid = onDocumentUpdated(
  {
    document: `${POS_COLLECTIONS.orders}/{orderId}`,
    region: "asia-southeast1",
    timeoutSeconds: 120,
  },
  async (
    event: FirestoreEvent<
      Change<FirebaseFirestore.QueryDocumentSnapshot> | undefined,
      { orderId: string }
    >,
  ) => {
    if (!event.data) return;

    const before = event.data.before.data() as PosOrder;
    const after = event.data.after.data() as PosOrder;
    if (!shouldSynchronizeRemoteOrder(
      before.status,
      after.status,
      after.orderKind ?? "STANDARD",
    )) {
      return;
    }

    await recordPosOrderAudit(event.params.orderId, before, after);

    const docRef = db
      .collection(POS_COLLECTIONS.orders)
      .doc(event.params.orderId);
    await synchronizeRemoteOrder(docRef, event.params.orderId, after);
  },
);

export const retryFailedOrderSyncs = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "asia-southeast1",
    timeoutSeconds: 120,
  },
  async () => {
    const snapshot = await db
      .collection(POS_COLLECTIONS.orders)
      .where("status", "==", "SYNC_FAILED")
      .where("sync.retryCount", "<", 5)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    let queuedCount = 0;
    for (const document of snapshot.docs) {
      const order = document.data() as PosOrder;
      if (order.orderKind === "MEMBER_PACKAGE") continue;
      batch.update(document.ref, {
        status: "LOCAL_PAID",
        updatedAt: new Date().toISOString(),
      });
      queuedCount += 1;
    }
    if (queuedCount === 0) return;
    await batch.commit();
    logger.info("[Đồng bộ đơn] Đã xếp lại đơn lỗi", {
      count: queuedCount,
    });
  },
);
