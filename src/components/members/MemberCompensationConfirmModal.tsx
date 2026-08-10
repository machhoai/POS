import { AlertTriangle, LoaderCircle } from "lucide-react";
import type { MemberCompensationDraft, MemberProfile } from "@/lib/types/member";

interface MemberCompensationConfirmModalProps {
  member: MemberProfile;
  draft: MemberCompensationDraft;
  warehouseName: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const formatPoints = (value: number | null): string =>
  new Intl.NumberFormat("vi-VN").format(value ?? 0);

export default function MemberCompensationConfirmModal({
  member,
  draft,
  warehouseName,
  busy,
  onClose,
  onConfirm,
}: MemberCompensationConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="compensation-title" className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle className="size-6" /></span><div><h2 id="compensation-title" className="text-xl font-extrabold">Xác nhận nạp bù</h2><p className="mt-1 text-sm text-slate-500">Kiểm tra kỹ thành viên và số điểm trước khi gửi OpenAPI.</p></div></div>
        <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Thành viên</dt><dd className="font-extrabold">{member.fullName}</dd></div>
          <div><dt className="text-slate-500">Mã thẻ / điện thoại</dt><dd className="font-extrabold">{member.memberCode || member.phone}</dd></div>
          <div><dt className="text-slate-500">Điểm bán</dt><dd className="font-extrabold">{warehouseName}</dd></div>
          <div><dt className="text-slate-500">Số điểm nạp bù</dt><dd className="text-xl font-black text-amber-700">+{formatPoints(draft.amount)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Lý do</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{draft.reason}</dd></div>
        </dl>
        <p className="mt-4 text-sm font-semibold text-red-700">Sau khi OpenAPI xác nhận, thao tác không thể hoàn tác tại POS.</p>
        <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={onClose} disabled={busy} className="min-h-13 rounded-2xl border border-slate-300 font-bold disabled:opacity-50">Quay lại</button><button id="member-compensation-confirm" type="button" onClick={onConfirm} disabled={busy} className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 font-extrabold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-5 animate-spin" /> : null}{busy ? "Đang nạp bù" : `Xác nhận +${formatPoints(draft.amount)}`}</button></div>
      </div>
    </div>
  );
}
