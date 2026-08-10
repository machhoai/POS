# Tích hợp đầu đọc thẻ Decard D3-U

## Thiết bị đã nhận diện

- Model trên nhãn: Decard D3, nguồn 5V.
- Windows nhận thiết bị tại `VID_0471&PID_A112`.
- Giao diện USB là HID riêng của hãng (`usage page FFA0`, `usage A2`), không phải
  bàn phím giả lập và không tạo cổng COM.

## Luồng POS

1. Người dùng chọn **Mã thẻ** trên màn hình Thành viên.
2. JPOS gọi command native `read_member_card` và khởi chạy bridge x86 ẩn.
3. Bridge nạp SDK 32-bit, mở USB logic số `100` bằng `dc_init`, chờ thẻ qua
   `dc_card`, sau đó luôn đóng thiết bị bằng `dc_exit`.
4. Serial thẻ dạng số thập phân được gửi tới OpenAPI action
   `member_getmember_serialnumber`.
5. Khi có kết quả, POS tự động tra cứu; người dùng không cần bấm nút lần nữa.

Người dùng vẫn có thể nhập mã thẻ thủ công. Trường hợp này POS tiếp tục dùng
`member_getmember_membercode`, nên hai loại định danh không bị nhầm lẫn.

## Đóng gói SDK Decard

Gói hardware chính thức đang cung cấp `dcrf32.dll` 32-bit, trong khi JPOS/Tauri
chạy 64-bit. Vì Windows không cho tiến trình 64-bit nạp DLL 32-bit trực tiếp,
dự án dùng tiến trình bridge 32-bit độc lập:

```text
JPOS 64-bit -> card-reader-bridge.exe 32-bit -> dcrf32.dll 32-bit -> D3-U USB
```

Hai tệp runtime nằm trong `src-tauri/resources/card-reader` và được cấu hình là
Tauri resource. Script `scripts/build-card-reader-sidecar.ps1` tự cài Rust target
`i686-pc-windows-msvc` nếu thiếu, build bridge và chép kết quả vào thư mục
resource. `beforeBuildCommand` gọi script này trước mỗi lần đóng gói ứng dụng,
vì vậy máy POS chỉ cần chạy bộ cài JPOS, không cần cài Jingjian riêng.

Khi phát triển có thể đặt `POS_CARD_READER_DLL` hoặc
`POS_CARD_READER_BRIDGE` để trỏ tới tệp thử nghiệm ở vị trí khác. Giao diện báo
riêng các lỗi thiếu runtime, không tìm thấy thiết bị, hết thời gian chờ, hủy đọc
và yêu cầu đang bận.

Thông tin nguồn và checksum của binary bên thứ ba được lưu trong
`src-tauri/resources/card-reader/THIRD_PARTY.md`.
