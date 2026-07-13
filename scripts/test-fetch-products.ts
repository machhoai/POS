// =============================================================================
// Local Test Script — Try multiple auth methods to find working HK API endpoint
// =============================================================================
// Usage: configure HK_API_APP_ID, HK_API_KEY, HK_API_BASE_URL,
// HK_DEVICE_KEY, HK_DEVICE_SID and HK_API_CHAIN_URL in .env.local, then run:
// npx tsx scripts/test-fetch-products.ts
// =============================================================================

import * as crypto from "crypto";
import { loadEnvFile } from "node:process";

// ── Credentials — loaded locally and never committed ────────────────────────
loadEnvFile(".env.local");

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  }
  return value;
}

const OPENAPI_APP_ID = requireEnv("HK_API_APP_ID");
const OPENAPI_KEY = requireEnv("HK_API_KEY");
const VERSION = process.env.HK_API_VERSION?.trim() || "11.7.1";

// ── Device Credentials (from partner system) ─────────────────────────────────
const DEVICE_KEY = requireEnv("HK_DEVICE_KEY");
const DEVICE_SID = Number(requireEnv("HK_DEVICE_SID"));
const BASE_DOMAIN = requireEnv("HK_API_BASE_URL").replace(/\/+$/, "");
const CHAIN_URL = requireEnv("HK_API_CHAIN_URL").replace(/\/+$/, "");

if (!Number.isFinite(DEVICE_SID)) {
  throw new Error("HK_DEVICE_SID phải là một số hợp lệ.");
}

// ── Signature for OpenAPI ────────────────────────────────────────────────────
function signOpenApi(action: string, bodyObj: Record<string, unknown>) {
  const timestamp = String(Date.now());
  const bodyString = JSON.stringify(bodyObj);
  const raw = `${OPENAPI_APP_ID}${action}${VERSION}${timestamp}${bodyString}${OPENAPI_KEY}`;
  const hash = crypto.createHash("md5").update(raw, "utf8").digest("hex").toUpperCase();
  return { appId: OPENAPI_APP_ID, action, version: VERSION, timestamp, sign: hash, body: bodyString };
}

async function tryFetch(label: string, url: string, options: RequestInit) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`🔍 ${label}`);
  console.log(`   URL: ${url}`);
  console.log(`${"─".repeat(70)}`);
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    console.log(`   STATUS: ${res.status}`);
    console.log(`   RESPONSE: ${text.substring(0, 2000)}`);
    return text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ❌ ERROR: ${msg}`);
    return null;
  }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST A: OpenAPI endpoint with SINGLE slash
  // ═══════════════════════════════════════════════════════════════════════════
  const envelope = signOpenApi("oversea_subscribe_base_list", { page: 1, limit: 3 });
  await tryFetch(
    "OpenAPI /openapi/action (single slash)",
    `${BASE_DOMAIN}/openapi/action`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST B: REST endpoint — passticket list (no auth)
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "REST passticket/list (no auth)",
    `${BASE_DOMAIN}/setmeal/manager/passticket/list?category=4&page=1&limit=3`,
    { method: "GET" }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST C: REST endpoint with device key as Authorization Bearer
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "REST passticket/list (Bearer key)",
    `${BASE_DOMAIN}/setmeal/manager/passticket/list?category=4&page=1&limit=3`,
    { method: "GET", headers: { "Authorization": `Bearer ${DEVICE_KEY}` } }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST D: REST endpoint with device key as query param
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "REST passticket/list (key + sid in query)",
    `${BASE_DOMAIN}/setmeal/manager/passticket/list?category=4&page=1&limit=3&key=${encodeURIComponent(DEVICE_KEY)}&sid=${DEVICE_SID}`,
    { method: "GET" }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST E: REST endpoint with device key as cookie
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "REST passticket/list (key as cookie header)",
    `${BASE_DOMAIN}/setmeal/manager/passticket/list?category=4&page=1&limit=3`,
    { method: "GET", headers: { "Cookie": `sid=${DEVICE_SID}; key=${DEVICE_KEY}` } }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST F: Chain URL REST endpoint
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "Chain URL passticket/list (no auth)",
    `${CHAIN_URL}/setmeal/manager/passticket/list?category=4&page=1&limit=3`,
    { method: "GET" }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST G: OpenAPI on Chain URL
  // ═══════════════════════════════════════════════════════════════════════════
  await tryFetch(
    "Chain URL OpenAPI /openapi/action",
    `${CHAIN_URL}/openapi/action`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) }
  );
}

main().catch(console.error);
