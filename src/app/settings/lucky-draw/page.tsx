"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Printer, RotateCcw, Save, Search, Sparkles } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import LuckyDrawTicketDocument from "@/features/lucky-draw/components/LuckyDrawTicketDocument";
import { printLuckyDrawPreviewWithDialog } from "@/features/lucky-draw/components/LuckyDrawPrintButton";
import {
  createDefaultLuckyDrawSettings,
  MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE,
} from "@/features/lucky-draw/config/luckyDrawConfig";
import { useLuckyDrawSettingsSync } from "@/features/lucky-draw/hooks/useLuckyDrawSettingsSync";
import { saveLuckyDrawSettings } from "@/features/lucky-draw/services/luckyDrawSettingsService";
import { useLuckyDrawSettingsStore } from "@/features/lucky-draw/store/useLuckyDrawSettingsStore";
import type {
  LuckyDrawSettingsInput,
  PrintableLuckyDrawTicket,
} from "@/features/lucky-draw/types/luckyDraw";
import { usePrinterSettingsStore } from "@/features/printer/store/usePrinterSettingsStore";
import { RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import type { ReceiptPaperSize } from "@/features/receipt/types/receipt";
import { useSettingsAccess } from "@/features/settings/hooks/useSettingsAccess";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useProductStore } from "@/lib/stores/useProductStore";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { showError, showSuccess } from "@/lib/utils/toast";

const MEMBER_PACKAGE_CATEGORIES = new Set([1, 2, 6]);
const SAMPLE_TICKET: PrintableLuckyDrawTicket = {
  orderId: "ORD-1770000000000-ABC123",
  customerName: "Nguyễn Văn An",
  customerPhone: "0901 234 567",
  purchasedAt: "2026-08-25T10:30:00+07:00",
  goodsName: "Gói thành viên Bạch Kim",
  sequence: 1,
  totalForOrder: 2,
};

const fieldClassName = "min-h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold outline-none focus:border-[var(--color-accent)] disabled:bg-slate-50 disabled:text-slate-500";

export default function LuckyDrawSettingsPage() {
  const router = useRouter();
  const auth = useAuth();
  const { canManageGeneralSettings } = useSettingsAccess();
  useLuckyDrawSettingsSync(auth.effectiveWarehouseId);
  const appliedSettings = useLuckyDrawSettingsStore((state) => state.settings);
  const remoteVersion = useLuckyDrawSettingsStore((state) => state.remoteVersion);
  const applyRemoteSettings = useLuckyDrawSettingsStore((state) => state.applyRemoteSettings);
  const products = useProductStore((state) => state.products);
  const productsLoading = useProductStore((state) => state.isLoading);
  const productsError = useProductStore((state) => state.error);
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const topMarginMm = usePrinterSettingsStore((state) => state.topMarginMm);
  const [draft, setDraft] = useState<LuckyDrawSettingsInput | null>(null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const activeDraft = draft?.warehouseId === auth.effectiveWarehouseId
    ? draft
    : null;
  const settings = activeDraft ?? (
    appliedSettings.warehouseId === auth.effectiveWarehouseId
      ? appliedSettings
      : createDefaultLuckyDrawSettings(auth.effectiveWarehouseId ?? "")
  );

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || !auth.userDoc)) router.replace("/login");
  }, [auth.isLoading, auth.user, auth.userDoc, router]);

  useEffect(() => {
    if (auth.user && products.length === 0 && !productsLoading && !productsError) {
      void fetchProducts();
    }
  }, [auth.user, fetchProducts, products.length, productsError, productsLoading]);

  const packages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return products
      .filter((product) => MEMBER_PACKAGE_CATEGORIES.has(product.category))
      .filter((product) => !query || [product.goodsName, product.typeName, product.goodsId]
        .some((value) => value?.toLocaleLowerCase("vi").includes(query)));
  }, [products, search]);

  const configuredCount = Object.values(settings.packageTicketCounts)
    .filter((count) => count > 0).length;

  const updateSettings = useCallback((patch: Partial<LuckyDrawSettingsInput>) => {
    if (!canManageGeneralSettings) return;
    setDraft((current) => ({
      ...(current?.warehouseId === auth.effectiveWarehouseId ? current : settings),
      warehouseId: auth.effectiveWarehouseId ?? settings.warehouseId,
      ...patch,
    }));
  }, [auth.effectiveWarehouseId, canManageGeneralSettings, settings]);

  const updatePackageCount = useCallback((goodsId: string, count: number) => {
    const normalized = Math.min(
      MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE,
      Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0)),
    );
    const next = { ...settings.packageTicketCounts };
    if (normalized > 0) next[goodsId] = normalized;
    else delete next[goodsId];
    updateSettings({ packageTicketCounts: next });
  }, [settings.packageTicketCounts, updateSettings]);

  const handleSave = useCallback(async () => {
    if (!auth.effectiveWarehouseId || !activeDraft || isSaving || !canManageGeneralSettings) return;
    setIsSaving(true);
    try {
      const saved = await saveLuckyDrawSettings({
        ...activeDraft,
        warehouseId: auth.effectiveWarehouseId,
      });
      applyRemoteSettings(saved);
      setDraft(null);
      showSuccess(
        "Đã lưu chương trình bốc thăm",
        saved.enabled
          ? "Các máy POS tại điểm bán sẽ cấp phiếu theo mapping đã cấu hình."
          : "Chương trình đã tắt; đơn mới sẽ không được cấp phiếu.",
      );
    } catch (error: unknown) {
      showError(
        "Không thể lưu cấu hình bốc thăm",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [activeDraft, applyRemoteSettings, auth.effectiveWarehouseId, canManageGeneralSettings, isSaving]);

  const handlePrintPreview = useCallback(async () => {
    setIsPrinting(true);
    try {
      await printLuckyDrawPreviewWithDialog(SAMPLE_TICKET, settings);
    } catch (error: unknown) {
      showError("Không thể mở bản in thử", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsPrinting(false);
    }
  }, [settings]);

  if (auth.isLoading || !auth.user || !auth.userDoc) {
    return <div className="grid h-screen place-items-center bg-[var(--color-background)]"><div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Gift className="size-5" /></div>
            <div><h1 className="text-lg font-extrabold">Phiếu bốc thăm trúng thưởng</h1><p className="text-xs text-[var(--color-text-muted)]">{auth.effectiveWarehouseName || "Điểm bán hiện tại"} · mapping theo gói điểm thành viên</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-1.5 text-xs font-semibold sm:flex ${activeDraft ? "text-amber-600" : "text-emerald-600"}`}><Check className="size-3.5" />{activeDraft ? "Có thay đổi chưa lưu" : `Đã đồng bộ · v${remoteVersion ?? 0}`}</span>
            <button type="button" onClick={() => setDraft(createDefaultLuckyDrawSettings(auth.effectiveWarehouseId ?? ""))} disabled={!canManageGeneralSettings || isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold disabled:opacity-50"><RotateCcw className="size-3.5" />Mặc định</button>
            <button type="button" onClick={() => void handleSave()} disabled={!activeDraft || !canManageGeneralSettings || isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"><Save className="size-3.5" />{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</button>
          </div>
        </header>

        <SettingsTabs />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(560px,1fr)_430px] xl:overflow-hidden">
          <fieldset disabled={!canManageGeneralSettings || isSaving} className="space-y-4 p-4 xl:overflow-y-auto">
            <section className={`rounded-2xl border p-4 ${settings.enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <div><p className="flex items-center gap-2 font-extrabold"><Sparkles className="size-4" />Chương trình đang {settings.enabled ? "bật" : "tắt"}</p><p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">Khi bật, bill của đơn có gói được mapping sẽ kèm đúng số phiếu bốc thăm.</p></div>
                <input type="checkbox" checked={settings.enabled} onChange={(event) => updateSettings({ enabled: event.target.checked })} className="size-6 accent-emerald-600" />
              </label>
            </section>

            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <h2 className="font-extrabold">Nội dung phiếu</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Thông tin khách hàng, đơn hàng, ngày mua, sản phẩm và barcode luôn được lấy từ đơn đã thanh toán.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold">Tên chương trình<input value={settings.programName} maxLength={100} onChange={(event) => updateSettings({ programName: event.target.value })} className={fieldClassName} /></label>
                <label className="grid gap-1.5 text-xs font-bold">Tiêu đề phiếu<input value={settings.ticketTitle} maxLength={80} onChange={(event) => updateSettings({ ticketTitle: event.target.value })} className={fieldClassName} /></label>
                <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Hướng dẫn<textarea value={settings.message} maxLength={240} rows={3} onChange={(event) => updateSettings({ message: event.target.value })} className={`${fieldClassName} py-3`} /></label>
                <label className="grid gap-1.5 text-xs font-bold sm:col-span-2">Dòng cuối phiếu<input value={settings.footerMessage} maxLength={160} onChange={(event) => updateSettings({ footerMessage: event.target.value })} className={fieldClassName} /></label>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {Object.values(RECEIPT_PAPER_PROFILES).map((profile) => (
                  <button key={profile.id} type="button" onClick={() => updateSettings({ paperSize: profile.id as ReceiptPaperSize })} className={`rounded-xl border p-3 text-left ${settings.paperSize === profile.id ? "border-[var(--color-accent)] bg-orange-50" : "border-[var(--color-border)]"}`}><span className="block text-sm font-extrabold">{profile.label}</span><span className="text-[10px] text-[var(--color-text-muted)]">{profile.printableWidthMm} mm</span></button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Số phiếu theo gói</h2><p className="mt-1 text-xs text-[var(--color-text-muted)]">Đã cấu hình {configuredCount} gói. Nhập 0 để không cấp phiếu.</p></div><label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm gói..." className={`${fieldClassName} w-56 pl-9`} /></label></div>
              <div className="mt-4 space-y-2">
                {productsLoading ? <div className="h-32 animate-pulse rounded-xl bg-slate-100" /> : null}
                {productsError ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{productsError}</p> : null}
                {!productsLoading && packages.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-[var(--color-text-muted)]">Không tìm thấy gói điểm thành viên.</p> : null}
                {packages.map((product) => {
                  const count = settings.packageTicketCounts[product.goodsId] ?? 0;
                  const price = product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price;
                  return <div key={product.goodsId} className={`grid grid-cols-[1fr_96px] items-center gap-3 rounded-xl border p-3 ${count > 0 ? "border-amber-300 bg-amber-50" : "border-[var(--color-border)]"}`}><div className="min-w-0"><p className="truncate text-sm font-extrabold">{product.goodsName}</p><p className="truncate text-xs text-[var(--color-text-muted)]">{product.typeName || product.goodsId} · {formatCurrency(price)}</p></div><label className="grid gap-1 text-center text-[10px] font-bold text-[var(--color-text-muted)]">SỐ PHIẾU<input type="number" min={0} max={MAX_LUCKY_DRAW_TICKETS_PER_PACKAGE} step={1} value={count} onChange={(event) => updatePackageCount(product.goodsId, Number(event.target.value))} className={`${fieldClassName} text-center text-base font-black`} /></label></div>;
                })}
              </div>
            </section>
          </fieldset>

          <aside className="border-l border-[var(--color-border)] bg-[#d8d6d1] p-4 xl:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-extrabold">Xem trước phiếu</h2><p className="text-xs text-slate-600">Dữ liệu minh họa · barcode Code 39</p></div><button type="button" onClick={() => void handlePrintPreview()} disabled={isPrinting} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#202124] px-3 text-xs font-bold text-white disabled:opacity-50"><Printer className="size-4" />{isPrinting ? "Đang mở..." : "In thử"}</button></div>
            <div className="mx-auto w-fit overflow-hidden bg-white shadow-xl"><LuckyDrawTicketDocument ticket={SAMPLE_TICKET} settings={settings} topMarginMm={topMarginMm} /></div>
          </aside>
        </div>
      </main>
    </div>
  );
}
