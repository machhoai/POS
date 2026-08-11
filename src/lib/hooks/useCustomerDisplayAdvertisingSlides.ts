"use client";

import { useEffect, useState } from "react";

import { getCachedCustomerDisplayMedia } from "@/lib/services/customerDisplayMediaCacheService";
import { useCustomerDisplayAdvertisingStore } from "@/lib/stores/useCustomerDisplayAdvertisingStore";
import type { CustomerDisplayResolvedSlide } from "@/lib/types/customerDisplayAdvertising";

const FALLBACK_SLIDE: CustomerDisplayResolvedSlide = {
  id: "jpos-fallback",
  type: "IMAGE",
  src: "/customer-display-fallback.svg",
  fileName: "Joy World",
  durationSeconds: 7,
};

export function useCustomerDisplayAdvertisingSlides(): CustomerDisplayResolvedSlide[] {
  const view = useCustomerDisplayAdvertisingStore((state) => state.view);
  const [slides, setSlides] = useState<CustomerDisplayResolvedSlide[]>([FALLBACK_SLIDE]);

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    const resolveSlides = async () => {
      const mediaById = new Map(view?.media.map((item) => [item.id, item]) ?? []);
      const playlist = (view?.settings?.playlist ?? [])
        .filter((item) => item.enabled)
        .slice()
        .sort((left, right) => left.sort_order - right.sort_order);
      const next = (
        await Promise.all(
          playlist.map(async (item): Promise<CustomerDisplayResolvedSlide | null> => {
            const media = mediaById.get(item.media_id);
            if (!media || media.is_deleted) return null;
            const cached = await getCachedCustomerDisplayMedia(media.id);
            if (!cached || cached.checksum !== media.checksum_sha256) return null;
            const src = URL.createObjectURL(cached.blob);
            objectUrls.push(src);
            return {
              id: media.id,
              type: media.type,
              src,
              fileName: media.file_name,
              durationSeconds:
                media.type === "VIDEO"
                  ? Math.min(15, Math.max(1, media.duration_seconds ?? 15))
                  : Math.min(15, Math.max(3, item.image_duration_seconds ?? 7)),
            };
          }),
        )
      ).filter((item): item is CustomerDisplayResolvedSlide => item !== null);
      if (!disposed) setSlides(next.length > 0 ? next : [FALLBACK_SLIDE]);
    };
    void resolveSlides();
    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [view]);

  return slides;
}
