# ERP Auth Analysis → POS RBAC Implementation Plan

## Part 1: ERP Codebase Analysis

### 1.1 User Document Schema (`users/{uid}`)

Source: [types/index.ts → UserDoc](file:///D:/Github/my_e-commerce/types/index.ts#L394-L436)

```typescript
interface UserDoc {
  uid: string;
  name: string;
  phone: string;          // Login credential (converted to pseudo-email)
  role: UserRole;         // 'super_admin' | 'admin' | 'store_manager' | 'manager' | 'employee' | 'office'
  type: EmployeeType;     // 'FT' | 'PT'
  isActive: boolean;      // Disabled accounts are rejected at login

  // Workplace assignment
  workplaceType?: 'STORE' | 'OFFICE' | 'CENTRAL';
  storeId?: string;       // Assigned store (when workplaceType === 'STORE')
  officeId?: string;      // Assigned office (when workplaceType === 'OFFICE')
  warehouseId?: string;   // Assigned warehouse (when workplaceType === 'CENTRAL')

  // Permissions
  customRoleId?: string;  // Points to `custom_roles/{id}` for fine-grained permissions
  // ... (profile fields, 2FA, avatar, etc.)
}
```

### 1.2 Permission System (`custom_roles/{id}`)

Source: [types/index.ts → CustomRoleDoc](file:///D:/Github/my_e-commerce/types/index.ts#L303-L315)

```typescript
interface CustomRoleDoc {
  id: string;
  name: string;
  permissions: string[];        // e.g. ['page.scheduling.overview', 'action.hr.manage']
  isSystem?: boolean;
  isLocked?: boolean;
  creatorRoles: string[];
  color?: string;
  defaultRoute?: string;        // e.g. '/dashboard' — used after login redirect
  applicableTo?: ('STORE' | 'OFFICE' | 'CENTRAL')[];
}
```

**Permission key convention:**
- `page.*` → route/page access control
- `action.*` → write/action permission
- Admin & super_admin **always bypass** all checks

**Resolution order:**
1. If `userDoc.customRoleId` exists → load `custom_roles/{customRoleId}`
2. Else → load `custom_roles/{userDoc.role}` (system role document)
3. Result → `Set<string>` of permission keys

### 1.3 Login Flow

Source: [AuthContext.tsx → login()](file:///D:/Github/my_e-commerce/contexts/AuthContext.tsx#L243-L263)

```
1. User enters phone number + password
2. phoneToEmail(phone) → "{digits}@company.com"         // pseudo-email trick
3. signInWithEmailAndPassword(auth, email, password)     // Firebase Auth
4. Fetch doc(db, 'users', credential.user.uid)           // Firestore user doc
5. If userDoc.isActive === false → signOut + throw error  // REJECT disabled
6. Create session cookie via POST /api/auth/session       // For SSR middleware
7. onAuthStateChanged fires → fetchUserDoc(uid):
   a. Load userDoc
   b. Load customRoleDoc (or system role) → Set<permissions>
   c. Resolve effectiveStoreId based on workplaceType
   d. Write role cookie for Edge middleware
```

### 1.4 Session/State Management

- **Primary**: React Context (`AuthProvider` wrapping the entire app)
- **Cookies**: `user_role` cookie for Edge middleware route guards (not for auth, just nav hints)
- **localStorage**: `office_selected_store_id` for office users' store selection persistence

### 1.5 Key Exposed Values from `useAuth()`

| Value | Type | Description |
|-------|------|-------------|
| `user` | `User \| null` | Firebase Auth user object |
| `userDoc` | `UserDoc \| null` | Full Firestore profile |
| `permissions` | `Set<string>` | Resolved permission keys |
| `hasPermission(key)` | `(string) => boolean` | Admin bypasses all; others check Set |
| `effectiveStoreId` | `string` | The store this session is operating in |
| `login(phone, pw)` | `async` | Phone-to-email + Firebase Auth |
| `logout()` | `async` | Signs out + clears state |

---

## Part 2: POS RBAC Adaptation Plan

### 2.1 POS Permission Gate

I propose adding **one new permission key** to the ERP's `ALL_PERMISSIONS` registry (in the ERP codebase, not in POS):

```typescript
{
  key: 'page.pos.access',
  label: 'Truy Cập Hệ Thống POS',
  description: 'Đăng nhập và sử dụng máy tính tiền POS',
  group: 'POS',
  type: 'page',
}
```

> [!IMPORTANT]
> **For the POS codebase itself**, I will hardcode `POS_REQUIRED_PERMISSION = 'page.pos.access'` and check it after login. If the user's role doesn't have this permission, they are **immediately signed out** with an error: *"Tài khoản của bạn không có quyền truy cập hệ thống POS."*
>
> Admin/super_admin automatically bypass this check (consistent with ERP behavior).

### 2.2 Files to Create/Modify in POS

#### [MODIFY] `src/lib/firebase/client.ts` — Add Auth export
- Add `getAuth()` / `initializeAuth()` with IndexedDB persistence (mirroring ERP exactly)
- Export `auth` alongside existing `db`

#### [NEW] `src/lib/types/user.ts` — Minimal UserDoc + CustomRoleDoc
- Copy only the fields we need from the ERP types (not the full 920-line file)
- `UserDoc`: uid, name, phone, role, isActive, workplaceType, storeId, officeId, customRoleId
- `CustomRoleDoc`: id, name, permissions, defaultRoute
- `UserRole` type union

#### [NEW] `src/lib/contexts/AuthContext.tsx` — POS AuthProvider
Mirrors the ERP `AuthContext` but **simplified for POS**:
- Same `phoneToEmail()` login mechanism
- Same `fetchUserDoc` → load user doc → load custom role permissions
- Same `hasPermission()` with admin bypass
- **POS-specific gate**: After permissions resolve, check `hasPermission('page.pos.access')`. If false → sign out + error.
- Resolve `effectiveStoreId` the same way (storeId for store users, officeId → managedStoreIds for office users)
- **No session cookie / middleware** (POS is a static Tauri app, no SSR)

#### [NEW] `src/app/login/page.tsx` — POS Login Page (Vietnamese)
- Same phone + password form as ERP
- Same `phoneToEmail()` trick
- Vietnamese labels: "Số điện thoại", "Mật khẩu", "Đăng nhập"
- POS-specific rejection messages

#### [MODIFY] `src/app/layout.tsx` — Wrap in AuthProvider
- `<AuthProvider>` wraps all children
- `lang="vi"` on html tag

#### [MODIFY] `src/app/page.tsx` — Auth guard
- If `!user || !userDoc` → redirect to `/login`
- Uses `effectiveStoreId` for all order operations

### 2.3 Login Flow in POS (Step by Step)

```
1. Cashier enters phone + password on /login
2. phoneToEmail(phone) → "0912345678@company.com"
3. signInWithEmailAndPassword(auth, email, password)
4. Fetch users/{uid} → UserDoc
5. GATE 1: if (!userDoc.isActive) → signOut, show "Tài khoản đã bị vô hiệu hóa"
6. Load custom_roles/{customRoleId || role} → permissions Set
7. GATE 2: if (!hasPermission('page.pos.access')) → signOut, show "Không có quyền truy cập POS"
8. Resolve effectiveStoreId from userDoc.storeId (or office managedStoreIds)
9. GATE 3: if (!effectiveStoreId) → show "Chưa được gán cửa hàng"
10. ✅ Login success → redirect to / (POS Dashboard)
```

### 2.4 How effectiveStoreId Is Used

Once logged in, `effectiveStoreId` is used throughout:
- **Product sync**: `syncProducts` Cloud Function receives `storeId` parameter
- **Order creation**: Written to `pos_orders/{id}.shopId`
- **Top nav**: Shows the store name for the cashier's context
- **Customer display**: Filters to orders from this store

### 2.5 Other Approved Features (Unchanged)

| Feature | Status |
|---------|--------|
| `syncProducts` onCall Cloud Function | ✅ Approved — Proceeds as planned |
| `useProductStore` (fetch all → filter in memory) | ✅ Approved — Proceeds as planned |
| `useCartStore` (add/remove/quantity/checkout) | ✅ Approved — Proceeds as planned |
| Full Vietnamese POS Dashboard UI | ✅ Approved — Proceeds as planned |

> [!NOTE]
> The `NEXT_PUBLIC_COMPANY_DOMAIN` env variable must be added to the POS `.env.example` since `phoneToEmail()` depends on it. I'll use the same value as the ERP project.

## Open Questions

> [!IMPORTANT]
> **Q1**: Should I add the `page.pos.access` permission entry to the ERP codebase's `ALL_PERMISSIONS` array in `D:\Github\my_e-commerce\types\index.ts`? Or will you handle that separately?

> [!IMPORTANT]
> **Q2**: The ERP login uses session cookies via `/api/auth/session` for SSR middleware. Since the POS is a **static Tauri app** (no Next.js server), I plan to **skip** session cookies entirely and rely only on Firebase Auth's client-side persistence (IndexedDB). Is this acceptable?
