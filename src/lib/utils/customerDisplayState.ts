import type {
  CustomerDisplayConnectionStatus,
  CustomerDisplayOrderSnapshot,
  CustomerDisplayState,
  CustomerDisplayTransferPayment,
} from "@/lib/types/customerDisplay";
import type {
  FixedTransferDetails,
  OrderItem,
  OrderMemberSnapshot,
  OrderStatus,
  PaymentMethod,
} from "@/lib/types/order";
import type {
  PayOSNextAction,
  PayOSPaymentSession,
} from "@/lib/types/payment";

interface CustomerDisplayPaymentSource {
  session: PayOSPaymentSession | null;
  fixedTransfer: FixedTransferDetails | null;
  nextAction: PayOSNextAction | null;
  remainingSeconds: number;
  /** Chỉ truyền tín hiệu lỗi; không đưa nội dung lỗi vận hành vào luồng màn hình khách. */
  hasError: boolean;
  isCartLocked: boolean;
  isBusy: boolean;
}

interface CreateCustomerDisplayStateInput {
  items: readonly OrderItem[];
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus | null;
  payment: CustomerDisplayPaymentSource;
  lastOrder: CustomerDisplayOrderSnapshot | null;
  member?: OrderMemberSnapshot | null;
}

export function createIdleCustomerDisplayState(
  connectionStatus: CustomerDisplayConnectionStatus = "CONNECTING",
): CustomerDisplayState {
  return {
    mode: "IDLE",
    connectionStatus,
    order: null,
    payment: { status: "NOT_STARTED", qr: null },
  };
}

export function createCustomerDisplayOrderSnapshot(
  items: readonly OrderItem[],
  paymentMethod: PaymentMethod,
  member: OrderMemberSnapshot | null = null,
): CustomerDisplayOrderSnapshot | null {
  if (items.length === 0) return null;
  return {
    items: items.map((item) => ({
      name: item.goodsName,
      quantity: item.quantity,
      unitPrice: item.price,
    })),
    totalAmount: items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ),
    paymentMethod: paymentMethod === "QR_CODE" ? "TRANSFER" : "CASH",
    member: member
      ? {
          fullName: member.fullName,
          phone: member.phone,
          memberCode: member.memberCode,
          levelName: member.levelName,
        }
      : null,
  };
}

function createTransferPayment(
  source: CustomerDisplayPaymentSource,
): CustomerDisplayTransferPayment {
  const { session, nextAction } = source;
  if (
    source.fixedTransfer?.status === "AWAITING_MANUAL_CONFIRMATION"
  ) {
    return {
      status: "AWAITING_PAYMENT",
      qr: {
        value: null,
        imageUrl: source.fixedTransfer.qrImageUrl,
        amount: source.fixedTransfer.amount,
        description: source.fixedTransfer.description,
        remainingSeconds: 0,
        snapshotAt: Date.now(),
        expiresAt: "",
        accountName: source.fixedTransfer.accountName,
        accountNumber: source.fixedTransfer.accountNumber,
        manualConfirmationRequired: true,
      },
    };
  }
  if (session?.status === "CANCELLED") return { status: "CANCELLED", qr: null };
  if (
    session?.status === "EXPIRED" ||
    nextAction === "RETRY_DISPLAY" ||
    nextAction === "RECREATE"
  ) {
    return { status: "EXPIRED", qr: null };
  }
  if (session?.status === "FAILED") return { status: "ERROR", qr: null };
  if (
    (source.isBusy && nextAction !== "WAIT") ||
    session?.status === "CREATING"
  ) {
    return { status: "CREATING", qr: null };
  }
  if (
    session?.qrCode &&
    (nextAction === "WAIT" ||
      ["PENDING", "PROCESSING", "UNDERPAID"].includes(session.status))
  ) {
    return {
      status: "AWAITING_PAYMENT",
      qr: {
        value: session.qrCode,
        imageUrl: null,
        amount: session.amount,
        description: session.description,
        remainingSeconds: Math.max(0, source.remainingSeconds),
        snapshotAt: Date.now(),
        expiresAt: session.displayExpiresAt,
        accountName: session.accountName || "",
        accountNumber: session.accountNumber || "",
        manualConfirmationRequired: false,
      },
    };
  }
  return { status: "ERROR", qr: null };
}

export function createCustomerDisplayState(
  input: CreateCustomerDisplayStateInput,
): CustomerDisplayState {
  const currentOrder = createCustomerDisplayOrderSnapshot(
    input.items,
    input.paymentMethod,
    input.member ?? null,
  );
  const order = currentOrder ?? input.lastOrder;
  const isPaid =
    (input.orderStatus !== null && input.orderStatus !== "DRAFT") ||
    input.payment.session?.status === "PAID" ||
    input.payment.nextAction === "COMPLETED";

  if (isPaid && order) {
    return {
      mode: "SUCCESS",
      connectionStatus: "CONNECTED",
      order,
      payment: { status: "PAID", qr: null },
    };
  }

  if (!currentOrder) return createIdleCustomerDisplayState("CONNECTED");

  const hasTransferSession =
    input.paymentMethod === "QR_CODE" &&
    (input.payment.session !== null ||
      input.payment.fixedTransfer !== null ||
      input.payment.isBusy ||
      input.payment.isCartLocked ||
      input.payment.hasError);

  if (hasTransferSession) {
    return {
      mode: "TRANSFER",
      connectionStatus: "CONNECTED",
      order: { ...currentOrder, paymentMethod: "TRANSFER" },
      payment: createTransferPayment(input.payment),
    };
  }

  return {
    mode: "CART",
    connectionStatus: "CONNECTED",
    order: currentOrder,
    payment: { status: "NOT_STARTED", qr: null },
  };
}
