"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, Radio, ShieldAlert, X } from "lucide-react";
import {
  cancelMemberCardRead,
  toCardReaderServiceError,
} from "@/lib/services/cardReaderService";
import {
  confirmMemberCardIssue,
  getMemberCardIssueInfo,
  prepareMemberCardForIssue,
  toMemberCardIssueServiceError,
  type MemberCardIssueInfo,
  type PreparedMemberCard,
} from "@/lib/services/memberCardIssueService";
import type { MemberProfile } from "@/lib/types/member";

type IssueStep = "LOADING" | "READY" | "READING" | "VERIFYING" | "CONFIRMING" | "SUCCESS" | "FAILED";

interface MemberCardIssueModalProps {
  open: boolean;
  member: MemberProfile;
  shopId: number;
  warehouseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MemberCardIssueModal: React.FC<MemberCardIssueModalProps> = ({
  open,
  member,
  shopId,
  warehouseId,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<IssueStep>("LOADING");
  const [info, setInfo] = useState<MemberCardIssueInfo | null>(null);
  const [card, setCard] = useState<PreparedMemberCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const loadInfo = useCallback(async () => {
    setStep("LOADING");
    setError(null);
    setCard(null);
    try {
      const result = await getMemberCardIssueInfo({
        shopId,
        warehouseId,
        uid: member.uid,
        lookupQuery: member.phone || member.memberCode || member.uid,
      });
      setInfo(result);
      setStep("READY");
    } catch (loadError: unknown) {
      const issueError = toMemberCardIssueServiceError(loadError);
      setError(issueError.message);
      setStep("FAILED");
    }
  }, [member.memberCode, member.phone, member.uid, shopId, warehouseId]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => void loadInfo());
    return () => {
      void cancelMemberCardRead();
    };
  }, [loadInfo, open]);

  const handleClose = useCallback(() => {
    if (["READING", "VERIFYING", "CONFIRMING"].includes(step)) return;
    onClose();
  }, [onClose, step]);

  const handleRead = useCallback(async () => {
    if (
      !info ||
      (info.maxReceiveCard > 0 && info.takeCardNum >= info.maxReceiveCard)
    ) return;
    setStep("READING");
    setError(null);
    setCard(null);
    try {
      const preparedCard = await prepareMemberCardForIssue({
        shopId,
        warehouseId,
      }, (phase) => {
        setStep(phase === "WAITING_FOR_NEW_CARD" ? "READING" : phase);
      });
      setCard(preparedCard);
      setStep("READY");
    } catch (readError: unknown) {
      const message = readError instanceof Error && readError.message
        ? readError.message
        : toCardReaderServiceError(readError).message;
      setError(message);
      setStep("FAILED");
    }
  }, [info, shopId, warehouseId]);

  const handleConfirm = useCallback(async () => {
    if (!card) return;
    setStep("CONFIRMING");
    setError(null);
    try {
      const result = await confirmMemberCardIssue({
        shopId,
        warehouseId,
        uid: member.uid,
        lookupQuery: member.phone || member.memberCode || member.uid,
        memberAcctId: info?.memberAcctId || member.uid,
        memberCode: card.memberCode,
        memberIcCard: card.memberIcCard,
        dynamicSerialNo: card.dynamicSerialNo,
      });
      setSuccessMessage(result.message || "Đã cấp thêm thẻ thành viên thành công.");
      setStep("SUCCESS");
      onSuccess();
    } catch (confirmError: unknown) {
      const issueError = toMemberCardIssueServiceError(confirmError);
      setError(issueError.message);
      setStep("FAILED");
    }
  }, [card, info, member.memberCode, member.phone, member.uid, onSuccess, shopId, warehouseId]);

  if (!open) return null;

  const busy = ["LOADING", "READING", "VERIFYING", "CONFIRMING"].includes(step);
  const canIssue = Boolean(
    info &&
    (info.maxReceiveCard <= 0 || info.takeCardNum < info.maxReceiveCard),
  );
  const remainingCards = info?.maxReceiveCard
    ? Math.max(0, info.maxReceiveCard - info.takeCardNum)
    : null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="member-card-issue-title">
    <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Thẻ thành viên HK</p>
          <h2 id="member-card-issue-title" className="mt-1 text-xl font-black text-slate-950">Cấp thêm thẻ cho thành viên</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{member.fullName || "Khách thành viên"} · {member.phone || member.uid}</p>
        </div>
        <button type="button" onClick={handleClose} disabled={busy} aria-label="Đóng" className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 disabled:opacity-40"><X className="size-5" /></button>
      </header>

      {step === "LOADING" ? <div className="my-8 flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-600"><LoaderCircle className="size-5 animate-spin text-orange-500" />Đang kiểm tra hạn mức cấp thẻ trên HK...</div> : null}

      {info ? <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
        <div><p className="text-xl font-black text-emerald-700">{remainingCards ?? "∞"}</p><p className="text-xs font-bold text-slate-500">Có thể cấp thêm</p></div>
        <div><p className="text-xl font-black text-slate-900">{info.takeCardNum}</p><p className="text-xs font-bold text-slate-500">Đã nhận</p></div>
        <div><p className="text-xl font-black text-slate-900">{info.maxReceiveCard || "—"}</p><p className="text-xs font-bold text-slate-500">Tối đa</p></div>
      </div> : null}

      {info && !canIssue ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-black">Đã đạt giới hạn thẻ</p><p className="mt-1 font-semibold">Thành viên đã nhận đủ {info.maxReceiveCard} thẻ theo giới hạn đang cấu hình trên HK.</p></div></div></div> : null}

      {canIssue && step !== "SUCCESS" ? <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-start gap-3">
          <Radio className={`mt-0.5 size-5 shrink-0 text-orange-600 ${step === "READING" || step === "VERIFYING" ? "animate-pulse" : ""}`} />
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-900">{step === "READING" ? "Đang đọc thẻ lần 1..." : step === "VERIFYING" ? "Giữ nguyên thẻ — đang xác thực lần 2..." : card ? "Thẻ mới đã được xác thực" : "Đặt thẻ HK chưa kích hoạt lên đầu đọc"}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">Thẻ được cấp miễn phí theo chính sách cửa hàng. Thẻ cũ vẫn hoạt động; nếu khách báo mất thẻ, cần thu hồi hoặc khóa thẻ cũ riêng.</p>
            {card?.memberCode ? <div className="mt-3 rounded-xl bg-white px-3 py-2"><p className="font-mono text-base font-black text-slate-950">{card.memberCode}</p><p className="mt-1 break-all text-xs text-slate-500">UUID: {card.memberIcCard}</p></div> : null}
          </div>
        </div>
      </div> : null}

      {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      {step === "SUCCESS" ? <div className="my-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto size-10 text-emerald-600" /><p className="mt-3 font-black text-emerald-900">{successMessage}</p><p className="mt-1 font-mono text-sm font-bold text-emerald-700">{card?.memberCode}</p></div> : null}

      <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={step === "SUCCESS" ? onClose : handleClose} disabled={busy} className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 disabled:opacity-40">{step === "SUCCESS" ? "Hoàn tất" : "Đóng"}</button>
        {canIssue && step !== "SUCCESS" ? <button type="button" onClick={() => void handleRead()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-5 text-sm font-black text-orange-700 disabled:opacity-40"><CreditCard className="size-4" />{card ? "Đọc thẻ khác" : "Đọc thẻ mới"}</button> : null}
        {card && step !== "SUCCESS" ? <button type="button" onClick={() => void handleConfirm()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-40">{step === "CONFIRMING" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Xác nhận cấp thẻ</button> : null}
        {step === "FAILED" ? <button type="button" onClick={() => void loadInfo()} className="min-h-12 rounded-xl bg-slate-900 px-5 text-sm font-black text-white">Kiểm tra lại</button> : null}
      </footer>
    </div>
  </div>;
};

export default MemberCardIssueModal;
