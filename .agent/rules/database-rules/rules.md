---
trigger: always_on
---

# QUY TẮC NAMESPACE DATABASE DÙNG CHUNG

POS và `D:\Github\bduck-system` dùng chung một Firebase project và Firestore
database. Mọi thay đổi collection phải tuân thủ các quy tắc sau.

## 1. Quyền sở hữu tên collection

- Collection top-level do POS sở hữu BẮT BUỘC dùng `snake_case` và bắt đầu bằng
  tiền tố `pos_`, ví dụ: `pos_orders`, `pos_products`, `pos_shifts`.
- POS KHÔNG được tạo collection top-level mới không có tiền tố, và KHÔNG được
  tạo collection mang tên đang thuộc `bduck-system`.
- `bduck-system` là chủ sở hữu các collection không có tiền tố `pos_` hiện có,
  bao gồm `users`, `roles`, `user_warehouse_roles`, `warehouses`, `products`,
  `inventory`, `import_vouchers`, `export_vouchers` và các collection WMS khác.
- Không dùng tên chung chung như `orders`, `products`, `settings`, `logs`,
  `configs` cho dữ liệu riêng của POS. Phải dùng `pos_orders`, `pos_products`,
  `pos_settings`, `pos_logs`, `pos_configs`.

## 2. Collection dùng chung

- Collection dùng chung phải được khai báo rõ chủ sở hữu schema và quyền truy
  cập trước khi code. Không được coi hai collection trùng tên là tương thích nếu
  chưa đối chiếu field, kiểu dữ liệu và document ID.
- `users` thuộc `bduck-system`. POS chỉ được đọc collection này theo schema của
  `bduck-system`; POS không được tạo, cập nhật hoặc xóa document `users`.
- `roles`, `user_warehouse_roles` và `warehouses` thuộc `bduck-system`. Nếu POS
  cần RBAC hoặc thông tin điểm bán từ các collection này, phải dùng đúng schema
  dùng chung hoặc một lớp mapping được review riêng.
- `custom_roles` và `stores` là tên legacy từ hệ thống ERP cũ. Không tạo dữ liệu
  mới dưới các tên này trong database dùng chung. Cần map sang collection của
  `bduck-system` hoặc đổi thành collection `pos_*` bằng một migration có kiểm soát.

## 3. Ngoại lệ legacy hiện tại

- `pos_orders` đúng namespace và tiếp tục được sử dụng.
- `jpos_products` hiện không trùng tên với `bduck-system`, nhưng là ngoại lệ
  legacy. Không tạo thêm collection `jpos_*`. Khi đổi sang `pos_products`, phải
  có migration dữ liệu, cập nhật Cloud Functions, frontend, index và rules trong
  cùng một thay đổi; không được chỉ đổi string trong code.

## 4. Kiểm tra bắt buộc trước khi thêm collection

1. Tìm tên dự kiến trong cả hai repository, bao gồm source, Cloud Functions,
   `firestore.rules` và `firestore.indexes.json`.
2. Xác nhận tên bắt đầu bằng `pos_` nếu dữ liệu do POS sở hữu.
3. Xác nhận owner, schema, document ID, read/write access và chiến lược migration.
4. Dùng hằng số collection tập trung; không rải string literal mới trong
   component UI.
5. Cập nhật Firestore Security Rules và indexes của database dùng chung theo
   hướng hợp nhất. Không deploy riêng file `firestore.rules` của POS vì deploy sẽ
   thay thế ruleset hiện hành của toàn bộ Firebase project.

## 5. Bảo mật

- Không commit `.env.local`, service-account JSON, private key hoặc API secret.
- Frontend chỉ được dùng biến `NEXT_PUBLIC_*` không bí mật.
- Firestore Rules phải phân quyền theo Firebase Auth/RBAC. Tuyệt đối không thêm
  `allow read, write: if true` vào rules production của database dùng chung.
