import MemberCompensationForm from "@/components/members/MemberCompensationForm";
import MemberProfileCard from "@/components/members/MemberProfileCard";
import MemberStoredValueHistoryView from "@/components/members/MemberStoredValueHistory";
import type { useMemberActivityController } from "@/lib/hooks/useMemberActivityController";
import type { useMemberCompensationController } from "@/lib/hooks/useMemberCompensationController";
import type { MemberProfile } from "@/lib/types/member";

interface MemberCompensationPanelProps {
  member: MemberProfile;
  fetchedAt: string | null;
  activity: ReturnType<typeof useMemberActivityController>;
  compensation: ReturnType<typeof useMemberCompensationController>;
}

export default function MemberCompensationPanel({
  member,
  fetchedAt,
  activity,
  compensation,
}: MemberCompensationPanelProps) {
  return (
    <div className="scrollbar-thin min-w-0 space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pb-1 lg:pr-1">
      <MemberProfileCard member={member} fetchedAt={fetchedAt} />
      <MemberCompensationForm draft={compensation.draft} mutation={compensation.mutation} onChange={compensation.updateDraft} onReview={compensation.openConfirmation} />
      <MemberStoredValueHistoryView status={activity.history.status} history={activity.history.data} error={activity.history.error} category={activity.storedCategory} startDate={activity.startDate} endDate={activity.endDate} onCategoryChange={activity.setStoredCategory} onStartDateChange={activity.setStartDate} onEndDateChange={activity.setEndDate} onReload={(page) => void activity.loadHistory(page)} />
    </div>
  );
}
