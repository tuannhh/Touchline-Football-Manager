"""Import public roster snapshots. Game ratings are generated separately.
Run: python3 scripts/import-data.py (requires beautifulsoup4 only for VPF HTML).
Cached source responses preserve provenance and make interrupted runs resumable.
"""
import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.request
import ssl
import certifi
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
CACHE.mkdir(exist_ok=True)
PUBLIC = ROOT / 'public'
NOW = dt.datetime.now(dt.timezone.utc)
TLS = ssl.create_default_context(cafile=certifi.where())
LEAGUES = [
    ('eng.1', 'Premier League', 'Anh', 'EN', 20),
    ('ger.1', 'Bundesliga', 'Đức', 'DE', 18),
    ('fra.1', 'Ligue 1', 'Pháp', 'FR', 18),
    ('ita.1', 'Serie A', 'Ý', 'IT', 20),
    ('esp.1', 'LaLiga', 'Tây Ban Nha', 'ES', 20),
    ('por.1', 'Liga Portugal', 'Bồ Đào Nha', 'PT', 18),
    ('ned.1', 'Eredivisie', 'Hà Lan', 'NL', 18),
    ('vie.1', 'V.League 1', 'Việt Nam', 'VN', 14),
]

def get(url, binary=False):
    path = CACHE / hashlib.sha256(url.encode()).hexdigest()
    if path.exists() and time.time() - path.stat().st_mtime < 86400:
        raw = path.read_bytes()
    else:
        error = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'TouchlineLocal/1.0 (personal football roster snapshot)'})
                with urllib.request.urlopen(req, timeout=30, context=TLS) as response:
                    raw = response.read()
                path.write_bytes(raw)
                break
            except Exception as exc:
                error = exc
                time.sleep(0.25 * (attempt + 1))
        else:
            raise RuntimeError(f'{url}: {error}')
    return raw if binary else raw.decode('utf-8')

def jsonget(url):
    return json.loads(get(url))

def roster_espn(task):
    league, team = task
    tid = str(team['id'])
    url = f'https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams/{tid}/roster'
    data = jsonget(url)
    players = []
    for a in data.get('athletes', []):
        stats = {s['name']: s.get('value', 0) for c in a.get('statistics', {}).get('splits', {}).get('categories', []) for s in c.get('stats', [])}
        pos = {'G': 'GK', 'D': 'DF', 'M': 'MF', 'F': 'FW'}.get(a.get('position', {}).get('abbreviation'), 'MF')
        players.append(dict(id='e'+a['id'], sourceId=a['id'], clubId='e'+tid,
            name=a['displayName'], shortName=a.get('shortName', a['displayName']),
            position=pos, positionKnown=bool(a.get('position')), age=a.get('age'),
            birthDate=(a.get('dateOfBirth') or '')[:10], nationality=a.get('citizenship', ''),
            countryCode=a.get('citizenshipCountry', {}).get('abbreviation', ''), number=a.get('jersey', ''),
            height=round(a.get('height', 0)*2.54) or None, sourceUrl=next((l['href'] for l in a.get('links',[]) if 'playercard' in l.get('rel', [])), url),
            source='ESPN', sourceStats={k:stats.get(k,0) for k in ['appearances','totalGoals','goalAssists','minutesPlayed']},
            photoUrl=f'https://a.espncdn.com/i/headshots/soccer/players/full/{a["id"]}.png', photo=''))
    if len(players) < 11:
        raise RuntimeError(f'{team["displayName"]}: only {len(players)} players; refusing incomplete roster')
    club=dict(id='e'+tid, name=team['displayName'], shortName=team.get('shortDisplayName', team['displayName']),
        abbreviation=team.get('abbreviation', team['displayName'][:3].upper()), leagueId=league,
        color='#'+(team.get('color') or '247a55'), alternateColor='#'+(team.get('alternateColor') or 'eeeeee'),
        badgeUrl=team.get('logos',[{}])[0].get('href',''), badge='', sourceUrl=url, source='ESPN',
        season=data.get('season',{}).get('displayName',''), snapshotAt=data.get('timestamp', NOW.isoformat()))
    return club, players

def roster_vpf(task):
    name,url,badge=task
    doc=BeautifulSoup(get(url), 'html.parser')
    slug=url.split('/team/')[1].split('/')[0]
    tid='v-'+slug
    players=[]
    for row in doc.select('#jstable_plz tbody tr'):
        cells=row.find_all('td', recursive=False)
        if len(cells)<6: continue
        texts=[c.get_text(' ',strip=True) for c in cells]
        a=cells[0].select_one('a[href*="/player/"]')
        if not a: continue
        purl=a['href']; pid='v-'+purl.split('/player/')[1].split('/')[0]
        im=cells[0].find('img'); photo=im.get('src','') if im else ''
        if 'player_st' in photo: photo=''
        birthday='';age=None
        try:
            b=dt.datetime.strptime(texts[5].replace('/','-'),'%d-%m-%Y').date()
            birthday=b.isoformat(); age=NOW.year-b.year-((NOW.month,NOW.day)<(b.month,b.day))
        except ValueError: pass
        players.append(dict(id=pid,clubId=tid,name=texts[0],shortName=texts[0],
            position={'Thủ môn':'GK','Hậu vệ':'DF','Tiền vệ':'MF','Tiền đạo':'FW'}.get(texts[1],'MF'), positionKnown=bool(texts[1]),
            age=age,birthDate=birthday,nationality='',countryCode='',number=texts[2],height=int(texts[3]) if texts[3].isdigit() else None,
            source='VPF',sourceUrl=purl,sourceStats={'totalGoals':int(texts[6]) if len(texts)>6 and texts[6].isdigit() else 0},photoUrl=photo,photo=''))
    if len(players)<11: raise RuntimeError(f'VPF {name}: roster missing')
    logo=doc.select_one('article img.entry-thumb')
    venue=doc.select_one('.venue-info-title')
    club=dict(id=tid,name=name,shortName=name,abbreviation=''.join(x[0] for x in name.split())[:5].upper(),leagueId='vie.1',
        color='#d32f3c',alternateColor='#eeeeee',badgeUrl=logo['src'] if logo else badge,badge='',stadium=venue.get_text(strip=True) if venue else '',
        source='VPF',sourceUrl=url,season='2026/27',snapshotAt=NOW.isoformat())
    return club,players

def asset(task):
    obj,key,folder=task
    url=obj.get(key+'Url','')
    if not url: return False
    ext='.jpg' if re.search(r'\.jpe?g(?:\?|$)',url,re.I) else '.png'
    safe_id=re.sub(r'[^a-zA-Z0-9_-]', '_',obj['id'])
    target=PUBLIC/folder/(safe_id+ext)
    try:
        if not target.exists():
            # Retain the URL from the source. Only verified image responses are persisted.
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req,timeout=12,context=TLS) as r:
                if not r.headers.get('Content-Type','').startswith('image/'): return False
                raw=r.read()
            if len(raw)<200: return False
            target.write_bytes(raw)
        obj[key]='/'+folder+'/'+target.name
        return True
    except Exception:
        return False

def main():
    leagues=[];tasks=[];clubs=[];players=[];errors=[]
    for lid,name,country,code,count in LEAGUES:
        league=dict(id=lid,name=name,country=country,countryCode=code,expectedTeams=count)
        if lid=='vie.1':
            url='https://vpf.vn/cac-doi-bong-v-league/'
            doc=BeautifulSoup(get(url),'html.parser')
            # The season selector includes other leagues. Scope to the first top-flight season id.
            candidates=doc.select('a[href*="/team/"]')
            sid=next(re.search(r'sid=(\d+)', a['href']).group(1) for a in candidates if 'sid=' in a['href'])
            named={}; badges={}
            for a in candidates:
                if 'sid='+sid not in a['href']: continue
                text=a.get_text(' ',strip=True)
                if text: named[a['href']]=text
                img=a.find('img')
                if img: badges[a['href']]=img.get('src','')
            if len(named)!=count: raise RuntimeError(f'Expected {count} VPF teams, got {len(named)}')
            league.update(sourceUrl=url,season='2026/27')
            with cf.ThreadPoolExecutor(max_workers=4) as ex:
                for club,ps in ex.map(roster_vpf,[(n,u,badges.get(u,'')) for u,n in named.items()]):
                    clubs.append(club);players.extend(ps);print(f'VPF {club["name"]}: {len(ps)}',flush=True)
        else:
            url=f'https://site.api.espn.com/apis/site/v2/sports/soccer/{lid}/teams?limit=100'
            data=jsonget(url)['sports'][0]['leagues'][0]
            teams=data['teams']
            if len(teams)!=count: raise RuntimeError(f'{lid}: expected {count}, got {len(teams)}')
            league.update(sourceUrl=url,season=str(data.get('season',{}).get('year','')))
            tasks.extend((lid,t['team']) for t in teams)
        leagues.append(league)
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for club,ps in ex.map(roster_espn,tasks):
            clubs.append(club);players.extend(ps);print(f'ESPN {club["name"]}: {len(ps)}',flush=True)
    # A source may list a transferred player in two rosters. Resolve by source season appearances;
    # retain all conflicts for a human to audit instead of inventing a second identity.
    unique={};conflicts=[]
    for p in players:
        if p['id'] in unique:
            old=unique[p['id']]
            take_new=p['sourceStats'].get('appearances',0)>old['sourceStats'].get('appearances',0)
            conflicts.append(dict(player=p['name'],clubs=[old['clubId'],p['clubId']],chosen=p['clubId'] if take_new else old['clubId'],resolution='Most source-season appearances; tied uses first source roster'))
            if take_new: unique[p['id']]=p
        else: unique[p['id']]=p
    players=list(unique.values())
    meta=dict(version=1,importedAt=NOW.isoformat(),season='2026/27',sources=['ESPN public roster API','VPF official team pages'],
        note='Roster snapshot, not a licensed Football Manager database. Ability, potential, finances and fixtures are simulated. Missing portraits use initials. Unavailable biographical fields remain empty.',
        conflicts=conflicts)
    db=dict(meta=meta,leagues=leagues,clubs=clubs,players=players)
    out=PUBLIC/'data/database.json'
    out.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
    print(f'Database: {len(clubs)} clubs, {len(players)} players. Downloading portraits and badges...',flush=True)
    jobs=[(c,'badge','badges') for c in clubs]+[(p,'photo','portraits') for p in players]
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        successes=0
        for i,ok in enumerate(ex.map(asset,jobs)):
            successes+=bool(ok)
            if (i+1)%250==0: print(f'Images {i+1}/{len(jobs)} · saved {successes}',flush=True)
    meta['portraitsDownloaded']=sum(bool(p['photo']) for p in players)
    meta['badgesDownloaded']=sum(bool(c['badge']) for c in clubs)
    out.write_text(json.dumps(db,ensure_ascii=False,separators=(',',':')))
    print(json.dumps(dict(clubs=len(clubs),players=len(players),portraits=meta['portraitsDownloaded'],badges=meta['badgesDownloaded'],conflicts=len(conflicts)),ensure_ascii=False),flush=True)

if __name__=='__main__': main()
