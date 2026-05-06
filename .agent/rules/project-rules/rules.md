---
trigger: always_on
---

# THÔNG TIN DỰ ÁN (PROJECT OVERVIEW)
- Dự án: Hệ thống POS (Point of Sale) "Local-First".
- Tech Stack: Next.js 14 (App Router), Tailwind CSS, Zustand, Tauri, Firebase (Firestore, Auth, Cloud Functions).
- Ngôn ngữ giao diện (UI): Bắt buộc 100% Tiếng Việt.

# QUY TẮC KIẾN TRÚC (ARCHITECTURE RULES)
1. Sự tách biệt rạch ròi (Separation of Concerns):
   - MỌI API gọi ra bên ngoài (đặc biệt là tích hợp hệ thống Hong Kong) PHẢI nằm trong thư mục `functions/`. Không được phép rò rỉ API Key ở Frontend.
   - Các thao tác với Firestore (CRUD) phải được định nghĩa trong `src/lib/services/`. Component KHÔNG được gọi trực tiếp Firebase SDK.
   - Global State quản lý bằng Zustand đặt trong `src/lib/stores/`.
2. Ưu tiên Local-First: POS phải hoạt động mượt mà bằng cách lấy dữ liệu từ RAM (Zustand) và Firebase. Bất kỳ tiến trình nào chạy chậm phải được chuyển thành Background Job.

# QUY TẮC PHÁT TRIỂN COMPONENT (COMPONENT DEVELOPMENT RULES)
1. Nguyên tắc "Kiểm tra trước khi code" (Check Before Write):
   - TRƯỚC KHI tạo một UI Component mới (như Button, Modal, Input...), Agent PHẢI tìm kiếm trong thư mục `src/components/` xem đã có component tương tự chưa để tái sử dụng.
   - TRƯỚC KHI tạo một hàm tiện ích (Utility function), phải kiểm tra thư mục `src/lib/utils/`.
2. Giới hạn độ dài: Không một file UI (Page hoặc Component) nào được vượt quá 200 dòng code. Nếu quá dài, PHẢI tách thành các sub-components nhỏ hơn.
3. Nguyên tắc Dumb & Smart Components: 
   - UI Components (Dumb) chỉ nhận `props` và render.
   - Page Components (Smart) mới chịu trách nhiệm kết nối với Zustand Store hoặc Services.

# QUY TẮC ĐẶT TÊN (NAMING CONVENTIONS)
- Components và Pages: `PascalCase` (ví dụ: `ProductCard.tsx`, `CheckoutModal.tsx`).
- Hàm logic, Hooks, Utilities: `camelCase` (ví dụ: `useCartStore.ts`, `formatCurrency.ts`).
- Các hàm giao tiếp API/Firebase phải bắt đầu bằng động từ hành động: `fetch...`, `create...`, `update...`, `delete...`.
- Interfaces và Types: Đặt trong `src/lib/types/` bằng `PascalCase` (ví dụ: `interface OrderItem`).

# QUY TẮC UI & STYLING
- Dùng 100% Tailwind CSS cho styling. Tránh viết CSS thuần hoặc inline styles trừ khi xử lý animation đặc thù.
- Giao diện, log thông báo, placeholder bắt buộc dùng Tiếng Việt. Không dùng tiếng Anh cho UI.
- Số tiền phải được format theo chuẩn Việt Nam (ví dụ: 150,000 đ).

# QUY TẮC XỬ LÝ LỖI (ERROR HANDLING)
- Các thao tác gọi Database hoặc Cloud Functions BẮT BUỘC phải bọc trong khối `try...catch`.
- Bắt được lỗi phải in ra `console.error` (để dev theo dõi) và trả về một thông báo lỗi Tiếng Việt thân thiện cho người dùng trên UI (ví dụ: "Đã có lỗi xảy ra khi tạo đơn hàng").