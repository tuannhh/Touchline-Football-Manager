# Nguồn tuyển trạch quốc tế — 1.18.0

Gói `public/data/scouting-pool.json` chỉ ghép vào sự nghiệp mới. Các CLB bổ sung có thể bán/mua cầu thủ trong mô phỏng và xuất hiện ở Tuyển trạch, Chuyển nhượng, Câu lạc bộ. Chúng không tạo thêm giải có thể dẫn dắt, lịch giải hay suất UEFA. Các CLB UEFA đã có được giữ nguyên mã, giải và tư cách tham dự.

Màn hình New Game → **Nguồn cầu thủ quốc tế** công bố số CLB, cầu thủ, ảnh thật và ngày thu thập. Số liệu này tính trên gói nguồn, trước khi loại hồ sơ trùng với bản đội hình được chọn. Nguồn có mùa khác nhau theo lịch từng nước; không phải mọi hồ sơ đều được xác minh mới đến ngày thu thập.

Ngày 11/10/2026: 197 CLB, 6.536 hồ sơ, 5.940 ảnh thật (279 ảnh từ trang CLB). Sau loại trùng với database mặc định, thêm 6.279 cầu thủ; tổng thế giới mới là 22.719 cầu thủ.

## Nguồn chính thức

- Nigeria: [Enyimba](https://enyimbafc.net/) và [Enugu Rangers](https://www.rangersintl.com/about).
- Ghana: [Asante Kotoko](https://scasantekotoko.com/players). Danh sách hiện hành không chứa các tên trong [thông báo chia tay trước mùa 2026/27](https://scasantekotoko.com/news/kotoko-confirm-list-of-departing-players).
- Bờ biển Ngà: [ASEC Mimosas](https://www.asec.ci/). Lấy hồ sơ cầu thủ nam ở mục Équipe pro, không lấy đội nữ hay học viện.
- Đối chiếu ảnh theo tên trong cùng CLB: [Palmeiras](https://www.palmeiras.com.br/elenco/), [Boca Juniors](https://www.bocajuniors.com.ar/futbol-masculino), [Olympiacos](https://www.olympiacos.org/en/team/), [Galatasaray](https://www.galatasaray.org/pl/futbol-takim-kadrosu/9), [Al Hilal](https://alhilal.com/en/teams/mens-team), [Sydney FC](https://sydneyfc.com/squads/men/), [Inter Miami](https://www.intermiamicf.com/club/roster/), [Legia Warszawa](https://legia.com/), [Vissel Kobe](https://www.vissel-kobe.co.jp/profile/).

FotMob bổ sung đội hình rộng hơn cho các giải Série A, Liga Profesional, Super League, Ekstraklasa, Süper Lig, J1 League, K League 1, Saudi Pro League, MLS và A-League Men. Mỗi hồ sơ có URL và mã nguồn; số liệu giá trị chuyển nhượng là ước tính của nhà cung cấp. Năng lực, tiềm năng, danh tiếng/tài chính CLB và đàm phán vẫn là mô phỏng.

## Dữ liệu thiếu và kiểm tra

- Nigeria, Ghana và Bờ biển Ngà **chỉ có một phần CLB/cầu thủ**. Không sinh cầu thủ giả để lấp đội hình thiếu.
- Trang chính thức cũng có thể thiếu/cũ/sai trường dữ liệu: ví dụ tuổi dưới 15 không được dùng làm tuổi thực. Thông tin chưa có nguồn để trống; game ghi rõ nếu cần tuổi ước tính để mô phỏng. Không suy ra quốc tịch từ nước của CLB.
- Ảnh dùng từ thẻ/hồ sơ của chính cầu thủ. Chỉ ghép ảnh khi nhận diện tên trong cùng đội; không ghép từ tìm kiếm ảnh chung hoặc chỉ dựa vào số áo. Các tên chưa đối chiếu được dùng ảnh theo mã hồ sơ nhà cung cấp nếu có.
- Kiểm tra định dạng, kích thước, ảnh trống, mã băm placeholder và ảnh lặp cho những người khác nhau; thiếu hoặc lỗi tải thì hiển thị trống. Không tạo mặt AI.
- Hồ sơ trùng được đối chiếu mã nhà cung cấp hoặc tên chuẩn hóa + ngày sinh. Nếu trùng bộ đội hình đã chọn, giữ cầu thủ và CLB gốc; chỉ có thể nâng ảnh thật có nguồn tốt hơn khi danh tính phù hợp. Nhật ký nằm trong `dbMeta.scoutingPool.conflicts` của sự nghiệp mới.
- Đội chưa có đủ nguồn không được xem là đội hình đầy đủ. Gói không mô phỏng thành tích thi đấu của các giải nguồn; các cầu thủ đó chỉ có thành tích do thế giới game thực sự tạo ra.

## Cập nhật và tái tạo

Chạy `npm run data:scouting` (Python với beautifulsoup4, certifi và Pillow), sau đó `npm run build`. Bộ nhập đọc trang CLB trước, bổ sung FotMob, đối chiếu các trang ảnh chính thức, tải ảnh cục bộ và xuất báo cáo. Không ghi vào `database.json`, các bản phát hành đội hình hoặc file save. Phản hồi nguồn được cache để có thể chạy lại; lỗi nằm trong `meta.errors`. Kiểm tra báo cáo trước khi phát hành dữ liệu mới.

Ảnh thuộc các chủ sở hữu tương ứng. Lưu ảnh cục bộ không cấp thêm quyền khai thác hoặc phân phối thương mại.
