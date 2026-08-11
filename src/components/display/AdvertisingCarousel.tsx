"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CustomerDisplayResolvedSlide } from "@/lib/types/customerDisplayAdvertising";

const SLIDE_TRANSITION_MS = 700;

interface AdvertisingMediaProps {
  slide: CustomerDisplayResolvedSlide;
  active: boolean;
  leaving: boolean;
  onEnded: () => void;
}

const AdvertisingMedia: React.FC<AdvertisingMediaProps> = ({
  slide,
  active,
  leaving,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (slide.type !== "VIDEO" || !videoRef.current) return;
    if (active) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => undefined);
    } else if (!leaving) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [active, leaving, slide.type]);

  return slide.type === "VIDEO" ? (
    <video
      ref={videoRef}
      src={slide.src}
      muted
      playsInline
      preload="auto"
      onEnded={active ? onEnded : undefined}
      className="h-full w-full object-cover"
      aria-label={slide.fileName}
    />
  ) : (
    // Media is served from IndexedDB object URLs and cannot use the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.src} alt={slide.fileName} className="h-full w-full object-cover" />
  );
};

const AdvertisingCarousel: React.FC<{
  slides: readonly CustomerDisplayResolvedSlide[];
}> = ({ slides }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const safeActiveIndex = activeIndex % Math.max(1, slides.length);
  const activeSlide = slides[safeActiveIndex];

  const advance = useCallback(() => {
    if (slides.length <= 1) return;
    setLeavingIndex(safeActiveIndex);
    setActiveIndex((safeActiveIndex + 1) % slides.length);
  }, [safeActiveIndex, slides.length]);

  useEffect(() => {
    if (!activeSlide || slides.length <= 1) return;
    const timeout = window.setTimeout(
      advance,
      activeSlide.type === "VIDEO" ? 15_000 : activeSlide.durationSeconds * 1_000,
    );
    return () => window.clearTimeout(timeout);
  }, [activeSlide, advance, slides.length]);

  useEffect(() => {
    if (leavingIndex === null) return;
    const timeout = window.setTimeout(
      () => setLeavingIndex(null),
      SLIDE_TRANSITION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [leavingIndex]);

  if (!activeSlide) return null;
  return (
    <section
      className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-xl)] bg-slate-950 shadow-[var(--shadow-lg)]"
      aria-label="Quảng cáo và ưu đãi"
      aria-roledescription="băng chuyền"
    >
      {slides.map((slide, index) => {
        const active = index === safeActiveIndex;
        const leaving = index === leavingIndex && !active;
        const position = active
          ? "z-20 translate-x-0"
          : leaving
            ? "z-10 -translate-x-full"
            : "z-0 translate-x-full";
        return (
          <article
            key={slide.id}
            aria-hidden={!active}
            className={`absolute inset-0 will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${position}`}
          >
            <AdvertisingMedia
              slide={slide}
              active={active}
              leaving={leaving}
              onEnded={advance}
            />
          </article>
        );
      })}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-20 bg-gradient-to-t from-black/45 to-transparent"
        aria-hidden="true"
      />
      {slides.length > 1 ? (
        <div className="absolute bottom-5 right-6 z-40 flex gap-2" aria-hidden="true">
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              className={`h-2.5 rounded-full bg-white transition-all duration-500 ${index === safeActiveIndex ? "w-8" : "w-2.5 opacity-50"}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default AdvertisingCarousel;
