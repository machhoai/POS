import { useState } from "react";
import { Coins, CreditCard, History, TicketCheck, UserRound } from "lucide-react";
import MemberCardList from "@/components/members/MemberCardList";
import MemberPackageCatalog from "@/components/members/MemberPackageCatalog";
import MemberPassTicketList from "@/components/members/MemberPassTicketList";
import MemberProfileCard from "@/components/members/MemberProfileCard";
import MemberStoredValueHistoryView from "@/components/members/MemberStoredValueHistory";
import type { useMemberActivityController } from "@/lib/hooks/useMemberActivityController";
import type { useMemberPackageSaleController } from "@/lib/hooks/useMemberPackageSaleController";
import type { MemberProfile } from "@/lib/types/member";

type MemberDetailTab = "HISTORY" | "PROFILE" | "TOP_UP" | "TICKETS" | "CARDS";
type MemberActivityController = ReturnType<typeof useMemberActivityController>;
type MemberPackageSaleController = ReturnType<typeof useMemberPackageSaleController>;

const tabs = [
    { id: "PROFILE", label: "Hồ sơ", icon: UserRound },
    { id: "TOP_UP", label: "Nạp thẻ", icon: Coins },
    { id: "HISTORY", label: "Biến động", icon: History },
    { id: "TICKETS", label: "Vé / gói", icon: TicketCheck },
    { id: "CARDS", label: "Thẻ", icon: CreditCard },
] as const;

interface MemberDetailsPanelProps {
    member: MemberProfile;
    shopId: number;
    warehouseId: string;
    fetchedAt: string | null;
    activity: MemberActivityController;
    packageSale: MemberPackageSaleController;
}

const MemberDetailsPanel: React.FC<MemberDetailsPanelProps> = ({ member, shopId, warehouseId, fetchedAt, activity, packageSale }) => {
    const [tab, setTab] = useState<MemberDetailTab>("PROFILE");

    return <div className="min-w-0 space-y-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-0 lg:gap-3">
        <nav aria-label="Chi tiết thành viên" className="shrink-0 overflow-x-auto rounded-full border border-[var(--color-border)] bg-white p-1.5 shadow-sm">
            <div className="flex min-w-max gap-1" role="tablist">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors ${tab === id ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-glow)]" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"}`}><Icon className="size-4" />{label}</button>)}</div>
        </nav>

        <div className="min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            {tab === "PROFILE" ? <MemberProfileCard member={member} fetchedAt={fetchedAt} /> : null}
            {tab === "TOP_UP" ? <div className="space-y-3">
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Nạp thẻ cho thành viên</p>
                    <p className="mt-1 font-extrabold text-[var(--color-text-primary)]">{member.fullName || "Khách thành viên"}</p>
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{member.phone || member.memberCode || "Chưa có số điện thoại"}</p>
                </div>
                <MemberPackageCatalog packages={packageSale.packages} request={packageSale.packagesRequest} selectedPackage={packageSale.selectedPackage} mutation={packageSale.mutation} canRetryRemote={packageSale.canRetryRemote} onSelect={packageSale.selectPackage} onReload={() => void packageSale.loadPackages()} onBuy={packageSale.openCheckout} onRetryRemote={packageSale.retryRemoteSale} />
            </div> : null}
            {tab === "HISTORY" ? <MemberStoredValueHistoryView status={activity.history.status} history={activity.history.data} error={activity.history.error} category={activity.storedCategory} startDate={activity.startDate} endDate={activity.endDate} onCategoryChange={activity.setStoredCategory} onStartDateChange={activity.setStartDate} onEndDateChange={activity.setEndDate} onReload={(page) => void activity.loadHistory(page)} /> : null}
            {tab === "TICKETS" ? <MemberPassTicketList status={activity.tickets.status} tickets={activity.tickets.data} error={activity.tickets.error} onReload={() => void activity.loadTickets()} /> : null}
            {tab === "CARDS" ? <MemberCardList status={activity.cards.status} cards={activity.cards.data} error={activity.cards.error} member={member} shopId={shopId} warehouseId={warehouseId} onReload={() => void activity.loadCards()} /> : null}
        </div>
    </div>;
};

export default MemberDetailsPanel;
