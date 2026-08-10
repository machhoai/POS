import {
  CheckCircle2,
  Edit3,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import type {
  MemberMutationState,
  MemberRegistrationDraft,
  MemberRegistrationReviewStatus,
} from "@/lib/types/member";

interface MemberRegistrationFormProps {
  draft: MemberRegistrationDraft;
  reviewStatus: MemberRegistrationReviewStatus;
  mutation: MemberMutationState;
  onChange: (values: Partial<MemberRegistrationDraft>) => void;
  onStartReview: () => void;
  onConfirmCustomer: () => void;
  onEdit: () => void;
  onRegister: () => void;
  onStartNew: () => void;
}

const fieldClass = "h-13 w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white px-4 text-base font-semibold transition-colors focus:border-[var(--color-accent)] disabled:bg-neutral-50 disabled:text-[var(--color-text-muted)]";

function numericPart(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export default function MemberRegistrationForm({
  draft,
  reviewStatus,
  mutation,
  onChange,
  onStartReview,
  onConfirmCustomer,
  onEdit,
  onRegister,
  onStartNew,
}: MemberRegistrationFormProps) {
  const isWaiting = mutation.kind === "REGISTER" && mutation.status === "WAITING_API";
  const isSucceeded = mutation.kind === "REGISTER" && mutation.status === "SUCCEEDED";
  const isLocked = reviewStatus !== "EDITING" || isWaiting || isSucceeded;

  if (isSucceeded) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
        <h2 className="mt-3 text-xl font-extrabold text-emerald-900">Đăng ký thành viên thành công</h2>
        <p className="mt-2 text-sm text-emerald-700">OpenAPI đã xác nhận và hồ sơ đã được lưu tại POS.</p>
        <button type="button" onClick={onStartNew} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 font-bold text-white active:scale-[0.98]">
          <RotateCcw className="size-5" /> Đăng ký thành viên khác
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]"><UserPlus className="size-6" /></span>
        <div><h2 className="text-lg font-extrabold">Đăng ký thành viên mới</h2><p className="text-xs text-[var(--color-text-muted)]">Các trường có dấu * là bắt buộc</p></div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); onStartReview(); }} className="space-y-3">
        <label className="block text-sm font-bold">Họ và tên *<input value={draft.fullName} onChange={(event) => onChange({ fullName: event.target.value })} disabled={isLocked} maxLength={120} autoComplete="name" className={`${fieldClass} mt-1.5`} placeholder="Nguyễn Văn A" /></label>
        <label className="block text-sm font-bold">Số điện thoại *<input value={draft.phone} onChange={(event) => onChange({ phone: event.target.value })} disabled={isLocked} inputMode="tel" autoComplete="tel" className={`${fieldClass} mt-1.5`} placeholder="0901 234 567" /></label>
        <label className="block text-sm font-bold">Giới tính<select value={draft.gender} onChange={(event) => onChange({ gender: event.target.value as MemberRegistrationDraft["gender"] })} disabled={isLocked} className={`${fieldClass} mt-1.5`}><option value="MALE">Nam</option><option value="FEMALE">Nữ</option></select></label>
        <fieldset>
          <legend className="text-sm font-bold">Ngày sinh</legend>
          <div className="mt-1.5 grid grid-cols-[0.75fr_0.75fr_1fr] gap-2">
            <label className="block"><span className="sr-only">Ngày sinh</span><input value={draft.birthDay} onChange={(event) => onChange({ birthDay: numericPart(event.target.value, 2) })} disabled={isLocked} inputMode="numeric" autoComplete="bday-day" maxLength={2} className={`${fieldClass} text-center`} placeholder="Ngày" aria-label="Ngày sinh" /></label>
            <label className="block"><span className="sr-only">Tháng sinh</span><input value={draft.birthMonth} onChange={(event) => onChange({ birthMonth: numericPart(event.target.value, 2) })} disabled={isLocked} inputMode="numeric" autoComplete="bday-month" maxLength={2} className={`${fieldClass} text-center`} placeholder="Tháng" aria-label="Tháng sinh" /></label>
            <label className="block"><span className="sr-only">Năm sinh</span><input value={draft.birthYear} onChange={(event) => onChange({ birthYear: numericPart(event.target.value, 4) })} disabled={isLocked} inputMode="numeric" autoComplete="bday-year" maxLength={4} className={`${fieldClass} text-center`} placeholder="Năm" aria-label="Năm sinh" /></label>
          </div>
        </fieldset>
        <label className="block text-sm font-bold">Email<input type="email" value={draft.email} onChange={(event) => onChange({ email: event.target.value })} disabled={isLocked} maxLength={254} autoComplete="email" className={`${fieldClass} mt-1.5`} placeholder="khachhang@example.com" /></label>

        {mutation.kind === "REGISTER" && mutation.status === "FAILED" ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{mutation.failureReason}</p>
        ) : null}

        {reviewStatus === "EDITING" ? (
          <button type="submit" className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 font-bold text-white shadow-[var(--shadow-glow)] active:scale-[0.98]"><ShieldCheck className="size-5" /> Yêu cầu khách xác nhận</button>
        ) : null}
        {reviewStatus === "AWAITING_CUSTOMER" ? (
          <div className="space-y-3 rounded-2xl bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-800">Đang hiển thị trên màn hình phụ. Hãy nhờ khách kiểm tra kỹ trước khi tiếp tục.</p><div className="grid grid-cols-2 gap-3"><button type="button" onClick={onEdit} className="flex min-h-13 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white font-bold text-amber-800"><Edit3 className="size-4" /> Chỉnh sửa</button><button type="button" onClick={onConfirmCustomer} className="flex min-h-13 items-center justify-center gap-2 rounded-xl bg-amber-500 font-bold text-white"><CheckCircle2 className="size-5" /> Khách xác nhận đúng</button></div></div>
        ) : null}
        {reviewStatus === "CUSTOMER_CONFIRMED" ? (
          <div className="space-y-3"><p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Khách đã xác nhận thông tin. POS sẽ chờ OpenAPI phản hồi trước khi lưu.</p><div className="grid grid-cols-[auto_1fr] gap-3"><button type="button" onClick={onEdit} disabled={isWaiting} className="min-h-14 rounded-2xl border border-[var(--color-border)] px-4 font-bold disabled:opacity-50"><Edit3 className="mx-auto size-5" /></button><button id="member-register-button" type="button" onClick={onRegister} disabled={isWaiting} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 font-bold text-white shadow-[var(--shadow-glow)] disabled:opacity-60">{isWaiting ? <LoaderCircle className="size-5 animate-spin" /> : <UserPlus className="size-5" />}{isWaiting ? "Đang chờ OpenAPI" : mutation.status === "FAILED" ? "Thử đăng ký lại" : "Đăng ký qua OpenAPI"}</button></div></div>
        ) : null}
      </form>
    </section>
  );
}
