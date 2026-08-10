import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, WalletCards } from "lucide-react";
import type {
  MemberStoredValueCategory,
  MemberStoredValueCategoryFilter,
  MemberStoredValueHistory,
  MemberStoredValueRecord,
  RemoteRequestStatus,
} from "@/lib/types/member";

const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const categoryLabels: Record<MemberStoredValueCategory, string> = {
  1: "Xu / điểm chơi",
  2: "Điểm thưởng",
  5: "Điểm tích lũy",
  6: "Vé xổ số",
  7: "Vé xanh",
};

const categoryOptions: Array<{ value: MemberStoredValueCategoryFilter; label: string }> = [
  { value: "ALL", label: "Tất cả loại điểm" },
  { value: 1, label: "Xu / điểm chơi" },
  { value: 2, label: "Điểm thưởng" },
  { value: 5, label: "Điểm tích lũy" },
  { value: 6, label: "Vé xổ số" },
  { value: 7, label: "Vé xanh" },
];

const machinePlayRemarkPattern = /^\s*\[[^\]]+\]\s*quẹt thẻ chơi game trên máy\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*ván\s*,\s*trừ\s*\[[^\]]+\]\s*,\s*tổng cộng\s*\[([^\]]+)\]\s*$/iu;

interface StoredValueRecordPresentation {
  title: string;
  description: string | null;
}

function getStoredValueRecordPresentation(
  record: MemberStoredValueRecord,
): StoredValueRecordPresentation {
  const match = record.remark.match(machinePlayRemarkPattern);
  if (match) {
    const [, machineName = "", gameCount = "", total = ""] = match;
    return {
      title: machineName.trim(),
      description: `Quẹt thẻ chơi game trên máy ${gameCount.trim()} ván trừ ${total.trim()}`,
    };
  }

  return {
    title: record.businessTypeName || "Biến động số dư",
    description: record.remark || null,
  };
}

function formatRemoteDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return match
    ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}:${match[6]}`
    : value;
}

interface MemberStoredValueHistoryProps {
  status: RemoteRequestStatus;
  history: MemberStoredValueHistory;
  error: string | null;
  category: MemberStoredValueCategoryFilter;
  startDate: string;
  endDate: string;
  onCategoryChange: (category: MemberStoredValueCategoryFilter) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onReload: (page?: number) => void;
}

const MemberStoredValueHistoryView: React.FC<MemberStoredValueHistoryProps> = ({
  status,
  history,
  error,
  category,
  startDate,
  endDate,
  onCategoryChange,
  onStartDateChange,
  onEndDateChange,
  onReload,
}) => {
  const loading = status === "WAITING_API";

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
        <div>
          <h3 className="font-extrabold text-[var(--color-text-primary)]">Lịch sử sử dụng và nạp</h3>
          <p className="text-xs text-[var(--color-text-muted)]">Dữ liệu trực tiếp từ OpenAPI, mới nhất hiển thị trước.</p>
        </div>
        <button type="button" onClick={() => onReload(history.page)} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold disabled:opacity-50">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Làm mới
        </button>
      </header>

      <div className="grid gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4 md:grid-cols-3">
        <label className="text-xs font-bold text-[var(--color-text-secondary)]">Loại số dư
          <select value={category} onChange={(event) => onCategoryChange(event.target.value === "ALL" ? "ALL" : Number(event.target.value) as MemberStoredValueCategory)} disabled={loading} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-semibold">
            {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-[var(--color-text-secondary)]">Từ ngày
          <input type="date" value={startDate} max={endDate} onChange={(event) => onStartDateChange(event.target.value)} disabled={loading} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-semibold" />
        </label>
        <label className="text-xs font-bold text-[var(--color-text-secondary)]">Đến ngày
          <input type="date" value={endDate} min={startDate} onChange={(event) => onEndDateChange(event.target.value)} disabled={loading} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-semibold" />
        </label>
      </div>

      <div className="min-h-72 p-4">
        {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-bold text-[var(--color-text-muted)]"><LoaderCircle className="size-6 animate-spin text-[var(--color-accent)]" />Đang tải lịch sử...</div> : null}
        {!loading && status === "FAILED" ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><p className="font-extrabold text-red-700">Không thể tải lịch sử</p><p className="mt-2 max-w-md text-sm text-red-600">{error}</p><button type="button" onClick={() => onReload(history.page)} className="mt-4 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white">Thử lại</button></div> : null}
        {!loading && status !== "FAILED" && history.records.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><WalletCards className="size-10 text-orange-300" /><p className="mt-3 font-extrabold">Chưa có biến động trong khoảng thời gian này</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">Hãy thử chọn loại số dư hoặc khoảng ngày khác.</p></div> : null}
        {!loading && status !== "FAILED" && history.records.length > 0 ? <div className="space-y-2">{history.records.map((record, index) => {
          const incoming = record.flowType === 1;
          const amount = numberFormatter.format(record.amount);
          const presentation = getStoredValueRecordPresentation(record);
          return <article key={`${record.createTime}-${record.businessType}-${index}`} className="rounded-2xl border border-[var(--color-border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <time className="text-sm font-bold text-[var(--color-text-secondary)]">{formatRemoteDate(record.createTime)}</time>
                <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-1 text-[11px] font-extrabold text-[var(--color-text-muted)]">{categoryLabels[record.storedCategory]}</span>
              </div>
              <p className="text-base font-black"><span className={incoming ? "text-emerald-700" : "text-red-700"}>{incoming ? `Nạp +${amount}` : `-${amount}`}</span><span className="ml-2 text-[var(--color-text-primary)]">còn {numberFormatter.format(record.afterAmount)}</span></p>
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-secondary)]">{presentation.title}</p>
            {presentation.description ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{presentation.description}</p> : null}
          </article>;
        })}</div> : null}
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-sm">
        <p className="font-semibold text-[var(--color-text-muted)]">{numberFormatter.format(history.totalRecord)} giao dịch</p>
        <div className="flex items-center gap-2"><button type="button" aria-label="Trang trước" onClick={() => onReload(history.page - 1)} disabled={loading || history.page <= 1} className="flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-30"><ChevronLeft className="size-4" /></button><span className="min-w-20 text-center font-bold">{history.page}/{Math.max(history.totalPage, 1)}</span><button type="button" aria-label="Trang sau" onClick={() => onReload(history.page + 1)} disabled={loading || history.totalPage === 0 || history.page >= history.totalPage} className="flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-30"><ChevronRight className="size-4" /></button></div>
      </footer>
    </section>
  );
};

export default MemberStoredValueHistoryView;
