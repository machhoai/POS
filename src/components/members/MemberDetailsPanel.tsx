import { useState } from "react";
import { CreditCard, History, TicketCheck, UserRound } from "lucide-react";
import MemberCardList from "@/components/members/MemberCardList";
import MemberPassTicketList from "@/components/members/MemberPassTicketList";
import MemberProfileCard from "@/components/members/MemberProfileCard";
import MemberStoredValueHistoryView from "@/components/members/MemberStoredValueHistory";
import type { useMemberActivityController } from "@/lib/hooks/useMemberActivityController";
import type { MemberProfile } from "@/lib/types/member";

type MemberDetailTab = "HISTORY" | "PROFILE" | "TICKETS" | "CARDS";
type MemberActivityController = ReturnType<typeof useMemberActivityController>;

const tabs = [
    { id: "PROFILE", label: "Hồ sơ", icon: UserRound },
    { id: "HISTORY", label: "Biến động", icon: History },
    { id: "TICKETS", label: "Vé / gói", icon: TicketCheck },
    { id: "CARDS", label: "Thẻ", icon: CreditCard },
] as const;

interface MemberDetailsPanelProps {
    member: MemberProfile;
    fetchedAt: string | null;
    activity: MemberActivityController;
}

const MemberDetailsPanel: React.FC<MemberDetailsPanelProps> = ({ member, fetchedAt, activity }) => {
    const [tab, setTab] = useState<MemberDetailTab>("PROFILE");

    return <div className="space-y-3">
        <nav aria-label="Chi tiết thành viên" className="overflow-x-auto rounded-full border border-[var(--color-border)] bg-white p-1.5 shadow-sm">
            <div className="flex min-w-max gap-1" role="tablist">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors ${tab === id ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-glow)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"}`}><Icon className="size-4" />{label}</button>)}</div>
        </nav>

        {tab === "PROFILE" ? <MemberProfileCard member={member} fetchedAt={fetchedAt} /> : null}
        {tab === "HISTORY" ? <MemberStoredValueHistoryView status={activity.history.status} history={activity.history.data} error={activity.history.error} category={activity.storedCategory} startDate={activity.startDate} endDate={activity.endDate} onCategoryChange={activity.setStoredCategory} onStartDateChange={activity.setStartDate} onEndDateChange={activity.setEndDate} onReload={(page) => void activity.loadHistory(page)} /> : null}
        {tab === "TICKETS" ? <MemberPassTicketList status={activity.tickets.status} tickets={activity.tickets.data} error={activity.tickets.error} onReload={() => void activity.loadTickets()} /> : null}
        {tab === "CARDS" ? <MemberCardList status={activity.cards.status} cards={activity.cards.data} error={activity.cards.error} onReload={() => void activity.loadCards()} /> : null}
    </div>;
};

export default MemberDetailsPanel;
