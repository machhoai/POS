import assert from "node:assert/strict";
import test from "node:test";

import {
  createRemoteSettingsWatchCredential,
  isRemoteSettingsOwnerPathname,
} from "../src/lib/utils/remoteSettingsPolling.ts";

test("only the customer display route gives up remote-settings ownership", () => {
  assert.equal(isRemoteSettingsOwnerPathname("/"), true);
  assert.equal(isRemoteSettingsOwnerPathname("/members"), true);
  assert.equal(isRemoteSettingsOwnerPathname("/display-control"), true);
  assert.equal(isRemoteSettingsOwnerPathname("/display"), false);
  assert.equal(isRemoteSettingsOwnerPathname("/display/preview"), false);
});

test("watch credential ignores session verification timestamps", () => {
  const first = createRemoteSettingsWatchCredential({
    device_id: "device-1",
    device_credential: "secret",
    warehouse_id: "warehouse-1",
    last_verified_at: "2026-09-01T01:00:00.000Z",
  });
  const refreshed = createRemoteSettingsWatchCredential({
    device_id: "device-1",
    device_credential: "secret",
    warehouse_id: "warehouse-1",
    last_verified_at: "2026-09-01T01:01:00.000Z",
  });

  assert.deepEqual(refreshed, first);
  assert.equal("last_verified_at" in refreshed, false);
});
