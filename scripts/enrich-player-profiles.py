"""Join detailed positions and preferred feet by source ID or exact name + DOB.

No biography field is inferred from ability, nationality or a player's name.
Team lists supply observed positions. Individual profiles supply the preferred
position and foot. --all downloads every matched individual profile; subsequent
runs reuse the 24-hour source cache. Save files are never edited by this script.
"""
import argparse, concurrent.futures as cf, datetime as dt, hashlib, importlib.util, json, re, unicodedata
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('import-data.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
parser=argparse.ArgumentParser();parser.add_argument('--all',action='store_true');parser.add_argument('--limit',type=int,default=1000);args=parser.parse_args()
path=b.PUBLIC/'data/database.json';db=json.loads(path.read_text());players={p['id']:p for p in db['players']};clubs={c['id']:c for c in db['clubs']};aliases=set()
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower().replace('đ','d').replace('ø','o').replace('ł','l')).encode('ascii','ignore').decode())
by_key={}
for p in players.values():
    if p.get('birthDate'):by_key.setdefault((norm(p['name']),p['birthDate']),[]).append(p)
codes={'CDM':'DM','CAM':'AM','CF':'ST'};valid=set(['GK','LB','CB','RB','LWB','RWB','DM','CM','LM','RM','AM','LW','RW','ST'])
def positions(xs):return list(dict.fromkeys(codes.get(x,x) for x in xs if codes.get(x,x) in valid))
team_ids={int(c['id'][1:]) for c in db['clubs'] if c['id'].startswith('f')}
errors=[]
def get(url):
    try:return b.jsonget(url)
    except Exception as e:errors.append(str(e)[:240]);return None
def walk(x):
    if isinstance(x,dict):
        if isinstance(x.get('pageUrl'),str) and x['pageUrl'].startswith('/teams/') and x.get('id'):team_ids.add(int(x['id']))
        for v in x.values():walk(v)
    elif isinstance(x,list):
        for v in x:walk(v)
with cf.ThreadPoolExecutor(max_workers=5) as ex:
    for d in ex.map(get,[f'https://www.fotmob.com/api/data/leagues?id={i}' for i in [47,54,53,55,87,61,57]]):
        if d:walk(d.get('table',[]))
matches={}
def match_player(row):
    p=players.get('f'+str(row['id']))
    if p:return p
    ps=by_key.get((norm(row['name']),row.get('dateOfBirth','')),[])
    if len(ps)==1:return ps[0]
    a=norm(row['name'])
    candidates=[p for p in players.values() if p.get('birthDate') and p['birthDate']==row.get('dateOfBirth') and norm(clubs[p['clubId']]['name'])==norm(row.get('_teamName','')) and (a in norm(p['name']) or norm(p['name']) in a)]
    if len(candidates)==1:
        aliases.add(candidates[0]['id']);return candidates[0]
    return None
def team(tid):
    d=get(f'https://www.fotmob.com/api/data/teams?id={tid}')
    if not d:return []
    squad=d.get('squad') or {};groups=(squad.get('squad') or []) if isinstance(squad,dict) else squad
    if not groups:errors.append('No public squad for FotMob team '+str(tid))
    return [{**p,'_teamName':d.get('details',{}).get('name',''),'_teamId':tid} for group in groups if isinstance(group,dict) and group.get('title')!='coach' for p in (group.get('members') or [])]
with cf.ThreadPoolExecutor(max_workers=5) as ex:
    for i,rows in enumerate(ex.map(team,sorted(team_ids))):
        for row in rows:
            p=match_player(row)
            if not p:continue
            fid=row['id'];matches[p['id']]=fid
            found=positions((row.get('positionIdsDesc') or '').split(','))
            if found and not p.get('profileSource'):
                p.update(naturalPositions=found[:1],otherPositions=found[1:],positionsSource=f'https://www.fotmob.com/players/{fid}',positionBasis='Positions listed in public team squad; secondary roles reflect observed use')
            p['fotmobId']=fid
        if i%25==0:print('Squad profiles',i+1,'/',len(team_ids),'matched',len(matches),flush=True)
for p in players.values():
    if p['id'].startswith('f') and p.get('sourceId'):matches.setdefault(p['id'],int(p['sourceId']))
priority=['e83','e359','e382','e364','e127','e132','e131','e83','e86','e160','e363','e1068','e384','e2250','e1929','e243','e148','e143','e142']
def order(item):
    p=players[item[0]];return (priority.index(p['clubId']) if p['clubId'] in priority else 100, hashlib.sha256(p['id'].encode()).hexdigest())
targets=sorted(matches.items(),key=order)
if not args.all:targets=targets[:max(0,args.limit)]
def profile(item):
    pid,fid=item;d=get(f'https://www.fotmob.com/api/data/playerData?id={fid}')
    if not d or not d.get('name'):return None
    p=players[pid];dob=(d.get('birthDate') or {}).get('utcTime','')[:10]
    # Exact normalized name and DOB are required for cross-provider identities.
    if not pid.startswith('f') and (dob!=p.get('birthDate') or (norm(d['name'])!=norm(p['name']) and not(pid in aliases and (norm(d['name']) in norm(p['name']) or norm(p['name']) in norm(d['name']))))):return None
    url=f'https://www.fotmob.com/players/{fid}';pd=d.get('positionDescription') or {};rows=pd.get('positions') or []
    main=positions([r.get('strPosShort',{}).get('label','') for r in rows if r.get('isMainPosition')])
    other=positions([r.get('strPosShort',{}).get('label','') for r in rows if not r.get('isMainPosition') and r.get('occurences',0)>=3])
    patch={'profileSource':url,'profileUpdatedAt':dt.datetime.now(dt.timezone.utc).isoformat()}
    if main:patch.update(naturalPositions=main,otherPositions=[x for x in other if x not in main],positionsSource=url,positionBasis='Preferred position from source; secondary roles observed at least three times')
    for info in d.get('playerInformation') or []:
        if info.get('translationKey')=='preferred_foot':
            v=str(info.get('value',{}).get('key') or info.get('value',{}).get('fallback','')).lower()
            foot={'right':'right','left':'left','both':'both','both feet':'both'}.get(v)
            if foot:patch.update(preferredFoot=foot,footSource=url)
    return pid,patch
with cf.ThreadPoolExecutor(max_workers=5) as ex:
    for i,result in enumerate(ex.map(profile,targets)):
        if result:players[result[0]].update(result[1])
        if i%100==0:print('Individual profiles',i+1,'/',len(targets),flush=True)
db['players']=list(players.values());db['meta']['detailedProfiles']={
    'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
    'positions':sum(bool(p.get('naturalPositions')) for p in players.values()),
    'preferredFeet':sum(p.get('preferredFoot') in ['left','right','both'] for p in players.values()),
    'source':'FotMob public squad/player profiles', 'unavailableRequests':len(errors),
    'note':'Missing preferred feet remain unknown. Secondary positions reflect observed use, not a measured proficiency rating.'}
backup=b.CACHE/'database-before-profile-enrichment.json'
if not backup.exists():backup.write_bytes(path.read_bytes())
tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')));tmp.replace(path)
(b.CACHE/'profile-enrichment-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
print(db['meta']['detailedProfiles'],flush=True)
