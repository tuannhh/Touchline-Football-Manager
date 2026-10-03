"""Current Dutch reserve lists: official Sparta website and VI 2026/27 squad table."""
import importlib.util,json,re,unicodedata,concurrent.futures as cf,datetime as dt,urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup
s=importlib.util.spec_from_file_location('b',Path(__file__).with_name('import-data.py'));b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
P=b.PUBLIC/'data/database.json';db=json.loads(P.read_text());clubs={c['id']:c for c in db['clubs']};players={p['id']:p for p in db['players']}
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
positions={'Keepers':'GK','Verdedigers':'DF','Middenvelders':'MF','Aanvallers':'FW'}
def player(tid,name,pos,url,source,**kw):return dict(id='jr-'+tid+'-'+norm(name),clubId=tid,name=name,shortName=name,position=pos,positionKnown=True,age=None,birthDate='',countryCode='',nationality='',number='',source=source,sourceUrl=url,sourceStats={},photo='',photoUrl='',**kw)
def saveclub(tid,name,url,ps):
 if tid in clubs:return
 assert len(ps)>=16,(name,len(ps))
 clubs[tid]=dict(id=tid,name=name,shortName=name,abbreviation='JSP' if tid=='f681215' else 'JAL',leagueId='ned.3',reserveTeam=True,color='#b7283d',alternateColor='#ffffff',sourceUrl=url,source='Club / VI',season='2026/27',badge='',badgeUrl=f'https://images.fotmob.com/image_resources/logo/teamlogo/{tid[1:]}.png')
 existing={norm(p['name']):p for p in players.values() if clubs[p['clubId']]['leagueId'] in ['ned.1','ned.2']}
 for p in ps:
  if norm(p['name']) in existing:
   old=existing[norm(p['name'])];db['meta']['conflicts'].append(dict(player=p['name'],clubs=[old['clubId'],tid],chosen=old['clubId'],resolution='Keep professional first-team registration over concurrent reserve listing'));continue
  players[p['id']]=p
 print(name,len(ps),flush=True)
u='https://www.sparta-rotterdam.nl/clubliefde/selectie-jong-sparta/';doc=BeautifulSoup(b.get(u),'html.parser');cards=[a for a in doc.select('a.sparta-player-card') if a.select_one('.sparta-player-role').get_text(strip=True) in positions]
def sparta(a):
 name=a.select_one('.sparta-player-name').get_text(' ',strip=True);name=' '.join(name.split());p=player('f681215',name,positions[a.select_one('.sparta-player-role').get_text(strip=True)],a['href'],'Sparta Rotterdam official')
 try:
  txt=BeautifulSoup(b.get(a['href']),'html.parser').get_text(' ',strip=True);m=re.search(r'Geboortedatum (\d{2}) (\w+) (\d{4})',txt)
  if m:
   month=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'].index(m[2])+1;date=dt.date(int(m[3]),month,int(m[1]));p.update(birthDate=date.isoformat(),age=b.NOW.year-date.year-((b.NOW.month,b.NOW.day)<(date.month,date.day)))
  m=re.search(r'Nationaliteit (.*?) Afkomstig van',txt)
  if m and m[1]!='-':p['nationality']=m[1];p['countryCode']={'Nederland':'NL','Suriname':'SR','Zweden':'SE','België':'BE','Curaçao':'CW','Marokko':'MA','Spanje':'ES'}.get(m[1],'')
 except Exception as e:print('profile unavailable',name,str(e)[:80],flush=True)
 return p
with cf.ThreadPoolExecutor(max_workers=6) as ex:ps=list(ex.map(sparta,cards))
saveclub('f681215','Jong Sparta Rotterdam',u,ps)
u='https://www.vi.nl/clubs/jong-almere-city/selectie';doc=BeautifulSoup(b.get(u),'html.parser');assert '2026/2027' in doc.get_text();ps=[]
for table in doc.select('table'):
 title=table.select_one('th');pos=positions.get(title.get_text(strip=True)) if title else None
 if not pos:continue
 for row in table.select('tbody tr'):
  namecell=row.select_one('[data-column="name"]');a=namecell.select_one('a') if namecell else None
  if not a:continue
  p=player('f681424',a.get_text(strip=True),pos,'https://www.vi.nl'+a['href'],'VI · 2026/27');n=row.select_one('[data-column="rank"]').get_text(strip=True);p['number']=n if n.isdigit() else ''
  flag=namecell.select_one('img');src=urllib.parse.unquote(flag.get('src','')) if flag else '';m=re.search(r'/flags/([a-z]{2,3})\.png',src)
  if m:p['countryCode']=m[1].upper()
  p['sourceStats']={k:int(row.select_one('[data-column="'+col+'"]').get_text()) if row.select_one('[data-column="'+col+'"]').get_text().isdigit() else 0 for k,col in [('appearances','appearances'),('totalGoals','goals'),('goalAssists','assists')]};ps.append(p)
saveclub('f681424','Jong Almere City FC',u,ps)
for c in clubs.values():
 if not c.get('badge') and c.get('badgeUrl'):b.asset((c,'badge','badges'))
db.update(clubs=list(clubs.values()),players=list(players.values()));db['meta']['expansionErrors']=[];db['meta']['sources']+=['Sparta Rotterdam official youth squad','Voetbal International 2026/27 Jong Almere squad'];db['meta']['badgesDownloaded']=sum(bool(c.get('badge')) for c in clubs.values());P.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
print('TOTAL',len(clubs),len(players),flush=True)
