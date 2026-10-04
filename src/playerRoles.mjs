// A small, independent simulation catalogue inspired by FM26's dual roles.
// Descriptions and effects below are Touchline's own; this is not the full FM database.
export const PLAYER_ROLE_SOURCES=[
 'https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution',
 'https://www.footballmanager.com/the-dugout/mastering-wide-forward-fm26',
 'https://www.footballmanager.com/the-dugout/mastering-your-rest-attack-fm26',
 'https://www.footballmanager.com/the-dugout/dominate-dual-strikers-fm26',
 'https://www.footballmanager.com/the-dugout/leading-line-fm26-lone-strikers',
];
const ip='inPossession',oop='outOfPossession',backs=['LB','RB','LWB','RWB'],wings=['LM','RM','LW','RW'];
const role=(id,label,phase,positions,attributes,behavior,description)=>({id,label,phase,positions,attributes,behavior,description});
export const PLAYER_ROLES=[
 role('goalkeeper','Goalkeeper',ip,['GK'],['handling','reflexes','positioning'],'goalkeeper','Giữ vị trí trong khung thành và chuyền bóng đơn giản.'),
 role('ball-playing-goalkeeper','Ball-Playing Goalkeeper',ip,['GK'],['passing','decisions','composure'],'playmaker','Tham gia triển khai bóng từ phía sau, ưu tiên đồng đội có khoảng trống.'),
 role('no-nonsense-goalkeeper','No-Nonsense Goalkeeper',ip,['GK'],['handling','strength','decisions'],'direct','Phát bóng sớm và trực diện để giảm rủi ro gần khung thành.'),
 role('centre-back','Centre-Back',ip,['CB'],['positioning','tackling','heading'],'centre-back','Giữ nền phòng ngự và luân chuyển bóng an toàn.'),
 role('ball-playing-centre-back','Ball-Playing Centre-Back',ip,['CB'],['passing','vision','composure'],'playmaker','Tìm đường chuyền xuyên tuyến từ hàng thủ.'),
 role('overlapping-centre-back','Overlapping Centre-Back',ip,['CB'],['stamina','passing','pace'],'overlapping-centre-back','Dâng lệch ra biên để hỗ trợ phối hợp khi đội có bóng.'),
 role('full-back','Full-Back',ip,backs,['tackling','positioning','crossing'],'full-back','Hỗ trợ cánh có chọn lọc và giữ liên kết với hàng thủ.'),
 role('wing-back','Wing-Back',ip,backs,['stamina','crossing','pace'],'wing-back','Dâng cao dọc biên, chồng cánh và tìm cơ hội tạt bóng.'),
 role('inside-full-back','Inside Full-Back',ip,backs,['positioning','tackling','decisions'],'inside-full-back','Bó vào cạnh trung vệ để bảo vệ phía sau; cách dùng tương tự inverted full back.'),
 role('inside-wing-back','Inside Wing-Back',ip,backs,['passing','decisions','positioning'],'inside-wing-back','Bó vào khu vực tiền vệ trụ khi bóng được triển khai lên trên.'),
 role('playmaking-wing-back','Playmaking Wing-Back',ip,backs,['passing','vision','decisions'],'playmaking-wing-back','Di chuyển vào trong để làm điểm nhận bóng và điều phối từ biên.'),
 role('advanced-wing-back','Advanced Wing-Back',ip,backs,['pace','stamina','crossing'],'advanced-wing-back','Giữ vị trí cao và rộng để tạo thêm mũi tấn công ngoài biên.'),
 role('defensive-midfielder','Defensive Midfielder',ip,['DM'],['positioning','passing','teamwork'],'holding','Làm điểm tựa phía trước trung vệ và giữ cân bằng khi có bóng.'),
 role('deep-lying-playmaker','Deep-Lying Playmaker',ip,['DM','CM'],['passing','vision','decisions'],'playmaker','Lùi nhận bóng và mở hướng tấn công từ tuyến thấp.'),
 role('central-midfielder','Central Midfielder',ip,['CM'],['passing','teamwork','decisions'],'central-midfielder','Liên kết các tuyến và hỗ trợ người cầm bóng ở trung lộ.'),
 role('midfield-playmaker','Midfield Playmaker',ip,['CM'],['passing','vision','composure'],'playmaker','Tìm khoảng trống ở giữa sân để điều tiết và tạo đường chuyền.'),
 role('box-to-box-midfielder','Box-to-Box Midfielder',ip,['CM','DM'],['stamina','teamwork','positioning'],'box-to-box','Di chuyển dọc sân, hỗ trợ triển khai rồi xâm nhập tuyến trên.'),
 role('wide-central-midfielder','Wide Central Midfielder',ip,['CM'],['stamina','crossing','teamwork'],'wide-central-midfielder','Di chuyển sang hành lang trong để kết nối với cầu thủ biên.'),
 role('attacking-midfielder','Attacking Midfielder',ip,['AM'],['vision','passing','dribbling'],'attacking-midfielder','Nhận bóng giữa các tuyến và hỗ trợ khu vực trước vòng cấm.'),
 role('advanced-playmaker','Advanced Playmaker',ip,['AM','CM','LW','RW'],['vision','passing','decisions'],'playmaker','Tìm bóng giữa các tuyến để tạo cơ hội cho đồng đội.'),
 role('winger','Winger',ip,wings,['pace','crossing','dribbling'],'winger','Giữ chiều rộng và ưu tiên đi biên, căng ngang hoặc tạt bóng.'),
 role('inside-forward','Inside Forward',ip,['LW','RW'],['finishing','dribbling','positioning'],'inside-forward','Bó vào gần tiền đạo để xâm nhập vòng cấm và dứt điểm.'),
 role('wide-forward','Wide Forward',ip,['LW','RW'],['pace','finishing','composure'],'wide-forward','Xuất phát rộng rồi chạy sau hàng thủ hoặc tấn công vòng cấm.'),
 role('centre-forward','Centre Forward',ip,['ST'],['finishing','positioning','strength'],'centre-forward','Làm điểm đến ở trung lộ và kết thúc các pha tấn công.'),
 role('poacher','Poacher',ip,['ST'],['pace','finishing','positioning'],'poacher','Bám hàng thủ và tìm thời điểm chạy vào khoảng trống phía sau.'),
 role('deep-lying-forward','Deep-Lying Forward',ip,['ST'],['passing','teamwork','composure'],'deep-lying-forward','Lùi kết nối đường chuyền, kéo hậu vệ ra và phối hợp với tuyến hai.'),
 role('channel-forward','Channel Forward',ip,['ST'],['pace','dribbling','positioning'],'channel-forward','Chạy lệch vào khoảng giữa trung vệ và hậu vệ cánh.'),
 role('goalkeeper-oop','Goalkeeper',oop,['GK'],['reflexes','handling','positioning'],'goalkeeper','Bảo vệ khung thành và xử lý bóng trong khu vực gần cầu môn.'),
 role('sweeper-keeper-oop','Sweeper Keeper',oop,['GK'],['decisions','pace','positioning'],'sweeper','Chủ động bảo vệ khoảng trống phía sau hàng thủ dâng cao.'),
 role('centre-back-oop','Centre-Back',oop,['CB'],['positioning','tackling','heading'],'centre-back','Giữ hàng thủ và theo dõi tiền đạo trong khu vực được phân công.'),
 role('covering-centre-back','Covering Centre-Back',oop,['CB'],['pace','positioning','decisions'],'covering','Lùi bọc lót đồng đội, ưu tiên ngăn đường chọc khe phía sau.'),
 role('pressing-centre-back','Pressing Centre-Back',oop,['CB'],['tackling','strength','decisions'],'pressing','Bước lên áp sát người nhận bóng khi có đồng đội bọc lót.'),
 role('full-back-oop','Full-Back',oop,backs,['positioning','tackling','pace'],'full-back','Giữ hành lang biên và hỗ trợ trung vệ khi cần.'),
 role('pressing-full-back','Pressing Full-Back',oop,backs,['stamina','tackling','pace'],'pressing','Dâng áp sát sớm để chặn đối phương triển khai dọc biên.'),
 role('holding-full-back','Holding Full-Back',oop,backs,['positioning','tackling','decisions'],'holding','Giữ vị trí thấp, ưu tiên bảo vệ cấu trúc hàng thủ.'),
 role('defensive-midfielder-oop','Defensive Midfielder',oop,['DM'],['positioning','tackling','teamwork'],'holding','Che chắn trung lộ phía trước hàng thủ.'),
 role('pressing-defensive-midfielder','Pressing Defensive Midfielder',oop,['DM'],['stamina','tackling','decisions'],'pressing','Rời vị trí để hỗ trợ gây áp lực lên tuyến giữa đối phương.'),
 role('holding-defensive-midfielder','Holding Defensive Midfielder',oop,['DM'],['positioning','tackling','decisions'],'holding','Giữ khu vực tiền vệ trụ và hạn chế lao theo bóng.'),
 role('central-midfielder-oop','Central Midfielder',oop,['CM'],['positioning','teamwork','stamina'],'central-midfielder','Giữ cự ly tuyến giữa và hỗ trợ phòng ngự quanh bóng.'),
 role('pressing-central-midfielder','Pressing Central Midfielder',oop,['CM'],['stamina','tackling','decisions'],'pressing','Chủ động áp sát người cầm bóng trong tuyến giữa.'),
 role('holding-central-midfielder','Holding Central Midfielder',oop,['CM'],['positioning','tackling','teamwork'],'holding','Giữ cự ly trung tâm để bảo vệ khoảng trống sau đồng đội.'),
 role('wide-covering-midfielder','Wide Covering Midfielder',oop,['CM','DM'],['stamina','positioning','teamwork'],'wide-covering','Dịch sang biên để bọc lót hậu vệ cánh khi tiền đạo giữ vị trí cao.'),
 role('tracking-attacking-midfielder','Tracking Attacking Midfielder',oop,['AM'],['stamina','teamwork','positioning'],'tracking','Lùi hỗ trợ tuyến giữa và theo người nhận bóng ở trung tâm.'),
 role('outlet-attacking-midfielder','Outlet Attacking Midfielder',oop,['AM'],['pace','dribbling','composure'],'outlet','Ở lại phía trên làm điểm nhận bóng cho pha phản công.'),
 role('tracking-winger','Tracking Winger',oop,wings,['stamina','teamwork','positioning'],'tracking','Lùi theo đối thủ ngoài biên để hỗ trợ hậu vệ cánh.'),
 role('outlet-winger','Wide Outlet Winger',oop,wings,['pace','dribbling','composure'],'outlet','Giữ vị trí cao và rộng để sẵn sàng phản công; biên sau lưng cần bọc lót.'),
 role('tracking-centre-forward','Tracking Centre Forward',oop,['ST'],['stamina','teamwork','positioning'],'tracking','Lùi về hỗ trợ tuyến giữa khi đội không có bóng.'),
 role('central-outlet-centre-forward','Central Outlet Centre Forward',oop,['ST'],['pace','strength','composure'],'outlet','Giữ vị trí gần hàng thủ đối phương để làm điểm thoát bóng.'),
];
export const ROLE_BY_ID=Object.fromEntries(PLAYER_ROLES.map(r=>[r.id,r]));
export const playerRoleDefinition=id=>ROLE_BY_ID[id]||null;
export const rolesForPosition=(position,phase)=>PLAYER_ROLES.filter(r=>r.phase===phase&&r.positions.includes(position));
export const validPlayerRole=(id,position,phase)=>!!ROLE_BY_ID[id]&&ROLE_BY_ID[id].phase===phase&&ROLE_BY_ID[id].positions.includes(position);
const defaults={inPossession:{GK:'goalkeeper',CB:'centre-back',LB:'full-back',RB:'full-back',LWB:'wing-back',RWB:'wing-back',DM:'defensive-midfielder',CM:'central-midfielder',AM:'attacking-midfielder',LM:'winger',RM:'winger',LW:'winger',RW:'winger',ST:'centre-forward'},outOfPossession:{GK:'goalkeeper-oop',CB:'centre-back-oop',LB:'full-back-oop',RB:'full-back-oop',LWB:'full-back-oop',RWB:'full-back-oop',DM:'defensive-midfielder-oop',CM:'central-midfielder-oop',AM:'tracking-attacking-midfielder',LM:'tracking-winger',RM:'tracking-winger',LW:'tracking-winger',RW:'tracking-winger',ST:'tracking-centre-forward'}};
export const defaultPlayerRole=(position,phase)=>defaults[phase]?.[position]||null;
// Role skills add a small modifier; positional familiarity is scored separately.
export function playerRoleFit(player,id){
 const r=ROLE_BY_ID[id];if(!r||!player?.attributes)return 1;
 const average=r.attributes.reduce((sum,key)=>sum+(player.attributes[key]||1),0)/r.attributes.length;
 return Math.max(.88,Math.min(1.06,.88+(average-1)/19*.18));
}
