# Giai đoạn 0 — Xác minh gói thành viên và bucket số dư

Ngày probe: 2026-08-03  
Phạm vi: chỉ đọc, không tạo đơn, không thanh toán và không thay đổi số dư.

## API đã gọi

- `setmeal_getsellgoods` — lấy gói theo category.
- `setmeal_passticket_details` — lấy cấu hình chi tiết từng gói.
- `order_precalculate` — xác nhận số tiền thanh toán của một gói.
- `basic_account_list` — map `shopAcctId` sang tài khoản stored value.
- `member_list` — lấy cấu trúc bucket số dư trên mẫu đã ẩn danh.
- `member_getmember_phone` — đối chiếu mã category với bucket trên cùng mẫu ẩn danh.

## Kết luận chính

1. Gói thành viên đang bán nằm ở `Category = 1` (13 gói tại thời điểm probe).
2. `Category = 2` và `Category = 6` đều trả danh sách rỗng.
3. `setmeal_getsellgoods` chỉ trả tên, `goodsId`, category và giá; không trả cấu hình điểm thưởng.
4. Phải gọi `setmeal_passticket_details` bằng `goodsId` để lấy `giveConfigs`.
5. Tiền khách thực trả phải lấy từ `order_precalculate.data.totalMoney`. Trên dữ liệu hiện tại, giá này bằng `afterTaxPrice`; trường `price` trong response chi tiết là giá trước thuế.
6. Công thức hiển thị của gói lấy từ response chi tiết: `amount` là giá trị gốc và tổng `giveConfigs[].giveAmount` là giá trị thưởng.
7. Tổng giá trị gói phải tính bằng `amount + sum(giveConfigs[].giveAmount)`; các trường top-level `givecoin1`, `nativecoin1`, `coinbal2` và `integral` hiện đều bằng `0`.

## Mapping bucket đã xác minh

| Ý nghĩa nghiệp vụ | Account `extendAttr` | Category từ tra cứu điện thoại | Field từ `member_list` |
| --- | ---: | ---: | --- |
| VND / số dư gốc | `1` | `101` | `nativeCoin1` |
| Tiền thưởng | `2` | `102` | `giveCoin1` |
| Tích phân | `5` | `105` | `integral` |
| Điểm/vé xổ số | `6` | `106` | `lottery` |

Trên mẫu ẩn danh, `nativeCoin1 = 693` khớp chính xác với `storedValues[{ category: 101, value: 693 }]`. Điều này xác nhận mapping `101 → nativeCoin1`. Tương tự, `102 → giveCoin1` theo metadata account và cấu trúc API.

Trong ngôn ngữ nghiệp vụ của POS, “điểm thành viên” nên được hiển thị như sau:

```text
Số dư VND       = category 101 / nativeCoin1
Tiền thưởng     = category 102 / giveCoin1
Tổng khả dụng   = số dư VND + tiền thưởng
```

Không dùng `integral`/category `105` làm số dư chính của chức năng thành viên hiện tại.

## Dữ liệu gói thật

| Gói | VND khách trả (API) | Thưởng tăng thêm (đối chiếu) | Tổng điểm `giveAmount` (API) | Bucket nhận (API) |
| --- | ---: | ---: | ---: | --- |
| Silver | 1.210.000 đ | 0 | 385 | Tiền thưởng |
| GSM: Silver +50 | 1.210.000 đ | +50 | 435 | Tiền thưởng |
| Silver x2 thưởng | 1.210.000 đ | +385 | 770 | Tiền thưởng |
| Gói Silver x2 ONLINE | 1.210.000 đ | +385 | 770 | Tiền thưởng |
| Gold | 2.035.000 đ | 0 | 1.210 | Tiền thưởng |
| GSM: Gold +100 | 2.035.000 đ | +100 | 1.310 | Tiền thưởng |
| Gold x2 thưởng | 2.035.000 đ | +1.210 | 2.420 | Tiền thưởng |
| Gói Gold x2 ONLINE | 2.035.000 đ | +1.210 | 2.420 | Tiền thưởng |
| Diamond | 4.070.000 đ | 0 | 3.267 | Tiền thưởng |
| GSM: Diamond +150 | 4.070.000 đ | +150 | 3.417 | Tiền thưởng |
| Diamond x2 thưởng | 4.070.000 đ | +3.267 | 6.534 | Tiền thưởng |
| Gói Diamond x2 ONLINE | 4.070.000 đ | +3.267 | 6.534 | Tiền thưởng |

Giá trị gốc và thưởng phải lấy trực tiếp từ `amount` và tổng `giveConfigs[].giveAmount`; không suy ra từ giá thanh toán hoặc tên gói.

`Gói sinh nhật 12 bé` cũng thuộc category 1 nhưng không có tổng `amount + sum(giveAmount)` dương, vì vậy không được coi là gói top-up thành viên trong giao diện.

## Quy tắc mapper cần triển khai

```ts
customerPaysVnd = precalculation.totalMoney;
principalPoints = detail.amount;
bonusPoints = sum(detail.giveConfigs.map(config => config.giveAmount));
totalPoints = principalPoints + bonusPoints;
creditedAccounts = detail.giveConfigs.map(config => ({
  accountId: config.shopAcctId,
  amount: config.giveAmount,
}));

configuredVndCredit = sum(config.giveAmount where account.extendAttr === 1);
configuredBonusCredit = sum(config.giveAmount where account.extendAttr === 2);
```

Số hiển thị gốc/thưởng trên catalog chỉ lấy từ `amount` và tổng `giveConfigs[].giveAmount`.

## Công cụ tái kiểm tra

Chạy probe chỉ đọc:

```powershell
node scripts/probe-member-phase0.mjs
```

Script không in App ID, secret, số điện thoại, tên, MID hoặc UID thành viên.
