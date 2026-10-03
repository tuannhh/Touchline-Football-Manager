"""Join current FotMob league membership with ESPN roster identities; preserve source provenance."""
import importlib.util,json,re,unicodedata,concurrent.futures as cf
from pathlib import Path
from bs4 import BeautifulSoup
s=importlib.util.spec_from_file_location('b',Path(__file__).with_name('import-data.py'));b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
P=b.PUBLIC/'data/database.json';db=json.loads(P.read_text());clubs={c['id']:c for c in db['clubs']};players={p['id']:p for p in db['players']}
# Manually checked provider identities: reserve sides must never map to the first team.
crosswalk=json.loads(Path(__file__).with_name('source-crosswalk.json').read_text());matches=[{'fotmob':m['fotmob'],'leagueId':m['leagueId']} for m in crosswalk];ids=[m['espnId'] for m in crosswalk]
errors=[]
def fetch(task):
 m,eid=task;t=m['fotmob'];tid='f'+str(t['id']);lid=m['leagueId']
 if tid in clubs or eid is None:return
 league={'esp':'esp.copa_del_rey','por':'por.taca.portugal','ned':'ned.cup'}[lid[:3]]
 team=dict(id=str(eid),displayName=t['name'])
 try:

  if eid in [5455,132804,19579,7000,9322]:league='club.friendly'
  if eid in [20738,21961]:league='ned.3'
  c,ps=b.roster_espn((league,team));season=c['season']
  if not season.startswith(('2026-27','2026/27','2026 ')):raise ValueError('roster season '+season)
  c.update(id=tid,leagueId=lid,name=t['name'],shortName=t.get('shortName',t['name']),source='FotMob / ESPN',sourceUrl='https://www.fotmob.com'+t['pageUrl'],rosterSourceUrl=c['sourceUrl'],badgeUrl=f'https://images.fotmob.com/image_resources/logo/teamlogo/{t["id"]}.png',reserveTeam=bool(re.search(r'(?: B$|^Jong |Castilla|Fabril|Madrileño)',t['name'])))
  for p in ps:p['clubId']=tid
  return c,ps
 except Exception as e:errors.append({'club':t['name'],'id':tid,'reason':str(e)});print('ERROR',t['name'],e,flush=True)
with cf.ThreadPoolExecutor(max_workers=6) as ex:
 for result in ex.map(fetch,zip(matches,ids)):
  if not result:continue
  c,ps=result;clubs[c['id']]=c
  for p in ps:
   if p['id'] not in players:players[p['id']]=p
   elif players[p['id']]['clubId']!=p['clubId']:db['meta']['conflicts'].append(dict(player=p['name'],clubs=[players[p['id']]['clubId'],p['clubId']],chosen=players[p['id']]['clubId'],resolution='Keep earlier provider identity'))
  print(c['name'],len(ps),flush=True)
# Correct VPF profile extraction; nationalities are not inferred from names.
def nationality(p):
 try:
  txt=BeautifulSoup(b.get(p['sourceUrl']),'html.parser').get_text(' ',strip=True);m=re.search(r'Quốc tịch:\s*(.*?)(?:\s+Team:|\s+Season|\s+Mùa giải|\s+Thống kê)',txt)
  if m and 0<len(m[1])<60:
   p['nationality']=m[1].strip();p['countryCode']={'Việt Nam':'VN','Brazil':'BR','Brasil':'BR','Nigeria':'NG','Uganda':'UG','Jamaica':'JM','Croatia':'HR','Portugal':'PT','Argentina':'AR','Australia':'AU','Úc':'AU','Serbia':'RS','Senegal':'SN','Pháp':'FR','France':'FR','Cameroon':'CM','Indonesia':'ID','Ghana':'GH','Mali':'ML','Hàn Quốc':'KR','Korea Republic':'KR','Trinidad and Tobago':'TT','Timor-Leste':'TL'}.get(p['nationality'],'');p['nationalitySource']=p['sourceUrl']
 except Exception as e:print('NATIONALITY',p['name'],str(e)[:80],flush=True)
with cf.ThreadPoolExecutor(max_workers=8) as ex:list(ex.map(nationality,[p for p in players.values() if p['source']=='VPF']))
db.update(clubs=list(clubs.values()),players=list(players.values()));db['meta']['expansionErrors']=errors;db['meta']['expandedAt']=b.NOW.isoformat()
P.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
with cf.ThreadPoolExecutor(max_workers=8) as ex:list(ex.map(b.asset,[(c,'badge','badges') for c in db['clubs'] if not c.get('badge')]))
db['meta']['badgesDownloaded']=sum(bool(c.get('badge')) for c in db['clubs']);P.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
print('COMPLETE',len(clubs),len(players),errors,flush=True)
