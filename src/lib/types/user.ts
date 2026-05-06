// =============================================================================
// POS User & Permission Types — Mirrored from ERP (Minimal subset)
// =============================================================================
// These types are copied from the ERP codebase (D:\Github\my_e-commerce\types)
// and trimmed to only the fields the POS needs for authentication and RBAC.
// =============================================================================

/** Available user roles in the system (matches ERP exactly). */
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'store_manager'
  | 'manager'
  | 'employee'
  | 'office';

/** Workplace assignment types. */
export type WorkplaceType = 'STORE' | 'OFFICE' | 'CENTRAL';

/** Roles that automatically bypass all permission checks. */
export const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([
  'super_admin',
  'admin',
]);

/** The permission key required to access the POS system. */
export const POS_REQUIRED_PERMISSION = 'page.pos.access';

/**
 * User document stored in Firestore `users/{uid}`.
 * Only includes fields relevant to POS authentication and authorization.
 */
export interface UserDoc {
  uid: string;
  name: string;
  phone: string;
  role: UserRole;
  type: 'FT' | 'PT';
  isActive: boolean;

  // Workplace assignment
  workplaceType?: WorkplaceType;
  storeId?: string;
  officeId?: string;
  warehouseId?: string;

  // Permission system
  customRoleId?: string;

  // Optional profile fields (read-only in POS)
  avatar?: string;
  email?: string;
}

/**
 * Custom role document stored in Firestore `custom_roles/{id}`.
 * Used to resolve granular permissions for non-admin users.
 */
export interface CustomRoleDoc {
  id: string;
  name: string;
  permissions: string[];
  isSystem?: boolean;
  isLocked?: boolean;
  creatorRoles?: string[];
  color?: string;
  defaultRoute?: string;
  applicableTo?: WorkplaceType[];
}
