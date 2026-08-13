"use client";

import { Megaphone, Radio, Save, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Sidebar from "@/components/layout/Sidebar";
import AdvertisingMediaUploader from "@/components/settings/AdvertisingMediaUploader";
import AdvertisingPlaylistEditor from "@/components/settings/AdvertisingPlaylistEditor";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { useSettingsAccess } from "@/features/settings/hooks/useSettingsAccess";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCustomerDisplayAdvertisingEditor } from "@/lib/hooks/useCustomerDisplayAdvertisingEditor";
import { applyCustomerDisplayAdvertisingView } from "@/lib/services/customerDisplayAdvertisingSyncService";
import {
  removeCustomerDisplayAdvertising,
  saveCustomerDisplayAdvertising,
  uploadCustomerDisplayAdvertising,
} from "@/lib/services/customerDisplayAdvertisingService";
import { loadDeviceCredential } from "@/lib/services/deviceEnrollmentService";
import type { CustomerDisplayPlaylistItem } from "@/lib/types/customerDisplayAdvertising";
import { showError, showSuccess } from "@/lib/utils/toast";

export default function AdvertisingSettingsPage() {
  const router = useRouter();
  const auth = useAuth();
  const { canReadAdvertisingSettings, canManageAdvertisingSettings } = useSettingsAccess();
  const [deviceWarehouseId, setDeviceWarehouseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerDisplayPlaylistItem[]>([]);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);
  const sameWarehouse = Boolean(auth.effectiveWarehouseId && auth.effectiveWarehouseId === deviceWarehouseId);
  const canRead = sameWarehouse && canReadAdvertisingSettings;
  const canManage = sameWarehouse && canManageAdvertisingSettings;
  const editor = useCustomerDisplayAdvertisingEditor(deviceWarehouseId, canRead);
  const mediaById = useMemo(() => new Map(editor.view?.media.map((item) => [item.id, item]) ?? []), [editor.view?.media]);

  useEffect(() => { if (!auth.isLoading && (!auth.user || !auth.userDoc)) router.replace("/login"); }, [auth.isLoading, auth.user, auth.userDoc, router]);
  useEffect(() => { void loadDeviceCredential().then((value) => setDeviceWarehouseId(value?.warehouse_id || null)); }, []);
  useEffect(() => {
    let disposed = false;
    const next = (editor.view?.settings?.playlist ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    queueMicrotask(() => { if (!disposed) setDraft(next); });
    return () => { disposed = true; };
  }, [editor.view?.settings?.playlist, editor.view?.settings?.version]);

  const applyResult = async (view: NonNullable<typeof editor.view>) => {
    await applyCustomerDisplayAdvertisingView(view);
    editor.replace(view);
  };
  const save = async () => {
    setBusy("save");
    try {
      await applyResult(await saveCustomerDisplayAdvertising({ expectedVersion: editor.view?.settings?.version ?? 0, playlist: draft.map((item, index) => ({ ...item, sort_order: index })) }));
      showSuccess("Đã lưu playlist quảng cáo", "Màn hình khách hàng nhận cấu hình mới theo thời gian thực.");
    } catch (error) { showError("Không thể lưu quảng cáo", error instanceof Error ? error.message : "Vui lòng thử lại."); }
    finally { setBusy(null); }
  };
  const upload = async (file: File) => {
    if (draft.length >= 10) return showError("Playlist đã đầy", "Mỗi cửa hàng được cấu hình tối đa 10 quảng cáo.");
    setBusy("upload");
    try { await applyResult(await uploadCustomerDisplayAdvertising(file, editor.view?.settings?.version ?? 0)); }
    catch (error) { showError("Không thể tải tệp", error instanceof Error ? error.message : "Vui lòng thử lại."); }
    finally { setBusy(null); }
  };
  const remove = async (mediaId: string) => {
    if (!window.confirm("Xóa tệp này khỏi playlist quảng cáo?")) return;
    setBusy("remove");
    try { await applyResult(await removeCustomerDisplayAdvertising(mediaId, editor.view?.settings?.version ?? 0)); }
    catch (error) { showError("Không thể xóa quảng cáo", error instanceof Error ? error.message : "Vui lòng thử lại."); }
    finally { setBusy(null); }
  };
  if (auth.isLoading || !auth.user || !auth.userDoc) return <div className="grid h-screen place-items-center bg-[var(--color-background)]"><div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" /></div>;
  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-orange-50 text-[var(--color-accent)]"><Megaphone className="size-5" /></div><div><h1 className="text-lg font-extrabold text-[var(--color-text-primary)]">Quảng cáo màn hình khách hàng</h1><p className="text-xs text-[var(--color-text-muted)]">Playlist riêng cho {auth.effectiveWarehouseName || "cửa hàng hiện tại"}</p></div></div>
          <button type="button" onClick={() => void save()} disabled={!canManage || busy !== null || editor.loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"><Save className="size-4" />{busy === "save" ? "Đang lưu…" : "Lưu playlist"}</button>
        </header>
        <SettingsTabs />
        <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="mx-auto max-w-5xl space-y-4">
          {!sameWarehouse ? <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><ShieldAlert className="size-5 shrink-0" /><p className="text-sm font-bold">Cửa hàng đang chọn không khớp cửa hàng đã gán cho thiết bị JPOS này.</p></div> : !canRead ? <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><ShieldAlert className="size-5 shrink-0" /><p className="text-sm font-bold">Bạn chưa có quyền xem quảng cáo của cửa hàng này.</p></div> : null}
          {editor.error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{editor.error}</p> : null}
          {canRead ? <><section className="flex items-start justify-between rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm"><div className="flex gap-3"><Radio className="size-5 text-emerald-600" /><div><p className="text-sm font-extrabold">Đồng bộ realtime với JPULSE</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Phiên bản {editor.view?.settings?.version ?? 0} · hình hiển thị 3–15 giây · video tối đa 15 giây</p></div></div></section>{canManage ? <AdvertisingMediaUploader disabled={draft.length >= 10 || busy !== null} uploading={busy === "upload"} onUpload={upload} onInvalid={() => showError("Tệp không hợp lệ", "Chỉ nhận PNG, JPG, WEBP hoặc MP4 tối đa 15 giây.")} /> : null}<AdvertisingPlaylistEditor items={draft} mediaById={mediaById} disabled={!canManage || busy !== null} onChange={setDraft} onRemove={(id) => void remove(id)} /></> : null}
        </div></div>
      </main>
    </div>
  );
}
