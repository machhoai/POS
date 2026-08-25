import { create } from "zustand";
import type {
  CardReaderStatus,
  MemberCardLookupKind,
  MemberCompensationDraft,
  MemberLookupMode,
  MemberMutationKind,
  MemberMutationState,
  MemberMutationStatus,
  MemberPointPackage,
  MemberProfile,
  MemberRegistrationDraft,
  RemoteRequestState,
} from "@/lib/types/member";

interface MemberState {
  lookupMode: MemberLookupMode;
  lookupQuery: string;
  cardReaderStatus: CardReaderStatus;
  cardReaderError: string | null;
  lastCardLookupKind: MemberCardLookupKind | null;
  lookupRequest: RemoteRequestState;
  currentMember: MemberProfile | null;
  registrationDraft: MemberRegistrationDraft;
  compensationDraft: MemberCompensationDraft;
  packages: MemberPointPackage[];
  packagesRequest: RemoteRequestState;
  selectedPackageId: string | null;
  mutation: MemberMutationState;
  setLookupMode: (mode: MemberLookupMode) => void;
  setLookupQuery: (query: string) => void;
  startCardRead: () => void;
  completeCardRead: (cardNumber: string, kind: MemberCardLookupKind) => void;
  failCardRead: (message: string) => void;
  startLookup: () => void;
  completeLookup: (member: MemberProfile) => void;
  failLookup: (message: string, code?: string) => void;
  updateRegistrationDraft: (values: Partial<MemberRegistrationDraft>) => void;
  startNewRegistration: () => void;
  resetRegistrationDraft: () => void;
  updateCompensationDraft: (values: Partial<MemberCompensationDraft>) => void;
  resetCompensationDraft: () => void;
  startLoadingPackages: () => void;
  setPackages: (packages: MemberPointPackage[]) => void;
  failLoadingPackages: (message: string, code?: string) => void;
  selectPackage: (goodsId: string | null) => void;
  startMutation: (kind: MemberMutationKind, status?: MemberMutationStatus) => void;
  markMutationWaitingApi: () => void;
  completeMutation: (remoteOrderNumber?: string) => void;
  failMutation: (reason: string, code?: string) => void;
  resetMutation: () => void;
  resetMemberSession: () => void;
}

const idleRequest: RemoteRequestState = {
  status: "IDLE",
  errorCode: null,
  errorMessage: null,
};

const emptyRegistrationDraft: MemberRegistrationDraft = {
  fullName: "",
  phone: "",
  memberCode: "",
  gender: "MALE",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  email: "",
};

const emptyCompensationDraft: MemberCompensationDraft = {
  storedCategory: 6,
  amount: null,
  reason: "",
};

const idleMutation: MemberMutationState = {
  kind: null,
  status: "IDLE",
  remoteOrderNumber: null,
  errorCode: null,
  failureReason: null,
};

export const useMemberStore = create<MemberState>((set) => ({
  lookupMode: "CARD",
  lookupQuery: "",
  cardReaderStatus: "IDLE",
  cardReaderError: null,
  lastCardLookupKind: null,
  lookupRequest: idleRequest,
  currentMember: null,
  registrationDraft: emptyRegistrationDraft,
  compensationDraft: emptyCompensationDraft,
  packages: [],
  packagesRequest: idleRequest,
  selectedPackageId: null,
  mutation: idleMutation,

  setLookupMode: (lookupMode) => set({
    lookupMode,
    lookupQuery: "",
    lookupRequest: idleRequest,
    currentMember: null,
    cardReaderStatus: "IDLE",
    cardReaderError: null,
    lastCardLookupKind: null,
  }),
  setLookupQuery: (lookupQuery) => set({
    lookupQuery,
    cardReaderStatus: "IDLE",
    cardReaderError: null,
    lastCardLookupKind: null,
  }),
  startCardRead: () => set({ cardReaderStatus: "READING", cardReaderError: null }),
  completeCardRead: (cardNumber, lastCardLookupKind) => set({
    lookupMode: "CARD",
    lookupQuery: cardNumber.trim(),
    cardReaderStatus: "SUCCEEDED",
    cardReaderError: null,
    lastCardLookupKind,
  }),
  failCardRead: (cardReaderError) => set({
    cardReaderStatus: "FAILED",
    cardReaderError,
  }),
  startLookup: () => set({
    lookupRequest: { status: "WAITING_API", errorCode: null, errorMessage: null },
    currentMember: null,
    packages: [],
    packagesRequest: idleRequest,
    selectedPackageId: null,
    mutation: idleMutation,
  }),
  completeLookup: (currentMember) => set({
    currentMember,
    lookupRequest: { status: "SUCCEEDED", errorCode: null, errorMessage: null },
  }),
  failLookup: (errorMessage, errorCode) => set({
    currentMember: null,
    lookupRequest: { status: "FAILED", errorCode: errorCode ?? null, errorMessage },
  }),
  updateRegistrationDraft: (values) => set((state) => ({
    registrationDraft: { ...state.registrationDraft, ...values },
    mutation: state.mutation.kind === "REGISTER" && state.mutation.status === "FAILED"
      ? idleMutation
      : state.mutation,
  })),
  startNewRegistration: () => set({
    registrationDraft: emptyRegistrationDraft,
    mutation: idleMutation,
    currentMember: null,
  }),
  resetRegistrationDraft: () => set({
    registrationDraft: emptyRegistrationDraft,
  }),
  updateCompensationDraft: (values) => set((state) => ({
    compensationDraft: { ...state.compensationDraft, ...values },
  })),
  resetCompensationDraft: () => set({ compensationDraft: emptyCompensationDraft }),
  startLoadingPackages: () => set({
    packagesRequest: { status: "WAITING_API", errorCode: null, errorMessage: null },
  }),
  setPackages: (packages) => set((state) => ({
    packages,
    selectedPackageId: packages.some(
      (item) => item.goodsId === state.selectedPackageId,
    ) ? state.selectedPackageId : null,
    packagesRequest: { status: "SUCCEEDED", errorCode: null, errorMessage: null },
  })),
  failLoadingPackages: (errorMessage, errorCode) => set({
    packagesRequest: { status: "FAILED", errorCode: errorCode ?? null, errorMessage },
  }),
  selectPackage: (goodsId) => set((state) => ({
    selectedPackageId: state.packages.some((item) => item.goodsId === goodsId)
      ? goodsId
      : null,
    mutation: idleMutation,
  })),
  startMutation: (kind, status = "WAITING_API") => set({
    mutation: {
      kind,
      status,
      remoteOrderNumber: null,
      errorCode: null,
      failureReason: null,
    },
  }),
  markMutationWaitingApi: () => set((state) => ({
    mutation: { ...state.mutation, status: "WAITING_API", failureReason: null },
  })),
  completeMutation: (remoteOrderNumber) => set((state) => ({
    mutation: {
      ...state.mutation,
      status: "SUCCEEDED",
      remoteOrderNumber: remoteOrderNumber ?? null,
      errorCode: null,
      failureReason: null,
    },
  })),
  failMutation: (failureReason, errorCode) => set((state) => ({
    mutation: {
      ...state.mutation,
      status: "FAILED",
      errorCode: errorCode ?? null,
      failureReason,
    },
  })),
  resetMutation: () => set({ mutation: idleMutation }),
  resetMemberSession: () => set({
    lookupQuery: "",
    cardReaderStatus: "IDLE",
    cardReaderError: null,
    lastCardLookupKind: null,
    lookupRequest: idleRequest,
    currentMember: null,
    registrationDraft: emptyRegistrationDraft,
    compensationDraft: emptyCompensationDraft,
    packages: [],
    packagesRequest: idleRequest,
    selectedPackageId: null,
    mutation: idleMutation,
  }),
}));

export const selectSelectedMemberPackage = (
  state: MemberState,
): MemberPointPackage | null =>
  state.packages.find((item) => item.goodsId === state.selectedPackageId) ?? null;

export const selectIsMemberBusy = (state: MemberState): boolean =>
  state.lookupRequest.status === "WAITING_API" ||
  state.packagesRequest.status === "WAITING_API" ||
  state.cardReaderStatus === "READING" ||
  ["WAITING_PAYMENT", "WAITING_API"].includes(state.mutation.status);
