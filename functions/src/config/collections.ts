/**
 * Read-only bduck-system collections used by POS authentication.
 * POS must never create, update, or delete documents in these collections.
 */
export const SHARED_AUTH_COLLECTIONS = {
  users: "users",
  employeeProfiles: "employee_profiles",
  roles: "roles",
  userWarehouseRoles: "user_warehouse_roles",
  warehouses: "warehouses",
} as const;

/**
 * Collections owned by the POS application.
 *
 * `jpos_products` is a legacy collection name already used in production.
 * New POS-owned collections must use the `pos_` prefix.
 */
export const POS_COLLECTIONS = {
  products: "jpos_products",
  orders: "pos_orders",
  members: "pos_members",
} as const;
