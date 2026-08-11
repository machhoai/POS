"use client";

import { useRouter } from "next/navigation";
import { Landmark, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import PaymentSettingsForm from "@/components/settings/PaymentSettingsForm";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  getFixedTransferSettings,
  saveFixedTransferSettings,
} from "@/lib/services/fixedTransferSettingsService";
import type { FixedTransferSettingsInput } from "@/lib/types/paymentSettings";
import { showError, showSuccess } from "@/lib/utils/toast";

const MANAGE_PAYMENT_SETTINGS_PERMISSION = "pos.settings.manage";
const EMPTY_FORM: FixedTransferSettingsInput = {
  warehouseId: "",
  enabled: false,
  fixedTransferOnly: false,
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
              fixedTransferOnly: settings.fixedTransferOnly === true,
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

  const updateForm = useCallback((updates: Partial<FixedTransferSettingsInput>) => {
    setForm((current) => ({ ...current, ...updates }));
  }, []);

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
        fixedTransferOnly: saved.fixedTransferOnly,
        bankBin: saved.bankBin,
        accountNumber: saved.accountNumber,
        accountName: saved.accountName,
      });
      showSuccess(
        "Đã lưu cấu hình thanh toán",
        saved.fixedTransferOnly
          ? "Điểm bán sẽ chỉ dùng QR cố định và chờ nhân viên xác nhận thủ công."
          : "QR tài khoản cố định đã sẵn sàng làm phương án dự phòng cho PayOS.",
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
                Phương thức chuyển khoản cho {effectiveWarehouseName || "điểm bán hiện tại"}
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
          <PaymentSettingsForm
            form={form}
            canManage={canManage}
            isLoading={isLoading}
            onChange={updateForm}
          />
        </div>
      </main>
    </div>
  );
}
