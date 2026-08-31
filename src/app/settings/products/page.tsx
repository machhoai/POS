"use client";

import { Eye, EyeOff, PackageSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { useSettingsAccess } from "@/features/settings/hooks/useSettingsAccess";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useProductVisibilitySync } from "@/lib/hooks/useProductVisibilitySync";
import { saveProductVisibility } from "@/lib/services/productVisibilityService";
import { getProductGroupKey, useProductStore } from "@/lib/stores/useProductStore";
import { showError, showSuccess } from "@/lib/utils/toast";

export default function ProductVisibilitySettingsPage() {
  const router = useRouter();
  const auth = useAuth();
  const { canManageGeneralSettings } = useSettingsAccess();
  useProductVisibilitySync(auth.effectiveWarehouseId);
  const products = useProductStore((state) => state.products);
  const settings = useProductStore((state) => state.visibilitySettings);
  const fetchProducts = useProductStore((state) => state.fetchProducts);
  const loading = useProductStore((state) => state.isLoading);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || !auth.userDoc)) router.replace("/login");
  }, [auth.isLoading, auth.user, auth.userDoc, router]);

  useEffect(() => {
    if (auth.user && products.length === 0 && !loading) void fetchProducts();
  }, [auth.user, fetchProducts, loading, products.length]);

  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    const result = new Map<string, typeof products>();
    for (const product of products) {
      if (query && ![product.goodsName, product.goodsId, product.typeName]
        .some((value) => value.toLocaleLowerCase("vi").includes(query))) continue;
      const groupKey = getProductGroupKey(product);
      result.set(groupKey, [...(result.get(groupKey) ?? []), product]);
    }
    return [...result.entries()];
  }, [products, search]);

  const persist = useCallback(async (
    disabledGroupKeys: string[],
    disabledProductIds: string[],
  ) => {
    if (saving || !canManageGeneralSettings) return;
    setSaving(true);
    try {
      await saveProductVisibility({
        expectedVersion: settings.version,
        disabledGroupKeys,
        disabledProductIds,
      });
      showSuccess("Đã cập nhật sản phẩm", "Các máy tại cửa hàng nhận thay đổi ngay lập tức.");
    } catch (error) {
      showError("Không thể cập nhật", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }, [canManageGeneralSettings, saving, settings.version]);

  if (auth.isLoading || !auth.user || !auth.userDoc) {
    return <div className="grid h-screen place-items-center"><div className="size-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" /></div>;
  }

  const disabledGroups = new Set(settings.disabledGroupKeys);
  const disabledProducts = new Set(settings.disabledProductIds);

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b bg-white px-5 py-3 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><PackageSearch className="size-5" /></div>
          <div><h1 className="text-lg font-extrabold">Sản phẩm hiển thị</h1><p className="text-xs text-[var(--color-text-muted)]">{auth.effectiveWarehouseName} · tự động đồng bộ · v{settings.version}</p></div>
        </header>
        <SettingsTabs />
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">Tắt nhóm phụ sẽ ẩn mọi sản phẩm trong nhóm. Sản phẩm đang có trong giỏ sẽ được xóa tự động; giao dịch QR đang chờ được hủy an toàn trước.</div>
            <label className="relative block"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm hoặc nhóm phụ..." className="min-h-10 w-full rounded-xl border bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400" /></label>
            {loading ? <div className="h-52 animate-pulse rounded-2xl bg-slate-100" /> : groups.map(([groupKey, items]) => {
              const groupDisabled = disabledGroups.has(groupKey);
              return <section key={groupKey} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <button type="button" disabled={!canManageGeneralSettings || saving} onClick={() => {
                  const next = new Set(disabledGroups);
                  if (groupDisabled) next.delete(groupKey);
                  else next.add(groupKey);
                  void persist([...next], [...disabledProducts]);
                }} className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left disabled:opacity-50"><span><span className="block text-sm font-extrabold">{items[0]?.typeName || "Chưa phân nhóm"}</span><span className="text-xs text-slate-500">{items.length} sản phẩm</span></span><span className={groupDisabled ? "flex items-center gap-2 text-xs font-bold text-slate-500" : "flex items-center gap-2 text-xs font-bold text-emerald-600"}>{groupDisabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{groupDisabled ? "Đã ẩn nhóm" : "Đang hiện nhóm"}</span></button>
                <div className="divide-y">{items.map((product) => {
                  const productDisabled = disabledProducts.has(product.goodsId);
                  return <button key={product.goodsId} type="button" disabled={!canManageGeneralSettings || saving || groupDisabled} onClick={() => {
                  const next = new Set(disabledProducts);
                    if (productDisabled) next.delete(product.goodsId);
                    else next.add(product.goodsId);
                    void persist([...disabledGroups], [...next]);
                  }} className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-40"><span><span className="block text-sm font-bold">{product.goodsName}</span><span className="text-xs text-slate-400">{product.goodsId}</span></span>{groupDisabled || productDisabled ? <EyeOff className="size-4 text-slate-400" /> : <Eye className="size-4 text-emerald-600" />}</button>;
                })}</div>
              </section>;
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
