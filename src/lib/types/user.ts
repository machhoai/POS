// Types are intentionally kept as a minimal, read-only mirror of
// D:\Github\bduck-system\packages\shared-types\src\users.ts.

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type WarehouseType = "MAIN" | "STORE" | "OFFICE";

export interface UserDoc {
  id: string;
  username: string;
  email: string;
  full_name: string;
  employee_id: string;
  status: UserStatus;
  is_deleted: boolean;
  workplace_facility_id?: string | null;
  mfa_enabled?: boolean;
}

export interface UserWarehouseRole {
  id: string;
  user_id: string;
  warehouse_id: string | null;
  role_id: string;
  assigned_by: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  is_deleted?: boolean;
  scope_origin?: "DIRECT" | "LEGACY_DIRECT";
}

export type ScopedPermissions = Record<string, unknown>;
export type PermissionMap = Record<string, ScopedPermissions>;

export interface WarehouseInfo {
  id: string;
  name: string;
  code: string;
  type: WarehouseType;
  address: string | null;
}

export interface AuthSessionData {
  user: UserDoc;
  permissions: PermissionMap;
  roles: UserWarehouseRole[];
  warehouses: WarehouseInfo[];
}
