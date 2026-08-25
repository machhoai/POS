"use client";

import { useEffect } from "react";
import { getLuckyDrawSettings } from "@/features/lucky-draw/services/luckyDrawSettingsService";
import { useLuckyDrawSettingsStore } from "@/features/lucky-draw/store/useLuckyDrawSettingsStore";

export function useLuckyDrawSettingsSync(warehouseId: string | null): void {
  const applyRemoteSettings = useLuckyDrawSettingsStore((state) => state.applyRemoteSettings);
  const clearRemoteSettings = useLuckyDrawSettingsStore((state) => state.clearRemoteSettings);

  useEffect(() => {
    if (!warehouseId) return;
    let disposed = false;
    void getLuckyDrawSettings(warehouseId)
      .then((settings) => {
        if (disposed) return;
        if (settings) applyRemoteSettings(settings);
        else clearRemoteSettings(warehouseId);
      })
      .catch((error: unknown) => {
        console.warn("[Bốc thăm] Không thể làm mới cấu hình, đang dùng cache:", error);
      });
    return () => { disposed = true; };
  }, [applyRemoteSettings, clearRemoteSettings, warehouseId]);
}
