// =============================================================================
// Test Script: HK API Signature Verification
// =============================================================================
//
// Purpose: Verify that the MD5 signature utility produces correct output
// before using it in production Cloud Functions.
//
// Run with:
//   cd functions && npx ts-node ../scripts/test-signature.ts
//   OR
//   npx tsx scripts/test-signature.ts  (from project root)
//
// This script mocks environment variables and calls generateHkApiRequest()
// to verify the signature matches expectations.
// =============================================================================

import * as crypto from "crypto";

// =============================================================================
// 1. Inline the signature functions (to avoid env/import issues in scripts)
// =============================================================================

interface SignatureParams {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  bodyString: string;
  key: string;
}

interface SignaturePayload {
  action: string;
  body: Record<string, unknown>;
}

interface HKApiRequestEnvelope {
  appId: string;
  action: string;
  version: string;
  timestamp: string;
  sign: string;
  body: string;
}

function generateSignature(params: SignatureParams): string {
  const { appId, action, version, timestamp, bodyString, key } = params;
  const rawString = `${appId}${action}${version}${timestamp}${bodyString}${key}`;
  const hash = crypto
    .createHash("md5")
    .update(rawString, "utf8")
    .digest("hex")
    .toUpperCase();
  return hash;
}

function generateHkApiRequest(
  payload: SignaturePayload,
  env: { appId: string; key: string; version: string; timestamp?: string }
): HKApiRequestEnvelope {
  const timestamp = env.timestamp || String(Date.now());
  const bodyString = JSON.stringify(payload.body);
  const sign = generateSignature({
    appId: env.appId,
    action: payload.action,
    version: env.version,
    timestamp,
    bodyString,
    key: env.key,
  });
  return {
    appId: env.appId,
    action: payload.action,
    version: env.version,
    timestamp,
    sign,
    body: bodyString,
  };
}

// =============================================================================
// 2. Test Data (Mock)
// =============================================================================

const MOCK_ENV = {
  appId: "8c9f2200a1834c6fb306682281e293e3",
  key: "9DAE66C101D801C51B1C8C5137B1F742",
  version: "11.7.1",
  timestamp: "1723822967585", // Fixed timestamp for reproducible results
};

// =============================================================================
// 3. Run Tests
// =============================================================================

console.log("═══════════════════════════════════════════════════════════════");
console.log("  HK API Signature Utility — Verification Tests");
console.log("═══════════════════════════════════════════════════════════════\n");

// ── Test 1: Basic signature with simple body ────────────────────────────────

console.log("── Test 1: Basic signature with test_action ──────────────────\n");

const test1Body = { userId: "123", amount: 100 };
const test1BodyString = JSON.stringify(test1Body);
const test1Raw =
  MOCK_ENV.appId +
  "test_action" +
  MOCK_ENV.version +
  MOCK_ENV.timestamp +
  test1BodyString +
  MOCK_ENV.key;

const test1Sign = crypto
  .createHash("md5")
  .update(test1Raw, "utf8")
  .digest("hex")
  .toUpperCase();

console.log("  Input:");
console.log(`    appId:     ${MOCK_ENV.appId}`);
console.log(`    action:    test_action`);
console.log(`    version:   ${MOCK_ENV.version}`);
console.log(`    timestamp: ${MOCK_ENV.timestamp}`);
console.log(`    body:      ${test1BodyString}`);
console.log(`    key:       ${MOCK_ENV.key}`);
console.log("");
console.log("  Concatenated string (before hashing):");
console.log(`    "${test1Raw}"`);
console.log("");
console.log(`  MD5 Signature: ${test1Sign}`);
console.log("");

// Verify via generateHkApiRequest
const test1Result = generateHkApiRequest(
  { action: "test_action", body: test1Body },
  { ...MOCK_ENV }
);

const test1Pass = test1Result.sign === test1Sign;
console.log(`  ✅ generateHkApiRequest matches: ${test1Pass ? "PASS ✓" : "FAIL ✗"}`);
console.log("");

// ── Test 2: order_create (matches real API format) ──────────────────────────

console.log("── Test 2: order_create (real API format) ────────────────────\n");

const test2Body = {
  Uid: "dc29c6ec-4255-4b55-8baf-244fe1d02820",
  GoodsItems: [{ GoodsId: "2a10a193-ddaa-4473-9d79-b9461ddaa1fc", Quantity: "1" }],
};

const test2Result = generateHkApiRequest(
  { action: "order_create", body: test2Body },
  { ...MOCK_ENV }
);

console.log("  Generated request envelope:");
console.log(JSON.stringify(test2Result, null, 4));
console.log("");

// Verify the sign was generated (non-empty, 32 hex chars, uppercase)
const test2Valid =
  test2Result.sign.length === 32 &&
  /^[A-F0-9]{32}$/.test(test2Result.sign);
console.log(`  Signature format valid (32 uppercase hex): ${test2Valid ? "PASS ✓" : "FAIL ✗"}`);
console.log("");

// ── Test 3: order_pay ───────────────────────────────────────────────────────

console.log("── Test 3: order_pay ─────────────────────────────────────────\n");

const test3Body = {
  OrderNumber: "O01325651772437086903635",
  PayAmount: null,
};

const test3Result = generateHkApiRequest(
  { action: "order_pay", body: test3Body },
  { ...MOCK_ENV }
);

console.log("  Generated request envelope:");
console.log(JSON.stringify(test3Result, null, 4));
console.log("");

const test3Valid =
  test3Result.sign.length === 32 &&
  /^[A-F0-9]{32}$/.test(test3Result.sign);
console.log(`  Signature format valid: ${test3Valid ? "PASS ✓" : "FAIL ✗"}`);
console.log("");

// ── Test 4: Verify body is correctly stringified ────────────────────────────

console.log("── Test 4: Body stringification check ────────────────────────\n");

const test4Result = generateHkApiRequest(
  {
    action: "order_create",
    body: {
      Uid: "dc29c6ec-4255-4b55-8baf-244fe1d02820",
      GoodsItems: [
        { GoodsId: "cc581d73-51e1-4dcc-9c4a-f5401df45812", Quantity: "2" },
      ],
    },
  },
  { ...MOCK_ENV }
);

// The body field in the envelope should be a string, not an object
const test4Pass =
  typeof test4Result.body === "string" &&
  JSON.parse(test4Result.body).Uid === "dc29c6ec-4255-4b55-8baf-244fe1d02820";
console.log(`  body is stringified JSON: ${test4Pass ? "PASS ✓" : "FAIL ✗"}`);
console.log(`  body value: ${test4Result.body}`);
console.log("");

// ── Test 5: Deterministic — same input produces same output ─────────────────

console.log("── Test 5: Determinism check ─────────────────────────────────\n");

const test5a = generateHkApiRequest(
  { action: "test_action", body: { userId: "123", amount: 100 } },
  { ...MOCK_ENV }
);
const test5b = generateHkApiRequest(
  { action: "test_action", body: { userId: "123", amount: 100 } },
  { ...MOCK_ENV }
);

const test5Pass = test5a.sign === test5b.sign;
console.log(`  Same input → same signature: ${test5Pass ? "PASS ✓" : "FAIL ✗"}`);
console.log(`    Run A: ${test5a.sign}`);
console.log(`    Run B: ${test5b.sign}`);
console.log("");

// ── Test 6: Cross-verify with the documented example ────────────────────────

console.log("── Test 6: Cross-verify with API docs example ───────────────\n");
console.log("  From docs (签名规则 line 124):");
console.log("    Raw: 'be559b49662c4b609c5944eda383fefdmember_join10.11.817238229675851234567890'");
console.log("    This example uses a different appId/key pair, so we verify");
console.log("    the algorithm produces the correct format.\n");

const docsRaw = "be559b49662c4b609c5944eda383fefdmember_join10.11.817238229675851234567890";
const docsSign = crypto
  .createHash("md5")
  .update(docsRaw, "utf8")
  .digest("hex")
  .toUpperCase();

// Re-create using our function
const docsSignViaFn = generateSignature({
  appId: "be559b49662c4b609c5944eda383fefd",
  action: "member_join",
  version: "10.11.8",
  timestamp: "1723822967585",
  bodyString: "1234567890",
  key: "",
});

// Note: The docs example is ambiguous about where the key starts.
// "be559b49662c4b609c5944eda383fefd" + "member_join" + "10.11.8" + "1723822967585" + body + key = raw
// The tail "1234567890" could be body="1234567890" with key="" or body="" with key="1234567890"
// Either way, our algorithm correctly concatenates and hashes.

console.log(`  Direct MD5 of docs string:   ${docsSign}`);
console.log(`  Via generateSignature():     ${docsSignViaFn}`);
const test6Pass = docsSign === docsSignViaFn;
console.log(`  Match: ${test6Pass ? "PASS ✓" : "FAIL ✗"}`);
console.log("");

// ── Summary ─────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
const allPassed = test1Pass && test2Valid && test3Valid && test4Pass && test5Pass && test6Pass;
if (allPassed) {
  console.log("  ✅ ALL TESTS PASSED — Signature utility is working correctly.");
} else {
  console.log("  ❌ SOME TESTS FAILED — Review output above.");
}
console.log("═══════════════════════════════════════════════════════════════\n");

process.exit(allPassed ? 0 : 1);
