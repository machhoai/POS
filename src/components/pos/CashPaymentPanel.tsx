"use client";

import Image from "next/image";
import { formatCurrency } from "@/lib/utils/formatCurrency";

const VND_BANKNOTES = [
    { value: 500_000, imageSrc: "/images/banknotes/vnd-500000.webp" },
    { value: 200_000, imageSrc: "/images/banknotes/vnd-200000.webp" },
    { value: 100_000, imageSrc: "/images/banknotes/vnd-100000.webp" },
    { value: 50_000, imageSrc: "/images/banknotes/vnd-50000.webp" },
    { value: 20_000, imageSrc: "/images/banknotes/vnd-20000.webp" },
    { value: 10_000, imageSrc: "/images/banknotes/vnd-10000.webp" },
    { value: 5_000, imageSrc: "/images/banknotes/vnd-5000.webp" },
    { value: 2_000, imageSrc: "/images/banknotes/vnd-2000.webp" },
    { value: 1_000, imageSrc: "/images/banknotes/vnd-1000.webp" },
] as const;

export type VndDenomination = (typeof VND_BANKNOTES)[number]["value"];
export type BanknoteCounts = Record<VndDenomination, number>;

interface CashPaymentPanelProps {
    counts: BanknoteCounts;
    missingAmount: number;
    changeAmount: number;
    onIncrement: (denomination: VndDenomination) => void;
    onDecrement: (denomination: VndDenomination) => void;
}

export function createEmptyBanknoteCounts(): BanknoteCounts {
    return Object.fromEntries(
        VND_BANKNOTES.map(({ value }) => [value, 0]),
    ) as BanknoteCounts;
}

export function calculateCashReceived(counts: BanknoteCounts): number {
    return VND_BANKNOTES.reduce(
        (total, { value }) => total + value * counts[value],
        0,
    );
}

const CashPaymentPanel: React.FC<CashPaymentPanelProps> = ({
    counts,
    missingAmount,
    changeAmount,
    onIncrement,
    onDecrement,
}) => {
    const hasEnoughCash = missingAmount === 0;

    return (
        <section
            className=""
            aria-labelledby="cash-payment-title"
        >
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <h3
                        id="cash-payment-title"
                        className="text-sm font-bold text-[var(--color-text-primary)]"
                    >
                        Tiền khách đưa
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        Chạm vào tờ tiền để thêm 1 tờ vào số tiền đã nhận
                    </p>
                </div>
            </div>

            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {VND_BANKNOTES.map((banknote) => {
                    const count = counts[banknote.value];
                    const formattedValue = formatCurrency(banknote.value);

                    return (
                        <li
                            key={banknote.value}
                            className={`overflow-hidden relative rounded-xl border bg-white transition-all ${count > 0
                                ? "border-emerald-400 shadow-[0_4px_14px_rgba(16,185,129,0.14)]"
                                : "border-slate-200"
                                }`}
                        >
                            <button
                                type="button"
                                onClick={() => onIncrement(banknote.value)}
                                className="block w-full touch-manipulation"
                                aria-label={`Thêm một tờ ${formattedValue}`}
                            >
                                <BanknoteImage
                                    value={banknote.value}
                                    src={banknote.imageSrc}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() => onDecrement(banknote.value)}
                                disabled={count === 0}
                                className="flex absolute top-3 right-3 right-0 gap-2 items-center w-fit  border-t border-slate-100 bg-white rounded-full p-1 pl-3"
                            >
                                <span
                                    className="text-xs font-bold text-[var(--color-text-secondary)]"
                                    aria-live="polite"
                                >
                                    {count} tờ
                                </span>
                                <span aria-hidden="true">−</span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <p
                className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${hasEnoughCash
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                    }`}
                role="status"
            >
                <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${hasEnoughCash ? "bg-emerald-600" : "bg-amber-600"
                        }`}
                    aria-hidden="true"
                >
                    {hasEnoughCash ? "✓" : "!"}
                </span>
                {hasEnoughCash
                    ? `Đã nhận đủ tiền. Cần thối lại ${formatCurrency(changeAmount)}.`
                    : `Cần nhận thêm ${formatCurrency(missingAmount)} để xác nhận thanh toán.`}
            </p>
        </section>
    );
};

function BanknoteImage({
    value,
    src,
}: {
    value: VndDenomination;
    src: string;
}) {
    return (
        <span className="relative block aspect-[2.25/1] w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <Image
                src={src}
                alt={`Tờ tiền Việt Nam mệnh giá ${formatCurrency(value)}`}
                fill
                sizes="(min-width: 640px) 230px, 45vw"
                className="object-cover"
            />
        </span>
    );
}

export default CashPaymentPanel;
