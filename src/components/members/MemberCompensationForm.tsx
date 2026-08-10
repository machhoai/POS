import { AlertTriangle, LoaderCircle, WalletCards } from "lucide-react";
import type { MemberCompensationDraft, MemberMutationState } from "@/lib/types/member";

interface MemberCompensationFormProps {
  draft: MemberCompensationDraft;
  mutation: MemberMutationState;
  onChange: (values: Partial<MemberCompensationDraft>) => void;
  onReview: () => void;
}

const COMPENSATION_REASON_PRESETS = [
  "Sửa lỗi thiết bị đọc hoặc ghi thẻ",
  "Thẻ không ghi nhận đúng số dư",
  "Khôi phục số dư sau khi cấp đổi thẻ",
  "Bù giao dịch bị gián đoạn giữa chừng",
  "Điều chỉnh sai lệch sau khi đối soát",
] as const;

export default function MemberCompensationForm({
  draft,
  mutation,
  onChange,
  onReview,
}: MemberCompensationFormProps) {
  const busy = mutation.kind === "COMPENSATION_TOP_UP" &&
    mutation.status === "WAITING_API";
  const failed = mutation.kind === "COMPENSATION_TOP_UP" &&
    mutation.status === "FAILED";
  const selectedPreset = COMPENSATION_REASON_PRESETS.find(
    (reason) => reason === draft.reason,
  ) ?? "";

  return (
    <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><WalletCards className="size-6" /></span>
        <div><h2 className="text-lg font-extrabold">Nạp bù điểm thẻ</h2><p className="text-xs text-[var(--color-text-muted)]">Chỉ dùng để khắc phục lỗi thẻ hoặc sai lệch đã được xác minh.</p></div>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); onReview(); }} className="space-y-4">
        <label className="block text-sm font-bold">Số điểm cần nạp bù *
          <input type="number" inputMode="numeric" min={1} max={10_000_000} step={1} value={draft.amount ?? ""} onChange={(event) => onChange({ amount: event.target.value === "" ? null : Number(event.target.value) })} disabled={busy} className="mt-1.5 h-13 w-full rounded-2xl border border-[var(--color-border-subtle)] px-4 text-lg font-extrabold focus:border-[var(--color-accent)] disabled:bg-neutral-50" placeholder="Ví dụ: 50" />
        </label>
        <label className="block text-sm font-bold">Chọn nhanh lý do
          <select value={selectedPreset} onChange={(event) => onChange({ reason: event.target.value })} disabled={busy} className="mt-1.5 h-13 w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold focus:border-[var(--color-accent)] disabled:bg-neutral-50">
            <option value="">Chọn một lý do có sẵn</option>
            {COMPENSATION_REASON_PRESETS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">Lý do nạp bù *
          <textarea value={draft.reason} onChange={(event) => onChange({ reason: event.target.value })} disabled={busy} minLength={5} maxLength={500} rows={4} className="mt-1.5 w-full resize-none rounded-2xl border border-[var(--color-border-subtle)] px-4 py-3 text-sm font-semibold focus:border-[var(--color-accent)] disabled:bg-neutral-50" placeholder="Mô tả lỗi thẻ, chứng từ hoặc lý do đã xác minh..." />
        </label>
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>Thao tác này làm tăng trực tiếp số dư của khách và được ghi vĩnh viễn vào nhật ký kiểm toán.</p></div>
        {failed ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{mutation.failureReason}</p> : null}
        <button type="submit" disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 font-extrabold text-white shadow-sm active:scale-[0.98] disabled:opacity-50">{busy ? <LoaderCircle className="size-5 animate-spin" /> : <WalletCards className="size-5" />}{busy ? "Đang xử lý" : "Kiểm tra và xác nhận"}</button>
      </form>
    </section>
  );
}
