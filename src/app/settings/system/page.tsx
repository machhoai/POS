"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, type ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useUpdater } from "@/features/updater/components/UpdateProvider";

const SystemSettingsPage: React.FC = () => {
  const router = useRouter();
  const { user, userDoc, isLoading: authLoading, logout } = useAuth();
  const updater = useUpdater();

  useEffect(() => {
    if (!authLoading && (!user || !userDoc)) router.replace("/login");
  }, [authLoading, router, user, userDoc]);

  const handleCheck = useCallback(() => {
    void updater.checkForUpdates(false);
  }, [updater]);

  const handleInstall = useCallback(() => {
    void updater.installUpdate();
  }, [updater]);

  const isBusy = updater.status === "downloading" || updater.status === "installing";

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[var(--color-accent)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--color-text-primary)]">Cập nhật hệ thống</h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Kiểm tra và cài đặt phiên bản JPOS đã được xác thực
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCheck}
            disabled={updater.status === "checking" || isBusy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-text-secondary)] hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${updater.status === "checking" ? "animate-spin" : ""}`} />
            {updater.status === "checking" ? "Đang kiểm tra..." : "Kiểm tra cập nhật"}
          </button>
        </header>

        <SettingsTabs />

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--color-border)] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Phiên bản hiện tại</p>
                  <p className="mt-2 text-3xl font-black text-[var(--color-text-primary)]">
                    {updater.currentVersion ? `JPOS ${updater.currentVersion}` : "JPOS"}
                  </p>
                </div>
                <StatusBadge status={updater.status} />
              </div>
            </div>

            <div className="space-y-5 p-6">
              {updater.status === "unsupported" && (
                <MessageBox icon={AlertCircle} tone="muted">
                  Chức năng cập nhật chỉ hoạt động trong ứng dụng JPOS desktop, không hoạt động khi mở bằng trình duyệt.
                </MessageBox>
              )}

              {updater.status === "up-to-date" && (
                <MessageBox icon={CheckCircle2} tone="success">
                  Bạn đang sử dụng phiên bản JPOS mới nhất.
                </MessageBox>
              )}

              {updater.error && (
                <MessageBox icon={AlertCircle} tone="error">{updater.error}</MessageBox>
              )}

              {updater.availableVersion && (
                <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[var(--color-accent)]">CÓ BẢN CẬP NHẬT</p>
                      <h2 className="mt-1 text-xl font-extrabold text-[var(--color-text-primary)]">
                        JPOS {updater.availableVersion}
                      </h2>
                      {updater.publishedAt && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          Phát hành: {new Date(updater.publishedAt).toLocaleString("vi-VN")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleInstall}
                      disabled={isBusy}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {isBusy ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
                      {updater.status === "downloading"
                        ? `Đang tải${updater.progressPercent === null ? "" : ` ${updater.progressPercent}%`}`
                        : updater.status === "installing"
                          ? "Đang cài đặt..."
                          : "Cập nhật ngay"}
                    </button>
                  </div>

                  {updater.status === "downloading" && (
                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-orange-100">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                        style={{ width: updater.progressPercent === null ? "20%" : `${updater.progressPercent}%` }}
                      />
                    </div>
                  )}

                  {updater.notes && (
                    <div className="mt-5 border-t border-orange-100 pt-4">
                      <p className="text-xs font-bold text-[var(--color-text-secondary)]">Nội dung cập nhật</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-muted)]">
                        {updater.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["1", "Kiểm tra", "JPOS đọc thông tin release mới nhất."],
                  ["2", "Xác thực", "Gói cài đặt được kiểm tra bằng chữ ký số."],
                  ["3", "Khởi động lại", "Ứng dụng cài bản mới và tự mở lại."],
                ].map(([number, title, description]) => (
                  <div key={number} className="rounded-2xl border border-[var(--color-border)] p-4">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-[var(--color-text-secondary)]">{number}</span>
                    <p className="mt-3 text-sm font-extrabold text-[var(--color-text-primary)]">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

interface StatusBadgeProps {
  status: ReturnType<typeof useUpdater>["status"];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const labels: Record<StatusBadgeProps["status"], string> = {
    idle: "Chưa kiểm tra",
    checking: "Đang kiểm tra",
    "up-to-date": "Mới nhất",
    available: "Có bản mới",
    downloading: "Đang tải",
    installing: "Đang cài",
    error: "Cần kiểm tra lại",
    unsupported: "Chỉ dành cho desktop",
  };

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)]">
      {labels[status]}
    </span>
  );
};

interface MessageBoxProps {
  icon: React.FC<{ className?: string }>;
  tone: "success" | "error" | "muted";
  children: ReactNode;
}

const MessageBox: React.FC<MessageBoxProps> = ({ icon: Icon, tone, children }) => {
  const toneClasses = {
    success: "bg-emerald-50 text-emerald-800",
    error: "bg-red-50 text-red-700",
    muted: "bg-slate-50 text-slate-600",
  };

  return (
    <div className={`flex gap-3 rounded-2xl p-4 text-sm leading-6 ${toneClasses[tone]}`}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </div>
  );
};

export default SystemSettingsPage;
