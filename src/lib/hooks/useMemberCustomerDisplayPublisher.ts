"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  listenCustomerDisplayReady,
  publishCustomerDisplayState,
} from "@/lib/services/customerDisplayBridge";
import { useCartStore } from "@/lib/stores/useCartStore";
import type {
  CustomerDisplayMemberSnapshot,
  CustomerDisplayState,
} from "@/lib/types/customerDisplay";
import type {
  MemberMutationStatus,
  MemberProfile,
  MemberRegistrationDraft,
  MemberRegistrationReviewStatus,
} from "@/lib/types/member";
import {
  createCustomerDisplayOrderSnapshot,
  createIdleCustomerDisplayState,
} from "@/lib/utils/customerDisplayState";
import { showError } from "@/lib/utils/toast";

interface MemberDisplayPublisherInput {
  enabled: boolean;
  suppressWhenDisabled?: boolean;
  draft: MemberRegistrationDraft;
  reviewStatus: MemberRegistrationReviewStatus;
  mutationStatus: MemberMutationStatus;
  member: MemberProfile | null;
}

function memberSnapshot(
  draft: MemberRegistrationDraft,
  member: MemberProfile | null,
): CustomerDisplayMemberSnapshot {
  return {
    fullName: member?.fullName || draft.fullName,
    phone: member?.phone || draft.phone,
    gender: member?.gender || draft.gender,
    birthDate: member?.birthDate || draft.birthDate || null,
    email: member?.email || draft.email || null,
    memberCode: member?.memberCode || null,
  };
}

export function useMemberCustomerDisplayPublisher({
  enabled,
  suppressWhenDisabled = false,
  draft,
  reviewStatus,
  mutationStatus,
  member,
}: MemberDisplayPublisherInput): void {
  const items = useCartStore((state) => state.items);
  const paymentMethod = useCartStore((state) => state.paymentMethod);
  const order = useMemo(
    () => createCustomerDisplayOrderSnapshot(items, paymentMethod),
    [items, paymentMethod],
  );
  const defaultState = useMemo<CustomerDisplayState>(
    () => order
      ? { mode: "CART", connectionStatus: "CONNECTED", order, payment: { status: "NOT_STARTED", qr: null } }
      : createIdleCustomerDisplayState("CONNECTED"),
    [order],
  );
  const displayState = useMemo<CustomerDisplayState>(() => {
    if (!enabled || reviewStatus === "EDITING") return defaultState;
    return {
      mode: mutationStatus === "SUCCEEDED" && member ? "MEMBER_SUCCESS" : "MEMBER_REVIEW",
      connectionStatus: "CONNECTED",
      member: memberSnapshot(draft, member),
      order,
      payment: { status: "NOT_STARTED", qr: null },
    };
  }, [defaultState, draft, enabled, member, mutationStatus, order, reviewStatus]);
  const latestStateRef = useRef(displayState);

  useEffect(() => {
    if (!enabled && suppressWhenDisabled) return;
    latestStateRef.current = displayState;
    void publishCustomerDisplayState(displayState).catch((error: unknown) => {
      console.error("[Thành viên] Không thể gửi dữ liệu sang màn hình khách:", error);
      showError("Không thể cập nhật màn hình khách", "Vui lòng kiểm tra kết nối màn hình phụ.");
    });
  }, [displayState, enabled, suppressWhenDisabled]);

  useEffect(() => {
    if (!enabled && suppressWhenDisabled) return;
    let disposed = false;
    let stopListening: (() => void) | null = null;
    void listenCustomerDisplayReady(() => {
      void publishCustomerDisplayState(latestStateRef.current);
    }).then((stop) => {
      if (disposed) stop();
      else stopListening = stop;
    });
    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [enabled, suppressWhenDisabled]);
}
