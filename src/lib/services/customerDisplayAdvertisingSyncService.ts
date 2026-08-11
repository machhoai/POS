import {
  cacheCustomerDisplayMedia,
  removeObsoleteCustomerDisplayMedia,
} from "@/lib/services/customerDisplayMediaCacheService";
import { useCustomerDisplayAdvertisingStore } from "@/lib/stores/useCustomerDisplayAdvertisingStore";
import type { CustomerDisplayAdvertisingView } from "@/lib/types/customerDisplayAdvertising";

export async function applyCustomerDisplayAdvertisingView(
  view: CustomerDisplayAdvertisingView,
): Promise<void> {
  const activeMedia = view.media.filter((item) => !item.is_deleted);
  await Promise.all(activeMedia.map(cacheCustomerDisplayMedia));
  await removeObsoleteCustomerDisplayMedia(new Set(activeMedia.map((item) => item.id)));
  useCustomerDisplayAdvertisingStore.getState().applyView({
    ...view,
    media: view.media.map((item) => ({ ...item, download_url: "" })),
  });
}
