"use client";

import { useEffect, useRef } from "react";
import {
  listenCustomerDisplayReady,
  publishCustomerDisplayState,
} from "@/lib/services/customerDisplayBridge";
import { useCartStore } from "@/lib/stores/useCartStore";
import type {
  CustomerDisplayOrderSnapshot,
  CustomerDisplayState,
} from "@/lib/types/customerDisplay";
import type { PayOSCheckoutController } from "@/lib/types/payment";
import {
  createCustomerDisplayOrderSnapshot,
  createCustomerDisplayState,
  createIdleCustomerDisplayState,
} from "@/lib/utils/customerDisplayState";

export function useCustomerDisplayPublisher(
  payOSPayment: PayOSCheckoutController,
): void {
  const items = useCartStore((state) => state.items);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const orderStatus = useCartStore((state) => state.currentOrderStatus);
  const lastOrderRef = useRef<CustomerDisplayOrderSnapshot | null>(null);
  const latestStateRef = useRef<CustomerDisplayState>(
    createIdleCustomerDisplayState("CONNECTED"),
  );
  const session = payOSPayment.session;
  const fixedTransfer = payOSPayment.fixedTransfer;
  const nextAction = payOSPayment.nextAction;
  const remainingSeconds = payOSPayment.remainingSeconds;
  const errorMessage = payOSPayment.errorMessage;
  const isCartLocked = payOSPayment.isCartLocked;
  const isBusy = payOSPayment.isBusy;

  useEffect(() => {
    const currentOrder = createCustomerDisplayOrderSnapshot(items, paymentMethod);
    if (currentOrder) lastOrderRef.current = currentOrder;
    const displayState = createCustomerDisplayState({
      items,
      paymentMethod,
      orderStatus,
      payment: {
        session,
        fixedTransfer,
        nextAction,
        remainingSeconds,
        errorMessage,
        isCartLocked,
        isBusy,
      },
      lastOrder: lastOrderRef.current,
    });
    latestStateRef.current = displayState;
    void publishCustomerDisplayState(displayState).catch((error: unknown) => {
      console.error("[Màn hình khách] Không thể gửi trạng thái:", error);
    });
  }, [
    errorMessage,
    fixedTransfer,
    isBusy,
    isCartLocked,
    items,
    nextAction,
    orderStatus,
    paymentMethod,
    remainingSeconds,
    session,
  ]);

  useEffect(() => {
    let isDisposed = false;
    let stopListening: (() => void) | null = null;

    void listenCustomerDisplayReady(() => {
      void publishCustomerDisplayState(latestStateRef.current).catch(
        (error: unknown) => {
          console.error("[Màn hình khách] Không thể gửi snapshot ban đầu:", error);
        },
      );
    })
      .then((stop) => {
        if (isDisposed) stop();
        else stopListening = stop;
      })
      .catch((error: unknown) => {
        console.error("[Màn hình khách] Không thể lắng nghe tín hiệu sẵn sàng:", error);
      });

    return () => {
      isDisposed = true;
      stopListening?.();
    };
  }, []);
}
