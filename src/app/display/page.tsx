"use client";

import { useState } from "react";

import AdvertisingCarousel from "@/components/display/AdvertisingCarousel";
import CustomerOrderPanel from "@/components/display/CustomerOrderPanel";
import CustomerPaymentQr from "@/components/display/CustomerPaymentQr";
import MemberRegistrationDisplay from "@/components/display/MemberRegistrationDisplay";
import PaymentSuccessView from "@/components/display/PaymentSuccessView";
import { CUSTOMER_DISPLAY_ADVERTISEMENTS } from "@/lib/data/customerDisplayAds";
import { useAdvertisingCarousel } from "@/lib/hooks/useAdvertisingCarousel";
import { useCustomerPaymentCountdown } from "@/lib/hooks/useCustomerPaymentCountdown";
import { useCustomerDisplayState } from "@/lib/hooks/useCustomerDisplayState";

export default function CustomerDisplayPage() {
    const state = useCustomerDisplayState();
    const activeAdIndex = useAdvertisingCarousel(CUSTOMER_DISPLAY_ADVERTISEMENTS.length);
    const [dismissedSuccessKey, setDismissedSuccessKey] = useState<string | null>(null);
    const activeQr = state.mode === "TRANSFER" && state.payment.status === "AWAITING_PAYMENT"
        ? state.payment.qr
        : null;
    const remainingSeconds = useCustomerPaymentCountdown(activeQr);

    const successKey = state.mode === "SUCCESS" ? JSON.stringify(state.order) : null;

    if (state.mode === "SUCCESS" && dismissedSuccessKey !== successKey) {
        return (
            <PaymentSuccessView
                key={successKey || "payment-success"}
                order={state.order}
                onTimeout={() => setDismissedSuccessKey(successKey)}
            />
        );
    }

    const isMemberMode = state.mode === "MEMBER_REVIEW" || state.mode === "MEMBER_SUCCESS";
    const contentLayout = (state.mode === "TRANSFER" || state.mode === "CART" || isMemberMode)
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
                {isMemberMode ? (
                    <div className="scrollbar-thin flex min-h-0 flex-col gap-3 overflow-y-auto">
                        <MemberRegistrationDisplay state={state} />
                        {state.order ? <CustomerOrderPanel order={state.order} /> : null}
                    </div>
                ) : null}
            </div>
        </main>
    );
}
