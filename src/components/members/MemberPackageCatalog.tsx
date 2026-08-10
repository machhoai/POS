import { Check, Gift, RefreshCw, Sparkles } from "lucide-react";
import type {
  MemberMutationState,
  MemberPointPackage,
  RemoteRequestState,
} from "@/lib/types/member";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface MemberPackageCatalogProps {
  packages: MemberPointPackage[];
  request: RemoteRequestState;
  selectedPackage: MemberPointPackage | null;
  mutation: MemberMutationState;
  canRetryRemote: boolean;
  onSelect: (goodsId: string) => void;
  onReload: () => void;
  onBuy: () => void;
  onRetryRemote: () => void;
}

export default function MemberPackageCatalog(props: MemberPackageCatalogProps) {
  const busy = props.request.status === "WAITING_API" ||
    ["WAITING_PAYMENT", "WAITING_API"].includes(props.mutation.status);
  return (
    <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold">Chọn gói điểm</h2><p className="text-sm text-[var(--color-text-muted)]">Giá và điểm thưởng được lấy trực tiếp từ OpenAPI.</p></div>
        <button id="member-package-reload" type="button" onClick={props.onReload} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold disabled:opacity-50"><RefreshCw className={`size-4 ${props.request.status === "WAITING_API" ? "animate-spin" : ""}`} />Tải lại</button>
      </div>

      {props.request.status === "FAILED" ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{props.request.errorMessage}</div> : null}
      {props.request.status === "WAITING_API" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-100" />)}</div> : null}
      {props.request.status === "SUCCEEDED" && props.packages.length === 0 ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center font-semibold text-amber-800">OpenAPI hiện không có gói điểm nào đang mở bán.</div> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {props.packages.map((item) => {
          const selected = props.selectedPackage?.goodsId === item.goodsId;
          return <button key={item.goodsId} type="button" onClick={() => props.onSelect(item.goodsId)} disabled={busy} className={`min-h-44 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] disabled:opacity-60 ${selected ? "border-[var(--color-accent)] bg-orange-50 shadow-md" : "border-[var(--color-border-subtle)] bg-white hover:border-orange-200"}`}>
            <div className="flex items-start justify-between gap-2"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-[var(--color-accent)]"><Gift className="size-5" /></span>{selected ? <Check className="size-6 rounded-full bg-[var(--color-accent)] p-1 text-white" /> : null}</div>
            <h3 className="mt-3 line-clamp-2 text-base font-extrabold">{item.name}</h3>
            <p className="mt-2 text-2xl font-black text-[var(--color-accent)]">{formatCurrency(item.paymentAmountVnd)}</p>
            <div className="mt-2 space-y-1 text-sm font-bold text-emerald-700"><p className="flex items-center gap-2"><Sparkles className="size-4" />Tổng: {item.totalPoints.toLocaleString("vi-VN")} điểm</p><p className="text-xs text-slate-600">VND: {item.principalPoints.toLocaleString("vi-VN")} · Thưởng: {item.bonusBucketPoints.toLocaleString("vi-VN")}</p></div>
          </button>;
        })}
      </div>

      {props.mutation.status === "FAILED" ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="font-bold text-red-800">OpenAPI chưa hoàn tất giao dịch</p><p className="mt-1 text-sm text-red-700">{props.mutation.failureReason}</p>{props.canRetryRemote ? <button id="member-package-retry-remote" type="button" onClick={props.onRetryRemote} className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white">Thử lại đúng đơn hiện tại</button> : null}</div> : null}
      {props.mutation.status === "SUCCEEDED" ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">Gói đã được OpenAPI xác nhận. Mã đơn: {props.mutation.remoteOrderNumber || "đã hoàn tất"}</div> : null}

      <button type="button" onClick={props.onBuy} disabled={!props.selectedPackage || busy} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--color-accent)] px-5 text-base font-extrabold text-white shadow-lg shadow-orange-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">{props.mutation.status === "WAITING_API" ? "Đang chờ OpenAPI..." : "Tiếp tục thanh toán gói"}</button>
    </section>
  );
}
