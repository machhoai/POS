const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findNewProductIds,
  mergeHiddenProductIds,
} = require("../lib/services/productSyncVisibilityPolicy");

test("detects only newly synchronized products and restores soft-deleted ids as new", () => {
  assert.deepEqual(
    findNewProductIds(
      [
        { id: "existing" },
        { id: "removed", isDeleted: true },
      ],
      ["new", "existing", "new", "removed"],
    ),
    ["new", "removed"],
  );
});

test("preserves current visibility overrides while hiding new products", () => {
  assert.deepEqual(
    mergeHiddenProductIds(["hidden-before", "same"], ["new", "same"]),
    ["hidden-before", "new", "same"],
  );
});
