import {
  APIError,
  ConnectionError,
  ConnectionTimeoutError,
} from "@payos/node";

/**
 * Only provider availability failures may fall back to a local cancellation.
 * Validation, authentication, and business-rule errors must still block the
 * cancellation so they are not mistaken for an unreachable PayOS service.
 */
export function isPayOSUnavailableError(error: unknown): boolean {
  if (
    error instanceof ConnectionError ||
    error instanceof ConnectionTimeoutError
  ) {
    return true;
  }
  if (!(error instanceof APIError) || typeof error.status !== "number") {
    return false;
  }
  return error.status === 429 || error.status >= 500;
}
