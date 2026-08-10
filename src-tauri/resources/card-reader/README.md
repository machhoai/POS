# Decard D3-U runtime

Thư mục này được đóng gói cùng ứng dụng Windows và chứa:

- `dcrf32.dll`: SDK Decard 32-bit lấy từ gói hardware 11.7.5 của Jingjian.
- `card-reader-bridge.exe`: tiến trình 32-bit do dự án build để gọi SDK từ JPOS 64-bit.

Không cần cài Jingjian hoặc chép DLL thủ công trên máy POS. Lệnh
`pnpm card-reader:build` build lại bridge; lệnh này cũng tự chạy trước
`tauri build`.

Khi phát triển có thể dùng `POS_CARD_READER_DLL` và
`POS_CARD_READER_BRIDGE` để thử các tệp ở đường dẫn tuyệt đối khác.
