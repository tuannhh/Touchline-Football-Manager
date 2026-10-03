"""Complete FotMob club lists using ESPN's current player registry. Explicit crosswalks retain identity."""
import importlib.util,json,re,unicodedata,difflib,concurrent.futures as cf,urllib.parse
from pathlib import Path
s=importlib.util.spec_from_file_location('b',Path(__file__).with_name('import-data.py'));b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
P=b.PUBLIC/'data/database.json';db=json.loads(P.read_text());clubs={c['id']:c for c in db['clubs']};players={p['id']:p for p in db['players']}
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
aliases={'AD Fafe':'Fafe','SC João Ver':'São João de Ver','CF Os Belenenses':'Os Belenenses','Atlético':'Atlético CP','Caldas':'FC Caldas','Lusitano de Évora':'Lusitano Évora','Santarém':'União Santarém','GVVV Veenendaal':'GVVV','HHC':'HHC Hardenberg','Katwijk':'VV Katwijk','Barendrecht':'BVV Barendrecht','Hoek':'HSV Hoek','Vitória de Guimarães B':'Vitoria Guimaraes B','Jong Almere City FC':'Jong Almere City','Athletic Club B':'Athletic Bilbao B','RC Deportivo Fabril':'Deportivo Fabril','Atlético Madrileño':'Atletico Madrid B','CDA Águilas FC':'Aguilas','CD Extremadura':'Extremadura','Logroñés':'UD Logrones','Gimnàstic':'Gimnastic de Tarragona','Sant Andreu':'UE Sant Andreu'}
work=[]
for fid,lid in [(8968,'esp.3'),(9112,'por.3'),(9195,'ned.3')]:
 raw=b.jsonget(f'https://www.fotmob.com/api/data/leagues?id={fid}')['table'][0]['data'];groups=raw.get('tables',[raw])
 for i,group in enumerate(groups):
  gid=lid+('.'+str(i+1) if len(groups)>1 else '')
  for t in group['table']['all']:
   if 'f'+str(t['id']) not in clubs:work.append((gid,t))
def lookup(task):
 gid,t=task;q=aliases.get(t['name'],t['name']);u='https://site.web.api.espn.com/apis/common/v3/search?query='+urllib.parse.quote(q)+'&limit=20&region=us&lang=en&type=team'
 try:
  candidates=[c for c in b.jsonget(u).get('items',[]) if c.get('sport')=='soccer' and c.get('type')=='team']
  ranked=sorted(candidates,key=lambda c:difflib.SequenceMatcher(None,norm(q),norm(c['displayName'])).ratio(),reverse=True)
  return {'leagueId':gid,'fotmob':t,'candidates':ranked[:3]}
 except Exception as e:return {'leagueId':gid,'fotmob':t,'candidates':[],'error':str(e)}
with cf.ThreadPoolExecutor(max_workers=6) as ex:matches=list(ex.map(lookup,work))
(b.CACHE/'lower-crosswalk.json').write_text(json.dumps(matches,ensure_ascii=False))
for m in matches:print(m['fotmob']['name'],'=>',[(c['id'],c['displayName']) for c in m['candidates']],flush=True)
