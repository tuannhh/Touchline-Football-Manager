"""Download identity-matched portraits, verify image bytes, keep source provenance.

Official club manifests take priority. FotMob photos use the already joined
FotMob identity (not a guessed ESPN number). Never touches career save files.
Reruns resume from local assets; failures are reported instead of marked real.
"""
import argparse, concurrent.futures as cf, datetime as dt, hashlib, io, json, re, ssl, time, urllib.request, urllib.error, unicodedata
from pathlib import Path
import certifi
from PIL import Image, ImageStat

ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public';CACHE=ROOT/'.cache';ASSETS=PUBLIC/'portraits';DB=PUBLIC/'data/database.json'
TLS=ssl.create_default_context(cafile=certifi.where())
PHOTO_FIELDS=['photo','photoUrl','photoSource','photoSourceUrl','photoVerified','photoUpdatedAt','photoDigest','photoPriority','photoFraming']
parser=argparse.ArgumentParser();parser.add_argument('--official-only',action='store_true');parser.add_argument('--limit',type=int);parser.add_argument('--workers',type=int,default=6);args=parser.parse_args()
db=json.loads(DB.read_text());players={p['id']:p for p in db['players']};clubs={c['id']:c for c in db['clubs']};leagues={l['id']:l for l in db['leagues']}
bad_file=ROOT/'scripts/data/portrait-placeholder-digests.json';bad_images=json.loads(bad_file.read_text()) if bad_file.exists() else [];bad_digests={r['digest'] if isinstance(r,dict) and 'digest' in r else r['sha256'] if isinstance(r,dict) else r for r in bad_images}
stamp=dt.datetime.now(dt.timezone.utc).isoformat();index_file=CACHE/'portrait-downloads.json';cache=json.loads(index_file.read_text()) if index_file.exists() else {};errors=[]
official={}
# Reuse the last verified index across a full roster reimport. Name and DOB
# must still agree; no league, club or ability fields are imported.
previous=PUBLIC/'data/portraits.json'
if previous.exists():
 for row in json.loads(previous.read_text()).get('players',[]):
  p=players.get(row.get('id'))
  if p and row.get('photoVerified') and p.get('name')==row.get('name') and (not p.get('birthDate') or not row.get('birthDate') or p['birthDate']==row['birthDate']) and (PUBLIC/row['photo'].lstrip('/')).exists():
   if not p.get('photoVerified') or row.get('photoPriority',0)>p.get('photoPriority',0):
    for key in PHOTO_FIELDS:
     if key in row:p[key]=row[key]
for file in [CACHE/'official-portraits.json',ROOT/'scripts/data/portrait-overrides.json']:
 if file.exists():
  rows=json.loads(file.read_text());rows=rows.get('players',rows.get('portraits',[])) if isinstance(rows,dict) else rows
  for row in rows:
   if row.get('playerId',row.get('id')) in players:official.setdefault(row.get('playerId',row.get('id')),[]).append(row)

def priority(p):
 if not p.get('photo'):return 0
 return p.get('photoPriority') or (100 if re.search('official|chính thức',p.get('photoSource',''),re.I) else 60)

def fetch_image(url):
 saved=cache.get(url)
 if saved and saved.get('photoDigest') not in bad_digests and (PUBLIC/saved['photo'].lstrip('/')).exists():return saved
 for attempt in range(2):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; Touchline personal local game)','Accept':'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8'})
   with urllib.request.urlopen(req,timeout=18,context=TLS) as r:
    if not r.headers.get('Content-Type','').lower().startswith('image/'):raise ValueError('Not an image response')
    raw=r.read(8*1024*1024+1)
   if not 1500<=len(raw)<=8*1024*1024:raise ValueError('Image byte size outside limits')
   with Image.open(io.BytesIO(raw)) as im:
    fmt=im.format;w,h=im.size;im.verify()
   if fmt not in ['PNG','JPEG','WEBP','AVIF'] or min(w,h)<75 or max(w,h)>6000:raise ValueError('Unsupported image or dimensions')
   with Image.open(io.BytesIO(raw)) as im:
    rgba=im.convert('RGBA');box=rgba.getchannel('A').getbbox()
    if not box or (box[2]-box[0])*(box[3]-box[1])<w*h*.035:raise ValueError('Transparent/empty image')
    if max(ImageStat.Stat(rgba.convert('RGB')).stddev)<3:raise ValueError('Blank image')
   digest=hashlib.sha256(raw).hexdigest()
   if digest in bad_digests:raise ValueError('Known provider silhouette/placeholder')
   ext={'PNG':'png','JPEG':'jpg','WEBP':'webp','AVIF':'avif'}[fmt]
   path=ASSETS/('real-'+digest[:24]+'.'+ext)
   if not path.exists():path.write_bytes(raw)
   return {'photo':'/portraits/'+path.name,'photoDigest':digest,'width':w,'height':h,'bytes':len(raw)}
  except urllib.error.HTTPError as e:
   if e.code in [403,404,410]:raise ValueError('HTTP '+str(e.code)) from e
   if e.code==429:raise ValueError('HTTP 429; deferred') from e
   if attempt:raise
  except Exception:
   if attempt:raise
  time.sleep(.35)

def candidates(p):
 for row in official.get(p['id'],[]):
  # Manifest collectors matched identity before producing this row.
  if row.get('name')!=p['name'] or (row.get('birthDate') and p.get('birthDate') and row['birthDate']!=p['birthDate']) or (row.get('sourceId') and p.get('sourceId') and str(row['sourceId'])!=str(p['sourceId'])):continue
  yield {'url':row.get('imageUrl',row.get('photoUrl')),'source':row.get('sourceName','Official club website'),'sourceUrl':row['sourceUrl'],'priority':row.get('priority',100),'basis':row.get('matchEvidence','Official profile matched by name and club'),'framing':row.get('cropBox')}
 if not args.official_only:
  fid=p.get('fotmobId') or (int(p['id'][1:]) if re.fullmatch(r'f\d+',p['id']) else None)
  if fid:yield {'url':f'https://images.fotmob.com/image_resources/playerimages/{fid}.png','source':'FotMob player profile','sourceUrl':f'https://www.fotmob.com/players/{fid}','priority':70,'basis':'Existing FotMob identity joined by source ID or name and date of birth'}

def one(p):
 for c in candidates(p):
  if not c['url'] or c['priority']<priority(p):continue
  if p.get('photoVerified') and p.get('photoUrl')==c['url'] and (PUBLIC/p['photo'].lstrip('/')).exists():return p['id'],None,None
  try:
   asset=fetch_image(c['url']);patch={**{k:asset[k] for k in ['photo','photoDigest']},'photoUrl':c['url'],'photoSource':c['source'],'photoSourceUrl':c['sourceUrl'],'photoVerified':True,'photoUpdatedAt':stamp,'photoPriority':c['priority'],'photoFraming':c.get('framing')}
   return p['id'],patch,(c['url'],asset,c['basis'])
  except Exception as e:errors.append({'id':p['id'],'name':p['name'],'url':c['url'],'error':str(e)[:160]})
 return p['id'],None,None

preferred=['e83','e359','e86','e132','e160','e382','e364','e363','e360','e127','e111','e1929','e437','e139']
targets=[p for p in db['players'] if list(candidates(p))]
targets.sort(key=lambda p:(preferred.index(p['clubId']) if p['clubId'] in preferred else 50 if leagues[clubs[p['clubId']]['leagueId']].get('tier')==1 else 80,p['clubId'],p['id']))
if args.limit:targets=targets[:args.limit]
print('Portrait candidates:',len(targets),'official identities:',len(official),flush=True)
updates={};evidence={};digest_ids={}
with cf.ThreadPoolExecutor(max_workers=max(1,min(args.workers,10))) as ex:
 for n,(pid,patch,download) in enumerate(ex.map(one,targets),1):
  if patch:
   updates[pid]=patch;url,asset,basis=download;cache[url]=asset;evidence[pid]=basis;digest_ids.setdefault(patch['photoDigest'],[]).append(pid)
  if n%100==0:
   index_file.write_text(json.dumps(cache,ensure_ascii=False));print('Fetched',n,'/',len(targets),'verified',len(updates),'failed requests',len(errors),flush=True)
# A repeated photo across different identities is usually a provider silhouette.
def same_person(ids):
 identities={(unicodedata.normalize('NFKD',players[pid]['name']).casefold(),players[pid].get('birthDate')) for pid in ids}
 return len(identities)==1 and bool(next(iter(identities))[1])
duplicates={d:ids for d,ids in digest_ids.items() if len(ids)>1 and not same_person(ids)}
for digest,ids in duplicates.items():
 for pid in ids:updates.pop(pid,None);errors.append({'id':pid,'error':'Same image bytes returned for distinct identities','digest':digest,'identities':ids})
for pid,patch in updates.items():players[pid].update(patch)
db['meta']['portraitsDownloaded']=sum(bool(p.get('photo')) for p in db['players'])
by_league={}
for lid,l in leagues.items():
 ps=[p for p in db['players'] if clubs[p['clubId']]['leagueId']==lid];by_league[lid]={'name':l['name'],'total':len(ps),'real':sum(bool(p.get('photo')) for p in ps)}
db['meta']['portraitUpdate']={'updatedAt':stamp,'verifiedAddedOrUpdated':len(updates),'realPhotos':db['meta']['portraitsDownloaded'],'missing':sum(not p.get('photo') for p in db['players']),'byLeague':by_league}
db['meta']['sources']=list(dict.fromkeys(db['meta'].get('sources',[])+['Official club player portraits','FotMob player portrait CDN, matched by player identity']))
tmp=DB.with_suffix('.tmp');tmp.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')));tmp.replace(DB)
rows=[{k:p[k] for k in ['id','name','sourceId','birthDate',*PHOTO_FIELDS] if k in p} for p in db['players'] if p.get('photoVerified')]
manifest=PUBLIC/'data/portraits.json';tmp=manifest.with_suffix('.tmp');tmp.write_text(json.dumps({'updatedAt':stamp,'players':rows},ensure_ascii=False,separators=(',',':')));tmp.replace(manifest)
index_file.write_text(json.dumps(cache,ensure_ascii=False));(CACHE/'portrait-fetch-report.json').write_text(json.dumps({'updatedAt':stamp,'updated':list(updates),'evidence':evidence,'duplicates':duplicates,'errors':errors,'coverage':db['meta']['portraitUpdate']},ensure_ascii=False,indent=2))
print(json.dumps(db['meta']['portraitUpdate'],ensure_ascii=False),flush=True)
