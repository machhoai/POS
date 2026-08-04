import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function createInvoiceRequestToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function isInvoiceRequestToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
