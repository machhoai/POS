"use client";

import { useRouter } from "next/navigation";
import { Landmark, Save, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  getFixedTransferSettings,
  saveFixedTransferSettings,
} from "@/lib/services/fixedTransferSettingsService";
import type { FixedTransferSettingsInput } from "@/lib/types/paymentSettings";
import { showError, showSuccess } from "@/lib/utils/toast";

const MANAGE_PAYMENT_SETTINGS_PERMISSION = "pos.settings.manage";
const fieldClassName = "min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] shadow-sm transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100";

const EMPTY_FORM: FixedTransferSettingsInput = {
  warehouseId: "",
  enabled: false,
  bankBin: "",
  accountNumber: "",
  accountName: "",
};

export default function PaymentSettingsPage() {
  const router = useRouter();
  const {
    user,
    userDoc,
    isLoading: authLoading,
    logout,
    effectiveWarehouseId,
    effectiveWarehouseName,
    hasPermission,
  } = useAuth();
  const [form, setForm] = useState<FixedTransferSettingsInput>(EMPTY_FORM);
  const [loadedWarehouseId, setLoadedWarehouseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isLoading = Boolean(
    effectiveWarehouseId && loadedWarehouseId !== effectiveWarehouseId,
  );
  const canManage = Boolean(
    effectiveWarehouseId &&
    hasPermission(MANAGE_PAYMENT_SETTINGS_PERMISSION, effectiveWarehouseId),
  );

  useEffect(() => {
    if (!authLoading && (!user || !userDoc)) router.replace("/login");
  }, [authLoading, router, user, userDoc]);

  useEffect(() => {
    if (!effectiveWarehouseId || !user) return;
    let isDisposed = false;
    void getFixedTransferSettings(effectiveWarehouseId)
      .then((settings) => {
        if (isDisposed) return;
        setForm(settings
          ? {
              warehouseId: settings.warehouseId,
              enabled: settings.enabled,
              bankBin: settings.bankBin,
              accountNumber: settings.accountNumber,
              accountName: settings.accountName,
            }
          : { ...EMPTY_FORM, warehouseId: effectiveWarehouseId });
      })
      .catch((error: unknown) => {
        console.error("[Cài đặt thanh toán] Không thể tải cấu hình:", error);
        showError(
          "Không thể tải cấu hình thanh toán",
          "Vui lòng kiểm tra kết nối và thử lại.",
        );
      })
      .finally(() => {
        if (!isDisposed) setLoadedWarehouseId(effectiveWarehouseId);
      });
    return () => {
      isDisposed = true;
    };
  }, [effectiveWarehouseId, user]);

  const updateForm = useCallback(
    <K extends keyof FixedTransferSettingsInput,>(
      key: K,
      value: FixedTransferSettingsInput[K],
    ) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!effectiveWarehouseId || !canManage) return;
    setIsSaving(true);
    try {
      const saved = await saveFixedTransferSettings({
        ...form,
        warehouseId: effectiveWarehouseId,
      });
      setForm({
        warehouseId: saved.warehouseId,
        enabled: saved.enabled,
        bankBin: saved.bankBin,
        accountNumber: saved.accountNumber,
        accountName: saved.accountName,
      });
      showSuccess(
        "Đã lưu cấu hình thanh toán",
        "QR tài khoản cố định đã sẵn sàng làm phương án dự phòng cho PayOS.",
      );
    } catch (error: unknown) {
      console.error("[Cài đặt thanh toán] Không thể lưu cấu hình:", error);
      showError(
        "Không thể lưu cấu hình",
        error instanceof Error ? error.message : "Vui lòng kiểm tra dữ liệu và thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [canManage, effectiveWarehouseId, form]);

  if (authLoading || !user || !userDoc) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[var(--color-accent)]">
              <Landmark className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--color-text-primary)]">Cài đặt thanh toán</h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Tài khoản QR dự phòng cho {effectiveWarehouseName || "điểm bán hiện tại"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canManage || isSaving || isLoading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              <Save className="size-4" /> {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </div>
        </header>

        <SettingsTabs />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-3xl space-y-4">
            {!canManage ? (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-sm font-extrabold">Chỉ quản lý được thay đổi tài khoản</p>
                  <p className="mt-1 text-xs leading-5">Bạn vẫn có thể xem cấu hình đang áp dụng tại điểm bán này.</p>
                </div>
              </div>
            ) : null}

            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--color-text-primary)]">QR tài khoản cố định</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    Chỉ được dùng tự động khi PayOS không tạo hoặc không trả về mã QR.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => updateForm("enabled", event.target.checked)}
                    disabled={!canManage || isLoading}
                    className="size-5 accent-[var(--color-accent)]"
                  />
                  Bật dự phòng
                </label>
              </div>

              {isLoading ? (
                <div className="mt-5 grid animate-pulse gap-4 sm:grid-cols-2">
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100 sm:col-span-2" />
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
                    Mã BIN ngân hàng
                    <input
                      value={form.bankBin}
                      onChange={(event) => updateForm("bankBin", event.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={!canManage}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Ví dụ: 970422"
                      className={fieldClassName}
                    />
                    <span className="font-normal text-[var(--color-text-muted)]">Gồm đúng 6 chữ số.</span>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
                    Số tài khoản
                    <input
                      value={form.accountNumber}
                      onChange={(event) => updateForm("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 19))}
                      disabled={!canManage}
                      inputMode="numeric"
                      maxLength={19}
                      className={fieldClassName}
                    />
                    <span className="font-normal text-[var(--color-text-muted)]">Từ 6 đến 19 chữ số.</span>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] sm:col-span-2">
                    Tên chủ tài khoản
                    <input
                      value={form.accountName}
                      onChange={(event) => updateForm("accountName", event.target.value.slice(0, 50))}
                      disabled={!canManage}
                      maxLength={50}
                      placeholder="Tên hiển thị trên ứng dụng ngân hàng"
                      className={fieldClassName}
                    />
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              Mỗi mã fallback sẽ tự điền đúng tổng tiền và nội dung của đơn. Sau khi nhân viên hoàn tất, đơn được in bill và đánh dấu <strong>Chưa được xác nhận thanh toán</strong> trong lịch sử.
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
