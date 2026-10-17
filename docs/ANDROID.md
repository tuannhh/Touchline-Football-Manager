# Touchline cho Android

Bản 1.19.1 có APK độc lập, đóng gói dữ liệu và ảnh cầu thủ thật trong ứng dụng. Không cần máy tính chạy server, tài khoản, Steam hoặc kết nối Internet để chơi. Các liên kết nguồn bên ngoài vẫn cần Internet. Không tạo thêm khuôn mặt AI.

## Cài đặt trên Samsung S20 FE

1. Chuyển `Touchline-1.19.1-android.apk` vào điện thoại (USB, Quick Share hoặc dịch vụ lưu trữ của bạn).
2. Mở APK bằng My Files/Tệp của bạn. Cho phép ứng dụng đó cài đặt ứng dụng không rõ nguồn gốc khi Android yêu cầu, rồi chọn Cài đặt.
3. Mở **Touchline**, chọn **Trò chơi mới** hoặc nhập file sự nghiệp `.json` đã xuất từ máy tính.

APK khoảng 532 MiB vì chứa toàn bộ ảnh và database; nên còn ít nhất 1,5 GB dung lượng trống để cài đặt và lưu sự nghiệp. Hỗ trợ Android 7 trở lên về cấu hình build; mục tiêu kiểm tra là Android 13 của dòng S20 FE. Cần Android System WebView 100 trở lên; nên cập nhật WebView/Chrome trước khi cài. Chưa kiểm thử trên S20 FE vật lý, nên chưa cam kết tốc độ khung hình hoặc mức dùng pin trên máy thực.

Giao diện có thanh điều hướng dưới, menu thu gọn, nút chạm tối thiểu 44 px, bố cục dọc/ngang và khoảng trống cho thanh hệ thống. Trong chiến thuật, chạm áo cầu thủ hoặc mở **Đổi người bằng danh sách**, chọn người thay thế rồi **Xác nhận**. Cũng có thể chạm tên cầu thủ dự bị để chọn vị trí vào sân. Bảng chọn tự lọc người đủ điều kiện; các giới hạn thay người vẫn được áp dụng. **Hủy** hoặc nút Back đóng bảng chọn mà không đổi đội hình. Dùng được trước và trong trận; không cần giữ hoặc kéo thả. Các thanh trượt phản hồi tại chỗ và chỉ áp dụng khi thả tay, kèm nút −/+ để chỉnh từng nấc. Các bảng nhiều cột cuộn ngang. Trận đấu dùng chế độ 2D, mặc định hiện số áo cho thoáng sân; bật **Tên cầu thủ** khi muốn xem nhãn tên.

## Lưu và chuyển sự nghiệp

- Bản lưu được nén trong bộ nhớ riêng của ứng dụng; tự lưu chạy ở worker. Trong trận, chỉ phần trận đấu thay đổi được ghi lại, tránh nén toàn bộ thế giới mỗi lần tự lưu.
- Vào **Thêm → Lưu & dữ liệu → Xuất file sự nghiệp** để chia sẻ file JSON qua trình chia sẻ Android. **Nhập file lưu** mở trình chọn tệp Android. Máy tính và điện thoại dùng cùng định dạng file; không tự đồng bộ hai thiết bị.
- Có thể tạo nhiều bản lưu, đổi tên và xóa trong **Saved Games**. Mỗi bản giữ thêm bản sao dự phòng gần nhất.
- Gỡ ứng dụng hoặc xóa dữ liệu ứng dụng sẽ xóa các sự nghiệp trên điện thoại. Xuất file trước khi làm việc đó. Cài bản cập nhật có cùng chữ ký lên ứng dụng hiện tại sẽ giữ dữ liệu.
- Database ngoài đời mới đi kèm APK cập nhật và chỉ áp dụng khi tạo New Game. Bản Android không tự chạy chương trình thu thập dữ liệu của máy tính.

## Build từ mã nguồn

Yêu cầu Node.js 22+, JDK 21, Android SDK Platform 36, Build Tools 36.0.0 và kết nối Internet cho lần tải dependencies đầu tiên.

```sh
npm ci
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
npm run build:android
```

Script tạo web bundle offline trong `dist-mobile`, đồng bộ Capacitor và build APK release đã ký tại `artifacts/Touchline-1.19.1-android.apk`. Có file SHA-256 kèm theo. `npm run build` vẫn tạo bản web dành cho server desktop như trước.

Lần đầu, script tạo khóa ký riêng trong `.android-signing/`. **Sao lưu an toàn cả thư mục này để ký các bản cập nhật sau. Không đưa khóa hoặc mật khẩu lên GitHub.** Mỗi người tự build bằng khóa khác sẽ không thể cài đè lên APK của người khác; phải xuất save trước nếu cần đổi sang bản có chữ ký khác.

Kiểm thử tự động bộ nhớ:

```sh
node --test tests/mobile-storage.test.mjs tests/save-worker.test.mjs tests/saveSlots.test.mjs
```

Kiểm thử trên thiết bị/emulator đã kết nối qua adb, sau khi chạy `npm run build:android:web`:

```sh
android/gradlew -p android :app:connectedDebugAndroidTest
```

Bài kiểm thử tạo sự nghiệp QA mới trên thiết bị kiểm thử, kiểm tra tìm kiếm, hồ sơ, cử chỉ kéo/hủy thanh trượt (không lưu trong lúc giữ), nút −/+, chạm chọn/hủy/xác nhận đổi người trước và trong trận, xoay màn hình, lưu/tải lại và trận đấu. Không chạy trên dữ liệu sử dụng hằng ngày. Bản release tắt WebView debugging; không đính kèm server, khóa ký, bản lưu cá nhân hoặc công cụ build.
