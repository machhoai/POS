import { ReceiptText, UserRound } from "lucide-react";
import type { CustomerDisplayOrderSnapshot } from "@/lib/types/customerDisplay";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { IoPerson } from "react-icons/io5";

interface CustomerOrderPanelProps {
    order: CustomerDisplayOrderSnapshot;
}

const CustomerOrderPanel: React.FC<CustomerOrderPanelProps> = ({ order }) => {
    const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);

    return (
        <section className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
            <header className="flex items-center justify-between border-b border-[var(--color-border)] p-3">
                <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-[var(--color-accent-subtle)] p-2.5 text-[var(--color-accent)]">
                        <ReceiptText className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)]">Đơn hàng của bạn</h2>
                        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{itemCount} sản phẩm</p>
                    </div>
                </div>
            </header>
            {order.member ? (
                <div className="flex items-center gap-3 px-4 pt-2">
                    <p className="text-lg font-semibold text-emerald-800">Thành viên</p>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                        <IoPerson className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-extrabold text-emerald-950">
                            {order.member.fullName || "Khách thành viên"}
                        </p>
                        <p className="truncate text-xs font-semibold text-emerald-800">
                            {[order.member.phone, order.member.memberCode].filter(Boolean).join(" · ")}
                        </p>
                    </div>
                    {order.member.levelName ? (
                        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">
                            {order.member.levelName}
                        </span>
                    ) : null}
                </div>
            ) : null}
            <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-3" aria-label="Danh sách món">
                {order.items.map((item, index) => (
                    <li
                        key={`${item.name}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-dashed border-[var(--color-border)] py-4 last:border-0"
                    >
                        <div className="min-w-0">
                            <p className="text-md font-bold text-[var(--color-text-primary)]">{item.name}</p>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {formatCurrency(item.unitPrice)} × {item.quantity}
                            </p>
                        </div>
                        <strong className="my-auto text-lg text-[var(--color-text-secondary)]">
                            {formatCurrency(item.unitPrice * item.quantity)}
                        </strong>
                    </li>
                ))}
            </ul>
            <footer className="bg-white rounded-xl px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-md font-bold text-right flex-1 tracking-[0.12em] text-[var(--color-text-muted)]">Tổng cộng</span>
                    <strong className="font-mono text-3xl shrink-0 font-black tracking-[-0.04em] text-[var(--color-accent)] xl:text-4xl">
                        {formatCurrency(order.totalAmount)}
                    </strong>
                </div>
            </footer>
        </section>
    );
};

export default CustomerOrderPanel;
