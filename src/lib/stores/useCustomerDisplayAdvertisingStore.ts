"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CustomerDisplayAdvertisingView } from "@/lib/types/customerDisplayAdvertising";

interface CustomerDisplayAdvertisingState {
  view: CustomerDisplayAdvertisingView | null;
  applyView: (view: CustomerDisplayAdvertisingView) => void;
  clear: () => void;
}

export const useCustomerDisplayAdvertisingStore = create<CustomerDisplayAdvertisingState>()(
  persist(
    (set) => ({
      view: null,
      applyView: (view) => set({ view }),
      clear: () => set({ view: null }),
    }),
    { name: "jpos-customer-display-advertising-v1" },
  ),
);
