"use client";

import { useEffect, useState } from "react";

import AdvertisingCarousel from "@/components/display/AdvertisingCarousel";
import CustomerOrderPanel from "@/components/display/CustomerOrderPanel";
import CustomerPaymentQr from "@/components/display/CustomerPaymentQr";
import PaymentSuccessView from "@/components/display/PaymentSuccessView";
import { CUSTOMER_DISPLAY_ADVERTISEMENTS } from "@/lib/data/customerDisplayAds";
import { useAdvertisingCarousel } from "@/lib/hooks/useAdvertisingCarousel";
import { useCustomerPaymentCountdown } from "@/lib/hooks/useCustomerPaymentCountdown";
import { useCustomerDisplayState } from "@/lib/hooks/useCustomerDisplayState";
import type { CustomerDisplayConnectionStatus } from "@/lib/types/customerDisplay";

const CONNECTION_CONTENT: Record<CustomerDisplayConnectionStatus, { label: string; className: string }> = {
    CONNECTING: {
        label: "Đang kết nối với quầy thu ngân",
        className: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    CONNECTED: {
        label: "Đã kết nối với quầy thu ngân",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    DISCONNECTED: {
        label: "Chưa kết nối với quầy thu ngân",
        className: "bg-red-50 text-red-700 ring-red-200",
    },
};

export default function CustomerDisplayPage() {
    const state = useCustomerDisplayState();
    const activeAdIndex = useAdvertisingCarousel(CUSTOMER_DISPLAY_ADVERTISEMENTS.length);
    const [dismissSuccess, setDismissSuccess] = useState(false);
    const activeQr = state.mode === "TRANSFER" && state.payment.status === "AWAITING_PAYMENT"
        ? state.payment.qr
        : null;
    const remainingSeconds = useCustomerPaymentCountdown(activeQr);

    useEffect(() => {
        if (state.mode !== "SUCCESS") {
            setDismissSuccess(false);
        }
    }, [state.mode]);

    if (state.mode === "SUCCESS" && !dismissSuccess) {
        return (
            <PaymentSuccessView
                order={state.order}
                onTimeout={() => setDismissSuccess(true)}
            />
        );
    }

    const connection = CONNECTION_CONTENT[state.connectionStatus];
    const contentLayout = (state.mode === "TRANSFER" || state.mode === "CART")
        ? "grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]"
        : "grid-cols-1";

    return (
        <main className="flex h-screen flex-col overflow-hidden bg-[var(--color-background)]">
            <div className={`grid min-h-0 flex-1 gap-3 overflow-y-auto p-2 ${contentLayout}`}>
                <AdvertisingCarousel
                    advertisements={CUSTOMER_DISPLAY_ADVERTISEMENTS}
                    activeIndex={activeAdIndex}
                />
                {state.mode === "CART" ? (
                    <CustomerOrderPanel order={state.order} />
                ) : null}
                {state.mode === "TRANSFER" ? (
                    <CustomerPaymentQr
                        order={state.order}
                        payment={state.payment}
                        remainingSeconds={remainingSeconds}
                    />
                ) : null}
            </div>
        </main>
    );
}
