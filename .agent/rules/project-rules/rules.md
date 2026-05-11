---
trigger: always_on
---

# THÔNG TIN DỰ ÁN (PROJECT OVERVIEW)
- Dự án: Hệ thống JPOS (Joy World Point of Sale) "Local-First".
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
2. Giữ code đơn giản (KISS & YAGNI) - TUYỆT ĐỐI KHÔNG OVER-ENGINEERING:
   - Viết code đi thẳng vào vấn đề, dễ đọc, dễ bảo trì. 
   - Không lạm dụng Design Pattern, Generics Types hay Abstraction Layers một cách không cần thiết.
   - Chỉ giải quyết bài toán hiện tại, không viết code dự phòng cho những tính năng "có thể xảy ra trong tương lai".
3. Giới hạn độ dài: Không một file UI (Page hoặc Component) nào được vượt quá 200 dòng code. Nếu quá dài, PHẢI tách thành các sub-components nhỏ hơn.
4. Nguyên tắc Dumb & Smart Components: 
   - UI Components (Dumb) chỉ nhận `props` và render.
   - Page Components (Smart) mới chịu trách nhiệm kết nối với Zustand Store hoặc Services.

# QUY TẮC ĐẶT TÊN (NAMING CONVENTIONS)
- Components và Pages: `PascalCase` (ví dụ: `ProductCard.tsx`, `CheckoutModal.tsx`).
- Hàm logic, Hooks, Utilities: `camelCase` (ví dụ: `useCartStore.ts`, `formatCurrency.ts`).
- Các hàm giao tiếp API/Firebase phải bắt đầu bằng động từ hành động: `fetch...`, `create...`, `update...`, `delete...`.
- Interfaces và Types: Đặt trong `src/lib/types/` bằng `PascalCase` (ví dụ: `interface OrderItem`).

# QUY TẮC UI & STYLING
1. Tận dụng Context/Skills: TRƯỚC KHI thiết kế hoặc chỉnh sửa bất kỳ UI nào, BẮT BUỘC phải đọc và tuân thủ các nguyên tắc từ `@frontend-expert` và `@brand-guidelines`.
2. Styling: Dùng 100% Tailwind CSS cho styling. Tránh viết CSS thuần hoặc inline styles trừ khi xử lý animation đặc thù.
3. Bản địa hóa (Localization): Giao diện, log thông báo, placeholder bắt buộc dùng Tiếng Việt. Không dùng tiếng Anh cho UI.
4. Format: Số tiền phải được định dạng theo chuẩn Việt Nam (ví dụ: 150,000 đ).

# QUY TẮC TƯƠNG TÁC, XỬ LÝ LỖI & THÔNG BÁO (INTERACTION, ERROR HANDLING & NOTIFICATION)
1. Phản hồi trực quan bắt buộc (Mandatory Visual Feedback):
   - MỌI thao tác thay đổi dữ liệu (Thêm món, Thanh toán, Lưu thiết lập...) BẮT BUỘC phải đi kèm hiệu ứng thay đổi trạng thái (ví dụ: `disabled` nút bấm, hiển thị `loading spinner` trong lúc chờ) để thu ngân biết hệ thống đang xử lý.
   - Luôn có hiệu ứng kết thúc (transition/animation) rõ ràng khi hoàn thành một tiến trình.
2. Hệ thống Toast thông báo (Gooey Toast):
   - BẮT BUỘC sử dụng thư viện `goey-toast` để thông báo kết quả cuối cùng cho người dùng (Thành công, Thất bại, hoặc Cảnh báo).
   - Đảm bảo Root Layout hoặc Provider đã bọc `<GooeyToaster position="top-right" />`.
   - **Cú pháp chuẩn cho thao tác cơ bản:**
     ```typescript
     gooeyToast.success('Đã lưu thay đổi', {
       description: 'Các thay đổi của bạn đã được lưu và đồng bộ thành công.',
       preset: 'snappy',
       timing: { displayDuration: 6000 },
     })
     ```
   - **Cú pháp chuẩn cho thao tác bất đồng bộ (API/Database):** Ưu tiên sử dụng `gooeyToast.promise` để gom chung trạng thái loading và kết quả. BẮT BUỘC cung cấp đầy đủ Title, Description (cho cả success/error) và action Retry nếu lỗi:
     ```typescript
     gooeyToast.promise(saveDataAction(), {
       loading: 'Đang xử lý...',
       success: 'Thành công',
       error: 'Đã xảy ra lỗi',
       description: {
         success: 'Thao tác của bạn đã được hoàn tất.',
         error: 'Vui lòng thử lại hoặc kiểm tra kết nối mạng.',
       },
       action: {
         error: {
           label: 'Thử lại',
           onClick: () => retryAction(),
         },
       },
     })
     ```
3. Xử lý lỗi (Error Handling):
   - Các thao tác gọi Database, Cloud Functions hoặc API BẮT BUỘC phải bọc trong khối `try...catch`.
   - Bắt được lỗi phải in ra `console.error` (để dev theo dõi) và gọi `gooeyToast.error(...)` (hoặc thông qua `.promise()`) để hiển thị một thông báo lỗi Tiếng Việt thân thiện cho người dùng trên UI (ví dụ: "Đã có lỗi xảy ra khi tạo đơn hàng").

# QUY TẮC MONOREPO & TAURI
- Tuyệt đối tuân thủ ranh giới Monorepo (Không import chéo giữa `src/` và `functions/`).
- Frontend trong Next.js không được dùng Native Node.js Modules (`fs`, `path`) vì môi trường Tauri build bằng Static Export.

# QUY TẮC QUY TRÌNH LÀM VIỆC (WORKFLOW & COMMUNICATION RULES)
1. Bắt buộc làm rõ yêu cầu (Zero Ambiguity): Khi nhận một yêu cầu mới, Agent PHẢI sử dụng skill `@brainstorm` để phân tích. Đặt câu hỏi ngược lại cho người dùng liên tục cho đến khi mọi khía cạnh (Logic, UI/UX, Edge cases) đều rõ ràng 100% thì mới được bước sang khâu lập kế hoạch.
2. Lập kế hoạch trước khi Code (Plan Before Execution): TRƯỚC KHI viết bất kỳ dòng code nào, Agent PHẢI xuất ra một Danh sách Task (Task List) và Kế hoạch triển khai (Implementation Plan) chi tiết.
3. Cập nhật tiến độ (Track Progress): Trong suốt quá trình code, Agent phải liên tục cập nhật trạng thái của Task List (đánh dấu [x] các task đã hoàn thành).
4. Phân tích tư duy (Walkthrough/Thought Process): Bất cứ khi nào hoàn thành một module hoặc một file code quan trọng, Agent phải cung cấp một đoạn giải thích ngắn gọn về luồng tư duy (throughout) và lý do tại sao lại code như vậy để dev dễ dàng review.

# API TỪ HỆ THỐNG QUẢN LÝ CHÍNH
- Mọi API sẽ được lấy từ hệ thống chính và có mô tả trong tài liệu API (tài liệu tên là OpenApi.md). Nếu trong tài liệu không có API để đáp ứng yêu cầu, cần báo ngay lập tức và không thực hiện thêm.