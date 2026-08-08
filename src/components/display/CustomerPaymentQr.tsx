import { CircleX, Clock3, LoaderCircle, ScanLine, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { CustomerDisplayOrderSnapshot, CustomerDisplayTransferPayment } from "@/lib/types/customerDisplay";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface CustomerPaymentQrProps {
    payment: CustomerDisplayTransferPayment;
    remainingSeconds: number;
    order?: CustomerDisplayOrderSnapshot;
}

const RECIPIENT_NAME = "Công ty TNHH Joy World Entertainment";

const STATUS_CONTENT = {
    CREATING: {
        title: "Đang tạo mã thanh toán",
        description: "Vui lòng chờ trong giây lát.",
        icon: LoaderCircle,
        iconClassName: "animate-spin text-[var(--color-info)]",
    },
    EXPIRED: {
        title: "Mã thanh toán đã hết hạn",
        description: "Vui lòng liên hệ thu ngân để tạo mã mới.",
        icon: Clock3,
        iconClassName: "text-[var(--color-warning)]",
    },
    CANCELLED: {
        title: "Thanh toán đã được hủy",
        description: "Thu ngân sẽ hỗ trợ bạn chọn phương thức khác.",
        icon: CircleX,
        iconClassName: "text-[var(--color-danger)]",
    },
    ERROR: {
        title: "Chưa thể hiển thị mã QR",
        description: "Vui lòng kiểm tra kết nối mạng hoặc liên hệ thu ngân.",
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
}) => {
    const hasLocallyExpired =
        payment.status === "AWAITING_PAYMENT" && remainingSeconds <= 0;
    const isReady = payment.status === "AWAITING_PAYMENT" && !hasLocallyExpired;
    const displayStatus = hasLocallyExpired ? "EXPIRED" : payment.status;
    const statusContent = displayStatus === "AWAITING_PAYMENT"
        ? null
        : STATUS_CONTENT[displayStatus];
    const StatusIcon = statusContent?.icon;

    return (
        <section className="flex flex-col h-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]" aria-live="polite">
            <header className="flex items-center justify-between border-b border-[var(--color-border)] p-4 bg-white/50 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-[var(--color-accent-subtle)] p-2.5 text-[var(--color-accent)]">
                        <ScanLine className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">Thanh toán qua mã QR</h2>
                        <p className="text-xs font-medium text-[var(--color-text-muted)]">Quét mã QR để hoàn tất thanh toán</p>
                    </div>
                </div>
                {isReady && (
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
                                    <QRCodeSVG
                                        key={payment.qr.value}
                                        value={payment.qr.value}
                                        level="M"
                                        marginSize={1}
                                        className="w-full h-full"
                                        aria-label="Mã QR thanh toán chuyển khoản"
                                    />
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
                                        Tên người nhận
                                    </p>
                                    <p className="mt-0.5 uppercase font-bold text-lg text-[var(--color-text-primary)]">
                                        {RECIPIENT_NAME}
                                    </p>
                                </div>

                                {/* Transfer Content */}
                                <div className="rounded-xl bg-amber-50/80 border border-amber-200/60 p-3 text-left">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                                        Nội dung chuyển khoản
                                    </p>
                                    <p className="mt-0.5 break-words  text-lg font-black text-amber-950">
                                        {payment.qr.description}
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center my-auto p-6 text-center">
                            {StatusIcon ? <StatusIcon className={`mb-4 size-14 ${statusContent?.iconClassName}`} aria-hidden="true" /> : null}
                            <h3 className="text-xl font-extrabold text-[var(--color-text-primary)]">{statusContent?.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{statusContent?.description}</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default CustomerPaymentQr;

