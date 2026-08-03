import { PayOS } from "@payos/node";
import { defineSecret } from "firebase-functions/params";

const JPOS_PUBLIC_BASE_URL = "https://jpos.joyworldcityfuns.vn/";

export const payosClientIdSecret = defineSecret("PAYOS_CLIENT_ID");
export const payosApiKeySecret = defineSecret("PAYOS_API_KEY");
export const payosChecksumKeySecret = defineSecret("PAYOS_CHECKSUM_KEY");

let payosClient: PayOS | null = null;

function requireConfiguredValue(name: string, rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    throw new Error(`Thiếu cấu hình Cloud Functions: ${name}.`);
  }
  return value;
}

function requireHttpUrl(name: string, rawValue: string): string {
  const value = requireConfiguredValue(name, rawValue);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} không phải URL hợp lệ.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} phải sử dụng giao thức HTTP hoặc HTTPS.`);
  }
  return url.toString();
}

export function getPayOS(): PayOS {
  if (!payosClient) {
    payosClient = new PayOS({
      clientId: requireConfiguredValue(
        "PAYOS_CLIENT_ID",
        payosClientIdSecret.value(),
      ),
      apiKey: requireConfiguredValue("PAYOS_API_KEY", payosApiKeySecret.value()),
      checksumKey: requireConfiguredValue(
        "PAYOS_CHECKSUM_KEY",
        payosChecksumKeySecret.value(),
      ),
      timeout: 30_000,
      maxRetries: 2,
      logLevel: "warn",
    });
  }
  return payosClient;
}

export function buildPayOSRedirectUrls(localOrderId: string): {
  returnUrl: string;
  cancelUrl: string;
} {
  const baseUrl = requireHttpUrl(
    "JPOS_PUBLIC_BASE_URL",
    JPOS_PUBLIC_BASE_URL,
  );
  const returnUrl = new URL(baseUrl);
  const cancelUrl = new URL(baseUrl);
  returnUrl.searchParams.set("orderId", localOrderId);
  returnUrl.searchParams.set("payment", "payos");
  returnUrl.searchParams.set("status", "PAID");
  cancelUrl.searchParams.set("orderId", localOrderId);
  cancelUrl.searchParams.set("payment", "payos");
  cancelUrl.searchParams.set("status", "CANCELLED");
  return {
    returnUrl: returnUrl.toString(),
    cancelUrl: cancelUrl.toString(),
  };
}
