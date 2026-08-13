"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PrinterSettingsState {
  selectedPrinterName: string | null;
  selectPrinter: (printerName: string) => void;
  clearSelection: () => void;
}

export const usePrinterSettingsStore = create<PrinterSettingsState>()(
  persist(
    (set) => ({
      selectedPrinterName: null,
      selectPrinter: (selectedPrinterName) => set({ selectedPrinterName }),
      clearSelection: () => set({ selectedPrinterName: null }),
    }),
    {
      name: "pos_local_printer_settings_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPrinterName: state.selectedPrinterName,
      }),
    },
  ),
);
