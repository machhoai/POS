// =============================================================================
// Auth Service — Firestore-backed user authentication & permission resolution
// =============================================================================
// Handles:
//   1. Phone-to-email conversion (matches ERP's phoneToEmail trick)
//   2. Fetching UserDoc from Firestore
//   3. Resolving permissions from CustomRoleDoc
//   4. Determining the effective store for the POS session
//
// This service does NOT call Firebase Auth directly (that's in AuthContext).
// It only handles Firestore reads and business logic.
// =============================================================================

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UserDoc, CustomRoleDoc } from "@/lib/types/user";
import { ADMIN_ROLES } from "@/lib/types/user";

/**
 * Company email domain used for the phone-to-email conversion trick.
 * Must match the ERP's COMPANY_DOMAIN configuration.
 */
const COMPANY_DOMAIN =
  process.env.NEXT_PUBLIC_COMPANY_DOMAIN || "company.com";

/**
 * Convert a phone number to a pseudo-email for Firebase Auth.
 * Mirrors the ERP's `phoneToEmail()` function exactly.
 *
 * @example phoneToEmail("0912345678") → "0912345678@company.com"
 */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@${COMPANY_DOMAIN}`;
}

/**
 * Fetch a user document from Firestore.
 *
 * @param uid - Firebase Auth UID.
 * @returns The UserDoc or null if not found.
 */
export async function fetchUserDoc(uid: string): Promise<UserDoc | null> {
  try {
    const userRef = doc(db, "users", uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as UserDoc;
  } catch (error) {
    console.error("[Auth] Lỗi khi tải thông tin người dùng:", error);
    return null;
  }
}

/**
 * Fetch a custom role document from Firestore.
 *
 * @param roleId - The custom role document ID.
 * @returns The CustomRoleDoc or null if not found.
 */
export async function fetchCustomRole(
  roleId: string
): Promise<CustomRoleDoc | null> {
  try {
    const roleRef = doc(db, "custom_roles", roleId);
    const snapshot = await getDoc(roleRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as CustomRoleDoc;
  } catch (error) {
    console.error("[Auth] Lỗi khi tải vai trò tùy chỉnh:", error);
    return null;
  }
}

/**
 * Resolve the permission set for a user.
 *
 * Resolution order (matches ERP):
 *   1. If userDoc.customRoleId exists → load custom_roles/{customRoleId}
 *   2. Else → load custom_roles/{userDoc.role} (system role fallback)
 *   3. Result → Set<string> of permission keys
 *
 * Admin/super_admin roles get an empty set (they bypass all checks).
 */
export async function resolvePermissions(
  userDoc: UserDoc
): Promise<Set<string>> {
  // Admins bypass all permission checks — no need to load role doc
  if (ADMIN_ROLES.has(userDoc.role)) {
    return new Set<string>();
  }

  const roleId = userDoc.customRoleId || userDoc.role;
  const roleDoc = await fetchCustomRole(roleId);

  if (!roleDoc) {
    console.error(
      `[Auth] Không tìm thấy vai trò: ${roleId}`
    );
    return new Set<string>();
  }

  return new Set(roleDoc.permissions);
}

/**
 * Resolve the effective store ID for the POS session.
 *
 * Logic (matches ERP):
 *   - STORE users → use their assigned storeId
 *   - OFFICE/CENTRAL users → use storeId if assigned, otherwise null
 *   - No workplaceType → use storeId if available
 */
export function resolveEffectiveStoreId(
  userDoc: UserDoc
): string | null {
  // Direct store assignment takes priority
  if (userDoc.storeId) {
    return userDoc.storeId;
  }

  return null;
}
