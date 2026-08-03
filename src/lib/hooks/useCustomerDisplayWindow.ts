"use client";

import { useEffect } from "react";
import {
  listenCustomerDisplayWarning,
  openCustomerDisplayWindow,
} from "@/lib/services/customerDisplayWindowService";
import { showError, showWarning } from "@/lib/utils/toast";

export function useCustomerDisplayWindow(): void {
  useEffect(() => {
    let isDisposed = false;
    let stopListening: (() => void) | null = null;

    const initializeWindow = async () => {
      try {
        stopListening = await listenCustomerDisplayWarning((message) => {
          showWarning("Chưa tìm thấy màn hình phụ", message);
        });

        if (isDisposed) {
          stopListening?.();
          return;
        }

        await openCustomerDisplayWindow();
      } catch (error: unknown) {
        console.error("[Màn hình khách] Không thể khởi tạo cửa sổ:", error);
        if (!isDisposed) {
          showError(
            "Không thể mở màn hình khách",
            "Vui lòng kiểm tra kết nối màn hình và khởi động lại ứng dụng.",
          );
        }
      }
    };

    void initializeWindow();
    return () => {
      isDisposed = true;
      stopListening?.();
    };
  }, []);
}
