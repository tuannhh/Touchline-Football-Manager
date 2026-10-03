"""Special public roster sources: official Vitoria B and dated Vietnam third-tier records."""
import importlib.util,json,re,unicodedata,hashlib,datetime as dt
from pathlib import Path
from bs4 import BeautifulSoup
s=importlib.util.spec_from_file_location('b',Path(__file__).with_name('import-data.py'));b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
P=b.PUBLIC/'data/database.json';db=json.loads(P.read_text());clubs={c['id']:c for c in db['clubs']};players={p['id']:p for p in db['players']}
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower().replace('đ','d')).encode('ascii','ignore').decode())
def add(c,ps):
 if c['id'] in clubs:return
 clubs[c['id']]=c
 for p in ps:
  # Cross-provider duplicates require exact full name + birth date. Missing dates are not guessed.
  same=next((x for x in players.values() if p.get('birthDate') and x.get('birthDate')==p['birthDate'] and norm(x['name'])==norm(p['name'])),None)
  if same:
   db['meta']['conflicts'].append(dict(player=p['name'],clubs=[same['clubId'],p['clubId']],chosen=same['clubId'],resolution='Exact full name + birth date; earlier source retained'));continue
  players.setdefault(p['id'],p)
 print(c['name'],len(ps),flush=True)
url='https://vitoriasc.pt/equipa-b/';doc=BeautifulSoup(b.get(url),'html.parser');ps=[];position='GK'
for el in doc.select('h1,h2,h3,h4,h5,h6'):
 name=el.get_text(' ',strip=True)
 if name=='EQUIPA TÉCNICA':break
 if name in ['GUARDA-REDES','DEFESAS','MÉDIOS','AVANÇADOS']:position={'GUARDA-REDES':'GK','DEFESAS':'DF','MÉDIOS':'MF','AVANÇADOS':'FW'}[name]
 if 'team-member_title' not in el.get('class',[]):continue
 desc=el.find_next('p').get_text(' ',strip=True);m=re.search(r'Data de nascimento: (\d{2}/\d{2}/\d{4}) Nacionalidade: (.*)',desc)
 if not m:continue
 dob=dt.datetime.strptime(m[1],'%d/%m/%Y').date();nat=m[2].strip();code={'Portugal':'PT','Marrocos':'MA','Angola':'AO','Costa do Marfim':'CI','Noruega':'NO','Inglaterra':'ENG','Nigéria':'NG','Espanha':'ES','Canadá':'CA'}.get(nat,'')
 ps.append(dict(id='vb-'+norm(name),clubId='f338305',name=name.title(),shortName=name.title(),position=position,positionKnown=True,birthDate=dob.isoformat(),age=b.NOW.year-dob.year-((b.NOW.month,b.NOW.day)<(dob.month,dob.day)),countryCode=code,nationality=nat,number='',source='Vitória SC official',sourceUrl=url,sourceStats={},photo='',photoUrl=''))
assert len(ps)>=20,len(ps)
add(dict(id='f338305',name='Vitória de Guimarães B',shortName='Vitória B',abbreviation='VIT',leagueId='por.3.1',reserveTeam=True,color='#222222',alternateColor='#ffffff',source='FotMob / Vitória SC',sourceUrl=url,season='2026/27',badge='',badgeUrl='https://images.fotmob.com/image_resources/logo/teamlogo/338305.png'),ps)
# The next complete 2027 entry list is not yet announced. Only known continuing clubs are used.
# Promoted/relegated 2026 teams are excluded to avoid listing a club in two divisions.
source='https://bvhttdl.gov.vn/xac-inh-bang-au-giai-hang-nhi-quoc-gia-2026-14-oi-tham-du-tranh-3-suat-thang-hang.htm'
note='Danh sách tạm cho mô phỏng 2026/27: 9 CLB còn lại sau mùa Hạng Nhì 2026, đã loại 3 đội lên hạng và 2 đội xuống hạng. Chưa có đủ danh sách tham dự 2027. Đội hình dùng mốc công khai 2026 ghi riêng trên hồ sơ; vòng đấu và nhóm 4/5 đội là giản lược của game.'
for i,count in [(1,4),(2,5)]:
 lid='vie.3.'+str(i)
 if not any(l['id']==lid for l in db['leagues']):db['leagues'].append(dict(id=lid,parentId='vie.3',name='Hạng Nhì · Bảng '+('A' if i==1 else 'B')+' (tạm)',country='Việt Nam',countryCode='VN',tier=3,kind='domestic',season='2026 → mô phỏng 2026/27',expectedTeams=count,sourceName='Bộ VHTTDL / hồ sơ 2026',sourceUrl=source,provisional=True,dataNote=note))
rows=[('tre-cahn','Trẻ Công an Hà Nội',1,'Cong_An_Hanoi_FC_Reserves_and_Academy','',True),('pvf','PVF',1,'PVF_Football_Academy','',False),('tdtt-ha-tinh','TT TDTT Hà Tĩnh',1,'Ha_Tinh_Sports_Training_and_Competition_Center','Current players',True),('tre-shb-da-nang','Trẻ SHB Đà Nẵng',1,'SHB_Da_Nang','Reserves team',True),('vinh-long','Vĩnh Long',2,'Vinh_Long_FC','',False),('truong-giang-gia-dinh','Trường Giang Gia Định',2,'Truong_Giang-Gia_Dinh_FC','Current squad',False),('tay-ninh-hn2','Tây Ninh',2,'Tay_Ninh_FC','',False),('quang-ngai-hn2','Quảng Ngãi',2,'Quang_Ngai_FC_(2025)','',False),('dak-lak-hn2','Đắk Lắk',2,'Dak_Lak_FC','',False)]
for slug,name,group,wiki,heading,reserve in rows:
 tid='v3-'+slug;u='https://en.wikipedia.org/wiki/'+wiki;doc=BeautifulSoup(b.get(u),'html.parser');ps=[];seen=set()
 tables=[t for t in doc.select('table') if not t.find('table') and 'Pos.' in t.get_text() and 'Player' in t.get_text()]
 for table in tables:
  h=table.find_previous(['h2','h3','h4']);label=h.get_text(' ',strip=True) if h else ''
  if heading and label!=heading:continue
  if not heading and label not in ['Current squad','Current players','Players','Squad']:continue
  for row in table.select('tr'):
   cells=row.find_all('td',recursive=False)
   if len(cells)!=4:continue
   num,pos,nat,pname=[c.get_text(' ',strip=True) for c in cells];pname=re.sub(r'\s*\(.*','',pname).strip()
   if not pname or pname in seen:continue
   seen.add(pname);pid='v3p-'+slug+'-'+norm(pname)
   ps.append(dict(id=pid,clubId=tid,name=pname,shortName=pname,position=pos if pos in ['GK','DF','MF','FW'] else 'MF',positionKnown=pos in ['GK','DF','MF','FW'],age=None,birthDate='',countryCode={'VIE':'VN','AUS':'AU'}.get(nat,nat),nationality={'VIE':'Việt Nam','AUS':'Australia'}.get(nat,nat),nationalityBasis='Football nationality listed by source; dual citizenship not confirmed',number=num if num.isdigit() else '',source='Wikipedia · danh sách 2026',sourceUrl=u,sourceStats={},photo='',photoUrl='',rosterNote='Đội hình công khai mùa 2026; chưa xác minh lại chuyển nhượng sau giải. Tuổi chưa có nguồn được ước lượng trong game. Quốc gia theo nguồn bóng đá, chưa có đủ dữ liệu hộ chiếu kép.'))
 assert len(ps)>=16,(name,len(ps),[t.find_previous(['h2','h3','h4']).get_text() for t in tables])
 # Current first-team registries take precedence over historical reserve listings.
 exact={norm(p['name']):p for p in players.values() if p['source']=='VPF'}
 filtered=[]
 for p in ps:
  match=exact.get(norm(p['name']))
  if match and reserve:
   db['meta']['conflicts'].append(dict(player=p['name'],clubs=[match['clubId'],tid],chosen=match['clubId'],resolution='Current VPF professional registration retained over historical academy list'));continue
  filtered.append(p)
 add(dict(id=tid,name=name,shortName=name,abbreviation=''.join(x[0] for x in name.split())[:4],leagueId='vie.3.'+str(group),reserveTeam=reserve,color='#ba3340',alternateColor='#eeeeee',source='Bộ VHTTDL / Wikipedia',sourceUrl=u,season='2026',dataNote=note,rosterStatus='Dated public 2026 list; 2027 membership provisional',badge='',badgeUrl=''),filtered)
# Avoid duplicate identities across ESPN and FotMob with corroborating date of birth.
seen={};remove=[]
for p in players.values():
 key=(norm(p['name']),p.get('birthDate'))
 if not key[1]:continue
 if key in seen:
  old=seen[key];remove.append(p['id']);db['meta']['conflicts'].append(dict(player=p['name'],clubs=[old['clubId'],p['clubId']],chosen=old['clubId'],resolution='Exact full name + birth date; earlier source retained'))
 else:seen[key]=p
for pid in remove:players.pop(pid)
for c in clubs.values():
 if re.search(r'(?: B$| II$|^Jong |Castilla|Fabril|Madrileño|U23$|U-23$|Futuro|Next Gen)',c['name']):c['reserveTeam']=True
b.asset((clubs['f338305'],'badge','badges'))
db.update(clubs=list(clubs.values()),players=list(players.values()));db['meta']['provisionalLeagues']=['vie.3.1','vie.3.2'];db['meta']['sources']+=['Vitória SC official B squad','Wikipedia dated Vietnamese third-tier squad tables'];db['meta']['expandedAt']=b.NOW.isoformat();db['meta']['badgesDownloaded']=sum(bool(c.get('badge')) for c in clubs.values());db['meta']['nationalitiesAvailable']=sum(bool(p.get('nationality')or p.get('countryCode')) for p in players.values())
P.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
print('TOTAL',len(clubs),len(players),flush=True)
