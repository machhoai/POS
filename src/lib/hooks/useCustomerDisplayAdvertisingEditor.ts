"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getCustomerDisplayAdvertising,
  listenCustomerDisplayAdvertisingVersion,
} from "@/lib/services/customerDisplayAdvertisingService";
import type { CustomerDisplayAdvertisingView } from "@/lib/types/customerDisplayAdvertising";

export function useCustomerDisplayAdvertisingEditor(warehouseId: string | null, enabled: boolean) {
  const [view, setView] = useState<CustomerDisplayAdvertisingView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number | null>(null);
  const requestId = useRef(0);

  const replace = useCallback((next: CustomerDisplayAdvertisingView) => {
    versionRef.current = next.settings?.version ?? 0;
    setView(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!warehouseId || !enabled) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await getCustomerDisplayAdvertising();
      if (requestId.current === currentRequest) replace(next);
    } catch (reason) {
      if (requestId.current === currentRequest) {
        setError(reason instanceof Error ? reason.message : "Không thể tải quảng cáo.");
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [enabled, replace, warehouseId]);

  useEffect(() => {
    versionRef.current = null;
    if (!warehouseId || !enabled) return;
    queueMicrotask(() => void refresh());
    return listenCustomerDisplayAdvertisingVersion(
      warehouseId,
      (version) => {
        if (versionRef.current !== null && versionRef.current !== version) void refresh();
      },
      () => setError("Không thể theo dõi cấu hình realtime từ JPULSE."),
    );
  }, [enabled, refresh, warehouseId]);

  return { view, loading, error, replace, refresh };
}
