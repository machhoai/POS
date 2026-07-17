"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  AuthServiceError,
  createPosAuthSession,
  resolveLoginEmail,
} from "@/lib/services/authService";
import type {
  PermissionMap,
  UserDoc,
  UserWarehouseRole,
  WarehouseInfo,
} from "@/lib/types/user";

const SELECTED_WAREHOUSE_KEY = "pos_selected_warehouse_id";

interface AuthState {
  user: User | null;
  userDoc: UserDoc | null;
  permissions: PermissionMap;
  roleAssignments: UserWarehouseRole[];
  availableWarehouses: WarehouseInfo[];
  effectiveWarehouseId: string | null;
  effectiveWarehouseName: string | null;
  isLoading: boolean;
  loginError: string | null;
  needsWarehouseSelection: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string, warehouseId?: string) => boolean;
  selectWarehouse: (warehouseId: string) => void;
}

const EMPTY_AUTH_STATE: AuthState = {
  user: null,
  userDoc: null,
  permissions: {},
  roleAssignments: [],
  availableWarehouses: [],
  effectiveWarehouseId: null,
  effectiveWarehouseName: null,
  isLoading: false,
  loginError: null,
  needsWarehouseSelection: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredWarehouseId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_WAREHOUSE_KEY);
}

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof AuthServiceError) return error.message;

  const firebaseCode =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";

  if (
    [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
    ].includes(firebaseCode)
  ) {
    return "Thông tin đăng nhập hoặc mật khẩu không chính xác.";
  }
  if (firebaseCode === "auth/too-many-requests") {
    return "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ít phút.";
  }
  if (firebaseCode === "auth/network-request-failed") {
    return "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.";
  }

  return "Đã có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.";
}

function hasScopedPermission(
  permissions: PermissionMap,
  key: string,
  warehouseId?: string,
): boolean {
  const globalPermissions = permissions.global || {};
  if (globalPermissions["*"] === true || globalPermissions[key] === true) {
    return true;
  }

  if (warehouseId) {
    const warehousePermissions = permissions[warehouseId] || {};
    return (
      warehousePermissions["*"] === true || warehousePermissions[key] === true
    );
  }

  return Object.entries(permissions).some(
    ([scope, scopedPermissions]) =>
      scope !== "global" &&
      (scopedPermissions["*"] === true || scopedPermissions[key] === true),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...EMPTY_AUTH_STATE,
    isLoading: true,
  });
  const sessionSyncRef = useRef<Promise<void> | null>(null);

  const syncUserSession = useCallback(async (firebaseUser: User) => {
    if (sessionSyncRef.current) return sessionSyncRef.current;

    const syncPromise = (async () => {
      const session = await createPosAuthSession(firebaseUser);
      if (session.user.id !== firebaseUser.uid) {
        throw new AuthServiceError(
          "Phiên đăng nhập không khớp với hồ sơ người dùng.",
          "invalid-session",
        );
      }

      const activeAssignments = session.roles.filter(
        (assignment) => assignment.is_active && assignment.is_deleted !== true,
      );
      if (Object.keys(session.permissions).length === 0) {
        throw new AuthServiceError(
          "Tài khoản chưa được cấp quyền truy cập hệ thống.",
          "no-access",
        );
      }

      const warehouses = session.warehouses;
      if (warehouses.length === 0) {
        throw new AuthServiceError(
          "Tài khoản chưa được gán điểm làm việc đang hoạt động.",
          "no-warehouse",
        );
      }

      const storedWarehouseId = getStoredWarehouseId();
      const selectedWarehouse =
        warehouses.find((warehouse) => warehouse.id === storedWarehouseId) ||
        (warehouses.length === 1 ? warehouses[0] : null);

      if (selectedWarehouse && typeof window !== "undefined") {
        window.localStorage.setItem(
          SELECTED_WAREHOUSE_KEY,
          selectedWarehouse.id,
        );
      }

      setState({
        user: firebaseUser,
        userDoc: session.user,
        permissions: session.permissions,
        roleAssignments: activeAssignments,
        availableWarehouses: warehouses,
        effectiveWarehouseId: selectedWarehouse?.id || null,
        effectiveWarehouseName: selectedWarehouse?.name || null,
        isLoading: false,
        loginError: null,
        needsWarehouseSelection: selectedWarehouse === null,
      });
    })();

    sessionSyncRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      sessionSyncRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setState((previous) => ({
          ...EMPTY_AUTH_STATE,
          loginError: previous.loginError,
        }));
        return;
      }

      setState((previous) => ({
        ...previous,
        isLoading: true,
        loginError: null,
      }));

      void syncUserSession(firebaseUser).catch(async (error: unknown) => {
        console.error("[Auth] Không thể đồng bộ phiên bduck-system:", error);
        await signOut(auth).catch(() => undefined);
        setState({
          ...EMPTY_AUTH_STATE,
          loginError: getLoginErrorMessage(error),
        });
      });
    });

    return unsubscribe;
  }, [syncUserSession]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setState((previous) => ({
        ...previous,
        isLoading: true,
        loginError: null,
      }));

      try {
        const email = await resolveLoginEmail(identifier);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await syncUserSession(credential.user);
      } catch (error: unknown) {
        await signOut(auth).catch(() => undefined);
        setState({
          ...EMPTY_AUTH_STATE,
          loginError: getLoginErrorMessage(error),
        });
      }
    },
    [syncUserSession],
  );

  const logout = useCallback(async () => {
    await signOut(auth).catch((error) => {
      console.error("[Auth] Không thể đăng xuất Firebase:", error);
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SELECTED_WAREHOUSE_KEY);
    }
    setState(EMPTY_AUTH_STATE);
  }, []);

  const selectWarehouse = useCallback((warehouseId: string) => {
    setState((previous) => {
      const warehouse = previous.availableWarehouses.find(
        (item) => item.id === warehouseId,
      );
      if (!warehouse) return previous;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(SELECTED_WAREHOUSE_KEY, warehouse.id);
      }

      return {
        ...previous,
        effectiveWarehouseId: warehouse.id,
        effectiveWarehouseName: warehouse.name,
        needsWarehouseSelection: false,
      };
    });
  }, []);

  const hasPermission = useCallback(
    (key: string, warehouseId?: string) =>
      hasScopedPermission(
        state.permissions,
        key,
        warehouseId || state.effectiveWarehouseId || undefined,
      ),
    [state.effectiveWarehouseId, state.permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasPermission,
        selectWarehouse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong <AuthProvider>");
  }
  return context;
}
