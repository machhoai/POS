"use client";

import { GooeyToaster } from "goey-toast";

export default function ToastProvider() {
  return (
    <GooeyToaster
      position="top-right"
      preset="snappy"
      closeButton
      richColors
    />
  );
}
