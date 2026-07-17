import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs } from "firebase/firestore";
import { db, functions } from "@/lib/firebase/client";
import type {
  AuthSessionData,
  UserWarehouseRole,
  WarehouseInfo,
} from "@/lib/types/user";

interface ResolveLoginIdentifierRequest {
  identifier: string;
}

interface ResolveLoginIdentifierResponse {
  email: string;
}

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid-credential"
      | "invalid-session"
      | "no-access"
      | "no-warehouse"
      | "network",
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

function isFunctionsError(error: unknown, codes: string[]): boolean {
  return error instanceof FirebaseError && codes.includes(error.code);
}

/** Resolve email, username, or employee phone through the POS-owned function. */
export async function resolveLoginEmail(identifier: string): Promise<string> {
  const resolveIdentifier = httpsCallable<
    ResolveLoginIdentifierRequest,
    ResolveLoginIdentifierResponse
  >(functions, "resolvePosLoginIdentifier");

  try {
    const result = await resolveIdentifier({ identifier: identifier.trim() });
    if (!result.data.email) {
      throw new AuthServiceError(
        "Thông tin đăng nhập không chính xác.",
        "invalid-credential",
      );
    }
    return result.data.email;
  } catch (error: unknown) {
    if (error instanceof AuthServiceError) throw error;
    if (
      isFunctionsError(error, [
        "functions/not-found",
        "functions/invalid-argument",
      ])
    ) {
      throw new AuthServiceError(
        "Thông tin đăng nhập không chính xác.",
        "invalid-credential",
      );
    }
    throw new AuthServiceError(
      "Không thể kết nối dịch vụ đăng nhập POS. Vui lòng kiểm tra kết nối mạng.",
      "network",
    );
  }
}

/** Load the authoritative shared user, roles, and permissions from POS Functions. */
export async function createPosAuthSession(
  firebaseUser: User,
): Promise<AuthSessionData> {
  const getSession = httpsCallable<Record<string, never>, AuthSessionData>(
    functions,
    "getPosAuthSession",
  );

  try {
    // Ensure the callable request carries a current Firebase ID token.
    await firebaseUser.getIdToken();
    const result = await getSession({});
    return result.data;
  } catch (error: unknown) {
    if (
      isFunctionsError(error, [
        "functions/unauthenticated",
        "functions/permission-denied",
        "functions/not-found",
        "functions/failed-precondition",
      ])
    ) {
      throw new AuthServiceError(
        error instanceof Error
          ? error.message
          : "Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.",
        "invalid-session",
      );
    }
    throw new AuthServiceError(
      "Không thể xác minh phiên đăng nhập với dịch vụ POS.",
      "network",
    );
  }
}

function hasGlobalAssignment(assignments: UserWarehouseRole[]): boolean {
  return assignments.some((assignment) => assignment.warehouse_id === null);
}

/** Read bduck-system's warehouses and restrict them to approved role scopes. */
export async function fetchAccessibleWarehouses(
  assignments: UserWarehouseRole[],
): Promise<WarehouseInfo[]> {
  const allowedIds = new Set(
    assignments
      .map((assignment) => assignment.warehouse_id)
      .filter((warehouseId): warehouseId is string => Boolean(warehouseId)),
  );
  const canAccessAll = hasGlobalAssignment(assignments);
  const snapshot = await getDocs(collection(db, "warehouses"));

  return snapshot.docs
    .filter((warehouseDoc) => {
      const data = warehouseDoc.data();
      return (
        data.is_deleted !== true &&
        data.status === "ACTIVE" &&
        (canAccessAll || allowedIds.has(warehouseDoc.id))
      );
    })
    .map((warehouseDoc) => {
      const data = warehouseDoc.data();
      return {
        id: warehouseDoc.id,
        name: typeof data.name === "string" ? data.name : warehouseDoc.id,
        code: typeof data.code === "string" ? data.code : "",
        address: typeof data.address === "string" ? data.address : null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "vi"));
}
