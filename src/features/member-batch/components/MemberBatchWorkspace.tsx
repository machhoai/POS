"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Radio,
  RefreshCw,
  ShoppingCart,
  SkipForward,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import StoreSelector from "@/components/pos/StoreSelector";
import { useAuth } from "@/lib/contexts/AuthContext";
import { showError, showSuccess } from "@/lib/utils/toast";
import {
  downloadMemberBatchTemplate,
  readMemberBatchFile,
} from "@/features/member-batch/helpers/memberBatchImport";
import { useMemberBatchProcessor } from "@/features/member-batch/hooks/useMemberBatchProcessor";
import { useMemberBatchStore } from "@/features/member-batch/store/useMemberBatchStore";
import type {
  MemberBatchImportError,
  MemberBatchItem,
  MemberBatchJobStatus,
  MemberBatchPhase,
  MemberBatchSafeStage,
} from "@/features/member-batch/types/memberBatch";

const phaseCopy: Record<MemberBatchPhase, { title: string; description: string }> = {
  IDLE: {
    title: "Sẵn sàng đọc thẻ",
    description: "Đặt đúng thẻ chưa kích hoạt lên đầu đọc và giữ nguyên cho đến khi xác thực xong.",
  },
  WAITING_FOR_NEW_CARD: {
    title: "Hãy nhấc thẻ vừa hoàn thành",
    description: "Đặt thẻ mới lên đầu đọc. JPOS sẽ tự nhận khi mã thẻ thay đổi.",
  },
  READING_CARD: {
    title: "Đang đọc thẻ lần 1",
    description: "Giữ nguyên thẻ trên đầu đọc, không thay thẻ lúc này.",
  },
  VERIFYING_CARD: {
    title: "Đang xác thực thẻ lần 2",
    description: "Tiếp tục giữ nguyên thẻ cho đến khi JPOS chuyển sang bước tạo thành viên.",
  },
  REGISTERING_MEMBER: {
    title: "Đang tạo thành viên",
    description: "Thẻ đã đọc chỉ được giữ tạm. Nếu dừng tại đây, lần tiếp tục sẽ yêu cầu đọc lại.",
  },
  ATTACHING_CARD: {
    title: "Đang gắn thẻ trên Joyworld",
    description: "Không đóng ứng dụng. JPOS đang xác nhận quyền sở hữu thẻ và lưu hồ sơ.",
  },
  TOPPING_UP_POINTS: {
    title: "Đang nạp điểm",
    description: "Thẻ đã được gắn. Yêu cầu nạp điểm có mã chống thực hiện trùng khi thử lại.",
  },
};

const jobStatusCopy: Record<MemberBatchJobStatus, string> = {
  READY: "Sẵn sàng",
  RUNNING: "Đang chạy",
  PAUSE_REQUESTED: "Đang chờ điểm dừng an toàn",
  PAUSED: "Đã tạm dừng",
  NEEDS_ATTENTION: "Cần xử lý",
  COMPLETED: "Hoàn thành",
};

function safeStageLabel(stage: MemberBatchSafeStage): string {
  return {
    AWAITING_CARD: "Chờ thẻ",
    MEMBER_CREATED: "Đã tạo, cần đọc lại thẻ",
    CARD_ATTACHED: "Đã gắn thẻ",
    COMPLETED: "Hoàn thành",
    SKIPPED: "Đã bỏ qua",
  }[stage];
}

function stageTone(stage: MemberBatchSafeStage): string {
  if (stage === "COMPLETED") return "bg-emerald-50 text-emerald-700";
  if (stage === "CARD_ATTACHED") return "bg-sky-50 text-sky-700";
  if (stage === "MEMBER_CREATED") return "bg-amber-50 text-amber-800";
  if (stage === "SKIPPED") return "bg-slate-100 text-slate-600";
  return "bg-orange-50 text-orange-700";
}

function downloadResult(items: MemberBatchItem[], fileName: string): void {
  const escape = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [
    ["Dòng", "Họ và tên", "Số điện thoại", "Mã thẻ", "Điểm", "Trạng thái", "Lỗi"],
    ...items.map((item) => [
      item.rowNumber,
      item.fullName,
      item.phone,
      item.memberCode || "",
      item.points,
      safeStageLabel(item.safeStage),
      item.errorMessage || "",
    ]),
  ].map((row) => row.map(escape).join(","));
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ket-qua-${fileName.replace(/\.[^.]+$/, "")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const MemberBatchWorkspace: React.FC = () => {
  const router = useRouter();
  const auth = useAuth();
  const job = useMemberBatchStore((state) => state.job);
  const hasHydrated = useMemberBatchStore((state) => state.hasHydrated);
  const createJob = useMemberBatchStore((state) => state.createJob);
  const startOrResume = useMemberBatchStore((state) => state.startOrResume);
  const requestPause = useMemberBatchStore((state) => state.requestPause);
  const retryCurrent = useMemberBatchStore((state) => state.retryCurrent);
  const skipCurrent = useMemberBatchStore((state) => state.skipCurrent);
  const clearJob = useMemberBatchStore((state) => state.clearJob);
  const [importErrors, setImportErrors] = useState<MemberBatchImportError[]>([]);
  const [isImporting, setImporting] = useState(false);
  const [navigateToSalesWhenPaused, setNavigateToSalesWhenPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;
  const warehouseId = auth.effectiveWarehouseId;
  const canCompensate = auth.hasPermission(
    "pos.members.compensate",
    warehouseId || undefined,
  );

  useMemberBatchProcessor({ shopId, warehouseId });

  const current = job?.items[job.currentIndex] ?? null;
  const stats = useMemo(() => {
    const items = job?.items ?? [];
    return {
      completed: items.filter((item) => item.safeStage === "COMPLETED").length,
      skipped: items.filter((item) => item.safeStage === "SKIPPED").length,
      failed: items.filter((item) => Boolean(item.errorMessage) && item.safeStage !== "SKIPPED").length,
      points: items.reduce((total, item) => total + item.points, 0),
    };
  }, [job?.items]);
  const hasPointRows = Boolean(job?.items.some((item) => item.points > 0));
  const warehouseMismatch = Boolean(job && warehouseId && job.warehouseId !== warehouseId);
  const phase = current?.phase ?? "IDLE";
  const phaseMessage = phaseCopy[phase];

  useEffect(() => {
    if (navigateToSalesWhenPaused && (job?.status === "PAUSED" || job?.status === "COMPLETED")) {
      router.push("/");
    }
  }, [job?.status, navigateToSalesWhenPaused, router]);

  const handleFile = useCallback(async (file: File): Promise<void> => {
    if (!warehouseId) {
      showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi nhập danh sách.");
      return;
    }
    if (job && job.status !== "COMPLETED" && !window.confirm(
      "Nhập file mới sẽ thay thế lô đang lưu trên máy này. Bạn có chắc muốn tiếp tục?",
    )) return;

    setImporting(true);
    setImportErrors([]);
    try {
      const result = await readMemberBatchFile(file);
      setImportErrors(result.errors);
      if (result.errors.length > 0) {
        showError("File chưa hợp lệ", `Có ${result.errors.length} lỗi cần sửa trước khi bắt đầu.`);
        return;
      }
      createJob({
        fileName: file.name,
        warehouseId,
        warehouseName: auth.effectiveWarehouseName || warehouseId,
        rows: result.rows,
      });
      showSuccess("Đã đọc file", `Đã nạp ${result.rows.length} thành viên vào hàng đợi.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể đọc file Excel.";
      setImportErrors([{ rowNumber: null, message }]);
      showError("Không thể đọc file", message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [auth.effectiveWarehouseName, createJob, job, warehouseId]);

  const handleStart = useCallback(() => {
    if (!job || warehouseMismatch) return;
    if (hasPointRows && !canCompensate) {
      showError(
        "Thiếu quyền nạp điểm",
        "Lô có thành viên cần nạp điểm nhưng tài khoản chưa có quyền pos.members.compensate.",
      );
      return;
    }
    startOrResume();
  }, [canCompensate, hasPointRows, job, startOrResume, warehouseMismatch]);

  const handlePauseAndSell = useCallback(() => {
    if (!job) return;
    setNavigateToSalesWhenPaused(true);
    requestPause();
  }, [job, requestPause]);

  const handleSkip = useCallback(() => {
    if (!current || !window.confirm(
      `Bỏ qua dòng ${current.rowNumber} – ${current.fullName}? Dòng này sẽ không được tự chạy lại.${
        current.memberUid ? " Thành viên đã tạo trên Joyworld vẫn được giữ lại." : ""
      }`,
    )) return;
    skipCurrent();
  }, [current, skipCurrent]);

  const handleClear = useCallback(() => {
    if (!job || window.confirm("Xóa toàn bộ tiến độ lô này khỏi máy POS?")) {
      clearJob();
      setImportErrors([]);
    }
  }, [clearJob, job]);

  if (auth.isLoading || !auth.user || !auth.userDoc) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
        <LoaderCircle className="size-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (auth.needsWarehouseSelection) {
    return (
      <StoreSelector
        userName={auth.userDoc?.full_name || "Nhân viên"}
        warehouses={auth.availableWarehouses}
        onSelectWarehouse={auth.selectWarehouse}
        onLogout={auth.logout}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]">
              <UsersRound className="size-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Tạo thẻ thành viên hàng loạt</h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Điểm bán: {auth.effectiveWarehouseName || warehouseId || "chưa chọn"}
              </p>
            </div>
          </div>
          {job ? (
            <span className={`rounded-full px-4 py-2 text-sm font-black ${
              job.status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700"
                : job.status === "NEEDS_ATTENTION"
                  ? "bg-red-50 text-red-700"
                  : job.status === "PAUSED"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-orange-50 text-orange-700"
            }`}>
              {jobStatusCopy[job.status]}
            </span>
          ) : null}
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <div className="mx-auto max-w-[1500px] space-y-4">
            {!hasHydrated || auth.isLoading ? (
              <section className="flex min-h-40 items-center justify-center rounded-3xl border border-[var(--color-border)] bg-white">
                <LoaderCircle className="size-7 animate-spin text-[var(--color-accent)]" />
                <span className="ml-3 text-sm font-bold text-[var(--color-text-muted)]">Đang khôi phục tiến độ...</span>
              </section>
            ) : null}

            {hasHydrated && !auth.isLoading ? (
              <>
                <section className="grid gap-4 lg:grid-cols-[minmax(320px,0.75fr)_minmax(480px,1.25fr)]">
                  <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Bước 1</p>
                        <h2 className="mt-1 text-lg font-extrabold">Nhập danh sách Excel</h2>
                      </div>
                      <FileSpreadsheet className="size-7 text-emerald-600" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                      Hỗ trợ .xlsx và .csv. Bắt buộc có Họ và tên, Số điện thoại, Giới tính và Số điểm cần nạp. Ngày sinh và Email có thể để trống.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting || job?.status === "RUNNING" || job?.status === "PAUSE_REQUESTED"}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-4 text-sm font-extrabold text-white disabled:opacity-50"
                      >
                        {isImporting ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {isImporting ? "Đang đọc file..." : "Chọn file Excel"}
                      </button>
                      <button
                        type="button"
                        onClick={downloadMemberBatchTemplate}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] px-4 text-sm font-bold text-[var(--color-text-secondary)]"
                      >
                        <Download className="size-4" /> Tải file mẫu
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                      }}
                    />
                    {importErrors.length > 0 ? (
                      <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-red-200 bg-red-50 p-3">
                        {importErrors.map((error, index) => (
                          <p key={`${error.rowNumber}-${index}`} className="text-sm font-semibold text-red-700">
                            {error.rowNumber ? `Dòng ${error.rowNumber}: ` : ""}{error.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Bước 2</p>
                        <h2 className="mt-1 text-lg font-extrabold">Đọc và xử lý lần lượt</h2>
                      </div>
                      {job ? <p className="font-mono text-xs font-bold text-slate-500">{job.fileName}</p> : null}
                    </div>

                    {!job ? (
                      <div className="mt-4 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-slate-50 p-6 text-center">
                        <FileSpreadsheet className="size-10 text-slate-300" />
                        <p className="mt-3 font-extrabold text-slate-700">Chưa có danh sách</p>
                        <p className="mt-1 text-sm text-slate-500">Nhập file để kiểm tra dữ liệu trước khi bật đầu đọc.</p>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-2xl font-black">{job.items.length}</p><p className="text-xs font-bold text-slate-500">Tổng dòng</p></div>
                          <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{stats.completed}</p><p className="text-xs font-bold text-emerald-600">Hoàn thành</p></div>
                          <div className="rounded-2xl bg-red-50 p-3"><p className="text-2xl font-black text-red-700">{stats.failed}</p><p className="text-xs font-bold text-red-600">Có lỗi</p></div>
                          <div className="rounded-2xl bg-sky-50 p-3"><p className="text-2xl font-black text-sky-700">{stats.points.toLocaleString("vi-VN")}</p><p className="text-xs font-bold text-sky-600">Tổng điểm</p></div>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                            style={{ width: `${job.items.length ? ((stats.completed + stats.skipped) / job.items.length) * 100 : 0}%` }}
                          />
                        </div>

                        {warehouseMismatch ? (
                          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                            Lô này thuộc điểm bán {job.warehouseName}. Hãy chuyển về đúng điểm bán trước khi tiếp tục.
                          </div>
                        ) : null}
                        {hasPointRows && !canCompensate ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                            Tài khoản hiện tại chưa có quyền nạp điểm. Có thể kiểm tra file nhưng không thể bắt đầu lô có điểm.
                          </div>
                        ) : null}

                        {current && job.status !== "COMPLETED" ? (
                          <div className={`rounded-3xl border p-5 ${current.errorMessage ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
                            <div className="flex items-start gap-4">
                              <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${current.errorMessage ? "bg-red-100 text-red-600" : "bg-white text-orange-600"}`}>
                                {current.errorMessage ? <AlertTriangle className="size-6" /> : <Radio className={`size-6 ${job.status === "RUNNING" ? "animate-pulse" : ""}`} />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Dòng {current.rowNumber} · {job.currentIndex + 1}/{job.items.length}</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">{current.fullName}</h3>
                                <p className="mt-1 font-mono text-sm font-bold text-slate-600">{current.phone} · {current.points.toLocaleString("vi-VN")} điểm</p>
                                <div className="mt-4 rounded-2xl bg-white/80 p-4">
                                  <p className="font-black text-slate-900">{current.errorMessage || phaseMessage.title}</p>
                                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                    {current.errorMessage
                                      ? current.safeStage === "CARD_ATTACHED"
                                        ? "Thẻ đã gắn an toàn. Bấm thử lại để tiếp tục nạp điểm."
                                        : "Bấm thử lại và đọc lại đúng thẻ. JPOS không giữ dữ liệu thẻ tạm sau lỗi hoặc tạm dừng."
                                      : phaseMessage.description}
                                  </p>
                                  {current.memberCode ? <p className="mt-2 font-mono text-sm font-black text-emerald-700">Thẻ: {current.memberCode}</p> : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {["READY", "PAUSED"].includes(job.status) ? (
                            <button type="button" onClick={handleStart} disabled={warehouseMismatch || (hasPointRows && !canCompensate)} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-extrabold text-white disabled:opacity-40">
                              <CirclePlay className="size-5" /> {job.status === "READY" ? "Bắt đầu lô" : "Tiếp tục tại dòng đang dừng"}
                            </button>
                          ) : null}
                          {job.status === "NEEDS_ATTENTION" ? (
                            <button type="button" onClick={retryCurrent} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-extrabold text-white">
                              <RefreshCw className="size-5" /> Thử lại dòng này
                            </button>
                          ) : null}
                          {["RUNNING", "PAUSE_REQUESTED", "NEEDS_ATTENTION"].includes(job.status) ? (
                            <button type="button" onClick={handlePauseAndSell} disabled={job.status === "PAUSE_REQUESTED"} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-extrabold text-white disabled:opacity-60">
                              {job.status === "PAUSE_REQUESTED" ? <LoaderCircle className="size-5 animate-spin" /> : <CirclePause className="size-5" />}
                              {job.status === "PAUSE_REQUESTED" ? "Đang dừng an toàn..." : "Tạm dừng & bán hàng"}
                            </button>
                          ) : null}
                          {job.status === "PAUSED" ? (
                            <button type="button" onClick={() => router.push("/")} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-slate-700">
                              <ShoppingCart className="size-5" /> Về bán hàng
                            </button>
                          ) : null}
                          {job.status === "NEEDS_ATTENTION" ? (
                            <button type="button" onClick={handleSkip} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">
                              <SkipForward className="size-5" /> Bỏ qua dòng
                            </button>
                          ) : null}
                          {job.status === "COMPLETED" ? (
                            <button type="button" onClick={() => downloadResult(job.items, job.fileName)} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-extrabold text-white">
                              <Download className="size-5" /> Xuất kết quả
                            </button>
                          ) : null}
                          {!job || !["RUNNING", "PAUSE_REQUESTED"].includes(job.status) ? (
                            <button type="button" onClick={handleClear} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700">
                              <Trash2 className="size-5" /> Xóa lô
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {job ? (
                  <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                      <div>
                        <h2 className="font-extrabold">Tiến độ từng thành viên</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Tiến độ được lưu trên máy POS này và tự khôi phục khi quay lại route.</p>
                      </div>
                      {job.status === "COMPLETED" ? <CheckCircle2 className="size-7 text-emerald-600" /> : null}
                    </div>
                    <div className="max-h-[430px] overflow-auto">
                      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr><th className="px-4 py-3">Dòng</th><th className="px-4 py-3">Thành viên</th><th className="px-4 py-3">Điện thoại</th><th className="px-4 py-3">Điểm</th><th className="px-4 py-3">Mã thẻ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Chi tiết</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {job.items.map((item, index) => (
                            <tr key={item.id} className={index === job.currentIndex && job.status !== "COMPLETED" ? "bg-orange-50/50" : ""}>
                              <td className="px-4 py-3 font-mono font-bold">{item.rowNumber}</td>
                              <td className="px-4 py-3 font-bold text-slate-900">{item.fullName}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{item.phone}</td>
                              <td className="px-4 py-3 font-bold text-sky-700">{item.points.toLocaleString("vi-VN")}</td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-700">{item.memberCode || "—"}</td>
                              <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${stageTone(item.safeStage)}`}>{safeStageLabel(item.safeStage)}</span></td>
                              <td className="max-w-sm px-4 py-3 text-xs font-semibold text-slate-500">{item.errorMessage || (item.completedAt ? `Xong lúc ${new Date(item.completedAt).toLocaleTimeString("vi-VN")}` : "")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberBatchWorkspace;
