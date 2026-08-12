/* eslint-disable @next/next/no-img-element */
import { CircleX, Clock3, LoaderCircle, ScanLine, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { CustomerDisplayOrderSnapshot, CustomerDisplayTransferPayment } from "@/lib/types/customerDisplay";
import type { CustomerDisplayLanguage } from "@/lib/types/customerDisplayControl";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { getCustomerDisplayCopy } from "@/lib/utils/customerDisplayI18n";

interface CustomerPaymentQrProps {
    payment: CustomerDisplayTransferPayment;
    remainingSeconds: number;
    order?: CustomerDisplayOrderSnapshot;
    language: CustomerDisplayLanguage;
}

const STATUS_ICONS = {
    CREATING: {
        icon: LoaderCircle,
        iconClassName: "animate-spin text-[var(--color-info)]",
    },
    EXPIRED: {
        icon: Clock3,
        iconClassName: "text-[var(--color-warning)]",
    },
    CANCELLED: {
        icon: CircleX,
        iconClassName: "text-[var(--color-danger)]",
    },
    ERROR: {
        icon: TriangleAlert,
        iconClassName: "text-[var(--color-danger)]",
    },
} as const;

function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

const CustomerPaymentQr: React.FC<CustomerPaymentQrProps> = ({
    payment,
    remainingSeconds,
    order,
    language,
}) => {
    const copy = getCustomerDisplayCopy(language);
    const hasLocallyExpired =
        payment.status === "AWAITING_PAYMENT" &&
        !payment.qr.manualConfirmationRequired &&
        remainingSeconds <= 0;
    const isReady = payment.status === "AWAITING_PAYMENT" && !hasLocallyExpired;
    const displayStatus = hasLocallyExpired ? "EXPIRED" : payment.status;
    const statusIcon = displayStatus === "AWAITING_PAYMENT"
        ? null
        : STATUS_ICONS[displayStatus];
    const statusText = displayStatus === "AWAITING_PAYMENT"
        ? null
        : copy.paymentStatuses[displayStatus];
    const StatusIcon = statusIcon?.icon;

    return (
        <section className="flex flex-col h-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]" aria-live="polite">
            <header className="flex items-center justify-between border-b border-[var(--color-border)] p-4 bg-white/50 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-[var(--color-accent-subtle)] p-2.5 text-[var(--color-accent)]">
                        <ScanLine className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">{copy.qrTitle}</h2>
                        <p className="text-xs font-medium text-[var(--color-text-muted)]">{copy.qrSubtitle}</p>
                    </div>
                </div>
                {isReady && !payment.qr.manualConfirmationRequired && (
                    <div className="flex items-center gap-2 rounded-full bg-red-50 px-3.5 py-1.5 text-sm font-bold text-[var(--color-danger)] ring-1 ring-red-200">
                        <Clock3 className="size-4" aria-hidden="true" />
                        <strong className=" tabular-nums">{formatCountdown(remainingSeconds)}</strong>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-1 gap-4 p-4 min-h-0 flex-1 overflow-y-auto">
                {/* Right Side: QR Code & Payment Info / Status */}
                <div className="flex flex-col items-center justify-center gap-6 w-full shrink-0">
                    {isReady ? (
                        <>
                            <div className="flex flex-col gap-2 items-center w-full">
                                {/* QR Code Display */}
                                <div className="flex flex-col items-center justify-center w-full aspect-square max-w-[340px] p-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    {payment.qr.imageUrl ? (
                                        <img
                                            src={payment.qr.imageUrl}
                                            alt={copy.qrImageAlt}
                                            className="h-full w-full object-contain"
                                        />
                                    ) : payment.qr.value ? (
                                        <QRCodeSVG
                                            key={payment.qr.value}
                                            value={payment.qr.value}
                                            level="M"
                                            marginSize={1}
                                            className="w-full h-full"
                                            aria-label={copy.qrImageAlt}
                                        />
                                    ) : null}
                                </div>
                                <strong className="text-2xl font-black text-[var(--color-accent)]">
                                    {formatCurrency(isReady ? payment.qr.amount : (order?.totalAmount ?? 0))}
                                </strong>
                            </div>
                            {/* Recipient & Transfer Info */}
                            <div className="w-full space-y-2.5">
                                {/* Recipient Name */}
                                <div className="rounded-xl bg-[var(--color-surface-alt)] p-3 text-left">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                        {copy.recipient}
                                    </p>
                                    <p className="mt-0.5 uppercase font-bold text-lg text-[var(--color-text-primary)]">
                                        {payment.qr.accountName || copy.updating}
                                    </p>
                                    {payment.qr.accountNumber ? (
                                        <p className="mt-0.5 font-mono text-sm font-bold text-[var(--color-text-secondary)]">
                                            {payment.qr.accountNumber}
                                        </p>
                                    ) : null}
                                </div>

                                {/* Transfer Content */}
                                <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3 text-left">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                                        {copy.transferContent}
                                    </p>
                                    <p className="mt-0.5 break-words  text-lg font-black text-amber-950">
                                        {payment.qr.description}
                                    </p>
                                </div>
                            </div>
                            {payment.qr.manualConfirmationRequired ? (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900">
                                    {copy.manualConfirmation}
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center my-auto p-6 text-center">
                            {StatusIcon ? <StatusIcon className={`mb-4 size-14 ${statusIcon?.iconClassName}`} aria-hidden="true" /> : null}
                            <h3 className="text-xl font-extrabold text-[var(--color-text-primary)]">{statusText?.[0]}</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{statusText?.[1]}</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default CustomerPaymentQr;
