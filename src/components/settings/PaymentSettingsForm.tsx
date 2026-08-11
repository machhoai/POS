import { ShieldAlert } from "lucide-react";
import type { FC } from "react";
import type { FixedTransferSettingsInput } from "@/lib/types/paymentSettings";

interface PaymentSettingsFormProps {
  form: FixedTransferSettingsInput;
  canManage: boolean;
  isLoading: boolean;
  onChange: (updates: Partial<FixedTransferSettingsInput>) => void;
}

const fieldClassName = "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] shadow-sm transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100";

const PaymentSettingsForm: FC<PaymentSettingsFormProps> = ({
  form,
  canManage,
  isLoading,
  onChange,
}) => (
  <div className="mx-auto max-w-3xl space-y-4">
    {!canManage ? (
      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">Chỉ quản lý được thay đổi tài khoản</p>
          <p className="mt-1 text-xs leading-5">
            Bạn vẫn có thể xem cấu hình đang áp dụng tại điểm bán này.
          </p>
        </div>
      </div>
    ) : null}

    <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[var(--color-text-primary)]">
            QR tài khoản cố định
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            Dùng làm phương án dự phòng hoặc thay thế hoàn toàn mã chuyển khoản PayOS.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => onChange({
              enabled: event.target.checked,
              ...(!event.target.checked ? { fixedTransferOnly: false } : {}),
            })}
            disabled={!canManage || isLoading}
            className="size-5 accent-[var(--color-accent)]"
          />
          Bật QR cố định
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <input
          type="checkbox"
          checked={form.fixedTransferOnly}
          onChange={(event) => onChange({
            fixedTransferOnly: event.target.checked,
            ...(event.target.checked ? { enabled: true } : {}),
          })}
          disabled={!canManage || isLoading}
          className="mt-0.5 size-5 accent-blue-600"
        />
        <span>
          <span className="block text-sm font-extrabold text-blue-950">
            Chỉ sử dụng QR tài khoản cố định
          </span>
          <span className="mt-1 block text-xs leading-5 text-blue-800">
            Không tạo mã PayOS và không tự động xác nhận đơn. Nhân viên phải kiểm tra giao dịch rồi bấm xác nhận.
          </span>
        </span>
      </label>

      {isLoading ? (
        <div className="mt-5 grid animate-pulse gap-4 sm:grid-cols-2">
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100 sm:col-span-2" />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
            Mã BIN ngân hàng
            <input
              value={form.bankBin}
              onChange={(event) => onChange({ bankBin: event.target.value.replace(/\D/g, "").slice(0, 6) })}
              disabled={!canManage}
              inputMode="numeric"
              maxLength={6}
              placeholder="Ví dụ: 970422"
              className={fieldClassName}
            />
            <span className="font-normal text-[var(--color-text-muted)]">Gồm đúng 6 chữ số.</span>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
            Số tài khoản
            <input
              value={form.accountNumber}
              onChange={(event) => onChange({ accountNumber: event.target.value.replace(/\D/g, "").slice(0, 19) })}
              disabled={!canManage}
              inputMode="numeric"
              maxLength={19}
              className={fieldClassName}
            />
            <span className="font-normal text-[var(--color-text-muted)]">Từ 6 đến 19 chữ số.</span>
          </label>
          <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] sm:col-span-2">
            Tên chủ tài khoản
            <input
              value={form.accountName}
              onChange={(event) => onChange({ accountName: event.target.value.slice(0, 50) })}
              disabled={!canManage}
              maxLength={50}
              placeholder="Tên hiển thị trên ứng dụng ngân hàng"
              className={fieldClassName}
            />
          </label>
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
      Mỗi QR cố định tự điền đúng tổng tiền và nội dung đơn. Chỉ sau khi nhân viên bấm xác nhận, đơn mới hoàn tất và được đánh dấu <strong>Chưa được xác nhận thanh toán</strong> trong lịch sử.
    </section>
  </div>
);

export default PaymentSettingsForm;
