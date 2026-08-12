"use client";

import {
  CheckCircle2,
  ImageIcon,
  Languages,
  MonitorPlay,
  PlayCircle,
  Radio,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import Sidebar from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCustomerDisplayAdvertisingSlides } from "@/lib/hooks/useCustomerDisplayAdvertisingSlides";
import { useCustomerDisplayWindow } from "@/lib/hooks/useCustomerDisplayWindow";
import {
  listenCustomerDisplayControl,
  publishCustomerDisplayControl,
} from "@/lib/services/customerDisplayControlBridge";
import type {
  CustomerDisplayControlState,
  CustomerDisplayLanguage,
} from "@/lib/types/customerDisplayControl";
import { DEFAULT_CUSTOMER_DISPLAY_CONTROL } from "@/lib/types/customerDisplayControl";

const LANGUAGES: ReadonlyArray<{
  value: CustomerDisplayLanguage;
  label: string;
  nativeLabel: string;
}> = [
  { value: "vi", label: "Tiếng Việt", nativeLabel: "VI" },
  { value: "en", label: "English", nativeLabel: "EN" },
  { value: "zh", label: "中文", nativeLabel: "中文" },
];

type PublishStatus = "IDLE" | "SYNCING" | "SYNCED" | "ERROR";

const CustomerDisplayControlPage: React.FC = () => {
  useCustomerDisplayWindow();
  const router = useRouter();
  const auth = useAuth();
  const slides = useCustomerDisplayAdvertisingSlides();
  const [control, setControl] = useState<CustomerDisplayControlState>(
    DEFAULT_CUSTOMER_DISPLAY_CONTROL,
  );
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("IDLE");
  const publishAttemptRef = useRef(0);

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || !auth.userDoc)) {
      router.replace("/login");
    }
  }, [auth.isLoading, auth.user, auth.userDoc, router]);

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | null = null;
    void listenCustomerDisplayControl((nextControl) => {
      if (!disposed) setControl(nextControl);
    }).then((stop) => {
      if (disposed) stop();
      else stopListening = stop;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);

  const updateControl = useCallback(async (next: CustomerDisplayControlState) => {
    const attempt = publishAttemptRef.current + 1;
    publishAttemptRef.current = attempt;
    setControl(next);
    setPublishStatus("SYNCING");
    try {
      await publishCustomerDisplayControl(next);
      if (publishAttemptRef.current === attempt) setPublishStatus("SYNCED");
    } catch (error: unknown) {
      console.error("[Điều khiển màn hình khách] Không thể gửi lựa chọn:", error);
      if (publishAttemptRef.current === attempt) setPublishStatus("ERROR");
    }
  }, []);

  const selectLanguage = useCallback((language: CustomerDisplayLanguage) => {
    void updateControl({ ...control, language });
  }, [control, updateControl]);

  const selectSlide = useCallback((pinnedSlideId: string | null) => {
    void updateControl({ ...control, pinnedSlideId });
  }, [control, updateControl]);

  if (auth.isLoading || !auth.user || !auth.userDoc) {
    return (
      <div className="grid h-screen place-items-center bg-[var(--color-background)]">
        <div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  const selectedSlide = slides.find((slide) => slide.id === control.pinnedSlideId);
  const activePinnedSlideId = selectedSlide ? control.pinnedSlideId : null;

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-orange-50 text-[var(--color-accent)]">
              <MonitorPlay className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--color-text-primary)]">
                Điều khiển màn hình khách
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Chọn quảng cáo cần giới thiệu và ngôn ngữ hiển thị
              </p>
            </div>
          </div>
          <div
            className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-bold ${
              publishStatus === "ERROR"
                ? "bg-red-50 text-red-700"
                : publishStatus === "SYNCING"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}
            aria-live="polite"
          >
            <Radio className={`size-3.5 ${publishStatus === "SYNCING" ? "animate-pulse" : ""}`} />
            {publishStatus === "ERROR"
              ? "Chưa gửi được lựa chọn"
              : publishStatus === "SYNCING"
                ? "Đang gửi tới màn hình khách…"
                : "Màn hình khách đã sẵn sàng"}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-7xl space-y-5">
            <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
                    <Languages className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-[var(--color-text-primary)]">
                      Ngôn ngữ trên màn hình khách
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Các tiêu đề, hướng dẫn thanh toán và thông tin thành viên sẽ đổi ngay.
                    </p>
                  </div>
                </div>
                <div className="grid min-w-[360px] grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
                  {LANGUAGES.map((language) => {
                    const selected = control.language === language.value;
                    return (
                      <button
                        key={language.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectLanguage(language.value)}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                          selected
                            ? "bg-white text-[var(--color-accent)] shadow-sm ring-1 ring-black/5"
                            : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                        }`}
                      >
                        <span className="text-[11px] opacity-70">{language.nativeLabel}</span>
                        {language.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--color-text-primary)]">
                    Quảng cáo đang phát
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Nhấn vào một quảng cáo để ghim ngay trên màn hình khách.
                  </p>
                </div>
                <p className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] shadow-sm">
                  {selectedSlide ? `Đang ghim: ${selectedSlide.fileName}` : "Đang tự động trình chiếu"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <button
                  type="button"
                  aria-pressed={activePinnedSlideId === null}
                  onClick={() => selectSlide(null)}
                  className={`group flex min-h-56 flex-col overflow-hidden rounded-3xl border-2 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                    activePinnedSlideId === null
                      ? "border-[var(--color-accent)] ring-4 ring-orange-100"
                      : "border-transparent"
                  }`}
                >
                  <span className="grid min-h-0 flex-1 place-items-center self-stretch bg-gradient-to-br from-orange-50 via-white to-amber-100 text-[var(--color-accent)]">
                    <RotateCcw className="size-12 transition-transform duration-500 group-hover:rotate-180" aria-hidden="true" />
                  </span>
                  <span className="flex w-full items-center justify-between gap-3 p-4">
                    <span>
                      <span className="block text-sm font-extrabold text-[var(--color-text-primary)]">Tự động trình chiếu</span>
                      <span className="mt-1 block text-xs text-[var(--color-text-muted)]">Phát lần lượt toàn bộ playlist</span>
                    </span>
                    {activePinnedSlideId === null ? <CheckCircle2 className="size-5 shrink-0 text-[var(--color-accent)]" /> : null}
                  </span>
                </button>

                {slides.map((slide, index) => {
                  const selected = activePinnedSlideId === slide.id;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectSlide(slide.id)}
                      className={`group overflow-hidden rounded-3xl border-2 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${
                        selected
                          ? "border-[var(--color-accent)] ring-4 ring-orange-100"
                          : "border-transparent"
                      }`}
                    >
                      <span className="relative block aspect-video overflow-hidden bg-slate-950">
                        {slide.type === "VIDEO" ? (
                          <video
                            src={slide.src}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            onMouseEnter={(event) => void event.currentTarget.play()}
                            onMouseLeave={(event) => {
                              event.currentTarget.pause();
                              event.currentTarget.currentTime = 0;
                            }}
                          />
                        ) : (
                          // Cached object URLs cannot use the Next image optimizer.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slide.src}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        )}
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
                          {slide.type === "VIDEO" ? <PlayCircle className="size-3" /> : <ImageIcon className="size-3" />}
                          {slide.type === "VIDEO" ? "Video" : "Hình ảnh"}
                        </span>
                        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-slate-700">
                          #{index + 1}
                        </span>
                        {selected ? (
                          <span className="absolute inset-0 grid place-items-center bg-orange-500/20">
                            <span className="grid size-12 place-items-center rounded-full bg-white text-[var(--color-accent)] shadow-lg">
                              <CheckCircle2 className="size-7" />
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center justify-between gap-3 p-4">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-extrabold text-[var(--color-text-primary)]">{slide.fileName}</span>
                          <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                            {slide.type === "VIDEO" ? "Lặp video khi được ghim" : `Hiển thị ${slide.durationSeconds} giây khi tự động`}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CustomerDisplayControlPage;
