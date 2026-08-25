"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultLuckyDrawSettings } from "@/features/lucky-draw/config/luckyDrawConfig";
import type {
  LuckyDrawSettings,
  LuckyDrawSettingsInput,
} from "@/features/lucky-draw/types/luckyDraw";

interface LuckyDrawSettingsState {
  settings: LuckyDrawSettingsInput;
  remoteVersion: number | null;
  applyRemoteSettings: (settings: LuckyDrawSettings) => void;
  clearRemoteSettings: (warehouseId: string) => void;
}

export const useLuckyDrawSettingsStore = create<LuckyDrawSettingsState>()(
  persist(
    (set) => ({
      settings: createDefaultLuckyDrawSettings(),
      remoteVersion: null,
      applyRemoteSettings: (settings) => set((state) => {
        if (
          state.settings.warehouseId === settings.warehouseId &&
          (state.remoteVersion ?? 0) > settings.version
        ) return state;
        return {
          settings: {
            warehouseId: settings.warehouseId,
            enabled: settings.enabled,
            paperSize: settings.paperSize,
            programName: settings.programName,
            ticketTitle: settings.ticketTitle,
            message: settings.message,
            footerMessage: settings.footerMessage,
            packageTicketCounts: settings.packageTicketCounts,
          },
          remoteVersion: settings.version,
        };
      }),
      clearRemoteSettings: (warehouseId) => set({
        settings: createDefaultLuckyDrawSettings(warehouseId),
        remoteVersion: null,
      }),
    }),
    {
      name: "pos_lucky_draw_settings_v1",
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const stored = persisted as Partial<LuckyDrawSettingsState>;
        return {
          ...current,
          ...stored,
          settings: {
            ...createDefaultLuckyDrawSettings(stored.settings?.warehouseId),
            ...stored.settings,
            packageTicketCounts: stored.settings?.packageTicketCounts ?? {},
          },
        };
      },
    },
  ),
);
