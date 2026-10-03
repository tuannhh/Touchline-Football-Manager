"""Reproducible, sourced identity corrections for the 2026/27 snapshot.

Training classifications are derived from dated club biographies. They are not
claimed to be an imported UEFA registration list. Do not carry them to a new
snapshot season without reviewing the evidence again.
"""
import json
import datetime as dt
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'public/data/database.json'
db = json.loads(path.read_text())
clubs = {c['id']: c for c in db['clubs']}
players = {p['id']: p for p in db['players']}

# UEFA and the Portuguese second tier use different provider IDs for one club.
if 'f212820' in clubs:
    duplicate = clubs.pop('f212820')
    clubs['e21615'].update(leagueId='por.2', playable=True,
                           domesticSourceUrl=duplicate['sourceUrl'])
    for p in players.values():
        if p['clubId'] == 'f212820':
            p['clubId'] = 'e21615'
db['meta']['clubAliases'] = {'f212820': 'e21615'}

# First-team and B-team registration can overlap in source lists. The engine
# represents one primary squad, so the source conflict remains visible.
p = players['e347568']
if p['clubId'] in ['e102', 'f161771']:
    p.update(clubId='f161771', previousClubId='e102', primaryRegistrationCorrection=True,
             rosterNote='Nguồn liệt kê cả đội một Villarreal và Villarreal B. Game xếp đội chính là Villarreal B; chưa mô phỏng đăng ký đồng thời hai đội.',
             rosterSourceUrl=clubs['f161771']['rosterSourceUrl'])

source = 'https://www.athletic-club.eus/en/players/iker-pagazartundua-etxezarraga/'
players.setdefault('ac-iker-pagazartundua', dict(
    id='ac-iker-pagazartundua', clubId='f161850', name='Iker Pagazartundua',
    shortName='I. Pagazartundua', position='GK', positionKnown=True,
    age=19, birthDate='2007-03-13', countryCode='', nationality='', number='30',
    source='Athletic Club official · 2026/27', sourceUrl=source,
    sourceStats={}, photo='', photoUrl='',
    rosterNote='Tiểu sử chính thức ghi Bilbao Athletic và Basconia mùa 2026/27. Game xếp vào Athletic Club B; chưa mô phỏng đăng ký đồng thời.'))

evidence = {
    'e323703': 'Gia nhập học viện Barcelona năm 2011; ít nhất 3 mùa từ 15–21 tuổi.',
    'e368992': 'Gia nhập Barcelona ngày 01/07/2018; đủ thời gian đào tạo từ 15 tuổi.',
    'e250465': 'Gia nhập Barcelona tháng 08/2020, trước tuổi 18; đủ 36 tháng trước tuổi 21.',
    'e323702': 'Gia nhập Barcelona mùa 2015/16; ít nhất 3 mùa từ 15–21 tuổi.',
    'e354334': 'Gia nhập Barcelona năm 2016; đủ 3 mùa sau tuổi 15 trước đợt cho mượn năm 2022.',
    'e376423': 'Gia nhập Barcelona từ 6 tuổi; đủ 3 năm sau tuổi 15.',
    'e362150': 'Gia nhập Barcelona từ 7 tuổi; đủ 3 năm sau tuổi 15.',
}
for pid, note in evidence.items():
    p = players[pid]
    p['training'] = dict(clubs=['e83'], associations=['ES'],
                         listBClubs=['e83'] if p['birthDate'] >= '2005-01-01' else [],
                         reviewed=True, derived=True, source=p['photoSourceUrl'],
                         evidence=note, verifiedAt='2026-10-03')
p = players['e280555']
p['training'] = dict(clubs=['e359'], associations=['EN'], listBClubs=[],
                     reviewed=True, derived=True, verifiedAt='2026-10-03',
                     source='https://www.arsenal.com/news/bukayo-saka-signs-new-long-term-contract-aFcin3f65ht4',
                     evidence='Gia nhập Hale End tháng 05/2010 lúc 8 tuổi; đủ 3 mùa đào tạo tại Arsenal từ 15–21 tuổi.')

for c in clubs.values():
    if c['name'] == 'RC Celta Fortuna':
        c['reserveTeam'] = True

counts = Counter(c['leagueId'] for c in clubs.values())
rosters = Counter(p['clubId'] for p in players.values())
keepers = Counter(p['clubId'] for p in players.values() if p['position'] == 'GK')
for league in db['leagues']:
    if league['kind'] != 'external':
        assert counts[league['id']] == league['expectedTeams'], (league['name'], counts[league['id']])
for cid in clubs:
    assert rosters[cid] >= 14 and keepers[cid] >= 1, (cid, rosters[cid], keepers[cid])
cup_ids = [cid for cup in db['competitions'] for cid in cup['participants']]
assert len(cup_ids) == len(set(cup_ids)) == 108
assert all(cid in clubs for cid in cup_ids)
db.update(clubs=list(clubs.values()), players=list(players.values()))
db['meta'].update(
    expandedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
    nationalitiesAvailable=sum(bool(p.get('nationality') or p.get('countryCode')) for p in players.values()),
    portraitsDownloaded=sum(bool(p.get('photo')) for p in players.values()),
    badgesDownloaded=sum(bool(c.get('badge')) for c in clubs.values()),
    trainingBiographiesReviewed=len(evidence) + 1,
    trainingNote='8 hồ sơ được suy ra từ mốc đào tạo trong tiểu sử CLB có nguồn; không phải danh sách đăng ký UEFA chính thức. Các hồ sơ khác không được suy từ quốc tịch.')
db['meta']['sources'] = list(dict.fromkeys(db['meta']['sources'] + [
    'Athletic Club official player biographies', 'FC Barcelona / Arsenal official training biographies']))
path.write_text(json.dumps(db, ensure_ascii=False, separators=(',', ':')))
print('Validated:', len(clubs), 'clubs,', len(players), 'players, 108 UEFA participants')
