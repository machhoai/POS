import {
    IoChevronBackOutline,
    IoChevronForwardOutline,
    IoReloadOutline,
    IoSyncOutline,
    IoWalletOutline,
} from "react-icons/io5";
import MemberHistoryFilters from "@/components/members/MemberHistoryFilters";
import MemberHistoryRecordList from "@/components/members/MemberHistoryRecordList";
import type {
    MemberStoredValueCategoryFilter,
    MemberStoredValueHistory,
    RemoteRequestStatus,
} from "@/lib/types/member";

const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

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
    status, history, error, category, startDate, endDate,
    onCategoryChange, onStartDateChange, onEndDateChange, onReload,
}) => {
    const loading = status === "WAITING_API";

    return (
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
                <div>
                    <h3 className="font-extrabold text-[var(--color-text-primary)]">Lịch sử biến động</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Dữ liệu trực tiếp từ OpenAPI, mới nhất hiển thị trước.</p>
                </div>
                <button type="button" onClick={() => onReload(history.page)} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-bold disabled:opacity-50">
                    <IoReloadOutline className={`size-5 ${loading ? "animate-spin" : ""}`} /> Làm mới
                </button>
            </header>

            <MemberHistoryFilters category={category} startDate={startDate} endDate={endDate} disabled={loading} onCategoryChange={onCategoryChange} onStartDateChange={onStartDateChange} onEndDateChange={onEndDateChange} />

            <div className="min-h-72 p-4">
                {loading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-bold text-[var(--color-text-muted)]"><IoSyncOutline className="size-6 animate-spin text-[var(--color-accent)]" />Đang tải lịch sử...</div> : null}
                {!loading && status === "FAILED" ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><p className="font-extrabold text-red-700">Không thể tải lịch sử</p><p className="mt-2 max-w-md text-sm text-red-600">{error}</p><button type="button" onClick={() => onReload(history.page)} className="mt-4 min-h-11 rounded-xl bg-red-700 px-4 text-sm font-bold text-white">Thử lại</button></div> : null}
                {!loading && status !== "FAILED" && history.records.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><IoWalletOutline className="size-11 text-orange-300" /><p className="mt-3 font-extrabold">Chưa có biến động trong khoảng thời gian này</p><p className="mt-1 text-sm text-[var(--color-text-muted)]">Hãy thử chọn loại số dư hoặc khoảng ngày khác.</p></div> : null}
                {!loading && status !== "FAILED" && history.records.length > 0 ? <MemberHistoryRecordList records={history.records} /> : null}
            </div>

            <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-sm">
                <p className="font-semibold text-[var(--color-text-muted)]">{numberFormatter.format(history.totalRecord)} giao dịch</p>
                <div className="flex items-center gap-2">
                    <button type="button" aria-label="Trang trước" onClick={() => onReload(history.page - 1)} disabled={loading || history.page <= 1} className="flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-30"><IoChevronBackOutline className="size-5" /></button>
                    <span className="min-w-20 text-center font-bold">{history.page}/{Math.max(history.totalPage, 1)}</span>
                    <button type="button" aria-label="Trang sau" onClick={() => onReload(history.page + 1)} disabled={loading || history.totalPage === 0 || history.page >= history.totalPage} className="flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-30"><IoChevronForwardOutline className="size-5" /></button>
                </div>
            </footer>
        </section>
    );
};

export default MemberStoredValueHistoryView;
