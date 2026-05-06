// =============================================================================
// Local Test Script — Try multiple auth methods to find working HK API endpoint
// =============================================================================
// Usage: npx tsx scripts/test-fetch-products.ts
// =============================================================================

import * as crypto from "crypto";

// ── OpenAPI Credentials (from functions/.env.local) ──────────────────────────
const OPENAPI_APP_ID = "8c9f2200a1834c6fb306682281e293e3";
const OPENAPI_KEY = "9DAE66C101D801C51B1C8C5137B1F742";
const VERSION = "11.7.1";

// ── Device Credentials (from partner system) ─────────────────────────────────
const DEVICE_KEY = "6qwZ/oUdEYVy8q2h2Qdpwhdb0E6PG9C2dv7jinDZR0B/bf+9O3be1w==";
const DEVICE_SID = 20692;
const DEVICE_ICKEY = "uPREBNWpE36yQg+GmQRhsH9t/707dt7X";
const BASE_DOMAIN = "http://joyworld.jingjianx.vip";
const CHAIN_URL = "http://jt.jingjianx.vip";

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
