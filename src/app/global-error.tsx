"use client";

import { useEffect } from "react";
import { recordPendingFailure } from "@/lib/services/checkoutJournalService";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[JPOS] Lỗi root layout:", error);
    void recordPendingFailure("RENDER_ERROR", error, { source: "global-boundary" });
  }, [error]);

  return (
    <html lang="vi">
      <body className="m-0 bg-[#f6f7f8] font-sans text-[#2d2926]">
        <main className="grid min-h-screen place-items-center p-6">
          <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h1 className="m-0 text-xl font-extrabold">
              JPOS đang tự phục hồi
            </h1>
            <p className="text-sm leading-6 text-[#64666b]">
              Giao dịch đang làm dở đã được lưu. Hãy thử khôi phục; nếu chưa được,
              mở lại ứng dụng để tiếp tục từ checkpoint gần nhất.
            </p>
            <button
              type="button"
              onClick={unstable_retry}
              className="min-h-11 rounded-xl border-0 bg-[#fc4c02] px-5 font-bold text-white"
            >
              Thử khôi phục
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
