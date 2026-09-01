"use client";

import { useEffect } from "react";

import {
  announceCustomerDisplayAdvertisingReady,
  listenCustomerDisplayAdvertising,
} from "@/lib/services/customerDisplayAdvertisingBridge";
import { useCustomerDisplayAdvertisingStore } from "@/lib/stores/useCustomerDisplayAdvertisingStore";

export function useCustomerDisplayAdvertisingBridge(): void {
  const applyView = useCustomerDisplayAdvertisingStore((state) => state.applyView);

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | null = null;
    const initialize = async () => {
      try {
        stopListening = await listenCustomerDisplayAdvertising((view) => {
          if (!disposed) applyView(view);
        });
        if (disposed) {
          stopListening();
          return;
        }
        await announceCustomerDisplayAdvertisingReady();
      } catch (error: unknown) {
        console.error("[Quảng cáo màn hình khách] Không thể kết nối bridge:", error);
      }
    };
    void initialize();
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [applyView]);
}
