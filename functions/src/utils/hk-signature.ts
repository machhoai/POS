// =============================================================================
// HK API Signature Utility — Server-Side Only (Cloud Functions)
// =============================================================================
//
// Generates MD5 signatures for authenticating requests to the HK (鲸舰) API.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Signature Rule (from 签名规则 documentation):                           │
// │                                                                         │
// │   sign = MD5( appId + action + version + timestamp + body + key )       │
// │                                                                         │
// │   • All fields are concatenated as raw strings (no separators)          │
// │   • `body` is a JSON-stringified string of the business parameters     │
// │   • `timestamp` is a 13-digit millisecond timestamp                    │
// │   • The MD5 result is converted to UPPERCASE                           │
// │                                                                         │
// │ Example from docs:                                                      │
// │   Raw: "be559b49662c4b609c5944eda383fefdmember_join10.11.8              │
// │         17238229675851234567890"                                        │
// │   → MD5 → UPPERCASE                                                    │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ⚠️  This file MUST only run on the server. The API key (`HK_API_KEY`)
//     is never exposed to the frontend or included in the Tauri static build.
//
// Reference: 海外-鲸舰-OpenApi.md → § 签名规则 (line 103)
// =============================================================================

import * as crypto from "crypto";

// =============================================================================
// Types
// =============================================================================

/** Low-level parameters for the raw MD5 signature computation. */
export interface SignatureParams {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  bodyString: string;
  key: string;
}

/**
 * High-level payload for `generateHkApiRequest`.
 * Callers provide only the action name and the business body object.
 * Environment credentials (appId, key, version) are read automatically.
 */
export interface SignaturePayload {
  /** The API action name, e.g. "order_create", "order_pay", "order_precalculate" */
  action: string;
  /** The business parameters object — will be JSON.stringify'd into the `body` field */
  body: Record<string, unknown>;
  /** Action-specific API version. Defaults to HK_API_VERSION when omitted. */
  version?: string;
}

/**
 * The complete, ready-to-send request envelope for the HK API.
 * POST this as JSON to `{HK_API_BASE_URL}` (i.e. `/openapi/action`).
 */
export interface HKApiRequestEnvelope {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  sign: string;
  body: string; // JSON-stringified business parameters
}

// =============================================================================
// Core Signature Function
// =============================================================================

/**
 * Generate an MD5 signature for the HK API.
 *
 * Concatenation order (strictly per docs — 签名规则):
 *   `appId + action + version + timestamp + bodyString + key`
 *
 * @param params - All components of the signature.
 * @returns The MD5 hash in UPPERCASE hex format.
 *
 * @example
 * ```ts
 * const sign = generateSignature({
 *   appId: "8c9f2200a1834c6fb306682281e293e3",
 *   action: "order_create",
 *   version: "11.7.1",
 *   timestamp: "1723822967585",
 *   bodyString: '{"Uid":"abc","GoodsItems":[]}',
 *   key: "9DAE66C101D801C51B1C8C5137B1F742",
 * });
 * // => "A1B2C3D4E5F6..."
 * ```
 */
export function generateSignature(params: SignatureParams): string {
  const { appId, action, version, timestamp, bodyString, key } = params;

  // Concatenate in the exact order specified by the API documentation
  // Reference: "appid + action + version + timestamp + body + key"
  const rawString = `${appId}${action}${version}${timestamp}${bodyString}${key}`;

  // Generate MD5 hash and convert to UPPERCASE
  const hash = crypto
    .createHash("md5")
    .update(rawString, "utf8")
    .digest("hex")
    .toUpperCase();

  return hash;
}

// =============================================================================
// High-Level Request Builder
// =============================================================================

/**
 * Build a complete signed request envelope for the HK API.
 *
 * Reads `HK_API_APP_ID`, `HK_API_KEY`, and `HK_API_VERSION` from
 * environment variables (set in `functions/.env` or Firebase Secrets).
 *
 * @param payload - The action name and business body object.
 * @returns A complete `HKApiRequestEnvelope` ready to POST.
 * @throws If `HK_API_APP_ID` or `HK_API_KEY` env vars are missing.
 *
 * @example
 * ```ts
 * const request = generateHkApiRequest({
 *   action: "order_create",
 *   body: {
 *     Uid: "dc29c6ec-4255-4b55-8baf-244fe1d02820",
 *     GoodsItems: [{ GoodsId: "abc-123", Quantity: "2" }],
 *   },
 * });
 * // POST request to HK_API_BASE_URL with Content-Type: application/json
 * ```
 */
export function generateHkApiRequest(
  payload: SignaturePayload
): HKApiRequestEnvelope {
  // Read credentials from environment
  const appId = process.env.HK_API_APP_ID;
  const key = process.env.HK_API_KEY;
  const version = payload.version || process.env.HK_API_VERSION || "11.7.1";

  if (!appId) {
    throw new Error(
      "[hk-signature] Missing HK_API_APP_ID environment variable. " +
      "Set it in functions/.env or via Firebase Secrets."
    );
  }
  if (!key) {
    throw new Error(
      "[hk-signature] Missing HK_API_KEY environment variable. " +
      "Set it in functions/.env or via Firebase Secrets."
    );
  }

  // Generate 13-digit millisecond timestamp (per API docs: "当前13位时间戳")
  const timestamp = String(Date.now());

  // Stringify the business body
  const bodyString = JSON.stringify(payload.body);

  // Compute the MD5 signature
  const sign = generateSignature({
    appId,
    action: payload.action,
    version,
    timestamp,
    bodyString,
    key,
  });

  return {
    appId,
    action: payload.action,
    version,
    timestamp,
    sign,
    body: bodyString,
  };
}

// =============================================================================
// Utility: Verify Push Signature (for webhook callbacks)
// =============================================================================

/**
 * Verify the signature of a push notification from the HK API.
 *
 * Push verification rule (from docs — 推送数据验签):
 *   `MD5(appId + timestamp + data + key)` → compare with `sign`
 *
 * @param params - The push notification parameters.
 * @returns `true` if the signature matches, `false` otherwise.
 */
export function verifyPushSignature(params: {
  appId: string;
  timestamp: string;
  data: string;
  key: string;
  sign: string;
}): boolean {
  const rawString = `${params.appId}${params.timestamp}${params.data}${params.key}`;

  const expectedSign = crypto
    .createHash("md5")
    .update(rawString, "utf8")
    .digest("hex")
    .toUpperCase();

  return expectedSign === params.sign;
}
