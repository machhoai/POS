/**
 * Read-only bduck-system collections used by POS authentication.
 * POS must never create, update, or delete documents in these collections.
 */
export const SHARED_AUTH_COLLECTIONS = {
  users: "users",
  employeeProfiles: "employee_profiles",
  roles: "roles",
  userWarehouseRoles: "user_warehouse_roles",
} as const;
