"use client";

import { useEffect } from "react";
import { Home, RotateCcw, ShieldCheck } from "lucide-react";
import { recordPendingFailure } from "@/lib/services/checkoutJournalService";

interface ErrorPageProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function ErrorPage({ error, unstable_retry }: ErrorPageProps) {
  useEffect(() => {
    console.error("[JPOS] Route gặp lỗi chưa xử lý:", error);
    void recordPendingFailure("RENDER_ERROR", error, { source: "route-boundary" });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-background)] p-6">
      <section className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 shadow-xl">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-[var(--color-text-primary)]">
          JPOS đã chặn một lỗi giao diện
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Dữ liệu thanh toán đang được giữ trong bộ nhớ phục hồi. Bạn có thể thử
          mở lại màn hình hoặc quay về bán hàng.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={unstable_retry}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-bold text-white"
          >
            <RotateCcw className="size-4" /> Thử khôi phục
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold"
          >
            <Home className="size-4" /> Về bán hàng
          </button>
        </div>
      </section>
    </main>
  );
}
