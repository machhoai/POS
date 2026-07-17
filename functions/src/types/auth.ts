export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface SharedUserRecord {
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

export interface UserWarehouseRoleRecord {
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

export interface RoleRecord {
  id: string;
  permissions: Record<string, unknown>;
  is_deleted: boolean;
}

export type PermissionMap = Record<string, Record<string, unknown>>;

export interface PosAuthSessionData {
  user: SharedUserRecord;
  permissions: PermissionMap;
  roles: UserWarehouseRoleRecord[];
}
