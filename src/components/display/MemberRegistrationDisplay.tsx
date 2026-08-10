import { CheckCircle2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import type { CustomerDisplayMemberState } from "@/lib/types/customerDisplay";

interface MemberRegistrationDisplayProps {
  state: CustomerDisplayMemberState;
}

const GENDER_LABEL = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
  UNKNOWN: "Chưa cập nhật",
};

export default function MemberRegistrationDisplay({ state }: MemberRegistrationDisplayProps) {
  const isSuccess = state.mode === "MEMBER_SUCCESS";
  const details = [
    { icon: Phone, label: "Số điện thoại", value: state.member.phone },
    { icon: UserRound, label: "Giới tính", value: GENDER_LABEL[state.member.gender] },
    { icon: ShieldCheck, label: "Ngày sinh", value: state.member.birthDate || "Chưa cập nhật" },
    { icon: Mail, label: "Email", value: state.member.email || "Chưa cập nhật" },
  ];

  return (
    <section className={`flex min-h-[420px] flex-col rounded-[var(--radius-xl)] border bg-white p-7 shadow-[var(--shadow-md)] ${isSuccess ? "border-emerald-200" : "border-orange-200"}`}>
      <div className="text-center">
        {isSuccess ? <CheckCircle2 className="mx-auto size-16 text-emerald-600" /> : <ShieldCheck className="mx-auto size-16 text-[var(--color-accent)]" />}
        <h1 className={`mt-3 text-3xl font-black ${isSuccess ? "text-emerald-800" : "text-[var(--color-text-primary)]"}`}>{isSuccess ? "Đăng ký thành công" : "Vui lòng kiểm tra thông tin"}</h1>
        <p className="mt-2 text-base text-[var(--color-text-muted)]">{isSuccess ? "Cảm ơn bạn đã đăng ký thành viên Joy World." : "Hãy báo cho thu ngân nếu có thông tin chưa chính xác."}</p>
      </div>

      <div className={`mt-6 rounded-3xl p-5 ${isSuccess ? "bg-emerald-50" : "bg-orange-50"}`}>
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Họ và tên</p>
        <p className="mt-1 text-3xl font-black text-[var(--color-text-primary)]">{state.member.fullName}</p>
        {state.member.memberCode ? <p className="mt-2 text-sm font-bold text-emerald-700">Mã thẻ: {state.member.memberCode}</p> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {details.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex min-h-20 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4">
            <Icon className="size-6 shrink-0 text-[var(--color-accent)]" />
            <div className="min-w-0"><p className="text-sm font-semibold text-[var(--color-text-muted)]">{label}</p><p className="truncate text-lg font-extrabold">{value}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
