# Phát hành cập nhật JPOS

JPOS dùng Tauri Updater v2 và GitHub Releases. Bản `0.1.12` là bản bootstrap đầu tiên có khả năng tự cập nhật.

## Khóa ký

Khóa hiện tại được tạo ở máy phát triển:

- Private key: `C:\Users\machh\.tauri\jpos.key`
- Public key: `C:\Users\machh\.tauri\jpos.key.pub`

Private key không được đưa vào Git. Hãy sao lưu khóa này vào kho bí mật an toàn. Nếu mất khóa, các bản JPOS đã cài sẽ không chấp nhận những bản cập nhật mới.

Trong GitHub repository `machhoai/POS`, tạo Actions secret:

- `TAURI_SIGNING_PRIVATE_KEY`: toàn bộ nội dung của file private key.

Khóa hiện tại không có mật khẩu; workflow đã truyền giá trị rỗng một cách tường minh để quá trình ký không mở prompt tương tác.

## Phát hành một phiên bản

1. Tăng `version` trong `package.json`, ví dụ từ `0.1.12` lên `0.1.13`.
2. Đồng bộ `version` trong `src-tauri/Cargo.toml`.
3. Commit và push thay đổi.
4. Chạy workflow **Release JPOS Desktop** trong GitHub Actions, hoặc tạo và push tag `jpos-v0.1.13`.
5. Kiểm tra GitHub Release có `latest.json`, installer NSIS và file `.sig`.

Không phát hành lại cùng một version. Tauri chỉ đề xuất bản có SemVer cao hơn bản đang chạy.

## Luồng trong ứng dụng

- JPOS kiểm tra cập nhật sau 5 giây khi cửa sổ chính khởi động.
- Nếu có bản mới, app hiển thị thông báo nhưng không tự cài.
- Người dùng có thể kiểm tra thủ công tại **Cài đặt → Hệ thống**.
- App chặn cài đặt nếu đang xử lý thanh toán.
- Tauri tải installer, xác minh chữ ký, đóng ứng dụng trên Windows, cài bản mới và khởi động lại.
