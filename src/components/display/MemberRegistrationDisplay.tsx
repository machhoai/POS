import { CalendarDays, CheckCircle2, Mail, Phone, UserRound } from "lucide-react";
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
        { icon: Phone, label: "Số điện thoại", value: state.member.phone || "" },
        { icon: UserRound, label: "Giới tính", value: GENDER_LABEL[state.member.gender] },
        { icon: CalendarDays, label: "Ngày sinh", value: state.member.birthDate || "Chưa nhập" },
        { icon: Mail, label: "Email", value: state.member.email || "Chưa nhập" },
    ];

    return (
        <section className={`flex min-h-[320px] flex-col overflow-hidden rounded-[var(--radius-xl)] border bg-white shadow-[var(--shadow-md)] ${isSuccess ? "border-emerald-200" : "border-[var(--color-border)]"}`} aria-live="polite">
            <header className="flex items-center gap-3 border-b border-[var(--color-border)] p-3">
                <span className={`rounded-xl p-2.5 ${isSuccess ? "bg-emerald-50 text-emerald-600" : "bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"}`}>
                    {isSuccess ? <CheckCircle2 className="size-6" /> : <UserRound className="size-6" />}
                </span>
                <div>
                    <h1 className="text-xl font-extrabold text-[var(--color-text-primary)]">{isSuccess ? "Đăng ký thành công" : "Thông tin thành viên"}</h1>
                    <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{isSuccess ? "Cảm ơn bạn đã đăng ký tại Joy World" : "Đang cập nhật trực tiếp từ thu ngân"}</p>
                </div>
            </header>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
                <div className={`rounded-2xl p-4 ${isSuccess ? "bg-emerald-50" : "bg-orange-50"}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Họ và tên</p>
                    <p className="mt-1 break-words text-2xl font-black text-[var(--color-text-primary)]">{state.member.fullName || ""}</p>
                    {state.member.memberCode ? <p className="mt-2 text-sm font-bold text-emerald-700">Mã thẻ: {state.member.memberCode}</p> : null}
                </div>

                <div className="mt-3 grid gap-2">
                    {details.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4">
                            <Icon className="size-5 shrink-0 text-[var(--color-accent)]" />
                            <div className="min-w-0"><p className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</p><p className="break-words text-base font-extrabold">{value}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
