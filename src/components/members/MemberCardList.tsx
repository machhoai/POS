"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import MemberCardIssueModal from "@/components/members/MemberCardIssueModal";
import type { MemberCard, MemberProfile, RemoteRequestStatus } from "@/lib/types/member";

interface MemberCardListProps {
  status: RemoteRequestStatus;
  cards: MemberCard[];
  error: string | null;
  member: MemberProfile;
  shopId: number;
  warehouseId: string;
  onReload: () => void;
}

const MemberCardList: React.FC<MemberCardListProps> = ({
  status,
  cards,
  error,
  member,
  shopId,
  warehouseId,
  onReload,
}) => {
  const loading = status === "WAITING_API";
  const [issueOpen, setIssueOpen] = useState(false);
  return <section className="min-h-72 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-extrabold">Thẻ thành viên hiện tại</h3><p className="text-xs text-[var(--color-text-muted)]">Cấp thêm thẻ HK chưa kích hoạt; thẻ cũ không tự động bị thu hồi.</p></div><div className="flex gap-2"><button type="button" onClick={() => setIssueOpen(true)} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"><Plus className="size-4" />Cấp thêm thẻ</button><button type="button" onClick={onReload} disabled={loading} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Làm mới</button></div></header>
    {loading ? <div className="flex min-h-56 items-center justify-center gap-3 text-sm font-bold text-[var(--color-text-muted)]"><LoaderCircle className="size-6 animate-spin text-[var(--color-accent)]" />Đang tải danh sách thẻ...</div> : null}
    {!loading && status === "FAILED" ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><p className="font-extrabold text-red-700">Không thể tải danh sách thẻ</p><p className="mt-2 max-w-md text-sm text-red-600">{error}</p><button type="button" onClick={onReload} className="mt-4 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white">Thử lại</button></div> : null}
    {!loading && status !== "FAILED" && cards.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><CreditCard className="size-10 text-orange-300" /><p className="mt-3 font-extrabold">Thành viên chưa có thẻ</p></div> : null}
    {!loading && status !== "FAILED" && cards.length > 0 ? <div className="grid gap-3 xl:grid-cols-2">{cards.map((card) => <article key={`${card.memberCode}-${card.icCard}`} className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-lg"><div className="flex items-start justify-between gap-3"><CreditCard className="size-7 text-orange-300" /><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{card.category === 1 ? "Thẻ vật lý" : card.category === 2 ? "Thẻ điện tử" : "Thẻ thành viên"}</span></div><p className="mt-8 text-xl font-black tracking-wider">{card.memberCode}</p><p className="mt-2 break-all text-xs text-slate-300">Chip: {card.icCard || "Không có"}</p>{card.remark ? <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-200">{card.remark}</p> : null}</article>)}</div> : null}
    <MemberCardIssueModal open={issueOpen} member={member} shopId={shopId} warehouseId={warehouseId} onClose={() => setIssueOpen(false)} onSuccess={onReload} />
  </section>;
};

export default MemberCardList;
