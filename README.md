# Auth Proxy - Quick Proxy Switcher

Extension quản lý Proxy mạnh mẽ cho trình duyệt, giúp bạn kết nối proxy nhanh chóng và chống phát hiện (Anti-detect) hiệu quả.

## Tính năng chính
- **Quản lý danh sách Proxy**: Hỗ trợ HTTP/HTTPS proxy kèm xác thực (User/Pass). Dễ dàng thêm, sửa, xóa và chọn proxy mong muốn cực nhanh.
- **Bật/Tắt tiện lợi**: Chuyển đổi proxy on/off chỉ với 1 thao tác duy nhất.
- **"Màng lưới tàng hình" WebRTC**: Ép WebRTC đi qua Proxy hoặc vô hiệu hóa, ngăn chặn 100% việc rò rỉ IP thực qua khe hở WebRTC. Mặc định luôn bật.
- **Antidetect Múi giờ & Ngôn ngữ**: Tự động đồng bộ timezone và language của trình duyệt theo chính xác IP quốc gia của Proxy đang dùng. Thích hợp để "ngâm" hoặc nuôi tài khoản tránh bị quét.
- **Mô phỏng Vị trí GPS & Độ cao**: Fake tọa độ (Latitude, Longitude) cũng như Altitude theo vị trí của Proxy.
- **Danh sách Whitelist**: Lựa chọn cụ thể chỉ áp dụng Proxy cho các trang web nhất định (ví dụ: spotify.com, netflix.com), các trang web khác vẫn sử dụng mạng thực. Có nút tiện lợi để "Load Rule" nhanh chóng.
- **Tình trạng mạng**: Check Ping liên tục và xem nhanh IP / Cờ Quốc gia mà Proxy đang kết nối.

## Cài đặt (Dành cho Developer Mode)
1. Tải toàn bộ source code về máy tính bằng Git hoặc tải dưới dạng file ZIP.
2. Mở trình duyệt Chrome/Edge/Brave và truy cập: `chrome://extensions/`
3. Bật **Developer mode** (Chế độ dành cho nhà phát triển - thường nằm ở góc trên bên phải).
4. Nhấn **Load unpacked** (Tải tiện ích đã giải nén) và chọn vào thư mục chứa source code của Extension này (Thư mục `Auth_Proxy`).
5. Ghim (Pin) Extension lên thanh công cụ (Toolbar) để sử dụng thuận tiện.
6. Mở lên, nhập proxy của bạn (định dạng `ip:port:user:pass` hoặc `ip:port`) và tận hưởng!

## Định dạng thêm Proxy
Mỗi một dòng tương ứng với 1 proxy, bạn có thể thêm cực nhanh và copy proxy qua lại dễ dàng ở phần Custom Context Menu (trượt/nhấn phải chuột vào proxy).

## Cập nhật phiên bản (v1.3.0)
- Bổ sung tuỳ chọn mô phỏng Toạ độ GPS, Altitude.
- Cải thiện độ ổn định khi thay đổi proxy theo Whitelist.
- Tinh chỉnh giao diện hiển thị.

## Tác giả
- Phát triển bởi **Nguyễn Ngọc Huy**.
