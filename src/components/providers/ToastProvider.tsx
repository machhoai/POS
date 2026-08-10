"use client";

import { GooeyToaster } from "goey-toast";

export default function ToastProvider() {
    return (
        <GooeyToaster
            position="bottom-left"
            preset="snappy"
            richColors
            closeButton="top-right"
            swipeToDismiss
            closeOnEscape
        />
    );
}
