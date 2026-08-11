"use client";

import { useMemo, useState } from "react";
import { Check, Coins, RefreshCw, Search, Sparkles } from "lucide-react";
import type {
  MemberMutationState,
  MemberPointPackage,
  RemoteRequestState,
} from "@/lib/types/member";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { getProductColors } from "@/lib/utils/productColors";

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

function matchesSearch(item: MemberPointPackage, query: string): boolean {
  if (!query) return true;
  return [item.name, item.description, item.typeName]
    .some((value) => value?.toLocaleLowerCase("vi").includes(query));
}

export default function MemberPackageCatalog(props: MemberPackageCatalogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const packageMutationActive = props.mutation.kind === "PACKAGE_TOP_UP";
  const busy = props.request.status === "WAITING_API" ||
    (packageMutationActive && ["WAITING_PAYMENT", "WAITING_API"].includes(props.mutation.status));
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("vi");
  const visiblePackages = useMemo(
    () => props.packages.filter((item) => matchesSearch(item, normalizedQuery)),
    [normalizedQuery, props.packages],
  );

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
      <header className="space-y-3 border-b border-[var(--color-border)] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Chọn gói điểm</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Gói và màu sắc được đọc từ catalog Firestore đã đồng bộ.
            </p>
          </div>
          <button id="member-package-reload" type="button" onClick={props.onReload} disabled={busy} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold disabled:opacity-50">
            <RefreshCw className={`size-4 ${props.request.status === "WAITING_API" ? "animate-spin" : ""}`} />
            Tải lại
          </button>
        </div>

        <label className="relative block">
          <span className="sr-only">Tìm gói điểm</span>
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm tên hoặc nhóm gói..." className="h-12 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] pl-11 pr-4 text-sm font-semibold focus:border-[var(--color-accent)]" />
        </label>
      </header>

      <div className="bg-[var(--color-background)] p-3 md:p-4">
        {props.request.status === "FAILED" ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{props.request.errorMessage}</div> : null}
        {props.request.status === "WAITING_API" ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-slate-100" />)}</div> : null}
        {props.request.status === "SUCCEEDED" && props.packages.length === 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center font-semibold text-amber-800">Catalog Firestore chưa có gói điểm. Hãy bấm Đồng bộ sản phẩm tại màn hình bán hàng.</div> : null}
        {props.request.status === "SUCCEEDED" && props.packages.length > 0 && visiblePackages.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-white p-6 text-center text-sm font-semibold text-[var(--color-text-muted)]">Không tìm thấy gói phù hợp.</div> : null}

        {props.request.status === "SUCCEEDED" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePackages.map((item) => {
              const selected = props.selectedPackage?.goodsId === item.goodsId;
              const colors = getProductColors({
                foreColor: item.foreColor || "#FFFFFF",
                backColor: item.backColor || "#F97316",
              });

              return (
                <button
                  key={item.goodsId}
                  type="button"
                  onClick={() => props.onSelect(item.goodsId)}
                  disabled={busy}
                  className={`min-h-52 rounded-2xl border-2 bg-white p-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${selected ? "shadow-md" : ""}`}
                  style={{ borderColor: selected ? colors.background : `color-mix(in srgb, ${colors.background} 24%, white)` }}
                >
                  <div className="flex items-start justify-between gap-2 rounded-xl p-2.5" style={{ backgroundColor: colors.background, color: colors.foreground }}>
                    <span className="flex size-10 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${colors.foreground} 18%, transparent)` }}><Coins className="size-5" /></span>
                    {selected ? <span className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black" style={{ backgroundColor: colors.foreground, color: colors.background }}><Check className="size-3.5" />Đã chọn</span> : null}
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-extrabold">{item.name}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-muted)]">{item.typeName || "Gói điểm"}</p>
                  <p className="mt-2 text-xl font-black" style={{ color: colors.accentText }}>{formatCurrency(item.paymentAmountVnd)}</p>
                  <div className="mt-2 space-y-1 text-sm font-bold text-emerald-700">
                    <p className="flex items-center gap-2"><Sparkles className="size-4" />Tổng điểm: {item.totalPoints.toLocaleString("vi-VN")}</p>
                    <p className="text-xs text-slate-600">Gốc: {item.principalPoints.toLocaleString("vi-VN")} · Thưởng: {item.bonusBucketPoints.toLocaleString("vi-VN")} điểm</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <footer className="border-t border-[var(--color-border)] bg-white p-4">
        {packageMutationActive && props.mutation.status === "FAILED" ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="font-bold text-red-800">OpenAPI chưa hoàn tất giao dịch</p><p className="mt-1 text-sm text-red-700">{props.mutation.failureReason}</p>{props.canRetryRemote ? <button id="member-package-retry-remote" type="button" onClick={props.onRetryRemote} className="mt-3 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white">Thử lại đúng đơn hiện tại</button> : null}</div> : null}
        {packageMutationActive && props.mutation.status === "SUCCEEDED" ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">Gói đã được OpenAPI xác nhận. Mã đơn: {props.mutation.remoteOrderNumber || "đã hoàn tất"}</div> : null}
        <button type="button" onClick={props.onBuy} disabled={!props.selectedPackage || busy} className="min-h-14 w-full rounded-2xl bg-[var(--color-accent)] px-5 text-base font-extrabold text-white shadow-lg shadow-orange-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">{packageMutationActive && props.mutation.status === "WAITING_API" ? "Đang chờ OpenAPI..." : "Tiếp tục thanh toán gói"}</button>
      </footer>
    </section>
  );
}
