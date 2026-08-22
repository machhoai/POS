/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getJoyworldCashierAccessToken,
  resetJoyworldAccessTokenCachesForTest,
  resolveJoyworldBaseUrl,
} = require("../lib/services/joyworldCatalogService");

test("derives the JoyWorld manager origin from the OpenAPI action URL", () => {
  assert.equal(
    resolveJoyworldBaseUrl(
      undefined,
      "http://joyworld.jingjianx.vip/openapi/action",
    ),
    "http://joyworld.jingjianx.vip",
  );
});

test("prefers an explicit JoyWorld manager base URL", () => {
  assert.equal(
    resolveJoyworldBaseUrl(
      "https://manager.example.com/custom-root/",
      "https://openapi.example.com/openapi/action",
    ),
    "https://manager.example.com/custom-root",
  );
});

test("derives and caches a cashier token from the configured account", async () => {
  const originalFetch = global.fetch;
  const originalUser = process.env.JOYWORLD_USER;
  const originalPass = process.env.JOYWORLD_PASS;
  const originalBaseUrl = process.env.JOYWORLD_BASE_URL;
  const requests = [];

  process.env.JOYWORLD_USER = "cashier-user";
  process.env.JOYWORLD_PASS = "cashier-password";
  process.env.JOYWORLD_BASE_URL = "https://joyworld.example.com";
  resetJoyworldAccessTokenCachesForTest();
  global.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/basic/manager/login/account")) {
      return Response.json({ data: { token: "manager-token" } });
    }
    if (String(url).includes("/device/manager/workplace/getsimpleworkplace")) {
      return Response.json({
        success: true,
        data: [
          { workPlaceId: "workplace-disabled" },
          { workPlaceId: "workplace-active" },
        ],
      });
    }
    const body = JSON.parse(init.body);
    if (body.workPlaceId === "workplace-disabled") {
      return Response.json({ success: false, msg: "disabled" });
    }
    return Response.json({
      success: true,
      data: {
        token: "cashier-token",
        expiresIn: 60,
        shopId: 20692,
      },
    });
  };

  try {
    assert.equal(
      await getJoyworldCashierAccessToken(20692),
      "cashier-token",
    );
    assert.equal(
      await getJoyworldCashierAccessToken(20692),
      "cashier-token",
    );
    assert.equal(requests.length, 4);
    assert.equal(
      requests[1].init.headers["JJ-SHOPID"],
      "20692",
    );
    assert.deepEqual(JSON.parse(requests[3].init.body), {
      workPlaceId: "workplace-active",
      userName: "cashier-user",
      password: "cashier-password",
    });
  } finally {
    global.fetch = originalFetch;
    if (originalUser === undefined) delete process.env.JOYWORLD_USER;
    else process.env.JOYWORLD_USER = originalUser;
    if (originalPass === undefined) delete process.env.JOYWORLD_PASS;
    else process.env.JOYWORLD_PASS = originalPass;
    if (originalBaseUrl === undefined) delete process.env.JOYWORLD_BASE_URL;
    else process.env.JOYWORLD_BASE_URL = originalBaseUrl;
    resetJoyworldAccessTokenCachesForTest();
  }
});
