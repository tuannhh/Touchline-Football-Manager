# Touchline — quản lý bóng đá cục bộ

**Giới thiệu:** [English](docs/INTRO.en.md) · [Español](docs/INTRO.es.md) · [Português](docs/INTRO.pt.md) · [Français](docs/INTRO.fr.md)

Touchline là game quản lý bóng đá độc lập dành cho một người chơi trên máy cá nhân: xây dựng đội hình, kéo thả chiến thuật, thương lượng chuyển nhượng, quản lý ban huấn luyện và theo dõi trận đấu 2D. Bạn có thể lưu nhiều sự nghiệp, chọn ngôn ngữ và đơn vị hiển thị, hoặc dùng Editor để thử nghiệm theo cách riêng.

[Ảnh chụp trong game](docs/SCREENSHOTS.md) · [Bài giới thiệu để chia sẻ](docs/COMMUNITY_POST.vi.md)

**Mục đích giải trí và hình ảnh:** Đây là dự án cá nhân phục vụ giải trí, không có liên kết chính thức với Football Manager, các CLB, giải đấu hay liên đoàn. Ảnh cầu thủ, logo, tên và tài sản của bên thứ ba thuộc các chủ sở hữu tương ứng; việc xuất hiện trong game không cấp quyền sử dụng lại. Tác giả không cấp phép khai thác thương mại các tài sản đó và không chịu trách nhiệm, trong phạm vi pháp luật cho phép, về việc người dùng sử dụng thương mại, phân phối lại hoặc vi phạm bản quyền hình ảnh/quyền hình ảnh. Người sử dụng tự chịu trách nhiệm xin các quyền cần thiết. Giấy phép MIT của mã nguồn dự án không cấp lại giấy phép cho tài sản của bên thứ ba.

Bản **1.7.0**, chơi cục bộ không cần Steam/VPN/tài khoản. Có giao diện tiếng Việt, Anh, Pháp, Tây Ban Nha và Bồ Đào Nha. Barcelona là lựa chọn mặc định; có thể chọn CLB ở ba cấp đấu của tám quốc gia.

## Mở game

Nhấp đúp **Choi-Touchline.command**; game mở tại **http://127.0.0.1:4179**. Giữ Terminal chạy trong lúc chơi, `Ctrl+C` để dừng. Hoặc chạy `npm start` trong thư mục này. Máy chủ chỉ lắng nghe trên `127.0.0.1`. Database, mã game, ảnh và logo đã tải nằm trên máy; chơi được khi mất mạng. Liên kết nguồn cần Internet.

## Mới ở bản 1.7.0

- **Tối ưu trận 2D:** chuẩn bị pha bóng tiếp theo bằng Web Worker; tái sử dụng nền sân và kích thước nhãn; bỏ việc sao chép sâu từng khung hình. Tạm dừng, đổi chiến thuật, thay người, RNG và kết quả trận vẫn theo cùng quy tắc. Trở lại tab sau khi chuyển ứng dụng không tua bù cả khoảng thời gian đã vắng mặt.
- **Lưu nền:** trong trận, chỉ gửi phần trạng thái trận thay đổi sang worker. Việc chuyển cả thế giới thành JSON và gửi autosave chạy ngoài luồng vẽ. Khi thay đổi đội hình, tài chính, sự nghiệp hoặc kết thúc trận, worker nhận lại đầy đủ thế giới; bản save trên đĩa vẫn tự chứa toàn bộ dữ liệu.
- **Cài đặt:** đổi ngay giữa Việt / English / Français / Español / Português bằng i18next. Định dạng số và ngày theo ngôn ngữ. Tên riêng và dữ liệu nguồn giữ nguyên; văn bản từ bản lưu/nguồn bên ngoài chưa có mẫu dịch dùng nguyên văn.
- **Đơn vị:** EUR / USD / GBP, m–km / yd–mi, cm / ft–in, kg / lb. Áp dụng ở hồ sơ cầu thủ, tài chính, Editor, tuyển mộ và đàm phán. Tỷ giá là giá trị mô phỏng có thể tự chỉnh; đổi đơn vị không đổi giá trị gốc trong save. Cài đặt lưu riêng trên trình duyệt.
- Có thể mở Cài đặt từ màn hình bắt đầu hoặc thanh bên. Mở trong trận sẽ tạm dừng; đóng lại rồi nhấn Tiếp tục khi sẵn sàng.

## Cài trên máy khác từ GitHub

Cần **Node.js 24 LTS**. Tải/clone toàn bộ repository, mở Terminal trong thư mục game rồi chạy:

```sh
npm ci
npm run build
npm start
```

Mở `http://127.0.0.1:4179` bằng trình duyệt. Những lệnh này dùng được trên macOS, Windows và Linux. Sau lần cài đầu tiên, chỉ cần `npm start`. Sau khi kéo bản cập nhật mã nguồn, chạy lại `npm ci` và `npm run build` trước khi mở game.

Repository chứa `public/data`, `public/portraits`, logo và các snapshot đội hình: ảnh đã tải đi cùng game, không phụ thuộc đường dẫn trên máy tác giả. `saves/`, cache và cài đặt cá nhân không đưa lên Git. Muốn mang sự nghiệp sang máy khác, xuất file trong **Lưu & dữ liệu**, sau đó nhập từ **Saved Games** trên máy mới. Push GitHub chia sẻ bộ game; để chơi, mỗi người chạy một bản trên máy mình.

## Mới ở bản 1.6.1

- **Chuyển động 2D theo tình huống:** từng cầu thủ có mục tiêu riêng theo vai trò, sơ đồ có/không bóng, chiều rộng, hàng thủ, pressing, lối chuyền và chuyển trạng thái. Có dẫn bóng, hỗ trợ tam giác, bật nhả, chồng biên, chọc khe, tạt bóng, theo người, bọc lót và thủ môn đón/cản phá.
- Bóng di chuyển liên tục giữa người chuyền và điểm đón; các quả tạt có quỹ đạo bổng. Cầu thủ chạy tới điểm nhận với tốc độ dựa trên thuộc tính. Mọi cú sút/bàn thắng theo đúng cầu thủ và kết quả trong mô phỏng, kể cả hai đội có tình huống trong cùng phút; tỉ số và bình luận xuất hiện theo diễn biến hình ảnh.
- **1× / 2× / 4× / 8×**, tạm dừng đứng yên toàn bộ tình huống, tùy chọn tên hoặc nhiệm vụ di chuyển. Đổi chiến thuật/nhân sự sẽ kết thúc tình huống hiện tại trước khi áp dụng. Nút đến hết trận giữ cùng kết quả mô phỏng.
- Bản lưu giữ phút mô phỏng hoàn tất gần nhất; đoạn diễn hoạt đang xem chưa hoàn tất được dựng lại khi tải lại. Sơ đồ, RNG và kết quả đã ghi nhận không bị đặt lại. Không cần tạo sự nghiệp mới để dùng chuyển động mới.
- Đây là lớp diễn hoạt hành vi theo trận mô phỏng, chưa phải bộ vật lý va chạm và trọng tài cho từng chạm bóng. Hoạt cảnh không thay đổi xác suất kết quả hay tiêu thụ RNG của trận.

## Mới ở bản 1.6

- **New Game / Load Game / Saved Games**: thư viện tất cả bản lưu, tìm theo tên/CLB/HLV, sắp xếp, đổi tên và Save as để lưu một mốc riêng. Giữ toàn bộ tiến trình, editor, đội hình, dự bị, tài chính, đàm phán và trận đang đá. Mở Saved Games trong trận sẽ tạm dừng; tải lại tiếp tục từ trạng thái đã lưu. Autosave tiếp tục ghi vào bản đang chơi, không thay thế các mốc khác.
- **Đội hình theo bản phát hành**: New Game chọn một snapshot có mã, mùa, ngày dữ liệu và nguồn. Mỗi snapshot được kiểm tra và đóng băng; sự nghiệp lưu danh tính nguồn, đồng thời chứa cả thế giới riêng. Load Game dùng dữ liệu đã lưu, không áp chuyển nhượng thực tế mới, home-grown mới hoặc thay đổi kỹ năng từ một release khác vào mùa đang chơi. Ảnh chân dung vẫn được cập nhật độc lập.
- **Hai sơ đồ theo pha**: bật trong Chiến thuật để xếp riêng khi có bóng và không có bóng, xem cạnh nhau, kéo thả các vị trí với cùng 11 người. Sơ đồ ảnh hưởng độ phù hợp tấn công/phòng ngự, chi phí chuyển vị trí và vị trí hiển thị 2D. Thay người dùng chung cầu thủ ở cả hai pha. Bản lưu cũ giữ cách mô phỏng cũ cho tới khi bạn bật tính năng.
- **Hoạch định tuyển mộ**: trong Chuyển nhượng, mở kế hoạch để xem chiều sâu từng vị trí và hợp đồng theo năm; lưu tiêu chí vị trí, tuổi, phí, lương, tìm ứng viên, theo dõi và mở đàm phán. Đây là thị trường mô phỏng trên máy, không kết nối dịch vụ TransferRoom.
- Tham khảo hai thay đổi chính thức của FM26: [sơ đồ có bóng/không bóng](https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution) và [khu tuyển dụng](https://www.footballmanager.com/fm26/features/powered-transferroom-fm26s-recruitment-revamp). Touchline dùng cơ chế 2D riêng; không sao chép match engine, Unity hoặc toàn bộ tính năng FM26.
- Quy trình phát hành đội hình: [docs/ROSTER_RELEASES.md](docs/ROSTER_RELEASES.md). Bản dữ liệu có thể mới hơn ngày bắt đầu mùa trong game; ngày dữ liệu và ngày mô phỏng là hai mốc riêng.

## Mới ở bản 1.5

- **Đội hình trận đấu**: chọn 11 người đá chính và danh sách dự bị riêng trong Chiến thuật. Ghế dự bị cạnh sân; kéo giữa sân/dự bị/ngoài danh sách để đổi chỗ, sắp thứ tự hoặc loại khỏi danh sách. Có thao tác bằng bàn phím. Trận đấu sử dụng đúng danh sách đã chọn; đổi sơ đồ không tự chọn lại người.
- **Điều lệ dự bị theo giải**: Premier League/Championship 9, League One 7, Bundesliga 1–2 là 9; Tây Ban Nha và UEFA 12; Serie A/C 15, Serie B 12; Bồ Đào Nha cấp 1–2 cập nhật 2026/27 là 12; Hà Lan 1–2 là 12, cấp 3 là 7; V.League 1–2 là 9. Nguồn và mùa điều lệ nằm trong `src/matchday.mjs` và hiển thị cạnh sân. Các nguồn cũ ghi rõ mùa; Pháp, 3. Liga, Hạng Nhì Việt Nam chưa xác minh đủ nên dùng giới hạn mô phỏng có thể sửa. Chưa áp dụng chỉ tiêu tối thiểu dự bị/thủ môn VPF hoặc lượt thay do chấn động não.
- **Thay người thống nhất**: trong trận mở **Chiến thuật & nhân sự**. Trước giao bóng được đổi đá chính/dự bị miễn phí; sau giao bóng áp dụng số cầu thủ và số đợt thay theo điều lệ. Nhiều thay cùng một phút dừng tính một đợt; giữa hiệp không mất đợt. UEFA cho thêm một người và một đợt khi vào hiệp phụ. Không cho tái nhập sân. Trận đang lưu từ phiên bản cũ giữ danh sách và giới hạn cũ.
- **Đội tuyển quốc gia**: một lịch chung với CLB, có thông báo triệu tập, tập trung, thi đấu và trở lại. Mốc FIFA 2026–2030 từ tài liệu chính thức; Nations League 2026/27, vòng loại EURO 2028, Asian Cup 2027 và giao hữu quốc tế được mô phỏng từ quốc tịch có trong database. Cặp đấu, đội được chọn, thể thức rút gọn và kết quả đều ghi rõ là mô phỏng; chưa có VCK World Cup, EURO hay đầy đủ các giải châu lục khác. Quốc tịch GB thiếu thông tin không tự gán thành Anh.
- **Nhả quân**: bắt buộc trong cửa sổ FIFA và Asian Cup; giao hữu ngoài cửa sổ cần CLB đồng ý. Có đề nghị miễn y tế khi đang chấn thương; liên đoàn chấp thuận được giản lược. AI từ chối giao hữu ngoài đợt nếu trùng lịch hoặc thiếu người. Thể lực, chấn thương và thống kê đội tuyển tách khỏi CLB, không cộng nhầm thưởng. Lịch CLB tránh cửa sổ toàn cầu; trường hợp còn dưới 7 người do lên tuyển được xếp đá bù giản lược. Ngày và mốc hiện tại, kết quả đã chơi giữ nguyên khi nâng cấp; lịch tương lai được ghép lại.
- **Home-grown có bằng chứng**: 518 hồ sơ trong `public/data/homegrown.json`, gồm 499 cầu thủ đối chiếu PL 2026/27 và 23 lịch sử đào tạo chính thức từ Barcelona, Arsenal, Real Madrid (có hồ sơ trùng hai nhóm). Tách PL, UEFA CT/AT và List B; không suy từ quốc tịch, không biến dấu U21 chưa xác nhận thành non-HG. Hồ sơ/nguồn hiển thị trong profile và Đăng ký. Giữ nguyên cờ đào tạo do người chơi sửa và danh sách đã đăng ký. Đây là phần dữ liệu đã kiểm chứng, chưa phải toàn bộ 16.440 cầu thủ.
- **Tâm lý & y tế**: cầu thủ phản ứng với thời gian thi đấu, lời hứa và danh sách chuyển nhượng; có thể bất mãn, xin ra đi, được động viên hoặc hứa 180 phút trong 28 ngày. Có thời gian chờ trao đổi, kiểm tra lời hứa theo phút thực tế và thư phản hồi. Chấn thương trận/tập luyện có mô tả và hồi phục; tập nặng/thể lực thấp tăng rủi ro trong mô phỏng.
- **Transfer listed / Loan listed**: bật/tắt trong hồ sơ, xem danh sách của CLB và lọc thị trường. Rao bán ảnh hưởng mức giá/AI và tâm lý. Loan listed hiện là trạng thái công bố/lọc; chưa có đàm phán hoặc hợp đồng cho mượn.

## Mới ở bản 1.4

- **Vị trí cụ thể trên giao diện**: đội hình, CLB, thị trường, hồ sơ, Editor và chiến thuật hiển thị LW/RW/ST, LB/RB/CB, CM/CDM/CAM… theo hồ sơ đã có. Vị trí phụ tách riêng; lọc vị trí gồm sở trường và vị trí phụ. Vị trí đang đá trên sân được phân biệt với sở trường của cầu thủ. Hồ sơ thiếu nguồn ghi “Chưa rõ chi tiết”; không suy ra LW/RW/ST từ nhóm FW. Mã AM/DM trong dữ liệu được hiển thị thành CAM/CDM, không thay đổi save hay mô phỏng.
- **Hồ sơ 568 CLB**: mục Câu lạc bộ có tìm kiếm và lọc giải. Bấm tên/logo đội ở BXH, lịch, thị trường hoặc hồ sơ cầu thủ để xem cầu thủ, ban huấn luyện, lịch thi đấu/kết quả và chuyển nhượng đến/đi của đội đó. Mọi trang dùng cùng dữ liệu đang diễn ra trong sự nghiệp.
- **Đàm phán hai bước**: mở hồ sơ → Thương lượng chuyển nhượng. CLB cân nhắc phí và phần trăm bán lại, phản hồi bằng mức giá mới hoặc từ chối. Sau khi thống nhất phí, người đại diện thương lượng lương, thời hạn, thưởng ký, phí đại diện, thưởng ra sân/ghi bàn, tăng lương hằng năm, vai trò và phí giải phóng. Mỗi bước tối đa 4 đề nghị; thỏa thuận có hạn 28 ngày. Rút lui hoặc bị từ chối có thời gian chờ liên hệ lại.
- **Ký riêng sau khi đồng ý**: chỉ chuyển người/tiền khi bấm Ký hợp đồng và hoàn tất chuyển nhượng. Kiểm tra đồng thời tiền mặt, ngân sách chuyển nhượng (gồm phí ký/đại diện) và quỹ lương. Cuộc đàm phán và phản hồi được tự lưu, có thể đóng và tiếp tục sau. Nhân sự được giao đàm phán ảnh hưởng giá yêu cầu của CLB bán.
- **Điều khoản có tác dụng**: thưởng ra sân/bàn thắng trả sau trận chính thức; lương tăng khi sang mùa; vai trò cam kết ảnh hưởng tinh thần khi thiếu thời gian thi đấu; CLB cũ nhận phần trăm phí bán tiếp; phí giải phóng giới hạn giá yêu cầu. Đăng ký cầu thủ mới của đội bạn vẫn do bạn quyết định.
- **Thị trường AI**: sau mỗi mốc quốc nội, các CLB khác tìm cầu thủ theo vị trí thiếu, tuổi, chất lượng và tài chính. Mục tiêu 2–6 giao dịch/mốc nếu đủ điều kiện; không bắt buộc giao dịch khi không đủ tiền/người. Cập nhật đội hình, hợp đồng, số áo, tiền, đăng ký và thư tổng hợp. Không tự bán/mua thay CLB bạn. Giao hữu và mốc UEFA không tạo thêm lượt thị trường.
- Thị trường mô phỏng mở quanh năm, chưa có cho mượn/trả góp/cửa sổ chuyển nhượng thực tế. Lịch sử chỉ gồm giao dịch trong sự nghiệp, không dựng thêm giao dịch ngoài đời. Save cũ được bổ sung trạng thái thị trường mà không đổi tiến độ, RNG trận đấu, tiền, cầu thủ hay trận đang chơi.

## Mới ở bản 1.3

- **Ban huấn luyện**: mọi CLB có 10 nhóm vai trò — trợ lý, giám đốc thể thao, giám đốc đào tạo trẻ, bác sỹ trưởng, HLV thủ môn, HLV chung, bác sỹ, HLV thể lực, chuyên gia khoa học thể thao và tuyển trạch viên. Xem hồ sơ, 12 chỉ số chuyên môn, lương và nguồn; tra cứu được cả đội khác.
- **Phân công nhiệm vụ**: chọn người đủ chuyên môn hoặc HLV trưởng cho 10 nhiệm vụ. Kiêm quá 3 nhiệm vụ làm giảm hiệu quả. Tập luyện, thủ môn, thể lực, cầu thủ dưới 22 tuổi, hồi phục, điều trị và phí mua cầu thủ đều chịu ảnh hưởng từ người được giao. Lương BHL hạch toán riêng mỗi tuần quốc nội; quỹ lương cầu thủ vẫn dùng cho đăng ký giao dịch cầu thủ.
- **Giao hữu**: tổ chức tối đa một trận mỗi mốc lịch tại mục Ban huấn luyện. Bạn tự dẫn dắt trên sân 2D hoặc giao trợ lý/HLV mô phỏng, chọn đội và thay người. Có báo cáo, thể lực và chấn thương, nhưng không cộng vào BXH, thống kê chính thức hay án treo giò. Trận chưa chơi bị hủy khi chuyển mốc lịch. Có thể lưu và tiếp tục giữa trận.
- **Báo chí**: người được phân công phát biểu sau trận; chọn phong cách cân bằng, động viên hoặc yêu cầu cao. Hộp thư lưu đủ nội dung hỏi–đáp và tác động tinh thần, chỉ áp dụng một lần mỗi trận.
- **Báo cáo tuần**: tuyển trạch đề xuất mục tiêu có liên kết hồ sơ, bác sỹ báo tình trạng thể lực, bộ phận trẻ đề xuất cầu thủ cần phát triển. Không tự mua/bán cầu thủ.
- **Nguồn nhân sự**: 57 người tại Arsenal, Barcelona, Liverpool, Manchester City, Bayern và Real Madrid được đối chiếu ngày 03/10/2026; URL và chức danh gốc nằm trong `src/staff-official.mjs`. Vai trò còn thiếu dùng nhân sự mô phỏng có nhãn rõ. Toàn bộ chỉ số và lương là mô phỏng. Chưa có tuyển dụng/sa thải hoặc thị trường nhân sự.
- Save cũ bổ sung riêng dữ liệu BHL, không đổi RNG, tiền, đội hình, cầu thủ, giao dịch hoặc trận đang chơi. Mặc định bạn tự dẫn dắt giao hữu và trả lời báo chí; có thể ủy quyền tại **Ban huấn luyện → Phân công nhiệm vụ**.

## Mới ở bản 1.2.1

- Bổ sung hàng nghìn ảnh thật, ưu tiên hồ sơ chính thức của CLB, sau đó FotMob theo mã cầu thủ đã đối chiếu. Có ảnh chính thức Arsenal, Barcelona, Liverpool, Real Madrid, PSG, Manchester United, Chelsea, Inter, Juventus, Sporting và Ajax.
- Ghép bằng danh tính, tên/ngày sinh và hồ sơ nguồn; không ghép chỉ bằng số áo. Nguồn ảnh mở được ngay trong profile. Các bí danh đã đối chiếu nằm trong `scripts/data/portrait-overrides.json`.
- Save cũ nhận bộ ảnh mới; chỉ cập nhật trường ảnh, giữ tiền, chỉ số, giao dịch và trận đang chơi. Ảnh vẫn theo cầu thủ đã chuyển nhượng. Bản giao diện mới kiểm tra chỉ mục ảnh mỗi 60 giây và khi quay lại tab; ảnh được lưu cục bộ nên chơi offline được.
- Ảnh phản hồi 200 vẫn có thể là hình bóng người: bộ nhập kiểm tra định dạng, kích thước, ảnh rỗng, mẫu placeholder đã nhận diện và ảnh trùng giữa các danh tính; kiểm tra mắt các nguồn và các trường hợp ngoại lệ. Hồ sơ chưa có ảnh thật vẫn ghi rõ AI; file ảnh lỗi hiện chữ viết tắt.

Cập nhật riêng bộ ảnh: `npm run data:portraits`. Lần đầu nâng cấp giao diện cần tải lại trang game; những lần cập nhật ảnh sau sẽ tự nhận từ máy chủ. Chạy `npm run build` khi cập nhật cả mã giao diện hoặc database.

## Mới ở bản 1.2

- **Thư viện 10 HLV**: Pep Guardiola, Jürgen Klopp, Hansi Flick, Mikel Arteta, Xabi Alonso, Simone Inzaghi, Carlo Ancelotti, Luis Enrique, Diego Simeone, Antonio Conte. Mỗi thẻ ghi CLB/giai đoạn và liên kết phân tích từ Premier League, Bundesliga hoặc UEFA. Các mẫu là mô phỏng lấy cảm hứng từ giai đoạn đó, không khẳng định HLV đang dẫn dắt CLB ấy.
- **9 sơ đồ**, điều chỉnh tâm thế, nhịp độ, chiều rộng, pressing, độ cao hàng thủ, chuyền bóng và chuyển trạng thái. Tham số tác động lên giữ bóng, tạo cơ hội, phản công và hao thể lực. Chúng không bảo đảm chiến thắng.
- **Kéo thả trước trận**: kéo áo sang áo khác để đổi chỗ, kéo nút ⋮⋮ của cầu thủ trong danh sách vào sân để thay đội hình. Có tìm tên và cách dùng bàn phím: chọn “Xếp…” rồi chọn vị trí, Escape để hủy.
- **Kéo thả trong trận**: mở **Chiến thuật & kéo thả** để tạm dừng, chỉnh sơ đồ/tham số hoặc dùng mẫu HLV. Đổi chỗ cầu thủ đang đá không tốn lượt; dự bị vào sân tính một trong tối đa 5 lượt. Cầu thủ đã thay ra/thẻ đỏ không thể trở lại. Thay đổi này áp dụng cho trận hiện tại và được lưu cùng trận.
- **Hồ sơ chi tiết**: bản đồ sở trường/vị trí phụ, chân thuận, ngày sinh, chiều cao, nguồn dữ liệu và vai trò gợi ý từ kỹ năng mô phỏng. Trường thiếu nguồn hiện rõ; không tự gán chân phải. Vị trí chi tiết ảnh hưởng độ phù hợp trên sân. Editor cho phép sửa vị trí/chân thuận với nhãn do người chơi chỉnh.

Áp dụng mẫu hoặc đổi sơ đồ giữ nguyên tập cầu thủ đang có trên sân và tìm cách phân vị trí phù hợp; không tự thực hiện thay người. Nút **Xếp đội hình tốt nhất** ở trước trận cho phép chọn lại nhân sự từ cả đội.

## Các tính năng bản 1.1

- **Hộp thư**: đọc từng thư đầy đủ, người gửi/nhận/ngày gửi, tìm kiếm, lọc chưa đọc, đánh dấu đã đọc. Số liệu đóng băng tại thời điểm gửi; thư cũ giữ nội dung đã lưu, không dựng thêm chi tiết lịch sử.
- **Ba cúp UEFA**: Champions League, Europa League và Conference League, 36 CLB mỗi giải; vòng league 8/8/6 trận, play-off, vòng 16 đội, tứ kết, bán kết hai lượt, chung kết trung lập, hiệp phụ và luân lưu. Cùng hồ sơ CLB với giải quốc nội.
- **Số tiếng Việt**: `144.437.842`, `1,25`, gồm ô nhập Editor, tiền, thống kê và xG. Dấu phân cách không thay đổi giá trị lưu.
- **Quốc tịch/đào tạo**: xem trong đội hình/hồ sơ; màn hình Đăng ký đội hình có home-grown, đào tạo tại CLB/liên đoàn, List B, tự chọn danh sách và sửa hồ sơ có nhật ký.
- **Hạng dưới**: thêm cấp 2 và 3 ở tám nước, có lịch/BXH/chuyển nhượng và lên/xuống hạng mô phỏng.

## Chơi và lưu

1. Chọn HLV, quốc gia, hạng đấu, CLB hoặc tiếp tục sự nghiệp đã lưu.
2. **Chiến thuật**: chọn mẫu HLV hoặc chỉnh hệ thống, kéo thả cầu thủ vào sân; có tự xếp đội hình. Kiểm tra **Đăng ký đội hình** trước giải áp dụng danh sách.
3. **Tiếp tục / Vào trận đấu**: Giao bóng, tốc độ 1×–8×, tạm dừng, đổi tâm thế, thay người theo giới hạn giải; có **Đến hết trận**. Sau trận bấm **Ghi nhận kết quả & về văn phòng**.
4. Lịch xen quốc nội và UEFA. Một lần Tiếp tục là một mốc lịch, có thể CLB được nghỉ. Tài chính/huấn luyện tính theo tuần quốc nội, không nhân đôi vì cúp giữa tuần.
5. **Chuyển nhượng** để tìm, chiêu mộ/bán. Tiền mặt/ngân sách/quỹ lương đều ảnh hưởng giao dịch. Cầu thủ mới có thể cần đăng ký trước khi ra sân.
6. **Touchline Editor** chỉnh tài chính, kỹ năng, lương/giá trị, hồi phục hoặc đặt kỹ năng 20; bấm Lưu tương ứng.
7. Hết mùa chọn **Mùa giải mới**: lên/xuống hạng, phân suất UEFA, lưu lịch sử danh hiệu.

Tự lưu sau thay đổi, mỗi 5 giây trong trận. Kiểm tra dòng **Đã lưu** trước khi đóng. File ở `saves/career-*.json`, bản trước đó `.json.bak`. **Lưu & dữ liệu** có Lưu ngay/Xuất/Nhập; nhập tạo ID mới, giữ file gốc. Có thể tiếp tục trận đang chơi từ phút đã lưu. Chỉ mở một tab cho cùng một sự nghiệp.

Sự nghiệp 1.0 tự nâng cấp khi mở, giữ ID, tiền, kỹ năng, giao dịch và kết quả. Nếu chưa thi đấu, lịch mở rộng dùng ngay. Nếu đã đá/đang trong trận, giữ lịch cũ đến hết mùa rồi mới thêm UEFA/hạng dưới. Hai file lưu gốc được sao lưu riêng trong `saves/backups/before-v1-1-20261003-020331/`.

Sự nghiệp 1.1 tự nâng cấp sang định dạng 3 khi mở bằng 1.2, giữ nguyên đội hình, tài chính, chỉ số, chuyển nhượng và tiến độ/trận đang chơi. Hồ sơ bổ sung chỉ điền trường đang thiếu, giữ giá trị đã chỉnh. Bản sao trước cập nhật ở `saves/backups/before-v1-2-20261003-053504/`.

## Database và nguồn

Snapshot **02–03/10/2026**, chủ yếu mùa **2026/27**: **568 CLB, 16.440 cầu thủ, 6.432 ảnh thật, 559 logo**. Có **14.535 hồ sơ có quốc tịch**, phần còn thiếu hiện “Chưa rõ”. Có 29 giải/nhóm quốc nội, ba cúp UEFA và 59 đối thủ từ các nước khác.

Bổ sung hồ sơ 03/10/2026: **4.603 cầu thủ có vị trí chi tiết**, **4.324 có chân thuận** từ FotMob. Barcelona có 28/30 và Arsenal có 24/27 hồ sơ ở cả hai trường. Nguồn công khai còn thiếu ở nhiều đội, nhất là hạng dưới; dữ liệu chưa có được ghi rõ trong game.

| Quốc gia | Cấp 1 | Cấp 2 | Cấp 3 |
|---|---|---|---|
| Anh | Premier League · 20 | Championship · 24 | League One · 24 |
| Đức | Bundesliga · 18 | 2. Bundesliga · 18 | 3. Liga · 20 |
| Pháp | Ligue 1 · 18 | Ligue 2 · 18 | Ligue 3 · 18 |
| Ý | Serie A · 20 | Serie B · 20 | Serie C · 3 × 20 |
| Tây Ban Nha | LaLiga · 20 | LaLiga 2 · 22 | Primera Federación · 2 × 20 |
| Bồ Đào Nha | Liga Portugal · 18 | Liga Portugal 2 · 18 | Liga 3 · 2 × 10 |
| Hà Lan | Eredivisie · 18 | Eerste Divisie · 20 | Tweede Divisie · 18 |
| Việt Nam | V.League 1 · 14 | V.League 2 · 14 | Hạng Nhì · **9 đội tạm**, nhóm 4/5 |

**Hạng Nhì Việt Nam chưa phải danh sách chính thức mùa 2027.** Dùng 9 CLB tiếp tục từ danh sách công khai 2026 sau khi loại đội lên/xuống hạng; nhóm 4/5 và lịch là mô phỏng. Đội hình có thể chưa cập nhật chuyển nhượng sau giải. Có nhãn tại màn hình chọn đội, giải đấu, hồ sơ và trang dữ liệu.

Nguồn: [ESPN](https://www.espn.com/soccer/teams), [FotMob](https://www.fotmob.com/), [VPF](https://vpf.vn/), [UEFA](https://www.uefa.com/), đội hình chính thức [Barcelona](https://www.fcbarcelona.com/en/football/first-team/players), [Athletic Club](https://www.athletic-club.eus/en/players/iker-pagazartundua-etxezarraga/), [Vitória SC](https://vitoriasc.pt/equipa-b/), [Sparta](https://www.sparta-rotterdam.nl/clubliefde/selectie-jong-sparta/), [VI](https://www.vi.nl/clubs/jong-almere-city/selectie), và bảng đội hình Việt Nam 2026 trên Wikipedia với URL riêng từng hồ sơ. Các trường/cầu thủ/CLB giữ nguồn; xung đột danh tính lưu trong `meta.conflicts` và hiển thị tại Lưu & dữ liệu.

Một cầu thủ có một đội chính trong mô phỏng, chưa đăng ký đồng thời đội một/B. CLB trùng mã giữa nguồn được hợp nhất khi xác minh được. Đội dự bị được đánh dấu để tránh tự thăng hạng; quốc tịch bóng đá từ nguồn chưa xác nhận đầy đủ hộ chiếu kép.

**Kỹ năng, tiềm năng, hợp đồng, tiền, giá trị và kết quả là mô phỏng**. Trường tiểu sử thiếu được đánh dấu; tuổi ước lượng/vị trí mặc định không được gọi là đã xác minh. Bộ 64 avatar AI dùng chung khi thiếu ảnh thật là gương mặt hư cấu, không tái hiện từng cầu thủ; nguồn tại `public/portraits/AI-PROVENANCE.txt`.

## Quy định đăng ký

Quốc tịch không tự tạo home-grown. Có cờ HG từ [danh sách Premier League 2026/27](https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists). Tám hồ sơ Barcelona/Arsenal có phân loại **suy ra từ mốc đào tạo trong tiểu sử CLB**, nhãn “Đối chiếu tiểu sử”; không phải cờ nhập từ danh sách UEFA. Hồ sơ còn thiếu giữ “Chưa xác minh”, có thể chỉnh trong game và ghi nhật ký.

- **Áp dụng khi ra sân**: PL tối đa 25/17 không HG + U21; UEFA List A 25 với suất 8/4, List B cần tuổi và quá trình đào tạo, ít nhất 2 thủ môn List A; Serie A 25 với suất 4+4 và U22. Thiếu suất đào tạo giảm quy mô danh sách. Mốc tuổi thay đổi theo mùa. Tổng 3 thủ môn A+B của UEFA hiện là cảnh báo vì một số nguồn thiếu đội trẻ.
- **Cảnh báo/đối chiếu**: EFL, DFL, Liga Portugal và ngoại binh V.League; chưa đủ ngoại lệ đội B/cho mượn/hộ chiếu kép/gốc Việt/danh sách trận.
- **Tra cứu**: các hạng/điều kiện khác có nguồn liên đoàn, không áp nhầm quota UEFA cho giải quốc nội.

URL điều lệ cụ thể trong màn hình Đăng ký và `src/registration.mjs`. Chưa mô phỏng hạn nộp danh sách, ngoại lệ y tế, giấy phép lao động hoặc toàn bộ quy định nhập cầu thủ ngoài EU.

## Phạm vi mô phỏng

- UEFA mùa đầu dùng danh sách từ nguồn; **lịch và bốc thăm do game tạo**. Mùa sau giữ số suất theo quốc gia của snapshot, lấy thứ hạng giải cao nhất; chưa có vòng sơ loại, hệ số quốc gia hoặc suất cúp quốc nội. Đối thủ ngoài tám nước giữ nguyên.
- Quốc nội hai lượt. Lên/xuống hạng trực tiếp theo thứ hạng, giữ số đội; chưa có play-off thực tế/giai đoạn hai. Chưa liên thông tự động Eerste/Tweede Divisie Hà Lan. Các nhóm cấp 3 Ý/Tây Ban Nha/Bồ Đào Nha được xếp chung thứ tự để chia suất.
- BXH theo điểm, hiệu số, bàn thắng, tên; chưa dùng mọi tie-break thực tế. Thẻ/treo giò dùng chung, chưa tách đầy đủ theo giải.
- Trận theo phút: năng lực/vị trí/thể lực/tinh thần/sân nhà và tham số chiến thuật ảnh hưởng kết quả. Sân 2D diễn hoạt trạng thái, chưa mô phỏng vật lý từng chạm bóng hay đầy đủ chỉ đạo riêng từng cầu thủ. Chân thuận là thông tin hồ sơ, chưa có mô hình chân không thuận. Có thẻ, chấn thương, thay người, hiệp phụ và luân lưu.
- Chưa có cúp quốc gia, sa thải HLV, cầu thủ trẻ sinh mới/giải nghệ. Hợp đồng hết hạn tự gia hạn; thị trường chưa có cho mượn, trả góp hoặc hợp đồng có hiệu lực trong tương lai.

## Editor ngoài game

Công cụ chỉnh JSON Touchline, tạo file mới; không can thiệp Football Manager/FMRTE:

```sh
node scripts/editor.mjs --input career.json --list
node scripts/editor.mjs --input career.json --money 1000000000 --wage-budget 10000000
node scripts/editor.mjs --input career.json --player "Lamine Yamal" --max --heal
```

Nhập `career-edited.json` trong game; `--help` xem tùy chọn. CLI nhập số thô, ô nhập giao diện dùng dấu phân cách tiếng Việt.

## Phát triển và cập nhật

```sh
npm install
npm test
npm run build
npm start
```

Phát triển: `npm run dev` cùng máy chủ, mở `http://127.0.0.1:5179`. Kiểm thử bao gồm tiền, chuyển nhượng, lưu/đọc, thư, migration, database, quota, lịch UEFA, hai mùa hoàn chỉnh/bảo toàn số đội, thay người/kéo thả, hiệu ứng chiến thuật, hao thể lực và tiếp tục trận sau đổi sơ đồ.

Importer cần Python 3, `beautifulsoup4`, `certifi`, Internet:

```sh
npm run data:refresh
npm test
npm run build
```

Chỉ bổ sung hồ sơ vị trí/chân thuận: `npm run data:profiles`. Ghép theo ID nguồn hoặc tên/ngày sinh; trường hợp tên rút gọn cần cùng CLB và ngày sinh, chỉ chấp nhận một ứng viên. Cùng danh tính được bổ sung mà không đổi CLB, kỹ năng hoặc tài chính. Vị trí phụ từ hồ sơ cá nhân cần ít nhất 3 lần ghi nhận; không phải thang điểm thành thạo đã xác minh.

Quy trình dành cho **2026/27**, cần rà lại khi đổi mùa. Cache nguồn 24 giờ, sao lưu trước refresh, khôi phục database nếu lỗi. Không chạy cùng lúc build. Sự nghiệp đang chơi giữ snapshot riêng; dữ liệu refresh dùng cho sự nghiệp mới. Nguồn công khai có thể thiếu/chậm; phần chưa chắc chắn có nhãn trong game.
