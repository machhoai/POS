import { CreditCard, LoaderCircle, Phone, Search } from "lucide-react";
import type { MemberLookupMode } from "@/lib/types/member";

interface MemberLookupPanelProps {
  mode: MemberLookupMode;
  query: string;
  isLookingUp: boolean;
  onModeChange: (mode: MemberLookupMode) => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
}

const MODES: Array<{
  value: MemberLookupMode;
  label: string;
  icon: typeof Phone;
}> = [
  { value: "PHONE", label: "Số điện thoại", icon: Phone },
  { value: "CARD", label: "Mã thẻ", icon: CreditCard },
];

export default function MemberLookupPanel({
  mode,
  query,
  isLookingUp,
  onModeChange,
  onQueryChange,
  onSubmit,
}: MemberLookupPanelProps) {
  const placeholder = mode === "PHONE"
    ? "Nhập số điện thoại khách hàng"
    : "Nhập mã thẻ thành viên";

  return (
    <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex rounded-2xl bg-[var(--color-surface-hover)] p-1.5" role="tablist">
        {MODES.map(({ value, label, icon: Icon }) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onModeChange(value)}
              disabled={isLookingUp}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-white text-[var(--color-accent)] shadow-sm"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          );
        })}
      </div>

      <form
        id="member-lookup-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-3"
      >
        <label htmlFor="member-lookup" className="text-sm font-bold text-[var(--color-text-primary)]">
          {mode === "PHONE" ? "Số điện thoại" : "Mã số thẻ thành viên"}
        </label>
        <div className="relative">
          {mode === "PHONE" ? (
            <Phone className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          ) : (
            <CreditCard className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          )}
          <input
            id="member-lookup"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            disabled={isLookingUp}
            inputMode={mode === "PHONE" ? "tel" : "text"}
            autoComplete={mode === "PHONE" ? "tel" : "off"}
            placeholder={placeholder}
            className="h-15 w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white pl-12 pr-4 text-lg font-semibold transition-colors placeholder:text-sm placeholder:font-normal focus:border-[var(--color-accent)] disabled:bg-neutral-50"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={isLookingUp || !query.trim()}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 font-bold text-white shadow-[var(--shadow-glow)] transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLookingUp ? <LoaderCircle className="size-5 animate-spin" /> : <Search className="size-5" />}
            {isLookingUp ? "Đang tra cứu" : "Tra cứu thành viên"}
          </button>
        </div>
      </form>
    </section>
  );
}
