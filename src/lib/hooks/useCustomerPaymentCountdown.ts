"use client";

import { useEffect, useState } from "react";
import type { CustomerDisplayQr } from "@/lib/types/customerDisplay";

const COUNTDOWN_INTERVAL_MS = 1_000;

function calculateRemainingSeconds(
  qr: CustomerDisplayQr | null,
  nowMs: number,
): number {
  if (!qr) return 0;
  const deadlineMs = qr.snapshotAt + qr.remainingSeconds * 1_000;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000));
}

export function useCustomerPaymentCountdown(
  qr: CustomerDisplayQr | null,
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, COUNTDOWN_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return calculateRemainingSeconds(qr, nowMs);
}
