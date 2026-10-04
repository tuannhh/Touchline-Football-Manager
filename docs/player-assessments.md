# Năng lực, ảnh hưởng và giá trị cầu thủ

Bản 1.14.0 tách dữ liệu ngoài đời dùng để **khởi tạo New Game** khỏi diễn biến của sự nghiệp đang chơi. Mọi điểm kỹ năng và tiềm năng đều là ước tính của Touchline. Không có nguồn công khai nào đo chính xác một cầu thủ bằng một con số 1–100.

## Bộ dữ liệu khởi điểm

- Dùng ID ổn định và ngày sinh khi đối chiếu hồ sơ, tránh nhầm cầu thủ trùng tên. Hồ sơ thiếu nguồn được ghi độ tin cậy thấp.
- Định giá FotMob/SciSports là ước tính thị trường, không phải giá CLB chắc chắn chấp nhận bán. Ngày định giá và ngày quan sát được giữ riêng.
- Mô hình dùng điểm thi đấu và số phút/số lần ra sân của tối đa bốn năm nguồn, giảm trọng số mùa cũ và mẫu nhỏ. Số lần ra sân chỉ dùng làm trọng số khi thiếu phút, không biến thành số phút thực tế để hiển thị.
- Có 32 mốc đánh giá được biên tập từ thành tích có nguồn. Các mốc có ngày đối chiếu, không phải hệ thống ưu tiên cầu thủ theo tên. Dữ liệu mới có thể điều chỉnh mốc theo thành tích, và độ ảnh hưởng của mốc giảm khi cũ đi.
- Năng lực có trọng số theo vị trí sở trường: trung vệ coi trọng phòng ngự/chọn vị trí; tiền đạo cánh coi trọng rê bóng, tốc độ, chuyền/tạt. Tiềm năng khác năng lực hiện tại; giá cao của một tài năng trẻ không tự chứng minh người đó giỏi hơn một trụ cột.
- Tuổi góp phần giải thích giá và khả năng phát triển. Không hạ năng lực cầu thủ chỉ vì người đó đã 34 tuổi.

Ví dụ với dữ liệu đã cài ngày 05/10/2026: Saliba **89/91** năng lực/tiềm năng, Mosquera **80/87**, Yamal **94/98**, Salah **88/88**. Giá trị lấy từ quan sát nguồn tương ứng. Các số này có thể thay đổi khi nguồn được làm mới; không phải cam kết xếp hạng bóng đá khách quan.

Nguồn đối chiếu gồm [PFA Team of the Year 2025/26](https://www.thepfa.com/news/2026/8/25/pfa-awards-2026-premier-league-winners), [PFA 2024/25](https://www.thepfa.com/news/2025/8/19/pfa-pl-toty-2025), [UEFA Champions League 2024/25](https://www.uefa.com/uefachampionsleague/news/029a-1de594e11846-742ee836b971-1000--2024-25-champions-league-team-of-the-season/), hồ sơ chính thức [Lamine Yamal](https://www.fcbarcelona.com/en/football/first-team/players/129404/lamine-yamal), cùng dữ liệu thi đấu/định giá của [FotMob](https://www.fotmob.com). Từng mốc có liên kết cụ thể trong `src/data/ability-evidence.mjs`; dữ liệu tổng hợp ở `public/data/player-reality.json`.

## Cập nhật từ đời thực

Ở **New Game** hoặc **Lưu & dữ liệu**, chọn **Tải dữ liệu đánh giá mới**. Đây là thao tác cần kết nối Internet và có thể mất vài phút. Trong lúc chạy vẫn có thể chơi với dữ liệu đã cài. Không tự tải nền định kỳ.

Mỗi đợt có tối đa 100 hồ sơ chi tiết cũ hơn 24 giờ được đối chiếu, cùng danh sách đội có thể đọc từ nhà cung cấp. Khi có dữ liệu thiếu hoặc nguồn lỗi một phần, bản tổng hợp giữ những quan sát trước đó và ngày cũ; ngày tổng hợp không có nghĩa tất cả cầu thủ đã được cập nhật đến ngày đó. Mất nguồn hoàn toàn không ghi đè bản đã cài. Công cụ dòng lệnh tương đương: `npm run data:assessments`.

Lần **New Game** tiếp theo dùng bộ quan sát mới nhất để đánh giá các cầu thủ khớp ID trong đội hình được chọn. Thao tác này không nhập chuyển nhượng, thay CLB hoặc thay bản đội hình bất biến. Lịch phát hành đội hình hai lần mỗi năm vào 03/02 và 05/09 được giữ nguyên.

**Save đang chơi không nhận các chỉ số ngoài đời mới.** Khi tải một save cũ, hệ thống chỉ thêm trạng thái theo dõi phát triển và lấy chỉ số hiện có làm điểm bắt đầu. Không sửa tiền, lương, hợp đồng, thể trạng, kết quả hoặc lịch sử chuyển nhượng.

## Biến động trong sự nghiệp

Mỗi 28 ngày theo lịch game, năng lực và giá trị được xem xét lại dựa trên thi đấu mô phỏng. Điểm và số phút nguồn ngoài đời không bị tính lại như trận đã chơi trong sự nghiệp.

- Cầu thủ trẻ cần thời gian, thi đấu, phong độ và huấn luyện để tiến gần tiềm năng; một trận hay không biến thành ngôi sao ngay.
- Cầu thủ lớn tuổi suy giảm từ từ tùy giai đoạn nghề nghiệp và phong độ. Chấn thương dài ảnh hưởng triển vọng/giá trị.
- Định giá xét năng lực, tuổi, phong độ, hợp đồng còn lại, chấn thương và ảnh hưởng trong đội. Mỗi kỳ biến động tối đa 8%, tiến dần về giá trị có điểm gốc thay vì tăng lũy thừa mãi.
- Ảnh hưởng phản ánh chất lượng tương đối và mức sử dụng tại CLB. Giai đoạn không có trận hoặc đang chấn thương không bị mặc định là HLV bỏ rơi.
- Danh sách **CLB quan tâm trong mô phỏng** được tính từ nhu cầu vị trí, khả năng nâng chất lượng đội hình và tài chính. Nó có thể thay đổi sau chuyển nhượng, phong độ hoặc ngân sách; không phải tin đồn hay thông tin nội bộ ngoài đời. Không tự coi danh sách này là đề nghị mua chắc chắn.

Lịch sử giữ tối đa 24 kỳ cho cầu thủ của bạn/đang theo dõi và 6 kỳ cho các cầu thủ khác để hạn chế kích thước save. Hồ sơ hiển thị sáu kỳ gần nhất. Lưu/tải lại không chạy lặp một kỳ đánh giá.
