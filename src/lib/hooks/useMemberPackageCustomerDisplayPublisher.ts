"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  listenCustomerDisplayReady,
  publishCustomerDisplayState,
} from "@/lib/services/customerDisplayBridge";
import type { MemberMutationState, MemberPointPackage } from "@/lib/types/member";
import type { PaymentMethod } from "@/lib/types/order";
import type { PayOSCheckoutController } from "@/lib/types/payment";
import type { CustomerDisplayState } from "@/lib/types/customerDisplay";
import {
  createCustomerDisplayOrderSnapshot,
  createCustomerDisplayState,
  createIdleCustomerDisplayState,
} from "@/lib/utils/customerDisplayState";
import { showError } from "@/lib/utils/toast";

interface MemberPackageDisplayInput {
  enabled: boolean;
  selectedPackage: MemberPointPackage | null;
  mutation: MemberMutationState;
  paymentMethod: PaymentMethod;
  payment: PayOSCheckoutController;
}

export function useMemberPackageCustomerDisplayPublisher({
  enabled,
  selectedPackage,
  mutation,
  paymentMethod,
  payment,
}: MemberPackageDisplayInput): void {
  const paymentSession = payment.session;
  const paymentNextAction = payment.nextAction;
  const paymentRemainingSeconds = payment.remainingSeconds;
  const paymentErrorMessage = payment.errorMessage;
  const paymentIsCartLocked = payment.isCartLocked;
  const paymentIsBusy = payment.isBusy;
  const displayState = useMemo<CustomerDisplayState>(() => {
    if (!enabled || !selectedPackage) {
      return createIdleCustomerDisplayState("CONNECTED");
    }
    const statusText = mutation.status === "WAITING_API"
      ? " · Đang chờ OpenAPI cộng điểm"
      : mutation.status === "SUCCEEDED"
        ? " · Đã cộng điểm thành công"
        : "";
    const items = [{
      goodsId: selectedPackage.goodsId,
      goodsName: `${selectedPackage.name} · Nhận ${selectedPackage.totalPoints.toLocaleString("vi-VN")} điểm${statusText}`,
      price: selectedPackage.paymentAmountVnd,
      quantity: 1,
    }];
    const order = createCustomerDisplayOrderSnapshot(items, paymentMethod)!;
    if (mutation.status === "SUCCEEDED") {
      return {
        mode: "SUCCESS",
        connectionStatus: "CONNECTED",
        order,
        payment: { status: "PAID", qr: null },
      };
    }
    if (mutation.status === "WAITING_PAYMENT" && paymentMethod === "QR_CODE") {
      return createCustomerDisplayState({
        items,
        paymentMethod,
        orderStatus: "DRAFT",
        payment: {
          session: paymentSession,
          nextAction: paymentNextAction,
          remainingSeconds: paymentRemainingSeconds,
          errorMessage: paymentErrorMessage,
          isCartLocked: paymentIsCartLocked,
          isBusy: paymentIsBusy,
        },
        lastOrder: order,
      });
    }
    return {
      mode: "CART",
      connectionStatus: "CONNECTED",
      order,
      payment: { status: "NOT_STARTED", qr: null },
    };
  }, [
    enabled,
    mutation.status,
    paymentErrorMessage,
    paymentIsBusy,
    paymentIsCartLocked,
    paymentMethod,
    paymentNextAction,
    paymentRemainingSeconds,
    paymentSession,
    selectedPackage,
  ]);
  const latestStateRef = useRef(displayState);

  useEffect(() => {
    if (!enabled) return;
    latestStateRef.current = displayState;
    void publishCustomerDisplayState(displayState).catch((error: unknown) => {
      console.error("[Thành viên] Không thể hiển thị gói trên màn hình khách:", error);
      showError("Không thể cập nhật màn hình khách", "Vui lòng kiểm tra kết nối màn hình phụ.");
    });
  }, [displayState, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let stopListening: (() => void) | null = null;
    void listenCustomerDisplayReady(() => {
      void publishCustomerDisplayState(latestStateRef.current);
    }).then((stop) => {
      if (disposed) stop();
      else stopListening = stop;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [enabled]);
}
