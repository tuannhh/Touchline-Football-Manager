const senders={board:'Chủ tịch CLB',match:'Trợ lý huấn luyện viên',transfer:'Giám đốc bóng đá',season:'Ban tổ chức giải',medical:'Trưởng bộ phận y tế',finance:'Giám đốc tài chính',registration:'Thư ký CLB',news:'Văn phòng CLB'};
export function makeMessage(g,title,body,type='news',details={}){
 g.messageSequence=(g.messageSequence||0)+1;
 const club=g.clubs[g.clubId];
 return {id:`mail-${g.id}-${g.messageSequence}`,date:g.date,title,body,type,sender:senders[type]||senders.news,to:`${g.manager} · HLV trưởng ${club.name}`,readAt:null,...details};
}
export function mailParagraphs(m,g){
 if(m.paragraphs?.length)return m.paragraphs;
 const money=n=>Number(n).toLocaleString('vi-VN')+' €';
 const c=g.clubs[g.clubId],squad=Object.values(g.players).filter(p=>p.clubId===g.clubId);
 const intro=`Kính gửi HLV ${g.manager},`;
 const common=[intro,m.body];
 if(m.type==='board')common.push(`Ban lãnh đạo giao cho ông toàn quyền lựa chọn đội hình, xây dựng chiến thuật và kế hoạch tập luyện của ${c.name}. Mục tiêu trước mắt là ổn định bộ khung, giữ thể lực cho lịch thi đấu và sử dụng ngân sách hợp lý.`,`Đội bóng hiện có ${squad.length} cầu thủ. Ông có thể xem hồ sơ, quốc tịch, tình trạng thể lực và hợp đồng trong mục Đội hình. Mục Đăng ký sẽ giúp đối chiếu điều kiện dự giải và các suất đào tạo tại CLB hoặc trong nước.`,`Báo cáo tại thời điểm lập thư: số dư ${money(c.cash)}, ngân sách chuyển nhượng ${money(c.budget)}, quỹ lương ${money(c.wageBudget)}/tuần. Các giao dịch sau đó được ghi ở báo cáo tiếp theo.`,`Hãy hoàn thiện đội hình xuất phát và chọn Tiếp tục khi sẵn sàng. Chúng tôi sẽ gửi báo cáo kết quả, tài chính và tình trạng cầu thủ vào hộp thư này.`);
 else if(m.type==='transfer')common.push('Bộ phận bóng đá đã cập nhật hồ sơ đăng ký, ngân sách và quỹ lương trong game. Vui lòng kiểm tra đội hình xuất phát sau giao dịch và bổ sung cầu thủ vào danh sách đăng ký các giải đang tham dự.','Quốc tịch và tiêu chuẩn đào tạo được kiểm tra riêng. Cầu thủ mới có thể cần một suất trong danh sách chính; ký hợp đồng không tự bảo đảm điều kiện thi đấu UEFA.');
 else if(m.type==='season')common.push('Kết quả, danh hiệu và vị trí cuối mùa được lưu trong mục Giải đấu. Lịch quốc nội và lịch UEFA được theo dõi trong mục Lịch thi đấu.','Trước khi bắt đầu giai đoạn tiếp theo, hãy kiểm tra tuổi, thời hạn hợp đồng, kế hoạch tập luyện và danh sách đăng ký. Các điều lệ giản lược của mô phỏng được ghi ở trang Giải đấu.');
 else if(m.type==='match')common.push('Báo cáo chi tiết về cú sút, bàn thắng, thẻ phạt và chấn thương được lưu cùng trận đấu trong mục Lịch thi đấu.','Ban huấn luyện đề nghị rà soát thể lực của đội hình xuất phát và bố trí cầu thủ dự bị cho trận tiếp theo.');
 common.push('Trân trọng,',m.sender||senders[m.type]||senders.news);return common;
}
export function upgradeMessages(g){
 g.messageSequence=Math.max(g.messageSequence||0,g.messages.length);const used=new Set();
 g.messages=g.messages.map((m,i)=>{let id=m.id||`legacy-${i}`;if(used.has(id))id=`legacy-${i}-${id}`;used.add(id);const next={...m,id,sender:m.sender||senders[m.type]||senders.news,to:m.to||`${g.manager} · HLV trưởng`,readAt:m.readAt??null};if(!next.paragraphs)next.paragraphs=[`Kính gửi HLV ${g.manager},`,m.body,'Thư này được giữ từ phiên bản trước. Những số liệu không lưu kèm thư cũ không được dựng lại. Bạn có thể xem tình hình hiện tại trong các mục Đội hình, Tài chính và Lịch thi đấu.','Trân trọng,',next.sender];return next;});
}
