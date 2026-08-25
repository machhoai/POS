import {
    CreditCard,
    LoaderCircle,
    RotateCcw,
    ScanLine,
    X,
    UserPlus,
} from "lucide-react";
import type {
    CardReaderStatus,
    MemberMutationState,
    MemberRegistrationDraft,
} from "@/lib/types/member";

interface MemberRegistrationFormProps {
    draft: MemberRegistrationDraft;
    mutation: MemberMutationState;
    onChange: (values: Partial<MemberRegistrationDraft>) => void;
    onRegister: () => void;
    onStartNew: () => void;
    cardReaderStatus: CardReaderStatus;
    cardReaderError: string | null;
    onReadCard: () => void;
    onCancelCardRead: () => void;
    onClearCard: () => void;
    memberCreated: boolean;
}

const fieldClass = "h-14 w-full rounded-2xl border border-[var(--color-border-subtle)] bg-white px-4 py-4 text-base font-semibold transition-colors focus:border-[var(--color-accent)] disabled:bg-neutral-50 disabled:text-[var(--color-text-muted)]";
const salutations = ["Ông", "Bà", "Anh", "Chị"] as const;

type Salutation = (typeof salutations)[number];

function numericPart(value: string, maxLength: number): string {
    return value.replace(/\D/g, "").slice(0, maxLength);
}

function salutationFromName(fullName: string): Salutation | null {
    const normalizedName = fullName.trimStart().toLocaleLowerCase("vi-VN");
    return salutations.find((salutation) => {
        const normalizedSalutation = salutation.toLocaleLowerCase("vi-VN");
        return normalizedName === normalizedSalutation || normalizedName.startsWith(`${normalizedSalutation} `);
    }) ?? null;
}

function nameWithSalutation(fullName: string, salutation: Salutation | null): string {
    const currentSalutation = salutationFromName(fullName);
    const name = currentSalutation
        ? fullName.trimStart().slice(currentSalutation.length).trimStart()
        : fullName.trimStart();

    if (!salutation) return name;
    return `${salutation}${name ? ` ${name}` : " "}`.slice(0, 120);
}

export default function MemberRegistrationForm({
    draft,
    mutation,
    onChange,
    onRegister,
    onStartNew,
    cardReaderStatus,
    cardReaderError,
    onReadCard,
    onCancelCardRead,
    onClearCard,
    memberCreated,
}: MemberRegistrationFormProps) {
    const isWaiting = mutation.kind === "REGISTER" && mutation.status === "WAITING_API";
    const isLocked = isWaiting;
    const isProfileLocked = isLocked || memberCreated;
    const hasVerifiedCard = cardReaderStatus === "SUCCEEDED" && Boolean(draft.memberCode.trim());
    const selectedSalutation = salutationFromName(draft.fullName);
    let submitLabel = mutation.status === "FAILED" ? "Thử đăng ký lại" : "Đăng ký";

    if (isWaiting) {
        submitLabel = memberCreated ? "Đang gắn thẻ" : "Đang đăng ký";
    } else if (cardReaderStatus === "READING") {
        submitLabel = "Đang đọc thẻ...";
    } else if (!hasVerifiedCard) {
        submitLabel = memberCreated ? "Đọc thẻ để tiếp tục" : "Đọc thẻ để đăng ký";
    } else if (memberCreated) {
        submitLabel = "Thử gắn thẻ lại";
    }

    return (
        <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 md:p-5">
            <form onSubmit={(event) => { event.preventDefault(); onRegister(); }} className="space-y-3">
                <fieldset disabled={isProfileLocked}>
                    <legend className="text-sm font-bold">Danh xưng</legend>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {salutations.map((salutation) => {
                            const isSelected = selectedSalutation === salutation;
                            return (
                                <button
                                    key={salutation}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => onChange({ fullName: nameWithSalutation(draft.fullName, salutation) })}
                                    className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${isSelected
                                        ? "border-[var(--color-accent)] bg-orange-50 text-[var(--color-accent)]"
                                        : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    {salutation}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            aria-pressed={selectedSalutation === null}
                            onClick={() => onChange({ fullName: nameWithSalutation(draft.fullName, null) })}
                            className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${selectedSalutation === null
                                ? "border-[var(--color-accent)] bg-orange-50 text-[var(--color-accent)]"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                                }`}
                        >
                            -
                        </button>
                    </div>
                </fieldset>
                <label className="block text-sm font-bold">Họ và tên *<input value={draft.fullName} onChange={(event) => onChange({ fullName: event.target.value })} disabled={isProfileLocked} maxLength={120} autoComplete="name" className={`${fieldClass} mt-1.5`} /></label>
                <label className="block text-sm font-bold">Số điện thoại *<input value={draft.phone} onChange={(event) => onChange({ phone: event.target.value })} disabled={isProfileLocked} inputMode="tel" autoComplete="tel" className={`${fieldClass} mt-1.5`} /></label>
                <div className="">
                    <div className="flex items-center gap-2 text-sm font-bold">
                        <CreditCard className="size-4 text-[var(--color-accent)]" />
                        Thẻ thành viên * <span className="font-medium text-red-600">(bắt buộc đọc thẻ)</span>
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                        <input
                            value={draft.memberCode}
                            readOnly
                            disabled={isLocked || cardReaderStatus === "READING"}
                            maxLength={64}
                            className={`${fieldClass} flex-1 min-w-0 h-14 basis-full font-mono sm:flex-1 sm:basis-0`}
                            placeholder="Vui lòng đọc thẻ"
                            aria-label="Mã thẻ thành viên"
                        />
                        <div className="flex">
                            {cardReaderStatus === "READING" ? (
                                <button
                                    type="button"
                                    onClick={onCancelCardRead}
                                    className="inline-flex flex-1 justify-center min-h-13 shrink-0 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700"
                                >
                                    <X className="size-4" /> Hủy
                                </button>
                            ) : (
                                <>
                                    {draft.memberCode ? (
                                        <button
                                            type="button"
                                            onClick={onClearCard}
                                            disabled={isLocked}
                                            className="inline-flex flex-1 justify-center min-h-13 shrink-0 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-60"
                                        >
                                            <X className="size-4" /> Xóa
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={onReadCard}
                                        disabled={isLocked}
                                        className="inline-flex flex-1 min-h-13 shrink-0 items-center gap-2 rounded-2xl border bg-orange-400 text-white justify-center px-4 text-sm font-bold text-[var(--color-accent)] disabled:opacity-60"
                                    >
                                        <ScanLine className="size-4" /> {draft.memberCode ? "Đọc thẻ khác" : "Đọc thẻ"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {cardReaderStatus === "READING" ? (
                        <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)]">
                            <LoaderCircle className="size-4 animate-spin" /> Đang chờ thẻ trên đầu đọc...
                        </p>
                    ) : cardReaderStatus === "SUCCEEDED" ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">Đã xác thực thẻ vật lý {draft.memberCode}.</p>
                    ) : cardReaderError ? (
                        <p className="mt-2 text-xs font-semibold text-red-700">{cardReaderError}</p>
                    ) : (
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Nhấn Đọc thẻ và giữ nguyên thẻ trên đầu đọc trong hai lần xác thực.</p>
                    )}
                </div>
                <fieldset disabled={isProfileLocked}>
                    <legend className="text-sm font-bold">Giới tính</legend>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            aria-pressed={draft.gender === "MALE"}
                            onClick={() => onChange({ gender: "MALE" })}
                            className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${draft.gender === "MALE"
                                ? "border-[var(--color-accent)] bg-orange-50 text-[var(--color-accent)]"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                                }`}
                        >
                            Nam
                        </button>
                        <button
                            type="button"
                            aria-pressed={draft.gender === "FEMALE"}
                            onClick={() => onChange({ gender: "FEMALE" })}
                            className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${draft.gender === "FEMALE"
                                ? "border-[var(--color-accent)] bg-orange-50 text-[var(--color-accent)]"
                                : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"
                                }`}
                        >
                            Nữ
                        </button>
                    </div>
                </fieldset>
                <fieldset>
                    <legend className="text-sm font-bold">Ngày sinh</legend>
                    <div className="mt-1.5 grid grid-cols-[0.75fr_0.75fr_1fr] gap-2">
                        <label className="block"><span className="sr-only">Ngày sinh</span><input value={draft.birthDay} onChange={(event) => onChange({ birthDay: numericPart(event.target.value, 2) })} disabled={isProfileLocked} inputMode="numeric" autoComplete="bday-day" maxLength={2} className={`${fieldClass} text-center`} placeholder="Ngày" aria-label="Ngày sinh" /></label>
                        <label className="block"><span className="sr-only">Tháng sinh</span><input value={draft.birthMonth} onChange={(event) => onChange({ birthMonth: numericPart(event.target.value, 2) })} disabled={isProfileLocked} inputMode="numeric" autoComplete="bday-month" maxLength={2} className={`${fieldClass} text-center`} placeholder="Tháng" aria-label="Tháng sinh" /></label>
                        <label className="block"><span className="sr-only">Năm sinh</span><input value={draft.birthYear} onChange={(event) => onChange({ birthYear: numericPart(event.target.value, 4) })} disabled={isProfileLocked} inputMode="numeric" autoComplete="bday-year" maxLength={4} className={`${fieldClass} text-center`} placeholder="Năm" aria-label="Năm sinh" /></label>
                    </div>
                </fieldset>
                <label className="block text-sm font-bold">Email<input type="email" value={draft.email} onChange={(event) => onChange({ email: event.target.value })} disabled={isProfileLocked} maxLength={254} autoComplete="email" className={`${fieldClass} mt-1.5`} placeholder="khachhang@example.com" /></label>

                {mutation.kind === "REGISTER" && mutation.status === "FAILED" ? (
                    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{mutation.failureReason}</p>
                ) : null}

                {memberCreated ? (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">Thành viên đã được tạo. JPOS sẽ chỉ thử lại bước gắn thẻ, không tạo thêm tài khoản.</p>
                        <p className="mt-1 text-xs text-amber-800">Nếu không muốn tiếp tục gắn thẻ, bạn có thể rời phiên này. Thành viên đã tạo trên Joyworld vẫn được giữ nguyên.</p>
                        <button
                            type="button"
                            onClick={onStartNew}
                            disabled={isWaiting}
                            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 font-bold text-amber-900 disabled:opacity-60"
                        >
                            <RotateCcw className="size-4" /> Rời phiên và đăng ký người khác
                        </button>
                    </div>
                ) : null}

                <button
                    id="member-register-button"
                    type="submit"
                    disabled={isWaiting || !hasVerifiedCard}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-5 font-bold text-white shadow-[var(--shadow-glow)] active:scale-[0.98] disabled:opacity-60"
                >
                    {isWaiting ? <LoaderCircle className="size-5 animate-spin" /> : <UserPlus className="size-5" />}
                    {submitLabel}
                </button>
            </form>
        </section>
    );
}
