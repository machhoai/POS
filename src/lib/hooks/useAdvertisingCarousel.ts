"use client";

import { useEffect, useState } from "react";

const ROTATION_INTERVAL_MS = 7_000;

export function useAdvertisingCarousel(slideCount: number): number {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slideCount <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slideCount);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [slideCount]);

  return slideCount === 0 ? 0 : activeIndex % slideCount;
}
