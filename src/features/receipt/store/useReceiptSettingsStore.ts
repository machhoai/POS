"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_RECEIPT_SETTINGS } from "@/features/receipt/config/receiptConfig";
import type { ReceiptSettings } from "@/features/receipt/types/receipt";

interface ReceiptSettingsState {
  settings: ReceiptSettings;
  remoteVersion: number | null;
  remoteWarehouseId: string | null;
  updateSettings: (patch: Partial<ReceiptSettings>) => void;
  applyRemoteSettings: (
    warehouseId: string,
    version: number,
    settings: ReceiptSettings,
  ) => void;
  clearRemoteSettings: (warehouseId: string) => void;
  resetSettings: () => void;
}

export const useReceiptSettingsStore = create<ReceiptSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_RECEIPT_SETTINGS,
      remoteVersion: null,
      remoteWarehouseId: null,
      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
      resetSettings: () => set({ settings: DEFAULT_RECEIPT_SETTINGS }),
      clearRemoteSettings: (warehouseId) =>
        set({
          settings: DEFAULT_RECEIPT_SETTINGS,
          remoteVersion: null,
          remoteWarehouseId: warehouseId,
        }),
      applyRemoteSettings: (warehouseId, version, settings) =>
        set((state) => {
          const isNewerWarehouse = state.remoteWarehouseId !== warehouseId;
          if (!isNewerWarehouse && (state.remoteVersion ?? 0) > version) {
            return state;
          }
          return {
            settings,
            remoteVersion: version,
            remoteWarehouseId: warehouseId,
          };
        }),
    }),
    {
      name: "pos_receipt_settings_v1",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const stored = persisted as Partial<ReceiptSettingsState>;
        const storedSettings = stored.settings;
        return {
          ...current,
          ...stored,
          settings: {
            ...DEFAULT_RECEIPT_SETTINGS,
            ...storedSettings,
            themeMessages: {
              ...DEFAULT_RECEIPT_SETTINGS.themeMessages,
              ...storedSettings?.themeMessages,
            },
            fontWeights: {
              ...DEFAULT_RECEIPT_SETTINGS.fontWeights,
              ...storedSettings?.fontWeights,
            },
          },
        };
      },
    },
  ),
);
