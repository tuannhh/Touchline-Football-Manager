"""Add the public 2026/27 lower-division and UEFA snapshots without discarding v1 assets.
ESPN, FotMob and VPF data are cached; every record retains its source URL.
"""
import importlib.util, json, re, concurrent.futures as cf, unicodedata
from pathlib import Path
from bs4 import BeautifulSoup
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('import-data.py'));b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
OUT=b.PUBLIC/'data/database.json';BASE=b.CACHE/'database-before-expansion.json'
if not BASE.exists(): BASE.write_bytes(OUT.read_bytes())
db=json.loads(BASE.read_text()); clubs={c['id']:c for c in db['clubs']};players={p['id']:p for p in db['players']};leagues={l['id']:l for l in db['leagues']}
for l in leagues.values():l.update(tier=1,kind='domestic',sourceName='VPF' if l['id']=='vie.1' else 'ESPN')
errors=[];conflicts=db['meta'].get('conflicts',[])
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
def accept(c,ps):
 if c['id'] in clubs:return
 clubs[c['id']]=c
 for p in ps:
  if p['id'] in players:
   old=players[p['id']]
   if old['clubId']!=p['clubId']:conflicts.append(dict(player=p['name'],clubs=[old['clubId'],p['clubId']],chosen=old['clubId'],resolution='Preserve existing verified snapshot identity'))
  else:players[p['id']]=p
 print(c['name'],len(ps),flush=True)
def safely(fn,arg):
 try:return fn(arg)
 except Exception as e:errors.append(str(e));print('SOURCE ERROR',str(e)[:180],flush=True);return None
ESPN=[('eng.2','Championship','Anh','EN',2,24),('eng.3','League One','Anh','EN',3,24),('ger.2','2. Bundesliga','Đức','DE',2,18),('fra.2','Ligue 2','Pháp','FR',2,18),('ita.2','Serie B','Ý','IT',2,20),('esp.2','LaLiga 2','Tây Ban Nha','ES',2,22),('ned.2','Eerste Divisie','Hà Lan','NL',2,20)]
tasks=[]
for lid,name,country,code,tier,count in ESPN:
 url=f'https://site.api.espn.com/apis/site/v2/sports/soccer/{lid}/teams?limit=100';d=b.jsonget(url)['sports'][0]['leagues'][0]
 assert len(d['teams'])==count,(lid,len(d['teams']))
 leagues[lid]=dict(id=lid,name=name,country=country,countryCode=code,tier=tier,kind='domestic',expectedTeams=count,season='2026/27',sourceUrl=url,sourceName='ESPN')
 tasks.extend((lid,t['team']) for t in d['teams'])
cups=[]
for lid,name,short,matches,official in [('uefa.champions','UEFA Champions League','UCL',8,'https://www.uefa.com/uefachampionsleague/clubs/'),('uefa.europa','UEFA Europa League','UEL',8,'https://www.uefa.com/uefaeuropaleague/clubs/'),('uefa.europa.conf','UEFA Conference League','UECL',6,'https://www.uefa.com/uefaconferenceleague/clubs/')]:
 url=f'https://site.api.espn.com/apis/site/v2/sports/soccer/{lid}/teams?limit=100';teams=b.jsonget(url)['sports'][0]['leagues'][0]['teams'];assert len(teams)==36
 cups.append(dict(id=lid,name=name,shortName=short,kind='uefa',country='UEFA',countryCode='EU',participants=['e'+t['team']['id'] for t in teams],matchdays=matches,season='2026/27',sourceUrl=official,rosterSourceUrl=url))
 known=set(clubs)|{'e'+t[1]['id'] for t in tasks}
 tasks.extend((lid,t['team']) for t in teams if 'e'+t['team']['id'] not in known)
with cf.ThreadPoolExecutor(max_workers=6) as ex:
 for result in ex.map(lambda t:safely(b.roster_espn,t),tasks):
  if result:
   c,ps=result
   if c['leagueId'].startswith('uefa.'):c['leagueId']='eur.other';c['playable']=False
   accept(c,ps)
leagues['eur.other']=dict(id='eur.other',name='Đối thủ châu Âu khác',country='Châu Âu',countryCode='EU',tier=0,kind='external',season='2026/27',sourceName='ESPN / UEFA',sourceUrl='https://www.uefa.com/uefachampionsleague/clubs/')
# FotMob covers third tiers and Liga Portugal 2, with the source's real regional groups.
FM=[(208,'ger.3','3. Liga','Đức','DE',3),(8970,'fra.3','Ligue 3','Pháp','FR',3),(147,'ita.3','Serie C','Ý','IT',3),(8968,'esp.3','Primera Federación','Tây Ban Nha','ES',3),(185,'por.2','Liga Portugal 2','Bồ Đào Nha','PT',2),(9112,'por.3','Liga 3','Bồ Đào Nha','PT',3),(9195,'ned.3','Tweede Divisie','Hà Lan','NL',3)]
fm_tasks=[]
for fid,lid,name,country,code,tier in FM:
 url=f'https://www.fotmob.com/api/data/leagues?id={fid}';data=b.jsonget(url);season=data['details']['selectedSeason'];assert season=='2026/2027',(lid,season)
 root=data['table'][0]['data'];groups=root.get('tables',[root]);groups=[x for x in groups if x.get('table',{}).get('all')]
 for index,group in enumerate(groups):
  gid=lid+('.'+str(index+1) if len(groups)>1 else '');teams=group['table']['all'];title=name+(' · '+group['leagueName'] if len(groups)>1 else '')
  leagues[gid]=dict(id=gid,parentId=lid,name=title,country=country,countryCode=code,tier=tier,kind='domestic',expectedTeams=len(teams),season=season,sourceUrl='https://www.fotmob.com'+data['details']['breadcrumbJSONLD']['itemListElement'][-1]['item'].split('fotmob.com')[-1],sourceName='FotMob',sourceApi=url,sourceLegend=group.get('legend',[]))
  fm_tasks.extend((gid,t) for t in teams)
def fotmob_roster(task):
 lid,t=task;tid='f'+str(t['id']);url=f'https://www.fotmob.com/api/data/teams?id={t["id"]}';d=b.jsonget(url);ps=[]
 for group in (d.get('squad') or {}).get('squad') or []:
  if group['title']=='coach':continue
  for p in group['members']:
   pos={'keepers':'GK','defenders':'DF','midfielders':'MF','attackers':'FW'}.get(group['title'],'MF')
   desc=(p.get('positionIdsDesc') or '').split(',')[0]
   if desc=='GK':pos='GK'
   elif desc in ['CB','LB','RB','LWB','RWB']:pos='DF'
   elif desc in ['ST','CF','LW','RW']:pos='FW'
   elif desc in ['CM','CAM','CDM','LM','RM','AM','DM']:pos='MF'
   ps.append(dict(id='f'+str(p['id']),clubId=tid,sourceId=str(p['id']),name=p['name'],shortName=p['name'],position=pos,positionKnown=True,age=p.get('age'),birthDate=(p.get('dateOfBirth') or '')[:10],nationality=p.get('cname',''),countryCode=p.get('ccode',''),number=str(p.get('shirtNumber') or ''),height=p.get('height'),source='FotMob',sourceUrl=f'https://www.fotmob.com/players/{p["id"]}',sourceStats={'totalGoals':p.get('goals',0) or 0,'goalAssists':p.get('assists',0) or 0},photo='',photoUrl=''))
 if len(ps)<16:
  found={p['id']:p for p in ps}
  fixtures=[m for m in d.get('fixtures',{}).get('allFixtures',{}).get('fixtures',[]) if m.get('status',{}).get('finished') and m.get('status',{}).get('utcTime','')>='2026-08-01'][-4:]
  for match in reversed(fixtures):
   matchurl=f'https://www.fotmob.com/api/data/matchDetails?matchId={match["id"]}'
   sheet=b.jsonget(matchurl).get('content',{}).get('lineup') or {}
   team=next((sheet.get(side,{}) for side in ['homeTeam','awayTeam'] if sheet.get(side,{}).get('id')==t['id']),{})
   for p in team.get('starters',[])+team.get('subs',[]):
    pid='f'+str(p['id']) if p.get('id') else 'fo'+str(p.get('optaId') or norm(p['name']))
    if pid in found:continue
    position=p.get('usualPlayingPositionId');pos={0:'GK',1:'DF',2:'MF',3:'FW'}.get(position)
    if not pos:pos='GK' if p.get('positionId')==11 else 'DF' if 30<=p.get('positionId',0)<60 else 'FW' if p.get('positionId',0)>=100 else 'MF'
    found[pid]=dict(id=pid,clubId=tid,name=p['name'],shortName=p['name'],position=pos,positionKnown=position is not None,age=p.get('age'),birthDate='',nationality=p.get('countryName',''),countryCode=p.get('countryCode',''),number=str(p.get('shirtNumber') or ''),height=None,source='FotMob match sheets',sourceUrl='https://www.fotmob.com'+match['pageUrl'],sourceStats={},photo='',photoUrl='',rosterNote='Observed on public match sheets, not a complete registration list')
   if len(found)>=22:break
  ps=list(found.values())
 c=dict(id=tid,name=t['name'],shortName=t.get('shortName',t['name']),abbreviation=t['name'][:3].upper(),leagueId=lid,color='#287753',alternateColor='#eeeeee',badge='',badgeUrl=f'https://images.fotmob.com/image_resources/logo/teamlogo/{t["id"]}.png',source='FotMob',sourceUrl='https://www.fotmob.com'+t['pageUrl'],season='2026/27',snapshotAt=b.NOW.isoformat())
 if len(ps)<11:raise ValueError(f'{c["name"]}: {len(ps)} source players; {tid}')
 return c,ps
with cf.ThreadPoolExecutor(max_workers=5) as ex:
 for result in ex.map(lambda t:safely(fotmob_roster,t),fm_tasks):
  if result:accept(*result)
# V.League 2: use the correct league-specific season ID, never the top-flight navigation.
url='https://vpf.vn/cac-doi-bong-hang-nhat/';doc=BeautifulSoup(b.get(url),'html.parser');named={};badges={}
for a in doc.select('a[href*="/team/"]'):
 if 'sid=154445' not in a['href']:continue
 if a.get_text(strip=True):named[a['href']]=a.get_text(' ',strip=True)
 if a.find('img'):badges[a['href']]=a.find('img').get('src','')
assert len(named)==14,len(named)
leagues['vie.2']=dict(id='vie.2',name='V.League 2 · Hạng Nhất',country='Việt Nam',countryCode='VN',tier=2,kind='domestic',expectedTeams=14,season='2026/27',sourceUrl=url,sourceName='VPF')
with cf.ThreadPoolExecutor(max_workers=4) as ex:
 for result in ex.map(lambda t:safely(b.roster_vpf,t),[(n,u,badges.get(u,'')) for u,n in named.items()]):
  if result:c,ps=result;c['leagueId']='vie.2';accept(c,ps)
# Nationality is read from each VPF player profile, never inferred from a name.
def vpf_nationality(p):
 doc=BeautifulSoup(b.get(p['sourceUrl']),'html.parser');txt=doc.get_text(' ',strip=True);m=re.search(r'Quốc tịch:\s*(.*?)(?:\s+Team:|\s+Season|\s+Mùa giải|\s+Thống kê)',txt)
 if m and 0<len(m[1])<60:
  p['nationality']=m[1].strip();p['countryCode']={'Việt Nam':'VN','Brazil':'BR','Brasil':'BR','Nigeria':'NG','Uganda':'UG','Jamaica':'JM','Croatia':'HR','Portugal':'PT','Argentina':'AR','Australia':'AU','Úc':'AU','Serbia':'RS','Senegal':'SN','Pháp':'FR','France':'FR','Cameroon':'CM'}.get(p['nationality'],'');p['nationalitySource']=p['sourceUrl']
 return p
with cf.ThreadPoolExecutor(max_workers=5) as ex:
 for _ in ex.map(lambda p:safely(vpf_nationality,p),[p for p in players.values() if p['source']=='VPF']):pass
# Cross-provider identity: exact normalized name AND birth date, with conflicts recorded.
seen={};duplicates=[]
for p in list(players.values()):
 key=(norm(p['name']),p.get('birthDate'))
 if not key[1]:continue
 if key in seen:
  old=seen[key];conflicts.append(dict(player=p['name'],clubs=[old['clubId'],p['clubId']],chosen=old['clubId'],resolution='Exact name and birth date across providers; preserve earlier snapshot'));duplicates.append(p['id'])
 else:seen[key]=p
for pid in duplicates:players.pop(pid)
# Official Premier League flags. Only unambiguous token matches are accepted.
pl_url='https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists';doc=BeautifulSoup(b.get(pl_url),'html.parser');entries=[]
for p in doc.select('p'):
 if 'Squad players' in p.get_text() or 'U21 players' in p.get_text():
  entries.extend(x.strip() for x in p.get_text('\n',strip=True).split('\n')[1:] if ',' in x)
def tokens(s):return set(re.findall('[a-z]+',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode()))
for p in players.values():
 if clubs[p['clubId']]['leagueId']!='eng.1':continue
 ts=tokens(p['name']);matches=[e for e in entries if len(ts)>1 and ts<=tokens(e)]
 if len(matches)==1:p['homegrown']={'EN':{'association':bool('*' in matches[0]),'source':pl_url,'verified':True,'definition':'Premier League: 3 seasons/36 months before 21'}}
db.update(leagues=list(leagues.values()),clubs=list(clubs.values()),players=list(players.values()),competitions=cups)
db['meta'].update(version=2,expandedAt=b.NOW.isoformat(),sources=db['meta']['sources']+['FotMob public league and squad data','Premier League official 2026/27 squad list'],conflicts=conflicts,expansionErrors=errors)
OUT.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
jobs=[(c,'badge','badges') for c in db['clubs'] if not c.get('badge')]+[(p,'photo','portraits') for p in db['players'] if p['source']=='VPF' and not p.get('photo')]
with cf.ThreadPoolExecutor(max_workers=8) as ex:list(ex.map(b.asset,jobs))
db['meta']['portraitsDownloaded']=sum(bool(p.get('photo')) for p in db['players']);db['meta']['badgesDownloaded']=sum(bool(c.get('badge')) for c in db['clubs'])
OUT.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
print(json.dumps(dict(leagues=len(leagues),clubs=len(clubs),players=len(players),errors=errors),ensure_ascii=False),flush=True)
