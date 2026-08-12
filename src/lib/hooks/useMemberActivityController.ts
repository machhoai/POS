import { useCallback, useEffect, useState } from "react";
import {
  fetchMemberCards,
  fetchMemberPassTickets,
  fetchMemberStoredValueHistory,
} from "@/lib/services/memberActivityService";
import { toMemberServiceError } from "@/lib/services/memberService";
import type {
  MemberCard,
  MemberPassTicket,
  MemberProfile,
  MemberStoredValueCategoryFilter,
  MemberStoredValueHistory,
  RemoteRequestStatus,
} from "@/lib/types/member";

interface LoadState<T> {
  status: RemoteRequestStatus;
  data: T;
  error: string | null;
}

interface UseMemberActivityControllerInput {
  member: MemberProfile | null;
  shopId: number;
  warehouseId: string | null;
}

const emptyHistory: MemberStoredValueHistory = {
  page: 1,
  limit: 20,
  totalPage: 0,
  totalRecord: 0,
  records: [],
  fetchedAt: "",
};

const dateValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initialStartDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return dateValue(date);
};

export function useMemberActivityController({
  member,
  shopId,
  warehouseId,
}: UseMemberActivityControllerInput) {
  const [storedCategory, setStoredCategory] =
    useState<MemberStoredValueCategoryFilter>(1);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(() => dateValue(new Date()));
  const [history, setHistory] = useState<LoadState<MemberStoredValueHistory>>({
    status: "IDLE",
    data: emptyHistory,
    error: null,
  });
  const [cards, setCards] = useState<LoadState<MemberCard[]>>({
    status: "IDLE",
    data: [],
    error: null,
  });
  const [tickets, setTickets] = useState<LoadState<MemberPassTicket[]>>({
    status: "IDLE",
    data: [],
    error: null,
  });

  const loadHistory = useCallback(async (page = 1): Promise<void> => {
    if (!member || !warehouseId || !startDate || !endDate) return;
    if (startDate > endDate) {
      setHistory((current) => ({
        ...current,
        status: "FAILED",
        error: "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.",
      }));
      return;
    }
    setHistory((current) => ({ ...current, status: "WAITING_API", error: null }));
    try {
      const data = await fetchMemberStoredValueHistory({
        shopId,
        warehouseId,
        uid: member.uid,
        storedCategory,
        startTime: `${startDate} 00:00:00`,
        endTime: `${endDate} 23:59:59`,
        page,
        limit: 20,
      });
      setHistory({ status: "SUCCEEDED", data, error: null });
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      console.error("[Thành viên] Không thể tải lịch sử sử dụng:", memberError);
      setHistory((current) => ({
        ...current,
        status: "FAILED",
        error: memberError.message,
      }));
    }
  }, [endDate, member, shopId, startDate, storedCategory, warehouseId]);

  const loadCards = useCallback(async (): Promise<void> => {
    if (!member || !warehouseId) return;
    setCards((current) => ({ ...current, status: "WAITING_API", error: null }));
    try {
      const result = await fetchMemberCards({ shopId, warehouseId, uid: member.uid });
      setCards({ status: "SUCCEEDED", data: result.cards, error: null });
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      console.error("[Thành viên] Không thể tải danh sách thẻ:", memberError);
      setCards({ status: "FAILED", data: [], error: memberError.message });
    }
  }, [member, shopId, warehouseId]);

  const loadTickets = useCallback(async (): Promise<void> => {
    if (!member || !warehouseId) return;
    setTickets((current) => ({ ...current, status: "WAITING_API", error: null }));
    try {
      const result = await fetchMemberPassTickets({ shopId, warehouseId, uid: member.uid });
      setTickets({ status: "SUCCEEDED", data: result.tickets, error: null });
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      console.error("[Thành viên] Không thể tải vé và gói:", memberError);
      setTickets({ status: "FAILED", data: [], error: memberError.message });
    }
  }, [member, shopId, warehouseId]);

  useEffect(() => {
    if (!member || !warehouseId) return;
    queueMicrotask(() => void loadHistory(1));
  }, [loadHistory, member, warehouseId]);

  useEffect(() => {
    if (!member || !warehouseId) return;
    queueMicrotask(() => void Promise.all([loadCards(), loadTickets()]));
  }, [loadCards, loadTickets, member, warehouseId]);

  return {
    storedCategory,
    setStoredCategory,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    history,
    cards,
    tickets,
    loadHistory,
    loadCards,
    loadTickets,
  };
}
