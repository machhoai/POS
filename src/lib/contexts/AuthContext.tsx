"use client";

// =============================================================================
// POS Auth Context — RBAC with 3 Gates of Login
// =============================================================================
// Mirrors the ERP's AuthContext but simplified for the POS Tauri environment:
//   - No session cookies (static app, uses IndexedDB persistence)
//   - No Edge middleware (no SSR)
//   - POS-specific permission gate (page.pos.access)
//
// Three Gates on Login:
//   Gate 1: Account must be active (isActive === true)
//   Gate 2: Must have 'page.pos.access' permission (or be admin)
//   Gate 3: Must have an assigned store (effectiveStoreId)
//           → Admin WITHOUT storeId enters "store selection" mode
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { UserDoc } from "@/lib/types/user";
import { ADMIN_ROLES, POS_REQUIRED_PERMISSION } from "@/lib/types/user";
import {
  phoneToEmail,
  fetchUserDoc,
  resolvePermissions,
  resolveEffectiveStoreId,
} from "@/lib/services/authService";

// =============================================================================
// Types
// =============================================================================

interface AuthState {
  /** Firebase Auth user object */
  user: User | null;
  /** Full Firestore user profile */
  userDoc: UserDoc | null;
  /** Resolved permission keys (empty for admins — they bypass all) */
  permissions: Set<string>;
  /** The store this POS session is operating in */
  effectiveStoreId: string | null;
  /** Whether the auth state is still being determined */
  isLoading: boolean;
  /** Error message from login (Vietnamese) */
  loginError: string | null;
  /**
   * True when admin is authenticated but hasn't selected a store yet.
   * The dashboard shows a StoreSelector in this state.
   */
  needsStoreSelection: boolean;
}

interface AuthContextValue extends AuthState {
  /** Login with phone number and password */
  login: (phone: string, password: string) => Promise<void>;
  /** Sign out and clear all state */
  logout: () => Promise<void>;
  /**
   * Check if the user has a specific permission.
   * Admin/super_admin always returns true (bypass).
   */
  hasPermission: (key: string) => boolean;
  /**
   * Set the effective store ID (used by admin store selector).
   */
  selectStore: (storeId: string) => void;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    userDoc: null,
    permissions: new Set(),
    effectiveStoreId: null,
    isLoading: true,
    loginError: null,
    needsStoreSelection: false,
  });

  // ── Permission check with admin bypass ──────────────────────────────────
  const hasPermission = useCallback(
    (key: string): boolean => {
      if (!state.userDoc) return false;
      // Admin/super_admin bypass all checks
      if (ADMIN_ROLES.has(state.userDoc.role)) return true;
      return state.permissions.has(key);
    },
    [state.userDoc, state.permissions]
  );

  // ── Admin store selector ────────────────────────────────────────────────
  const selectStore = useCallback(
    (storeId: string) => {
      setState((prev) => ({
        ...prev,
        effectiveStoreId: storeId,
        needsStoreSelection: false,
      }));
    },
    []
  );

  // ── Load user profile + permissions + storeId ───────────────────────────
  const loadUserProfile = useCallback(async (firebaseUser: User) => {
    try {
      const userDoc = await fetchUserDoc(firebaseUser.uid);

      if (!userDoc) {
        // User exists in Auth but not in Firestore — force sign out
        await signOut(auth);
        setState((prev) => ({
          ...prev,
          user: null,
          userDoc: null,
          permissions: new Set(),
          effectiveStoreId: null,
          isLoading: false,
          loginError: "Không tìm thấy thông tin tài khoản trong hệ thống.",
          needsStoreSelection: false,
        }));
        return;
      }

      // Gate 1: Check if account is active
      if (!userDoc.isActive) {
        await signOut(auth);
        setState((prev) => ({
          ...prev,
          user: null,
          userDoc: null,
          permissions: new Set(),
          effectiveStoreId: null,
          isLoading: false,
          loginError: "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản lý.",
          needsStoreSelection: false,
        }));
        return;
      }

      // Resolve permissions
      const permissions = await resolvePermissions(userDoc);

      // Gate 2: Check POS access permission (admin bypasses)
      const isAdmin = ADMIN_ROLES.has(userDoc.role);
      if (!isAdmin && !permissions.has(POS_REQUIRED_PERMISSION)) {
        await signOut(auth);
        setState((prev) => ({
          ...prev,
          user: null,
          userDoc: null,
          permissions: new Set(),
          effectiveStoreId: null,
          isLoading: false,
          loginError:
            "Tài khoản của bạn không có quyền truy cập hệ thống POS. Vui lòng liên hệ quản trị viên.",
          needsStoreSelection: false,
        }));
        return;
      }

      // Resolve effective store ID
      const effectiveStoreId = resolveEffectiveStoreId(userDoc);

      // Gate 3: Must have a store assigned
      if (!effectiveStoreId) {
        if (isAdmin) {
          // Admin without storeId → allow login, show store selector
          setState({
            user: firebaseUser,
            userDoc,
            permissions,
            effectiveStoreId: null,
            isLoading: false,
            loginError: null,
            needsStoreSelection: true,
          });
          return;
        }

        // Non-admin without store → reject
        await signOut(auth);
        setState((prev) => ({
          ...prev,
          user: null,
          userDoc: null,
          permissions: new Set(),
          effectiveStoreId: null,
          isLoading: false,
          loginError:
            "Tài khoản chưa được gán cửa hàng. Vui lòng liên hệ quản lý để được phân công.",
          needsStoreSelection: false,
        }));
        return;
      }

      // ✅ All gates passed — user is fully authenticated
      setState({
        user: firebaseUser,
        userDoc,
        permissions,
        effectiveStoreId,
        isLoading: false,
        loginError: null,
        needsStoreSelection: false,
      });
    } catch (error) {
      console.error("[Auth] Lỗi khi tải hồ sơ người dùng:", error);
      await signOut(auth);
      setState((prev) => ({
        ...prev,
        user: null,
        userDoc: null,
        permissions: new Set(),
        effectiveStoreId: null,
        isLoading: false,
        loginError: "Đã có lỗi xảy ra khi xác thực. Vui lòng thử lại.",
        needsStoreSelection: false,
      }));
    }
  }, []);

  // ── Firebase Auth state observer ────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setState({
          user: null,
          userDoc: null,
          permissions: new Set(),
          effectiveStoreId: null,
          isLoading: false,
          loginError: null,
          needsStoreSelection: false,
        });
      }
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  // ── Login action ────────────────────────────────────────────────────────
  const login = useCallback(async (phone: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, loginError: null }));

    try {
      const email = phoneToEmail(phone);
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will fire → loadUserProfile handles the rest
    } catch (error: unknown) {
      const firebaseError = error as { code?: string };

      let message = "Đã có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.";

      if (
        firebaseError.code === "auth/user-not-found" ||
        firebaseError.code === "auth/wrong-password" ||
        firebaseError.code === "auth/invalid-credential"
      ) {
        message = "Số điện thoại hoặc mật khẩu không chính xác.";
      } else if (firebaseError.code === "auth/too-many-requests") {
        message =
          "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ít phút.";
      } else if (firebaseError.code === "auth/network-request-failed") {
        message = "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.";
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        loginError: message,
      }));
    }
  }, []);

  // ── Logout action ──────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will fire → state gets cleared
    } catch (error) {
      console.error("[Auth] Lỗi khi đăng xuất:", error);
    }
  }, []);

  // ── Context value ──────────────────────────────────────────────────────
  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    hasPermission,
    selectStore,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the POS auth context.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong <AuthProvider>");
  }
  return context;
}
