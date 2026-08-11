"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_TICKET_SETTINGS } from "@/features/ticket/config/ticketConfig";
import type { TicketSettings } from "@/features/ticket/types/ticket";

interface TicketSettingsState {
  settings: TicketSettings;
  remoteVersion: number | null;
  remoteWarehouseId: string | null;
  saveSettings: (settings: TicketSettings) => void;
  applyRemoteSettings: (
    warehouseId: string,
    version: number,
    settings: TicketSettings,
  ) => void;
  resetSettings: () => void;
}

export const useTicketSettingsStore = create<TicketSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_TICKET_SETTINGS,
      remoteVersion: null,
      remoteWarehouseId: null,
      saveSettings: (settings) => set({ settings }),
      resetSettings: () => set({ settings: DEFAULT_TICKET_SETTINGS }),
      applyRemoteSettings: (warehouseId, version, settings) =>
        set((state) => {
          const changedWarehouse = state.remoteWarehouseId !== warehouseId;
          if (!changedWarehouse && (state.remoteVersion ?? 0) > version) return state;
          return {
            settings,
            remoteVersion: version,
            remoteWarehouseId: warehouseId,
          };
        }),
    }),
    {
      name: "pos_ticket_settings_v1",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const stored = persisted as Partial<TicketSettingsState>;
        return {
          ...current,
          ...stored,
          settings: {
            ...DEFAULT_TICKET_SETTINGS,
            ...stored.settings,
          },
        };
      },
    },
  ),
);
