#!/usr/bin/env node
import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {ATTRS,editClub,editPlayer,healSquad,validateGame,overall} from '../src/engine.mjs';

const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){const name=args[i];if(['--max','--heal','--list','--help'].includes(name))options[name.slice(2)]=true;else if(['--input','--output','--club','--player','--money','--wage-budget'].includes(name)&&args[i+1])options[name.slice(2)]=args[++i];else{console.error('Tham số không hợp lệ:',name);process.exit(1);}}
if(options.help||!options.input){
 console.log(`Touchline Save Editor — chỉnh file lưu riêng, không ghi đè bản gốc.

node scripts/editor.mjs --input career.json --list
node scripts/editor.mjs --input career.json --money 1000000000 --wage-budget 10000000
node scripts/editor.mjs --input career.json --player "Lamine Yamal" --max --heal

--input FILE        File JSON xuất từ game hoặc trong thư mục saves/
--output FILE       Mặc định: FILE-edited.json (không được trùng bản gốc)
--club ID           CLB cần chỉnh tiền; mặc định đội đang dẫn dắt
--money NUMBER      Đặt cả số dư và ngân sách chuyển nhượng (€)
--wage-budget N     Đặt quỹ lương mỗi tuần (€)
--player NAME|ID    Tên đầy đủ hoặc mã cầu thủ cần chỉnh
--max              Tất cả kỹ năng 20, tiềm năng 100
--heal             Hồi phục toàn đội đang dẫn dắt
--list             Liệt kê cầu thủ của CLB đang chọn

Nhập file kết quả qua Lưu & dữ liệu → Nhập file lưu. File gốc được giữ lại.`);
 process.exit(0);
}
try{
 const input=path.resolve(options.input),g=JSON.parse(await readFile(input,'utf8'));validateGame(g);const club=options.club||g.clubId;if(!g.clubs[club])throw Error('Không tìm thấy CLB.');
 if(options.list){console.log(g.clubs[club].name);for(const p of Object.values(g.players).filter(p=>p.clubId===club))console.log(`${p.id.padEnd(24)} ${p.name.padEnd(30)} ${p.position} ${overall(p)}/100`);process.exit(0);}
 if(g.liveMatch)throw Error('Hãy hoàn tất trận đấu và xuất file lưu trước khi chỉnh bằng công cụ ngoài game.');
 if(options.money!==undefined||options['wage-budget']!==undefined){const patch={};if(options.money!==undefined){patch.cash=Number(options.money);patch.budget=Number(options.money);}if(options['wage-budget']!==undefined)patch.wageBudget=Number(options['wage-budget']);editClub(g,club,patch);}
 if(options.max){if(!options.player)throw Error('--max yêu cầu --player NAME hoặc ID.');const ps=Object.values(g.players).filter(p=>p.id===options.player||p.name.toLocaleLowerCase()===options.player.toLocaleLowerCase());if(ps.length!==1)throw Error(`Tìm thấy ${ps.length} cầu thủ. Dùng mã ID chính xác.`);editPlayer(g,ps[0].id,{attributes:Object.fromEntries(Object.keys(ATTRS).map(k=>[k,20])),potential:100,fitness:100,morale:100,injury:0,suspension:0});}
 if(options.heal)healSquad(g);
 if(!options.max&&!options.heal&&options.money===undefined&&options['wage-budget']===undefined)throw Error('Chưa chọn thay đổi. Dùng --help để xem cách dùng.');
 g.id=`career-${Date.now()}-edited`;validateGame(g);const output=path.resolve(options.output||input.replace(/\.json$/i,'')+'-edited.json');if(output===input)throw Error('File kết quả phải khác file gốc.');
 // Exclusive creation avoids replacing an unrelated file selected by mistake.
 await writeFile(output,JSON.stringify(g),{flag:'wx',mode:0o600});console.log('Đã tạo bản chỉnh sửa:',output);
}catch(error){console.error(error.message);process.exit(1);}
