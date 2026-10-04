import React,{useEffect,useRef,useState} from 'react';
import {ArrowsClockwise,WarningCircle} from '@phosphor-icons/react';
import {number,dateLabel,dateTimeLabel} from './locale.mjs';
import './assessment-sources.css';

const endpoint='/api/player-assessments/refresh';
export default function AssessmentSources({onUpdated}){
 const [snapshot,setSnapshot]=useState(null),[job,setJob]=useState({status:'idle'}),[checking,setChecking]=useState(true),[starting,setStarting]=useState(false),[error,setError]=useState('');
 const mounted=useRef(false),startLock=useRef(false),notified=useRef(''),callback=useRef(onUpdated);callback.current=onUpdated;
 const readSnapshot=async()=>{
  const response=await fetch('/data/player-reality.json',{cache:'no-store'});if(!response.ok)throw Error('Không tải được bản dữ liệu đánh giá.');const next=await response.json();
  if(next?.version!==1||!next.players||!next.coverage)throw Error('Bản dữ liệu đánh giá không hợp lệ.');
  if(mounted.current)setSnapshot(next);return next;
 };
 const readStatus=async()=>{
  const response=await fetch(endpoint,{cache:'no-store'});if(!response.ok)throw Error('Không kiểm tra được tiến trình cập nhật.');const next=await response.json();if(mounted.current)setJob(next);return next;
 };
 useEffect(()=>{
  mounted.current=true;let active=true;
  Promise.allSettled([readSnapshot(),readStatus()]).then(results=>{if(!active)return;const failed=results.find(result=>result.status==='rejected');if(failed)setError(failed.reason.message);setChecking(false);});
  return()=>{active=false;mounted.current=false;};
 },[]);
 useEffect(()=>{
  if(job.status!=='running')return;let active=true,timer;
  const poll=async()=>{try{await readStatus();if(active)setError('');}catch(err){if(active){setError(err.message);timer=setTimeout(poll,3000);}}};
  timer=setTimeout(poll,3000);return()=>{active=false;clearTimeout(timer);};
 },[job]);
 useEffect(()=>{
  if(job.status!=='complete')return;const key=job.finishedAt||job.startedAt;if(!key||notified.current===key)return;notified.current=key;let active=true;
  readSnapshot().then(next=>{if(active&&mounted.current)callback.current?.(next);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};
 },[job.status,job.finishedAt,job.startedAt]);
 const refresh=async()=>{
  if(checking||starting||startLock.current||job.status==='running')return;startLock.current=true;setStarting(true);setError('');
  try{const response=await fetch(endpoint,{method:'POST'});const next=await response.json();if(!response.ok)throw Error(next.error||'Không bắt đầu được cập nhật đánh giá.');if(mounted.current)setJob(next);}
  catch(err){if(mounted.current)setError(err.message||'Không bắt đầu được cập nhật đánh giá.');}
  finally{startLock.current=false;if(mounted.current)setStarting(false);}
 };
 const coverage=snapshot?.coverage,running=job.status==='running',display=n=>Number.isFinite(n)?number(n):'—';
 return <section className="assessment-sources" aria-label="Dữ liệu đánh giá cho New Game">
  <header><div><h3>Dữ liệu đánh giá cho New Game</h3><p>Chỉ áp dụng khi tạo New Game. Sự nghiệp đang chơi giữ nguyên bộ đánh giá ban đầu.</p></div><button type="button" className="secondary" disabled={checking||starting||running} onClick={refresh}><ArrowsClockwise size={16} className={checking||starting||running?'spin':''}/>{running?'Đang cập nhật dữ liệu…':starting?'Đang bắt đầu…':'Tải dữ liệu đánh giá mới'}</button></header>
  {error&&<p className="assessment-source-error" role="alert"><WarningCircle size={16}/>{error}</p>}
  {job.status==='error'&&<p className="assessment-source-error" role="alert"><WarningCircle size={16}/><span>{job.error||'Cập nhật chưa thành công. Bản dữ liệu trước được giữ lại.'}</span></p>}
  {running&&<p className="assessment-source-progress" role="status">Đang thu thập từ nguồn công khai. Có thể mất vài phút; bạn vẫn có thể chơi với bản dữ liệu đang có.</p>}
  {job.status==='complete'&&<p className="assessment-source-complete" role="status">Đã hoàn tất đợt kiểm tra nguồn. Xem mức độ bao phủ và ngày thu thập bên dưới; các hồ sơ thiếu dữ liệu vẫn được ghi rõ.</p>}
  {snapshot&&<><dl className="assessment-source-facts"><div><dt>Mốc bộ dữ liệu</dt><dd>{dateLabel(snapshot.asOf)}</dd></div><div><dt>Lần tổng hợp</dt><dd>{dateTimeLabel(snapshot.importedAt)}</dd></div><div><dt>Hồ sơ có nguồn đối chiếu</dt><dd>{display(coverage.observations)} / {display(coverage.totalPlayers)}</dd></div><div><dt>Có giá trị thị trường từ nguồn</dt><dd>{display(coverage.marketValues)}</dd></div><div><dt>Có lịch sử thành tích</dt><dd>{display(coverage.performanceHistories)}</dd></div><div><dt>Lỗi nguồn trong lần thu thập</dt><dd>{display(coverage.sourceFailures)}</dd></div></dl><p className="fine-print">Ngày tổng hợp không có nghĩa mọi hồ sơ đều mới đến ngày đó. Mốc quan sát, nguồn và độ tin cậy được ghi riêng trong hồ sơ cầu thủ. Năng lực và tiềm năng là ước lượng của game; giá trị thị trường là ước tính của nhà cung cấp.</p></>}
  {!snapshot&&!checking&&<p className="fine-print">Chưa đọc được bộ đánh giá đã cài. Bạn có thể thử tải lại dữ liệu.</p>}
 </section>;
}
