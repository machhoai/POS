const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildScopedPermissions,
  isRoleAssignmentActive,
  isUsableLoginUser,
  normalizePhone,
  normalizeUsername,
} = require("../lib/services/posAuthPolicy");

function assignment(overrides = {}) {
  return {
    id: "assignment-1",
    user_id: "user-1",
    warehouse_id: "warehouse-1",
    role_id: "cashier",
    assigned_by: "admin-1",
    valid_from: "2026-07-15",
    valid_until: "2026-07-15",
    is_active: true,
    is_deleted: false,
    scope_origin: "DIRECT",
    ...overrides,
  };
}

test("normalizes login identifiers like bduck-system", () => {
  assert.equal(normalizeUsername("  Cashier.One "), "cashier.one");
  assert.equal(normalizePhone("0901 (234)-567"), "0901234567");
});

test("only ACTIVE, non-deleted users can create a POS session", () => {
  const activeUser = { status: "ACTIVE", is_deleted: false };
  assert.equal(isUsableLoginUser(activeUser), true);
  assert.equal(
    isUsableLoginUser({ ...activeUser, status: "SUSPENDED" }),
    false,
  );
  assert.equal(isUsableLoginUser({ ...activeUser, is_deleted: true }), false);
});

test("role validity uses the full Asia/Ho_Chi_Minh calendar day", () => {
  assert.equal(
    isRoleAssignmentActive(
      assignment(),
      new Date("2026-07-15T16:59:59.999Z"),
    ),
    true,
  );
  assert.equal(
    isRoleAssignmentActive(assignment(), new Date("2026-07-15T17:00:00.000Z")),
    false,
  );
});

test("rejects inactive, deleted, and malformed role assignments", () => {
  const now = new Date("2026-07-15T05:00:00.000Z");
  assert.equal(isRoleAssignmentActive(assignment({ is_active: false }), now), false);
  assert.equal(isRoleAssignmentActive(assignment({ is_deleted: true }), now), false);
  assert.equal(isRoleAssignmentActive(assignment({ warehouse_id: "" }), now), false);
  assert.equal(isRoleAssignmentActive(assignment({ valid_from: "bad-date" }), now), false);
});

test("merges permissions independently for global and warehouse scopes", () => {
  const assignments = [
    assignment({ id: "global", warehouse_id: null, role_id: "admin" }),
    assignment({ id: "cashier", role_id: "cashier" }),
    assignment({ id: "viewer", role_id: "viewer" }),
  ];
  const roles = new Map([
    [
      "admin",
      { id: "admin", permissions: { "*": true }, is_deleted: false },
    ],
    [
      "cashier",
      {
        id: "cashier",
        permissions: { "pos.orders.create": true },
        is_deleted: false,
      },
    ],
    [
      "viewer",
      {
        id: "viewer",
        permissions: { "pos.orders.read": true },
        is_deleted: false,
      },
    ],
  ]);

  assert.deepEqual(buildScopedPermissions(assignments, roles), {
    global: { "*": true },
    "warehouse-1": {
      "pos.orders.create": true,
      "pos.orders.read": true,
    },
  });
});
