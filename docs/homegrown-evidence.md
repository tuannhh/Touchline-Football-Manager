# Hồ sơ home-grown — 1.16.0

Đối chiếu ngày 05/10/2026. Dữ liệu không phải cơ sở đăng ký chính thức đầy đủ của các liên đoàn.

## Cách sử dụng

New Game dùng hồ sơ home-grown đang cài, kể cả khi chọn một snapshot đội hình cũ. Ghép theo ID, tên và ngày sinh; không thay đội bóng hay chỉ số của snapshot. Thông tin UEFA chỉ áp dụng đúng CLB và mùa nguồn. Bằng chứng trực tiếp List B chỉ bắt đầu hiệu lực từ ngày quan sát nguồn, còn trước đó dùng lịch sử đào tạo.

Với save đang chơi: **Đăng ký đội hình → Cập nhật hồ sơ home-grown**. Chỉ cập nhật bằng chứng, không sửa ngày chơi, chuyển nhượng, năng lực, đăng ký đã lưu hoặc ghi đè xác nhận thủ công trong Editor. Sau đó chọn giải, rà **Xem bằng chứng**, chọn **Tham khảo List A của UEFA** hoặc **Tự chọn danh sách hợp lệ**, rồi **Lưu đăng ký**. Tham khảo UEFA chỉ đổi bản nháp; danh sách vẫn phải qua kiểm tra hạn mức.

Có thể đặt cầu thủ đủ List B vào List A. Khi đó cầu thủ chiếm một suất A, được xét CT/AT và thủ môn trong A, và không bị tính hai lần. Cầu thủ đủ List B không được chọn vào A vẫn có quyền List B. Miễn danh sách theo tuổi ở giải trong nước không bị thay đổi.

## Phạm vi và nguồn

- 36 trang đội hình Champions League 2026/27, 1.270 tên nguồn: 901 tên ghép với database, trong đó 114 List B; 369 tên chưa có hoặc không ghép chắc chắn. Chỉ lưu các dữ kiện tên, ID, A/B, URL, mùa, ngày quan sát trong [bản ghi nguồn](data/uefa-squads-2026-10-05.json). Dấu `*` của UEFA là List B; không phải home-grown.
- 4.462 hồ sơ FotMob có tên/ngày sinh/ID khớp, cho 15.163 khoảng lịch sử phù hợp tuổi đào tạo; thêm tiểu sử CLB và nguồn đối chiếu thủ công, tổng cộng 4.474 cầu thủ có lịch sử. Đây là số hồ sơ có bằng chứng, **không phải 4.474 cầu thủ chắc chắn đạt home-grown**.
- 499 cờ Premier League được giữ riêng, chỉ dùng cho điều kiện trong nước phù hợp. Không chuyển thành cờ UEFA.
- Biểu diễn trong game: **CLB** = CT; **Trong nước** = AT; **Không đạt** chỉ khi có hồ sơ xác nhận âm phù hợp hoặc toàn bộ cửa sổ tuổi đào tạo được chứng minh ở liên đoàn khác; còn lại **Chưa xác minh**. Chưa xác minh vẫn có thể đăng ký ở suất thường.

Nguồn chính: [UEFA Article 31](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-31-Player-lists-Online), [Arsenal squad](https://www.uefa.com/uefachampionsleague/clubs/52280--arsenal/squad/), [danh sách CLB UEFA](https://www.uefa.com/uefachampionsleague/clubs/), các hồ sơ FotMob và URL cụ thể trong từng khoảng. [Các tiểu sử bổ sung](data/homegrown-reviewed-periods.json) ghi rõ nguồn CLB/liên đoàn hoặc nguồn thứ cấp. Hồ sơ James McConnell đối chiếu thêm [phỏng vấn Liverpool 24/11/2023](https://www.liverpoolfc.com/news/meet-academy-james-mcconnell-pl-debut-klopp-hugs-and-playing-no6).

## Cách tính và giới hạn

UEFA yêu cầu tối đa 25 List A, dành tám suất đào tạo, trong đó tối đa bốn suất chỉ là AT. Thiếu người đào tạo giảm quy mô. Game tính 36 tháng trong khung 15–21 và chấp nhận ba mùa trọn vẹn khi có ngày đầu/cuối giải được xác minh; không tự biến ba nhãn năm thành ba mùa đủ điều kiện. Ngày kết thúc theo nhà cung cấp được tính bao gồm ngày đó. Các khoảng chồng lấn được hợp nhất, không đếm hai lần. Khoảng cho mượn cắt khỏi lịch sử CLB chủ quản, kể cả khi chưa xác định được liên đoàn của đội mượn.

Lịch sử nhà cung cấp không phải sổ đăng ký liên đoàn, có thể thiếu học viện, ghi ngày xấp xỉ hoặc có khoảng trống. Ghép CLB theo ID/tên chính xác; đội trẻ/dự bị có tên CLB mẹ rõ ràng được quy về CLB mẹ. Không ghép mờ theo tên gần giống. Những hồ sơ cần ngoại lệ mùa sinh nhật nhưng thiếu lịch giải, ngoại lệ List B ba năm với một đợt cho mượn, hoặc chứng từ đăng ký riêng vẫn cần đối chiếu thủ công. Hai thủ môn List A được kiểm tra bắt buộc; thiếu ba thủ môn tổng A+B hiện cảnh báo do database có thể thiếu thủ môn trẻ.

Danh sách UEFA chỉ xác nhận việc có tên ở A/B. Vì vậy một số CLB vẫn chưa thể sao nguyên List A ngoài đời khi dữ liệu đào tạo còn thiếu hoặc đội hình trong save đã khác. Hệ thống không gán bừa CT/AT để làm danh sách hợp lệ. Số lượng nguồn và trường hợp chưa xác minh được giữ để tiếp tục bổ sung.

Mốc cache được lưu theo từng khoảng; không cộng thời gian ngoài đời chưa quan sát hoặc giả định mọi hồ sơ vừa được tải mới. Lịch sử sau tuổi đào tạo không được nhập hàng loạt. Save tự chứa bằng chứng đã nhập, mở lại không cần Internet. Nguồn liên kết cần Internet.

## Cập nhật dữ liệu

`npm run data:homegrown -- --as-of YYYY-MM-DD` nhập lại quan sát UEFA đã rà và lịch sử từ cache FotMob đã có. Đây là nhập dữ liệu, không tự duyệt lại Internet; cần thu thập và rà bản quan sát mới trước khi phát hành. Không thay save hoặc snapshot đội hình đã đóng băng. `scripts/refresh-homegrown.py` giữ các nguồn UEFA/lịch sử độc lập khi làm mới cờ PL.

Bộ kiểm thử kiểm tra danh tính, nguồn, cho mượn chưa khớp CLB, 36 tháng, A/B và tuổi/ngày/mùa/CLB, đăng ký thực tế Arsenal/Barcelona/Liverpool, hạn mức và bảo toàn save. Các trường hợp ngoài phạm vi nguồn được giữ chưa xác minh để tránh tạo hồ sơ sai.
