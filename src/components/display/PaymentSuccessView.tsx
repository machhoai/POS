"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Heart } from "lucide-react";
import type { CustomerDisplayOrderSnapshot } from "@/lib/types/customerDisplay";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface PaymentSuccessViewProps {
    order?: CustomerDisplayOrderSnapshot | null;
    onTimeout?: () => void;
    durationSeconds?: number;
}

const DEFAULT_DURATION_SECONDS = 5;

const MOCK_ORDER: CustomerDisplayOrderSnapshot = {
    items: [
        { name: "Trà sữa Ô Long Nướng", quantity: 2, unitPrice: 45000 },
        { name: "Cà phê Muối Kem Béo", quantity: 1, unitPrice: 38000 },
        { name: "Bánh Croissant Bơ Thụy Sĩ", quantity: 1, unitPrice: 32000 },
    ],
    totalAmount: 160000,
    paymentMethod: "TRANSFER",
};

const PaymentSuccessView: React.FC<PaymentSuccessViewProps> = ({
    order,
    onTimeout,
    durationSeconds = DEFAULT_DURATION_SECONDS,
}) => {
    const displayOrder = order ?? MOCK_ORDER;
    const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
    const itemCount = displayOrder.items.reduce((total, item) => total + item.quantity, 0);

    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    useEffect(() => {
        setSecondsLeft(durationSeconds);
        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onTimeoutRef.current?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [durationSeconds]);

    const progressPercentage = (secondsLeft / durationSeconds) * 100;

    return (
        <main className="relative flex h-screen items-center justify-center overflow-hidden bg-emerald-50 p-8 text-center select-none">
            <div className="absolute -left-28 -top-28 size-96 rounded-full bg-emerald-200/50" />
            <div className="absolute -bottom-36 -right-24 size-[30rem] rounded-full bg-orange-200/50" />
            <section className="relative w-full max-w-2xl rounded-[2rem] border border-emerald-200 bg-white px-8 py-12 shadow-[var(--shadow-lg)] sm:px-14">

                <span className="mx-auto flex size-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-14" strokeWidth={2.4} aria-hidden="true" />
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-5xl">
                    Cảm ơn quý khách!
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-[var(--color-text-secondary)]">
                    Đơn hàng gồm {itemCount} sản phẩm đã được thanh toán thành công.
                </p>
                <strong className="mt-7 block text-5xl font-black tracking-[-0.05em] text-[var(--color-accent)] sm:text-6xl">
                    {formatCurrency(displayOrder.totalAmount)}
                </strong>
                <div className="mt-8 flex items-center justify-center gap-2 text-lg font-bold text-[var(--color-text-muted)]">
                    <Heart className="size-5 fill-current text-rose-400" aria-hidden="true" />
                    Hẹn gặp lại quý khách trong lần mua sắm tiếp theo
                </div>
            </section>
        </main>
    );
};

export default PaymentSuccessView;
