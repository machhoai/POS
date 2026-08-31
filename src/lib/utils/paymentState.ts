import type { FixedTransferStatus } from "@/lib/types/order";

interface ActiveTransferInput {
  hasSession: boolean;
  fixedTransferStatus: FixedTransferStatus | null;
  isCartLocked: boolean;
}

export function hasActiveTransfer({
  hasSession,
  fixedTransferStatus,
  isCartLocked,
}: ActiveTransferInput): boolean {
  return hasSession ||
    fixedTransferStatus === "AWAITING_MANUAL_CONFIRMATION" ||
    isCartLocked;
}
