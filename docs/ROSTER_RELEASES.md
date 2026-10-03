# Phát hành bộ đội hình bất biến

Bộ đầu tiên là `2026-10-03-initial`, nhãn **Đội hình 03/10/2026 · 2026/27**: 30 giải, 568 CLB, 16.440 cầu thủ và 518 hồ sơ home-grown có nguồn. Đây là bản chụp dữ liệu công khai; các nhóm Hạng Nhì Việt Nam còn tạm thời và một số nguồn hạng dưới chưa phải danh sách đăng ký hoàn chỉnh. Xem `meta.provisionalLeagues`, `rosterNote` và nguồn của từng hồ sơ.

`asOf: 2026-10-03` là ngày phạm vi đối chiếu nguồn, theo `Asia/Ho_Chi_Minh`. `publishedAt` là thời điểm UTC thật lúc đóng gói, không thay thế ngày dữ liệu. `sourceImportedAt` và `homegrownVerifiedAt` giữ nguyên mốc của nguồn. Không gắn ngày hôm nay vào dữ liệu cũ để gọi là mới.

## Phạm vi bảo toàn

- Mỗi phiên bản nằm ở `public/data/releases/<id>/`, gồm nguyên byte `database.json`, `homegrown.json` và `release.json`.
- `public/data/releases/index.json` là chỉ mục. SHA-256 riêng của hai file dữ liệu và SHA-256 của metadata được đối chiếu khi nạp.
- ID đã tồn tại không được ghi đè. File được đặt chỉ đọc; publisher dùng khóa và ghi nguyên tử. Chủ máy vẫn có thể sửa file bằng công cụ ngoài, nhưng kiểm tra hash sẽ phát hiện việc đó.
- Publisher không đọc, sao chép hoặc sửa sự nghiệp. Bộ đội hình được chọn chỉ dùng để tạo sự nghiệp mới; tải save phải dùng bản dữ liệu gốc của save hoặc dữ liệu đã lưu trong save, không ghép bộ mới vào.
- Ảnh và chỉ mục ảnh được quản lý riêng. Bất biến ở đây là danh tính/CLB/thuộc tính nguồn và chứng cứ home-grown, không phải toàn bộ thư viện ảnh. Ảnh mới trong thư mục staging cần quy trình nhập ảnh riêng nếu muốn dùng ngoài staging.

## API cục bộ

Module Node `src/rosterReleases.mjs` cung cấp:

```js
await listRosterReleases({rootDir});
await loadRosterRelease(id, {rootDir}); // {release, database, homegrown}
await prepareRosterRelease(options);  // kiểm tra, không ghi
await publishRosterRelease(options);  // khóa, kiểm tra, phát hành
await stageRosterRefresh({rootDir, stageDir, refresh: false});
```

`rootDir` mặc định là thư mục dự án. Danh sách sắp xếp giảm dần theo ngày dữ liệu, thời điểm xuất bản, rồi ID để thứ tự ổn định. `list` kiểm tra metadata; `load` kiểm tra cả hash và cấu trúc của hai file dữ liệu. Module không tự thêm trường vào database trả về. Server có thể đính kèm `db.meta.release = {id,label,season,asOf,publishedAt}` cho màn tạo sự nghiệp; danh tính này cần được giữ trong save.

Server gắn `GET /api/roster-releases` và `GET /api/roster-releases/:id` vào hai hàm đọc. API không cần mạng để liệt kê hoặc nạp bộ đã xuất bản.

```sh
node scripts/release-rosters.mjs --list
node scripts/release-rosters.mjs --verify 2026-10-03-initial
```

## Thu thập trong staging

Các script Python hiện tại xác định root từ vị trí file và ghi database tại chỗ. Không chạy `refresh-data.py` trực tiếp trên cây dự án đang chơi khi chuẩn bị một bản mới. Lệnh dưới sao chép script, dữ liệu và tài nguyên ảnh sang một cây độc lập; **không sao chép saves hoặc cache nguồn cũ**:

```sh
node scripts/release-rosters.mjs \
  --stage .cache/roster-staging/2026-27-winter-review \
  --season 2026/27
```

Tên thư mục phải chưa tồn tại. Có thể thêm `--refresh` ngay ở lệnh tạo staging để chạy tuần tự `refresh-data.py` và `refresh-homegrown.py` trong cây mới. Hoặc rà soát các nguồn trong script đã sao chép trước, rồi chạy chính các bản đã sao chép:

```sh
python3 .cache/roster-staging/2026-27-winter-review/scripts/refresh-data.py
python3 .cache/roster-staging/2026-27-winter-review/scripts/refresh-homegrown.py
```

Các adapter đang ghim mùa 2026/27, một số URL và mốc chứng cứ 03/10/2026. Trước kỳ chuyển nhượng khác phải kiểm tra URL đội hình mới, ngày cập nhật, danh sách đăng ký và chứng cứ home-grown tương ứng. Sang mùa mới phải cập nhật adapter và danh sách giải/CLB trong staging; chỉ đổi `meta.season` không phải cập nhật dữ liệu. Lệnh staging không chấp nhận yêu cầu mùa khác với adapter hiện tại. Sau khi tạo staging cho mùa nguồn đang có, có thể sửa các bản script sao chép để hỗ trợ mùa tiếp theo rồi chạy chúng tại đó.

`--refresh` lỗi sẽ ghi `staging.json` với `status: failed`; dữ liệu sống và saves không bị thay đổi. Không phát hành output của một lần chạy lỗi. Sau khi sửa adapter, chạy lại trong staging hoặc tạo staging mới. Máy cần các thư viện Python mà importer hiện tại sử dụng (`beautifulsoup4`, `certifi`).

## Kiểm tra và xuất bản ứng viên

Thay các giá trị ví dụ bên dưới bằng ID, ngày nguồn và nhãn đã xác minh. Ngày đóng cửa kỳ chuyển nhượng không tự chứng minh roster đã cập nhật xong.

```sh
node scripts/release-rosters.mjs \
  --id 2026-27-winter-YYYYMMDD \
  --name 'Đội hình sau kỳ chuyển nhượng mùa đông · 2026/27' \
  --season 2026/27 --as-of YYYY-MM-DD \
  --database .cache/roster-staging/2026-27-winter-review/public/data/database.json \
  --homegrown .cache/roster-staging/2026-27-winter-review/public/data/homegrown.json \
  --note 'Các nguồn và phạm vi đã được kiểm tra cho bản này.' \
  --check
```

Không có lỗi thì bỏ `--check` để xuất bản bằng cùng các tham số. `--dry-run` là tên khác của `--check`. Bỏ hai đường dẫn ứng viên sẽ dùng hai file nguồn hiện tại trong `public/data/`; lệnh vẫn không ghi đè chúng.

Kiểm tra bắt buộc gồm ID duy nhất, liên kết CLB/cầu thủ, đủ cả ba tầng của tám quốc gia, số CLB đúng theo giải, tối thiểu 14 cầu thủ và một thủ môn mỗi CLB, 108 suất UEFA không trùng, mùa nguồn khớp và chứng cứ home-grown đúng danh tính. Tuổi `0` được giữ như giá trị thiếu của nhà cung cấp; không suy ra ngày sinh mới.

So với phiên bản mới nhất, công cụ yêu cầu đối chiếu riêng khi mất hơn 5% cầu thủ tổng, hơn 2% CLB, hơn 10% ID cầu thủ, xóa giải, giảm mạnh một đội (hơn 5 người và hơn 30%), mất hơn 5% chứng cứ home-grown hoặc chứng cứ cũ hơn ngày bộ dữ liệu quá 90 ngày.

Khi phát hiện rủi ro, công cụ trả JSON có `code: ROSTER_REVIEW_REQUIRED` và danh sách `risks`. Chỉ sau khi kiểm tra từng thay đổi với nguồn, chạy lại với **từng mã chính xác**, ví dụ:

```sh
node scripts/release-rosters.mjs [cùng các tham số ứng viên] \
  --acknowledge-risk TOTAL_PLAYER_DROP \
  --acknowledge-risk CLUB_ROSTER_DROP:e83 \
  --review-note 'Nêu nguồn, số cầu thủ và lý do giảm đã được đối chiếu cụ thể.'
```

Đoạn `[cùng các tham số ứng viên]` là hướng dẫn thay thế, không phải tham số thật. Không chấp nhận `*`, mã cũ không còn trong diff, ghi chú quá ngắn hoặc một cờ `--force` tổng quát. Lỗi cấu trúc/danh tính/thiếu đội hình không thể bỏ qua bằng ghi chú. Hồ sơ review được lưu trong metadata của bản phát hành.

Sau xuất bản, dùng `--verify <id>` và kiểm tra API trước khi đánh dấu kỳ chuyển nhượng đã xử lý. Nếu tiến trình bị ngắt, kiểm tra phiên bản và `.publish.lock`; xác định PID giữ khóa đã dừng trước khi xóa khóa cũ. Không tự lấy khóa của tiến trình khác. Không sửa trực tiếp `index.json` hoặc các file của phiên bản đã phát hành.

## Quy trình kiểm tra định kỳ theo kỳ chuyển nhượng

Scheduler chỉ kiểm tra sự kiện thật, không xuất bản một bản giống nhau mỗi tuần. Dùng sổ cục bộ `.cache/roster-release-windows.json`, tách khỏi dữ liệu sự nghiệp:

```json
{
  "version": 1,
  "windows": {
    "eng-2026-summer": {
      "market": "eng",
      "season": "2026/27",
      "window": "summer",
      "closedAt": "NGÀY_GIỜ_CÓ_MÚI_GIỜ_ĐÃ_XÁC_MINH",
      "closureSourceUrl": "URL_CHÍNH_THỨC",
      "checkedAt": "THỜI_ĐIỂM_KIỂM_TRA_UTC",
      "status": "pending-sources",
      "candidateHashes": null,
      "releaseId": null,
      "releaseHash": null
    }
  }
}
```

Các giá trị viết hoa là chỗ điền, không phải dữ liệu mẫu đã xác minh. Khóa ổn định gồm thị trường–năm–kỳ (`eng-2026-summer`, `vie-2026-second`, v.v.); không dùng ngày chạy kiểm tra làm khóa. Theo dõi riêng Anh, Đức, Pháp, Ý, Tây Ban Nha, Bồ Đào Nha, Hà Lan và Việt Nam vì hạn đóng cửa có thể khác nhau.

1. Chỉ chạy tự động vào hai đợt **03/02 và 05/09 dương lịch thực tế** hằng năm, lúc 09:00 giờ Việt Nam; không dùng lịch mô phỏng trong game. Đọc sổ và chỉ mục phát hành trước. Đối chiếu ngày giờ đóng cửa từng thị trường bằng thông báo chính thức của liên đoàn/giải, ghi nguồn và múi giờ; thị trường còn mở phải được ghi rõ trong ghi chú nguồn của đợt.
2. Trong mỗi đợt, xác minh nguồn roster thực sự đã phản ánh đăng ký/chuyển nhượng tính đến ngày chốt. Chưa đủ nguồn thì giữ `pending-sources`, thông báo phần thiếu, không gán ngày mới vào snapshot cũ và không tự thêm lịch kiểm tra ngoài hai đợt.
3. Tạo staging mới, rà soát adapter, thu thập và chạy kiểm tra. Ghi `candidateHashes` bằng SHA-256 của database và homegrown. Hash giống bộ đã xuất bản và không có thay đổi roster được xác minh thì giữ `no-data-change`, không tạo bản trùng.
4. Rà soát cảnh báo chênh lệch; chỉ xác nhận những cảnh báo có chứng cứ. Lỗi thu thập/thiếu đội hình thì giữ `failed` cùng lý do; dữ liệu đang chơi không đổi.
5. Xuất bản tối đa một bản tổng hợp cho mỗi đợt, dùng ID xác định theo ngày chốt `YYYY-02-03` hoặc `YYYY-09-05`. Ghi ngày chốt và releaseId của đợt vào sổ; gắn cùng releaseId cho những khóa thị trường đã được bản đó bao phủ. Kiểm tra cả ngày chốt đợt và các kỳ thị trường để tránh phát hành trùng.
6. Chỉ sau khi `loadRosterRelease`/`--verify` thành công mới ghi `status: published`, `releaseId`, `releaseHash`. Ghi sổ bằng file tạm và rename. Lần chạy sau gặp khóa đã published thì xác minh bản đó tồn tại và bỏ qua, không xuất bản lại.
7. Thông báo người chơi khi có bản mới dùng được hoặc có lỗi cần họ xử lý. Save hiện tại tiếp tục với dữ liệu của chính nó. Không tự nhập file, tạo sự nghiệp, đổi CLB hoặc ghi đè save.

Nếu script bị ngắt giữa phát hành và ghi sổ, lần kiểm tra tiếp theo phải tìm ID xác định trong manifest và kiểm tra hash rồi bổ sung sổ, không tạo ID khác để thử lại.

## Lịch đã cài trên máy

Automation **Cập nhật đội hình Touchline** (`c-p-nh-t-i-h-nh-touchline`) gắn với task này, chạy đúng **hai lần mỗi năm vào 03/02 và 05/09, lúc 09:00 Asia/Ho_Chi_Minh**, theo lịch dương ngoài đời. Lịch này thay thế lịch thứ Hai hằng tuần. Lần kế tiếp tính tại thời điểm đổi lịch 03/10/2026 là **03/02/2027**. Chỉ xử lý dữ liệu mới sau mốc 03/10/2026. Lịch chạy do Codex quản lý; việc xuất bản vẫn phải qua đối chiếu nguồn và quy trình ở trên, chỉ áp dụng cho New Game. Sổ ban đầu đã được tạo với `trackingAfter` và `baselineReleaseId`, không tự đánh dấu kỳ lịch sử nào là đã xác minh.
