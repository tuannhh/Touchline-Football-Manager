"""Separate, non-playable scouting sources. Never rewrites a roster release or save.

Official club adapters provide roster identities and portraits; FotMob supplements
coverage. Run with --no-photos to inspect coverage before downloading assets.
Responses are cached by import-data.py; errors are recorded rather than invented.
"""
import argparse, concurrent.futures as cf, datetime as dt, hashlib, importlib.util
import io, json, re, unicodedata, urllib.parse
from pathlib import Path
from PIL import Image, ImageStat
from scouting_official import enrich_official

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('base', ROOT/'scripts/import-data.py')
base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
NOW = dt.datetime.now(dt.timezone.utc).isoformat()
LEAGUES = [
 ('bra',268,'Série A','Brazil','BR',70), ('arg',112,'Liga Profesional','Argentina','AR',68),
 ('gre',135,'Super League','Hy Lạp','GR',65), ('pol',196,'Ekstraklasa','Ba Lan','PL',62),
 ('tur',71,'Süper Lig','Thổ Nhĩ Kỳ','TR',70), ('jpn',223,'J1 League','Nhật Bản','JP',62),
 ('kor',9080,'K League 1','Hàn Quốc','KR',59), ('ksa',536,'Saudi Pro League','Saudi Arabia','SA',65),
 ('usa',130,'Major League Soccer','Mỹ / Canada','US',63), ('aus',113,'A-League Men','Úc / New Zealand','AU',54),
 ('nga',533,'Nigeria Premier Football League','Nigeria','NG',48),
 ('gha',522,'Ghana Premier League','Ghana','GH',47),
 ('civ',None,'Ligue 1','Bờ biển Ngà','CI',49),
]
ERRORS=[]
def norm(s):
 return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def fetch(url): return base.BeautifulSoup(base.get(url),'html.parser')
def league_id(code): return 'scout.'+code
def club(cid,name,code,source,url,rep):
 return dict(id=cid,name=name,shortName=name,abbreviation=name[:3].upper(),leagueId=league_id(code),playable=False,scoutingOnly=True,simulationReputation=rep,color='#286345',alternateColor='#eeeeee',badge='',source=source,sourceUrl=url,snapshotAt=NOW)
def player(pid,cid,name,position,url,source):
 return dict(id=pid,clubId=cid,name=name,shortName=name,position=position,positionKnown=position in ['GK','DF','MF','FW'],naturalPositions=[],age=None,birthDate='',nationality='',countryCode='',number='',height=None,photo='',source=source,sourceUrl=url,snapshotAt=NOW)
def teams_in(value):
 found={}
 def walk(v):
  if isinstance(v,dict):
   if isinstance(v.get('table'),dict):
    for t in v['table'].get('all',[]):
     if t.get('id') and t.get('name'): found[t['id']]=t
   for x in v.values(): walk(x)
  elif isinstance(v,list):
   for x in v:walk(x)
 walk(value); return list(found.values())
def fotmob_team(task):
 code,rep,t=task; tid=t['id'];url=f'https://www.fotmob.com/teams/{tid}/squad'
 try:
  data=base.jsonget(f'https://www.fotmob.com/api/data/teams?id={tid}')
  c=club('sf'+str(tid),t['name'],code,'FotMob',url,rep);c['fotmobId']=tid
  rows=[]
  for group in ((data.get('squad') or {}).get('squad') or []):
   pos={'keepers':'GK','defenders':'DF','midfielders':'MF','attackers':'FW'}.get(group.get('title'))
   if not pos:continue
   for r in group.get('members',[]):
    fid=r['id'];p=player('f'+str(fid),c['id'],r['name'],pos,f'https://www.fotmob.com/players/{fid}','FotMob')
    roles=[{'CDM':'DM','CAM':'AM','CF':'ST'}.get(x,x) for x in (r.get('positionIdsDesc') or '').split(',')]
    p.update(fotmobId=fid,sourceId=fid,naturalPositions=[x for x in roles if x in ['GK','CB','LB','RB','LWB','RWB','DM','CM','AM','LM','RM','LW','RW','ST']],birthDate=(r.get('dateOfBirth') or '')[:10],age=r.get('age'),nationality=r.get('cname') or '',countryCode=r.get('ccode') or '',height=r.get('height'),number=r.get('shirtNumber') or '',photoUrl=f'https://images.fotmob.com/image_resources/playerimages/{fid}.png')
    value=r.get('transferValue')
    if isinstance(value,(float,int)) and value>0:p['realWorld']={'playerId':p['id'],'fotmobId':fid,'sourceUrl':p['sourceUrl'],'sourceGameClubId':c['id'],'observedAt':NOW,'marketValue':{'eur':value,'asOf':NOW[:10],'provider':'FotMob','kind':'provider_estimate'}}
    rows.append(p)
  if not rows:ERRORS.append({'club':c['name'],'sourceUrl':url,'reason':'Source returned no player roster'})
  return c,rows
 except Exception as e:ERRORS.append({'club':t['name'],'sourceUrl':url,'reason':str(e)});return None,[]

OFFICIAL=[
 ('asec','ASEC Mimosas','civ','https://www.asec.ci/',55),
 ('kotoko','Asante Kotoko','gha','https://scasantekotoko.com/players',53),
 ('enyimba','Enyimba','nga','https://enyimbafc.net/',54),
 ('rangers','Enugu Rangers','nga','https://www.rangersintl.com/about',54),
]
def official_team(config):
 key,name,code,url,rep=config;c=club('official-'+key,name,code,'Official club website',url,rep);doc=fetch(url);rows=[];seen=set()
 if key=='rangers':
  c['fotmobId']=102054
  # Men's squad is a distinct list, before the women's squad and staff sections.
  anchor=doc.find('img',alt='Abuchi Okeke')
  if not anchor:raise ValueError('Men\'s roster selector changed')
  for card in anchor.find_parent('ul').find_all('li',recursive=False):
   labels=card.find_all('p',recursive=False)
   if len(labels)!=2:continue
   label=labels[0].get_text(' ',strip=True);role=labels[1].get_text(' ',strip=True)
   position={'Goalkeeper':'GK','Defenders':'DF','Midfielders':'MF','Forward':'FW','Forwards':'FW'}.get(role)
   if not position:continue
   p=player('official-rangers-'+norm(label),c['id'],label,position,url,'Official club website');img=card.find('img')
   p['photoUrl']=urllib.parse.parse_qs(urllib.parse.urlparse(img.get('src','')).query).get('url',[''])[0] if img else ''
   rows.append(p)
  return c,rows
 for a in doc.select('a[href*="/players/"]' if key=='kotoko' else 'a[href*="/player/"]'):
  href=urllib.parse.urljoin(url,a['href']);img=a.find('img')
  if href in seen or not img:continue
  seen.add(href);position='MF';label='';number=''
  if key=='asec':
   label=a.find('strong').get_text(' ',strip=True);position={'gardien':'GK','defenseur':'DF','milieu':'MF','attaquant':'FW'}.get(a.find('span').get_text(' ',strip=True),'MF');photo=img.get('src','')
  elif key=='kotoko':
   label=re.sub(r'^\d+\s*','',a.get_text(' ',strip=True));number=a.find('h3').get_text(strip=True)
   heading=a.find_previous('h2').get_text(strip=True);position={'Goalkeepers':'GK','Defenders':'DF','Midfielders':'MF','Attackers':'FW'}.get(heading,'MF')
   candidates=[im.get('src','') for im in a.select('img')];photo=next((urllib.parse.parse_qs(urllib.parse.urlparse(x).query).get('url',[''])[0] for x in candidates if '/_next/image?' in x),'')
  else:
   card=a.find_parent(class_=re.compile('team-roster__item'))
   if not card:card=a.parent.parent
   label=(card.find('h2') or card.find('h3')).get_text(' ',strip=True)
   text=card.get_text(' ',strip=True);position=next((p for k,p in [('Goalkeeper','GK'),('Defence','DF'),('Midfield','MF'),('Attack','FW')] if k in text),'MF');photo=img.get('src','')
  p=player('official-'+key+'-'+href.rstrip('/').split('/')[-1],c['id'],label,position,href,'Official club website');p.update(photoUrl=photo,number=number,rosterSourceUrl=url)
  rows.append(p)
 def enrich(p):
  try:
   d=fetch(p['sourceUrl']);text=d.get_text(' ',strip=True)
   if key=='asec':
    nat=re.search(r'NATIONALITE\s+(.+?)\s+DATE DE NAISSANCE',text)
    if nat:p['nationality']=nat.group(1)
    born=re.search(r'DATE DE NAISSANCE\s+(\d{1,2})\s+(\w+)\s+(\d{4})',text)
    months='janvier février mars avril mai juin juillet août septembre octobre novembre décembre'.split()
    if born and born[2] in months:p['birthDate']=dt.date(int(born[3]),months.index(born[2])+1,int(born[1])).isoformat()
    height=re.search(r'Taille\s+(\d+)\s*cm',text)
    if height:p['height']=int(height[1])
    number=re.search(r'^(\d+)\.',(d.find('h1') or d).get_text(' ',strip=True))
    if number:p['number']=number[1]
   elif key=='kotoko':
    age=re.search(r'Age\s+(\d+)\s+Position',text);nat=re.search(r'Country\s+(.+?)\s+Date of birth',text)
    if age and 14<=int(age[1])<=50:p['age']=int(age[1])
    if nat:p['nationality']=nat[1]
   else:
    nat=re.search(r'Nationality\s+(.+?)\s+Position',text)
    if nat:p['nationality']=nat[1]
    # WordPress profiles report invalid ages (e.g. 1); do not import those.
   if p['birthDate']:
    b=dt.date.fromisoformat(p['birthDate']);today=dt.date.fromisoformat(NOW[:10]);p['age']=today.year-b.year-((today.month,today.day)<(b.month,b.day))
   p['countryCode']={'Ivoirienne':'CIV','Burkinabè':'BFA','Malienne':'MLI','Togolaise':'TOG','Ghana':'GHA','Nigeria':'NGA','Guinea':'GUI','Mali':'MLI'}.get(p['nationality'],'')
  except Exception as e:ERRORS.append({'player':p['name'],'sourceUrl':p['sourceUrl'],'reason':str(e)})
  return p
 with cf.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(enrich,rows))
 return c,rows

def download_portraits(players,workers):
 bad=set(json.loads((ROOT/'scripts/data/portrait-placeholder-digests.json').read_text()));assets=ROOT/'public/portraits';assets.mkdir(exist_ok=True)
 def one(p):
  try:
   url=p.get('photoUrl','')
   if not url.startswith('https://') or re.search(r'placeholder|default|no[-_]?(?:photo|image)|silhouette',url,re.I):return
   raw=base.get(url,binary=True)
   if not 1500<=len(raw)<=8*1024*1024:return
   with Image.open(io.BytesIO(raw)) as im:fmt=im.format;w,h=im.size;im.verify()
   if fmt not in ['PNG','JPEG','WEBP'] or min(w,h)<75 or max(w,h)>6000:return
   with Image.open(io.BytesIO(raw)) as im:
    rgba=im.convert('RGBA');box=rgba.getchannel('A').getbbox()
    if not box or (box[2]-box[0])*(box[3]-box[1])<w*h*.035 or max(ImageStat.Stat(rgba.convert('RGB')).stddev)<3:return
   digest=hashlib.sha256(raw).hexdigest()
   if digest in bad:return
   path=assets/('real-'+digest[:24]+'.'+{'PNG':'png','JPEG':'jpg','WEBP':'webp'}[fmt])
   if not path.exists():path.write_bytes(raw)
   p.update(photo='/portraits/'+path.name,photoDigest=digest,photoVerified=True,photoPriority=100 if p.get('photoCandidateSource',p['source'])=='Official club website' else 70,photoSource=p.get('photoCandidateSource',p['source']),photoSourceUrl=p.get('photoCandidateSourceUrl',p['sourceUrl']),photoUpdatedAt=NOW)
  except Exception:return
 with cf.ThreadPoolExecutor(max_workers=workers) as ex:
  for n,_ in enumerate(ex.map(one,players),1):
   if n%250==0:print('Portraits checked',n,'/',len(players),flush=True)
 digests={}
 for p in players:
  if p.get('photoDigest'):digests.setdefault(p['photoDigest'],[]).append(p)
 for group in digests.values():
  if len({norm(p['name']) for p in group})>1:
   for p in group:p['photo']='';p['photoVerified']=False

def finalize_pool(result):
 # ASEC publishes player cards with the face on the left. Display that window
 # via CSS metadata, preserving the original pixels and source attribution.
 for p in result['players']:
  # Official pages can contain impossible years (e.g. 0200). Keep the raw
  # observation for audit, but never present a guessed correction as a fact.
  if p.get('birthDate'):
   try:
    born=dt.date.fromisoformat(p['birthDate']);today=dt.date.fromisoformat(result['meta']['snapshotAt'][:10]);age=today.year-born.year-((today.month,today.day)<(born.month,born.day))
    if not 14<=age<=60:raise ValueError('Implausible active-player age')
    p['age']=age
   except ValueError:
    p['invalidSourceBirthDate']=p['birthDate'];p['birthDate']='';p['age']=None
    result['meta'].setdefault('errors',[]).append({'player':p['name'],'sourceUrl':p['sourceUrl'],'reason':'Invalid birth date omitted: '+p['invalidSourceBirthDate']})
  if p.get('age') is not None and (not isinstance(p['age'],(int,float)) or not 14<=p['age']<=60):p['age']=None
  if p.get('photo') and p['id'].startswith('official-asec-'):
   with Image.open(ROOT/'public'/p['photo'].lstrip('/')) as im:
    if im.size==(2000,2300):p['photoFraming']={'x':.025,'y':.025,'w':.49,'h':980/2300}
 for l in result['leagues']:
  if l['id']=='scout.civ':l['sourceUrl']='https://www.asec.ci/'
  ids={c['id'] for c in result['clubs'] if c['leagueId']==l['id']};ps=[p for p in result['players'] if p['clubId'] in ids]
  l['coverage']={'clubs':len(ids),'players':len(ps),'realPhotos':sum(bool(p['photo']) for p in ps),'officialPlayers':sum(p['source']=='Official club website' for p in ps)}
 out=ROOT/'public/data/scouting-pool.json';tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));tmp.replace(out)
 (ROOT/'public/data/scouting-sources.json').write_text(json.dumps({'snapshotAt':result['meta']['snapshotAt'],'leagues':result['leagues'],'officialCrossChecks':result['meta'].get('officialCrossChecks',[])},ensure_ascii=False,indent=2))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--no-photos',action='store_true');parser.add_argument('--workers',type=int,default=6);args=parser.parse_args()
 leagues=[];clubs=[];players=[];tasks=[]
 # Process official rosters first. Provider data only supplements them.
 for config in OFFICIAL:
  try:
   c,ps=official_team(config);clubs.append(c);players.extend(ps);print('Official',c['name'],len(ps),flush=True)
  except Exception as e:ERRORS.append({'club':config[1],'sourceUrl':config[3],'reason':str(e)})
 for code,lid,name,country,cc,rep in LEAGUES:
  url=f'https://www.fotmob.com/leagues/{lid}' if lid else 'https://www.asec.ci/'
  league=dict(id=league_id(code),name=name,country=country,code=cc,countryCode=cc,kind='external',tier=1,playable=False,scoutingOnly=True,sourceUrl=url,sourceName='FotMob' if lid else 'ASEC Mimosas',snapshotAt=NOW)
  if lid:
   try:
    data=base.jsonget(f'https://www.fotmob.com/api/data/leagues?id={lid}');league['season']=data.get('details',{}).get('selectedSeason','');teams=teams_in(data.get('table',[]));league['sourceClubCount']=len(teams);tasks.extend((code,rep,t) for t in teams)
   except Exception as e:ERRORS.append({'league':name,'sourceUrl':url,'reason':str(e)})
  leagues.append(league)
 with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
  for c,ps in ex.map(fotmob_team,tasks):
   if c and ps:clubs.append(c);players.extend(ps)
   if c:print('Roster',c['name'],len(ps),flush=True)
 # Prefer official identity/photo when a provider names the same player at that club.
 canonical={norm(c['name']):c for c in clubs if c['source']=='Official club website'};remap={}
 for c in clubs:
  target=canonical.get(norm(c['name']))
  if target and target['id']!=c['id']:remap[c['id']]=target['id'];target['fotmobId']=c.get('fotmobId')
 clubs=[c for c in clubs if c['id'] not in remap];unique={};identity={}
 for p in players:
  p['clubId']=remap.get(p['clubId'],p['clubId']);key=(p['clubId'],norm(p['name']))
  existing=identity.get(key)
  if existing:
   for field in ['fotmobId','sourceId','birthDate','height','nationality','countryCode','naturalPositions','realWorld']:
    if not existing.get(field) and p.get(field):existing[field]=p[field]
   if existing.get('realWorld'):existing['realWorld']['playerId']=existing['id'];existing['realWorld']['sourceGameClubId']=existing['clubId']
   continue
  if p['id'] in unique:
   ERRORS.append({'player':p['name'],'sourceUrl':p['sourceUrl'],'reason':'Duplicate provider ID in multiple rosters; kept first source assignment','keptClub':unique[p['id']]['clubId'],'otherClub':p['clubId']});continue
  unique[p['id']]=p;identity[key]=p
 players=list(unique.values())
 official_reports=enrich_official(clubs,players,fetch,norm,ERRORS,NOW)
 if not args.no_photos:download_portraits(players,args.workers)
 for l in leagues:
  ids={c['id'] for c in clubs if c['leagueId']==l['id']};ps=[p for p in players if p['clubId'] in ids]
  l['coverage']={'clubs':len(ids),'players':len(ps),'realPhotos':sum(bool(p['photo']) for p in ps),'officialPlayers':sum(p['source']=='Official club website' for p in ps)}
 result={'schema':1,'meta':{'snapshotAt':NOW,'scope':'Scouting and transfers only; new careers only','coverage':'Club rosters as published; not every club is covered. Missing facts remain unknown. Ratings and finances are simulated.','errors':ERRORS,'officialCrossChecks':official_reports},'leagues':leagues,'clubs':clubs,'players':players}
 finalize_pool(result)
 print(json.dumps([{'country':l['country'],**l['coverage']} for l in leagues],ensure_ascii=False,indent=2),flush=True)
if __name__=='__main__':main()
