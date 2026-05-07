# 🔍 Phân tích API Sync Products — Kết quả

## Vấn đề gốc

Action `setmeal_getsellgoods` trả về lỗi:
> "Không tìm thấy thông tin API, hãy kiểm tra xem thông tin hành động và phiên bản có chính xác không"

## Nguyên nhân

Sau khi kiểm tra kỹ tài liệu [OpenApi.md](file:///d:/Github/POS/OpenApi.md), phát hiện:

| API Action | Trạng thái trong tài liệu | Hoạt động? |
|---|---|---|
| `setmeal_getsellgoods` | ⚠️ **In Progress** (dòng 12773) | ❌ Server HK chưa deploy |
| `oversea_subscribe_base_list` | ⚠️ **In Progress** (dòng 18250) | ⚠️ Trả response nhưng data rỗng |
| `oversea_goodsmanage_list` | ⚠️ **In Progress** (dòng 19651) | ❌ Chưa xác nhận |
| `setmeal_passticket_list` | ⚠️ **In Progress** (dòng 16809) | ❌ Chưa xác nhận |

> [!CAUTION]
> **Tất cả API liên quan đến lấy danh sách sản phẩm/套餐 đều có status `In Progress`** — nghĩa là phía đội HK (鲸舰) chưa deploy các API này lên server production. Đây KHÔNG phải lỗi code của POS.

## Các API đã `Completed` (đang hoạt động)

Các API `Completed` trong tài liệu chủ yếu thuộc nhóm:
- **Hội viên** (member_*): `member_join`, `member_addstored`, `member_reducestored`, `member_qrcode`, ...
- **Đơn hàng** (order_*): `order_create`, `order_pay`, `order_pay_query`, `order_precalculate`
- **Thiết bị** (device_*): `device_machine_list`, `device_scan_login`, ...
- **Quà tặng** (gift_*): `gift_realtime_stock`, `gift_type`
- **Báo cáo** (report_*): `report_revenue_summary`, `report_sell_statistics_bygoodstype`, ...

> [!IMPORTANT]
> Hiện tại **KHÔNG CÓ API `Completed` nào để lấy danh sách sản phẩm/套餐 bán hàng**. 
> Cần liên hệ đội HK API để:
> 1. Hoàn thành và deploy `setmeal_getsellgoods` (hoặc)
> 2. Hoàn thành `setmeal_passticket_list` (API này có response data chi tiết nhất)

## Giải pháp tạm thời

Trong lúc chờ API được deploy, có thể:
1. **Import sản phẩm thủ công** — Tạo script để nhập dữ liệu trực tiếp vào Firestore `jpos_products`
2. **Dùng mock data** — Bật mock mode trong Cloud Functions (xóa `HK_API_BASE_URL` trong `.env`)
3. **Dùng `setmeal_passticket_list`** — Thử gọi xem server đã deploy chưa (response schema rất chi tiết, có vẻ gần hoàn thành)
