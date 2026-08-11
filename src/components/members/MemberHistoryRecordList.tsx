import { IoArrowDownOutline, IoArrowUpOutline } from "react-icons/io5";
import { memberHistoryCategories } from "@/components/members/memberHistoryPresentation";
import type { MemberStoredValueRecord } from "@/lib/types/member";

const numberFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const machinePlayRemarkPattern = /^\s*\[[^\]]+\]\s*quẹt thẻ chơi game trên máy\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*ván\s*,\s*trừ\s*\[[^\]]+\]\s*,\s*tổng cộng\s*\[([^\]]+)\]\s*$/iu;

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecordDate(value: string): string {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || value;
}

function formatGroupLabel(value: string): string {
  const today = new Date();
  if (value === toDateValue(today)) return "Hôm nay";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === toDateValue(yesterday)) return "Hôm qua";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatRecordTime(value: string): string {
  const match = value.match(/[ T](\d{2}):(\d{2})(?::\d{2})?/);
  return match ? `${match[1]}:${match[2]}` : value;
}

function getRecordCopy(record: MemberStoredValueRecord): { title: string; description: string | null } {
  const match = record.remark.match(machinePlayRemarkPattern);
  if (match) {
    const [, machineName = "", gameCount = "", total = ""] = match;
    return {
      title: machineName.trim(),
      description: `Quẹt thẻ chơi ${gameCount.trim()} ván · Trừ ${total.trim()}`,
    };
  }
  return {
    title: record.businessTypeName || "Biến động số dư",
    description: record.remark || null,
  };
}

interface MemberHistoryRecordListProps {
  records: MemberStoredValueRecord[];
}

const MemberHistoryRecordList: React.FC<MemberHistoryRecordListProps> = ({ records }) => {
  const groups = records.reduce<Array<{ date: string; records: MemberStoredValueRecord[] }>>((result, record) => {
    const date = getRecordDate(record.createTime);
    const currentGroup = result.at(-1);
    if (currentGroup?.date === date) currentGroup.records.push(record);
    else result.push({ date, records: [record] });
    return result;
  }, []);

  return <div className="space-y-5">
    {groups.map((group) => <section key={group.date} aria-labelledby={`history-date-${group.date}`}>
      <div className="mb-2 flex items-center gap-3">
        <h4 id={`history-date-${group.date}`} className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-[var(--color-text-muted)]">{formatGroupLabel(group.date)}</h4>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <div className="space-y-2">
        {group.records.map((record, index) => {
          const incoming = record.flowType === 1;
          const category = memberHistoryCategories[record.storedCategory];
          const Icon = category.icon;
          const FlowIcon = incoming ? IoArrowUpOutline : IoArrowDownOutline;
          const copy = getRecordCopy(record);
          return <article key={`${record.createTime}-${record.businessType}-${index}`} className="flex gap-3 rounded-2xl border border-[var(--color-border)] p-3.5 sm:p-4">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${category.iconClassName}`}><Icon className="size-5" /></span>
            <div className="min-w-0 flex-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-[var(--color-text-primary)]">{copy.title}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${category.badgeClassName}`}>{category.label}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text-muted)]">{formatRecordTime(record.createTime)}{copy.description ? ` · ${copy.description}` : ""}</p>
              </div>
              <div className="mt-3 shrink-0 text-left sm:mt-0 sm:text-right">
                <p className={`inline-flex items-center gap-1 text-base font-black ${incoming ? "text-emerald-700" : "text-red-700"}`}><FlowIcon className="size-4" />{incoming ? "+" : "−"}{numberFormatter.format(record.amount)} {category.unit}</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--color-text-muted)]">Số dư {numberFormatter.format(record.afterAmount)} {category.unit}</p>
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>)}
  </div>;
};

export default MemberHistoryRecordList;
