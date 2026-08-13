"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_PRINT_TOP_MARGIN_MM,
  normalizePrintTopMarginMm,
} from "@/features/printer/config/printerConfig";

interface PrinterSettingsState {
  selectedPrinterName: string | null;
  topMarginMm: number;
  selectPrinter: (printerName: string) => void;
  clearSelection: () => void;
  setTopMarginMm: (topMarginMm: number) => void;
}

export const usePrinterSettingsStore = create<PrinterSettingsState>()(
  persist(
    (set) => ({
      selectedPrinterName: null,
      topMarginMm: DEFAULT_PRINT_TOP_MARGIN_MM,
      selectPrinter: (selectedPrinterName) => set({ selectedPrinterName }),
      clearSelection: () => set({ selectedPrinterName: null }),
      setTopMarginMm: (topMarginMm) => set({
        topMarginMm: normalizePrintTopMarginMm(topMarginMm),
      }),
    }),
    {
      name: "pos_local_printer_settings_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPrinterName: state.selectedPrinterName,
        topMarginMm: state.topMarginMm,
      }),
      merge: (persistedState, currentState) => {
        const savedState = (persistedState ?? {}) as Partial<PrinterSettingsState>;
        return {
          ...currentState,
          ...savedState,
          topMarginMm: normalizePrintTopMarginMm(savedState.topMarginMm),
        };
      },
    },
  ),
);
