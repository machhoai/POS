import type { ReactNode } from "react";
import type { OrderItem } from "@/lib/types/order";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface CartItemProps {
  item: OrderItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const initials = item.goodsName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <li className="rounded-2xl border border-gray-100/80 bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-200 hover:border-orange-200 hover:shadow-md">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-12 shrink-0 select-none items-center justify-center rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 text-sm font-extrabold tracking-wider text-[var(--color-accent)] shadow-xs">
              {initials || "SP"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-bold leading-tight text-[var(--color-text-primary)]">
                {item.goodsName}
              </h3>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Đơn giá:{" "}
                <span className="font-bold text-[var(--color-accent)]">
                  {formatCurrency(item.price)}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-red-100/60 bg-red-50/80 text-red-500 shadow-xs transition-all hover:bg-red-500 hover:text-white active:scale-90"
            aria-label={`Xóa ${item.goodsName}`}
            title="Xóa sản phẩm"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.35 9m-4.78 0-.35-9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17-1.07 13.88a2.25 2.25 0 0 1-2.24 2.08H8.08a2.25 2.25 0 0 1-2.24-2.08L4.77 5.79m14.46 0a48.7 48.7 0 0 0-3.48-.4m-12 .57c.34-.06.68-.12 1.02-.17m0 0a48 48 0 0 1 3.48-.4m7.5 0v-.91a2.25 2.25 0 0 0-2.09-2.2 52 52 0 0 0-3.32 0 2.25 2.25 0 0 0-2.09 2.2v.91m7.5 0a48.7 48.7 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100/80 pt-2.5">
          <div className="flex items-center gap-1 rounded-xl border border-gray-200/50 bg-gray-100/80 p-1">
            <QuantityButton label="Giảm số lượng" onClick={() => onUpdateQuantity(item.quantity - 1)}>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </QuantityButton>
            <span className="min-w-9 select-none text-center text-sm font-extrabold tabular-nums text-gray-800">
              {item.quantity}
            </span>
            <QuantityButton label="Tăng số lượng" onClick={() => onUpdateQuantity(item.quantity + 1)}>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </QuantityButton>
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Thành tiền
            </span>
            <span className="text-base font-extrabold tracking-tight text-[var(--color-accent)]">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function QuantityButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 touch-manipulation items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-700 shadow-xs transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-[var(--color-accent)] active:scale-95"
    >
      {children}
    </button>
  );
}

export function EmptyCart() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-orange-50">
        <svg className="size-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.39c.51 0 .95.34 1.09.84l.38 1.43M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.22a60.1 60.1 0 0 0 2.92-7.14 60.1 60.1 0 0 0-16.53-1.84L7.5 14.25ZM6 20.25h.01v.01H6v-.01Zm12.75 0h.01v.01h-.01v-.01Z" />
        </svg>
      </div>
      <p className="text-sm font-bold text-[var(--color-text-primary)]">
        Giỏ hàng đang trống
      </p>
      <p className="mt-1.5 max-w-[210px] text-xs leading-relaxed text-[var(--color-text-muted)]">
        Chạm vào một sản phẩm bên trái để thêm vào đơn hàng
      </p>
    </div>
  );
}
