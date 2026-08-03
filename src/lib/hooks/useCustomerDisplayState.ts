"use client";

import { useEffect, useState } from "react";
import {
  announceCustomerDisplayReady,
  listenCustomerDisplayState,
} from "@/lib/services/customerDisplayBridge";
import type { CustomerDisplayState } from "@/lib/types/customerDisplay";
import { createIdleCustomerDisplayState } from "@/lib/utils/customerDisplayState";

const INITIAL_RESPONSE_TIMEOUT_MS = 3_000;

export function useCustomerDisplayState(): CustomerDisplayState {
  const [state, setState] = useState<CustomerDisplayState>(() =>
    createIdleCustomerDisplayState(),
  );

  useEffect(() => {
    let isDisposed = false;
    let hasReceivedState = false;
    let stopListening: (() => void) | null = null;
    const responseTimeout = window.setTimeout(() => {
      if (!hasReceivedState && !isDisposed) {
        setState(createIdleCustomerDisplayState("DISCONNECTED"));
      }
    }, INITIAL_RESPONSE_TIMEOUT_MS);

    const initializeSubscription = async () => {
      try {
        stopListening = await listenCustomerDisplayState((nextState) => {
          hasReceivedState = true;
          window.clearTimeout(responseTimeout);
          if (!isDisposed) {
            setState({ ...nextState, connectionStatus: "CONNECTED" });
          }
        });
        if (isDisposed) {
          stopListening();
          return;
        }
        await announceCustomerDisplayReady();
      } catch (error: unknown) {
        console.error("[Màn hình khách] Không thể kết nối cửa sổ thu ngân:", error);
        if (!isDisposed) {
          setState(createIdleCustomerDisplayState("DISCONNECTED"));
        }
      }
    };

    void initializeSubscription();
    return () => {
      isDisposed = true;
      window.clearTimeout(responseTimeout);
      stopListening?.();
    };
  }, []);

  return state;
}
