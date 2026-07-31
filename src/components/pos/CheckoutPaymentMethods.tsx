import type { PaymentMethod } from "@/lib/types/order";
import type { PaymentMethodOption } from "@/lib/types/payment";

interface CheckoutPaymentMethodsProps {
  paymentMethod: PaymentMethod;
  methods: PaymentMethodOption[];
  onChange: (method: PaymentMethod) => void;
}

export default function CheckoutPaymentMethods({
  paymentMethod,
  methods,
  onChange,
}: CheckoutPaymentMethodsProps) {
  return (
    <section aria-labelledby="payment-method-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="payment-method-title" className="text-sm font-bold text-[var(--color-text-primary)]">
            Phương thức thanh toán
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Ghi nhận hình thức khách thanh toán tại Việt Nam
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
          Bắt buộc
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Phương thức thanh toán">
        {methods.map((method) => (
          <PaymentButton
            key={method.id}
            method={method}
            active={paymentMethod === method.id}
            onClick={() => onChange(method.id)}
          />
        ))}
      </div>

    </section>
  );
}

function PaymentButton({
  active,
  method,
  onClick,
}: {
  active: boolean;
  method: PaymentMethodOption;
  onClick: () => void;
}) {
  const iconPath = method.kind === "cash"
    ? "M2.25 6.75A2.25 2.25 0 0 1 4.5 4.5h15a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75Zm6 5.25a3.75 3.75 0 1 0 7.5 0 3.75 3.75 0 0 0-7.5 0ZM18 8.25h.01v.01H18v-.01ZM6 15.75h.01v.01H6v-.01Z"
    : "M3.75 4.5A.75.75 0 0 1 4.5 3.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm0 12A.75.75 0 0 1 4.5 15.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm12-12a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-3a.75.75 0 0 1-.75-.75v-3Zm0 11.25h1.5v1.5h-1.5v-1.5Zm3 0h1.5v4.5h-4.5v-1.5h3v-3Z";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative flex min-h-[96px] touch-manipulation items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] ${
        active
          ? "border-[var(--color-accent)] bg-orange-50 text-[var(--color-accent)] shadow-[0_4px_18px_rgba(239,103,31,0.12)]"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-orange-200 hover:bg-orange-50/40"
      }`}
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white shadow-sm" : "bg-gray-100"}`}>
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </span>
      <span className="min-w-0 pr-4">
        <span className={`block text-sm font-bold ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"}`}>
          {method.methodName}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-text-muted)]">
          {method.description}
        </span>
      </span>
      <span className={`absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full border ${active ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-gray-300 bg-white text-transparent"}`}>
        <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
        </svg>
      </span>
    </button>
  );
}
