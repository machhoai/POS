import { createHmac, timingSafeEqual } from "crypto";

export function createProductSyncSignature(
  secret: string,
  timestamp: string,
  requestId: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret.trim())
    .update(`${timestamp}.${requestId}.${rawBody}`)
    .digest("hex");
}

export function productSyncSignaturesMatch(
  received: string,
  expected: string,
): boolean {
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}
