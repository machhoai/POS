/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
