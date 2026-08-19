import { invoke, isTauri } from "@tauri-apps/api/core";

export interface CardReadResult {
  serialNumber?: string;
  serialNumberHex?: string;
  memberCode?: string;
  cardUuid?: string;
  dynamicSerialNo?: string;
}

interface CardReaderErrorPayload {
  code?: unknown;
  message?: unknown;
}

export class CardReaderServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CardReaderServiceError";
  }
}

function parsePayload(error: unknown): CardReaderErrorPayload | null {
  if (error && typeof error === "object") return error as CardReaderErrorPayload;
  if (typeof error !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(error);
    return parsed && typeof parsed === "object"
      ? parsed as CardReaderErrorPayload
      : null;
  } catch {
    return { message: error };
  }
}

export function toCardReaderServiceError(error: unknown): CardReaderServiceError {
  if (error instanceof CardReaderServiceError) return error;
  const payload = parsePayload(error);
  const code = typeof payload?.code === "string" ? payload.code : "UNKNOWN";
  const message = typeof payload?.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : "Không thể đọc thẻ. Vui lòng kiểm tra đầu đọc và thử lại.";
  return new CardReaderServiceError(message, code);
}

export async function readMemberCard(
  timeoutMs = 15_000,
  dynamicSerialNo?: string,
): Promise<CardReadResult> {
  if (!isTauri()) {
    throw new CardReaderServiceError(
      "Đọc thẻ tự động chỉ hoạt động trong ứng dụng JPOS trên Windows. Bạn vẫn có thể nhập mã thẻ thủ công.",
      "TAURI_REQUIRED",
    );
  }

  try {
    return await invoke<CardReadResult>("read_member_card", {
      timeoutMs,
      dynamicSerialNo: dynamicSerialNo?.trim() || null,
    });
  } catch (error: unknown) {
    throw toCardReaderServiceError(error);
  }
}

export async function cancelMemberCardRead(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("cancel_member_card_read");
}
