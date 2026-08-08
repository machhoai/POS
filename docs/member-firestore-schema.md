# Firestore schema — thành viên POS

## Quyền sở hữu và namespace

- Collection: `pos_members`
- Chủ sở hữu schema: POS
- Document ID: `remoteUid` do OpenAPI trả về
- Phiên bản schema hiện tại: `1`
- Truy cập: backend-only qua Cloud Functions Admin SDK

Frontend không đọc hoặc ghi trực tiếp collection này. Tra cứu thành viên bằng
điện thoại hoặc mã thẻ luôn gọi OpenAPI; dữ liệu local chỉ bổ sung ngày sinh,
email và metadata đồng bộ.

## Fields

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `schemaVersion` | `1` | Phiên bản schema bắt buộc |
| `remoteUid` | `string` | Phải trùng document ID |
| `mid` | `string \| null` | Member ID từ OpenAPI nếu có |
| `memberCode` | `string \| null` | Chỉ lưu khi OpenAPI đã xác nhận |
| `phone` | `string` | Số điện thoại đã chuẩn hóa |
| `fullName` | `string` | Họ tên thành viên |
| `gender` | `MALE \| FEMALE \| OTHER \| UNKNOWN` | Giá trị chuẩn hóa |
| `birthDate` | `string \| null` | `YYYY-MM-DD` |
| `email` | `string \| null` | Email chữ thường |
| `shopId` | `number` | Cửa hàng OpenAPI |
| `warehouseId` | `string` | Điểm bán mà nhân viên được phân quyền |
| `createdBy` | `string` | Firebase UID người tạo |
| `updatedBy` | `string` | Firebase UID người cập nhật cuối |
| `createdAt` | `string` | ISO-8601, được bảo toàn khi cập nhật |
| `updatedAt` | `string` | ISO-8601 |
| `lastRemoteSyncAt` | `string` | Lần OpenAPI xác nhận thành công gần nhất |

## Indexes

Repository hiện chỉ đọc theo document ID nên không cần composite index. Các
field PII không được dùng để query local đã tắt single-field index trong
`firestore.indexes.json`: `remoteUid`, `mid`, `memberCode`, `phone`, `fullName`,
`birthDate`, `email`, `createdBy`, `updatedBy`.

`shopId`, `warehouseId`, `updatedAt` và `schemaVersion` giữ index mặc định để có
thể phục vụ tác vụ quản trị/reconciliation có phân vùng trong tương lai mà không
lập chỉ mục trực tiếp trên PII.

## Security Rules

`pos_members` có `allow read, write: if false`. Cloud Functions Admin SDK không
bị Security Rules chặn và là đường truy cập duy nhất.

POS và `bduck-system` dùng chung Firebase project. Không deploy riêng
`firestore.rules` hoặc `firestore.indexes.json` từ repository POS. Trước khi
deploy, phải merge block `pos_members` và các field override vào rules/indexes
chính thức của database dùng chung rồi review toàn bộ diff.

