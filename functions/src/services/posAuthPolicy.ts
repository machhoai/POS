import type {
  PermissionMap,
  RoleRecord,
  SharedUserRecord,
  UserWarehouseRoleRecord,
} from "../types/auth";

const HO_CHI_MINH_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateBoundary = "START" | "END";

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s().-]/g, "");
}

export function isUsableLoginUser(
  user: SharedUserRecord | null,
): user is SharedUserRecord {
  return user !== null && user.is_deleted === false && user.status === "ACTIVE";
}

/**
 * POS sessions may only select active, non-deleted physical stores.
 * MAIN and OFFICE warehouses remain available to bduck-system, but are not
 * valid POS selling locations.
 */
export function isSelectablePosWarehouse(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const warehouse = value as Record<string, unknown>;
  return (
    warehouse.type === "STORE" &&
    warehouse.status === "ACTIVE" &&
    warehouse.is_deleted !== true
  );
}

function resolveRoleAssignmentScopeKey(
  warehouseId: string | null | undefined,
): string | null {
  if (warehouseId === null) return "global";
  return typeof warehouseId === "string" && warehouseId.trim().length > 0
    ? warehouseId
    : null;
}

function parseRoleAssignmentDate(
  value: string,
  boundary: DateBoundary,
): Date | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalizedUtc = new Date(Date.UTC(year, month - 1, day));

  if (
    normalizedUtc.getUTCFullYear() !== year ||
    normalizedUtc.getUTCMonth() !== month - 1 ||
    normalizedUtc.getUTCDate() !== day
  ) {
    return null;
  }

  const dayStartUtc = normalizedUtc.getTime() - HO_CHI_MINH_UTC_OFFSET_MS;
  return new Date(
    boundary === "START" ? dayStartUtc : dayStartUtc + DAY_MS - 1,
  );
}

function parseRoleAssignmentBoundary(
  value: string,
  boundary: DateBoundary,
): Date | null {
  if (DATE_PATTERN.test(value)) {
    return parseRoleAssignmentDate(value, boundary);
  }

  // Temporary compatibility with legacy assignments stored as ISO timestamps.
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function isRoleAssignmentActive(
  assignment: UserWarehouseRoleRecord,
  now: Date,
): boolean {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) return false;
  if (assignment.is_active !== true || assignment.is_deleted === true) {
    return false;
  }
  if (resolveRoleAssignmentScopeKey(assignment.warehouse_id) === null) {
    return false;
  }
  if (!assignment.valid_from) return false;

  const validFrom = parseRoleAssignmentBoundary(
    assignment.valid_from,
    "START",
  );
  if (!validFrom || nowTime < validFrom.getTime()) return false;

  if (assignment.valid_until !== null) {
    if (!assignment.valid_until) return false;
    const validUntil = parseRoleAssignmentBoundary(
      assignment.valid_until,
      "END",
    );
    if (!validUntil || nowTime > validUntil.getTime()) return false;
  }

  return true;
}

export function activeRoleAssignments(
  assignments: UserWarehouseRoleRecord[],
  now = new Date(),
): UserWarehouseRoleRecord[] {
  return assignments.filter((assignment) =>
    isRoleAssignmentActive(assignment, now),
  );
}

export function buildScopedPermissions(
  assignments: UserWarehouseRoleRecord[],
  rolesById: ReadonlyMap<string, RoleRecord>,
): PermissionMap {
  const permissions: PermissionMap = {};

  assignments.forEach((assignment) => {
    const role = rolesById.get(assignment.role_id);
    const scope = resolveRoleAssignmentScopeKey(assignment.warehouse_id);
    if (!role || role.is_deleted || !scope) return;

    permissions[scope] = {
      ...permissions[scope],
      ...role.permissions,
    };
  });

  return permissions;
}
