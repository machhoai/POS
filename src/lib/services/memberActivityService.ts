import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";
import { toMemberServiceError } from "@/lib/services/memberService";
import type {
  MemberCard,
  MemberPassTicket,
  MemberStoredValueCategoryFilter,
  MemberStoredValueHistory,
} from "@/lib/types/member";

interface MemberActivityScope {
  shopId: number;
  warehouseId: string;
  uid: string;
}

export interface MemberStoredValueHistoryInput extends MemberActivityScope {
  storedCategory: MemberStoredValueCategoryFilter;
  startTime: string;
  endTime: string;
  page: number;
  limit: number;
}

interface MemberCardsResult {
  cards: MemberCard[];
  fetchedAt: string;
}

interface MemberPassTicketsResult {
  tickets: MemberPassTicket[];
  fetchedAt: string;
}

async function callMemberActivity<TPayload, TResult>(
  action:
    | "getMemberStoredValueHistory"
    | "getMemberCards"
    | "getMemberPassTickets",
  payload: TPayload,
): Promise<TResult> {
  const callable = httpsCallable<
    { action: typeof action; payload: TPayload },
    TResult
  >(functions, "getPosAuthSession");
  try {
    const result = await callable(await withDeviceAuth({ action, payload }));
    return result.data;
  } catch (error: unknown) {
    throw toMemberServiceError(error);
  }
}

export function fetchMemberStoredValueHistory(
  input: MemberStoredValueHistoryInput,
): Promise<MemberStoredValueHistory> {
  return callMemberActivity("getMemberStoredValueHistory", input);
}

export function fetchMemberCards(
  input: MemberActivityScope,
): Promise<MemberCardsResult> {
  return callMemberActivity("getMemberCards", input);
}

export function fetchMemberPassTickets(
  input: MemberActivityScope,
): Promise<MemberPassTicketsResult> {
  return callMemberActivity("getMemberPassTickets", {
    ...input,
    category: null,
  });
}
