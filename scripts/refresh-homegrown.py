"""Build a sourced home-grown index without editing the database or save files.

PL identity matching is restricted to the same club and exact normalized name
tokens (including full first name), not nationality, shirt number or surname.
Biography periods are deliberately conservative when a source only gives a year
or age. They are evidence intervals, never invented exact registration dates.
"""
import importlib.util
import json
import re
import unicodedata
from pathlib import Path

spec = importlib.util.spec_from_file_location('official', Path(__file__).with_name('collect-official-portraits.py'))
official = importlib.util.module_from_spec(spec)
spec.loader.exec_module(official)
ROOT = official.ROOT
AS_OF = '2026-10-03'
PL = 'https://www.premierleague.com/en/news/4706139/see-all-the-202627-premier-league-squad-lists'
UEFA = 'https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-31-Player-lists-Online'
SPURS = 'https://www.tottenhamhotspur.com/news/1088296/squad-confirmed-for-202627-premier-league-season'
FIGC = 'https://files.figc.it/version/c%3AZmQ5Yzc3MGItNDE1Ni00%3AYzdmYmQ0YjItMDY4MS00/245%20-%20Modifica%20disposizioni%20in%20materia%20di%20Tetto%20alle%20Rose.pdf'


def tokens(value):
    return set(re.findall('[a-z0-9]+', unicodedata.normalize('NFKD', value.lower().replace('ø', 'o')).encode('ascii', 'ignore').decode()))


def main():
    db = json.loads((ROOT / 'public/data/database.json').read_text())
    players = {p['id']: p for p in db['players']}
    clubs = {c['id']: c for c in db['clubs']}
    rows, unmatched, entries = {}, [], {}
    page = official.read_page('homegrown-pl', PL)
    for heading in page.select('h5'):
        name, club_entries = heading.get_text(' ', strip=True), []
        for sibling in heading.next_siblings:
            if getattr(sibling, 'name', None) == 'h5':
                break
            if getattr(sibling, 'name', None) != 'p':
                continue
            text = sibling.get_text('\n', strip=True)
            if not ('Squad players' in text or text.startswith('U21')):
                continue
            group = 'u21' if text.startswith('U21') else 'senior'
            club_entries.extend((line, group) for line in text.split('\n') if ',' in line)
        entries[name] = club_entries

    def record(pid):
        p = players[pid]
        return rows.setdefault(pid, dict(id=pid, name=p['name'], birthDate=p.get('birthDate', ''), asOf=AS_OF))

    for p in players.values():
        club = clubs[p['clubId']]
        if club['leagueId'] != 'eng.1':
            continue
        parts = tokens(p['name'])
        matches = [(name, group) for name, group in entries.get(club['name'], []) if len(parts) > 1 and parts <= tokens(name)]
        if len(matches) != 1:
            unmatched.append(dict(id=p['id'], name=p['name'], club=club['name']))
            continue
        source_name, group = matches[0]
        # Youth lists are not submitted as a non-HG quota list. Unmarked U21
        # names remain unknown instead of being turned into negative evidence.
        flag = True if '*' in source_name else False if group == 'senior' else None
        record(p['id'])['pl'] = dict(association=flag, source=PL, sourceName='Premier League official squad list',
            sourcePlayerName=source_name, sourceClub=club['name'], sourceClubId=club['id'], group=group,
            season='2026/27', verifiedAt=AS_OF,
            evidence=('PL công bố dấu * home-grown.' if flag is True else 'Danh sách senior PL không đánh dấu home-grown.' if flag is False else 'Có trong danh sách U21; không suy ra trạng thái home-grown từ việc không có dấu *.'),
            matchEvidence='Exact normalized first-name/surname tokens, unique within the same official club squad')

    def period(pid, club_id, association, start, end, source, evidence, precision='conservative'):
        record(pid).setdefault('periods', []).append(dict(clubId=club_id, association=association,
            start=start, end=end, source=source, evidence=evidence, datePrecision=precision,
            verified=True, eligible=True, verifiedAt=AS_OF))

    # Reviewed official Barcelona biographies. An end-of-year start is a lower
    # bound on tenure, not a claim that the player signed on 31 December.
    barca = [
        ('e323703', '2011-12-31', AS_OF, 'Gia nhập Barcelona năm 2011, tiến liên tục qua học viện đến đội một; dùng cuối năm làm mốc bảo thủ.'),
        ('e368992', '2018-07-01', AS_OF, 'Hồ sơ CLB ghi gia nhập ngày 01/07/2018 từ Girona, đi qua học viện đến đội một.'),
        ('e250465', '2020-08-31', AS_OF, 'Tiểu sử ghi đến Barcelona tháng 08/2020; dùng cuối tháng để tính đủ thời gian, không dùng ngày ký thỏa thuận năm 2019.'),
        ('e323702', '2016-06-30', AS_OF, 'Gia nhập Barcelona mùa 2015/16; lấy cuối mùa làm mốc bảo thủ, tiến lên đội một.'),
        ('e354334', '2017-06-30', '2022-01-01', 'Ở Barcelona từ mùa 2016/17, đi mượn tại Linares năm 2022; chỉ tính khoảng bảo thủ trước đợt cho mượn.'),
        ('e376423', '2014-05-26', AS_OF, 'Gia nhập La Masia lúc 6 tuổi; sinh 26/05/2007. Mốc tính là sinh nhật 7 tuổi, không phải ngày ký hợp đồng.'),
        ('e362150', '2015-07-13', AS_OF, 'Gia nhập Barcelona lúc 7 tuổi; sinh 13/07/2007. Mốc tính là sinh nhật 8 tuổi, không phải ngày ký hợp đồng.'),
        ('e403582', '2015-12-31', AS_OF, 'Gia nhập Barcelona hè 2015 từ Vilassar de Mar; tiến qua các đội trẻ tới đội một.'),
        ('e403575', '2018-12-31', AS_OF, 'Hồ sơ CLB ghi khoác áo Barcelona liên tục từ 2018, hoàn thành các cấp học viện.'),
        ('e227765', '2007-12-31', '2014-01-01', 'Đào tạo tại Barcelona 2007–2014, sau đó sang Dinamo Zagreb. Thời gian trước 15 tuổi không tự tạo suất CT UEFA.'),
        ('e312015', '2023-12-31', AS_OF, 'Gia nhập Barça Atlètic hè 2023. Việc chơi cho Barcelona sau tuổi 21 không tự tạo suất CT.'),
    ]
    barca_sources = {'e323703': 'https://www.fcbarcelona.com/en/football/first-team/players/68906/alejandro-balde', 'e368992': 'https://www.fcbarcelona.com/en/football/first-team/players/129400/pau-cubarsi', 'e250465': 'https://www.fcbarcelona.com/en/football/first-team/players/70486/pedro-gonzalez-lopez', 'e323702': 'https://www.fcbarcelona.com/en/football/first-team/players/116719/pablo-paez-gavira', 'e354334': 'https://www.fcbarcelona.com/en/football/first-team/players/118929/fermin-lopez', 'e376423': 'https://www.fcbarcelona.com/en/football/first-team/players/141411/marc-bernal', 'e362150': 'https://www.fcbarcelona.com/en/football/first-team/players/129404/lamine-yamal-nasraoui-ebana', 'e403582': 'https://www.fcbarcelona.com/en/football/first-team/players/141001/xavi-espart', 'e403575': 'https://www.fcbarcelona.com/en/football/first-team/players/140515/brian-farinas', 'e227765': 'https://www.fcbarcelona.com/en/football/first-team/players/16677/dani-olmo', 'e312015': 'https://www.fcbarcelona.com/en/football/first-team/players/111861/gerard-martin'}
    for pid, start, end, evidence in barca:
        period(pid, 'e83', 'ES', start, end, barca_sources[pid], evidence)

    # Exact source identities were checked against these official biographies.
    period('e280555', 'e359', 'EN', '2010-05-31', AS_OF,
        'https://www.arsenal.com/news/bukayo-saka-signs-new-long-term-contract-aFcin3f65ht4',
        'Arsenal ghi Saka gia nhập Hale End tháng 05/2010 lúc 8 tuổi; học viện đến đội một.')
    period('e352758', 'e359', 'EN', '2015-09-26', AS_OF,
        'https://www.arsenal.com/fixtures/men/players/myles-lewis-skelly-aIsu57v3pDqR',
        'Tiểu sử Arsenal ghi gia nhập lúc 8 tuổi; dùng sinh nhật 9 tuổi làm mốc bảo thủ.')
    period('e399894', 'e359', 'EN', '2016-05-21', AS_OF,
        'https://www.arsenal.com/news/meet-the-academy-stars-out-in-girona-ar8uf3e9Wq3R',
        'Arsenal công bố Ife Ibrahim: sinh 20/01/2008, gia nhập 21/05/2016.', 'date')
    period('e393424', 'e359', 'EN', '2021-06-01', AS_OF,
        'https://www.arsenal.com/news/meet-the-academy-stars-out-in-girona-ar8uf3e9Wq3R',
        'Arsenal công bố Theo Julienne: sinh 11/01/2008, gia nhập 01/06/2021.', 'date')
    period('e400284', 'e359', 'EN', '2019-07-31', AS_OF,
        'https://www.arsenal.com/news/marli-salmon-commits-his-future-to-arsenal-ag2Dg2K3ftAU',
        'Arsenal công bố Marli Salmon gia nhập tháng 07/2019 lúc 9 tuổi; chưa đủ 3 năm sau tuổi 15 ở đầu mùa 2026/27.')

    madrid = [
        ('e84349', 'castilla/javier-navarro-jimenez', '2019-12-31'),
        ('e330352', 'castilla/mario-rivas-lagos', '2021-12-31'),
        ('e405544', 'castilla/jesus-fortea-tejedo', '2022-12-31'),
        ('e376422', 'castilla/daniel-yanez-barla', '2019-12-31'),
        ('e388339', 'castilla/joan-martinez-lozano', '2023-12-31'),
        ('e350351', 'castilla/sergio-mestre-sanchez', '2024-12-31'),
    ]
    madrid_id = next(c['id'] for c in clubs.values() if c['name'] == 'Real Madrid')
    for pid, path, start in madrid:
        url = 'https://www.realmadrid.com/en-US/football/academy/' + path
        period(pid, madrid_id, 'ES', start, AS_OF, url,
            f'Lịch sử đào tạo trên hồ sơ chính thức Real Madrid bắt đầu năm {start[:4]}; ngày 31/12 chỉ là mốc tính bảo thủ. Không suy trạng thái từ quốc tịch.')
    period('e350351', None, 'ES', '2012-12-31', '2024-01-01',
        'https://www.realmadrid.com/en-US/football/academy/castilla/sergio-mestre-sanchez',
        'Hồ sơ chính thức liệt kê Atlético de Madrid / Atlético Madrileño liên tiếp 2012–2024; xác minh đào tạo trong liên đoàn ES, không gộp thành CT Real Madrid.')
    period('e409318', None, 'ES', '2017-12-31', '2026-01-01',
        'https://www.realmadrid.com/en-US/football/academy/castilla/sergio-martinez-montero',
        'Hồ sơ Real Madrid ghi Racing de Santander 2017–2026, chuyển tới Castilla năm 2026; chỉ xác nhận AT Tây Ban Nha.')

    meta = dict(version=1, season='2026/27', verifiedAt=AS_OF, plMatched=sum('pl' in row for row in rows.values()),
        plHomegrown=sum(row.get('pl', {}).get('association') is True for row in rows.values()),
        plConfirmedNonHomegrown=sum(row.get('pl', {}).get('association') is False for row in rows.values()),
        plYouthUnknown=sum('pl' in row and row['pl']['association'] is None for row in rows.values()),
        plUnmatched=len(unmatched), biographyPlayers=sum(bool(row.get('periods')) for row in rows.values()),
        note='Dấu PL áp dụng cho PL; không tự đổi thành CT/AT UEFA. Lịch sử CLB dùng các khoảng thời gian đã đối chiếu; chưa có bằng chứng thì để chưa xác minh. Không suy home-grown từ quốc tịch.',
        limitations=['Không tự cộng tương lai sau ngày đối chiếu nguồn.', 'Các khoảng chỉ biết năm/tháng dùng mốc bảo thủ; ngoại lệ mùa giải cần ngày đầu/cuối giải được xác minh.', 'List B không suy chỉ từ CT. Ngoại lệ một đợt cho mượn cần hồ sơ riêng.'],
        sources=[dict(name='Premier League squad flags', url=PL), dict(name='UEFA Article 31', url=UEFA), dict(name='Spurs PL U21 cutoff corroboration', url=SPURS), dict(name='FIGC CU 245/A 2026', url=FIGC), dict(name='DFL LOS §5b 2026', url='https://media.dfl.de/sites/2/2026/04/Lizenzordnung-Spieler-LOS-2026-04-21-Stand.pdf'), dict(name='Liga Portugal 2026/27 definition u, articles 87–88', url='https://www.ligaportugal.pt/backoffice/assets/20260701_RC_2026_27_f53785bcd4.pdf')],
        sourceConflict='Footer bài PL ghi U21 2007 nhưng danh sách thực tế và thông báo chính thức Tottenham 2026/27 ghi 01/01/2005. Game giữ mốc 2005, không dùng lỗi footer để loại cầu thủ.')
    # Refreshing one evidence source must not erase independently reviewed
    # UEFA squads or career histories. Only retain identity-matched records.
    previous_path = ROOT / 'public/data/homegrown.json'
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {}
    for pid, old in previous.get('players', {}).items():
        player = players.get(pid)
        if not player or old.get('name') != player['name'] or old.get('birthDate') != player.get('birthDate'):
            continue
        if pid not in rows:
            rows[pid] = old
            continue
        row = rows[pid]
        if old.get('uefaSquads'):
            row['uefaSquads'] = old['uefaSquads']
        row.setdefault('periods', []).extend(p for p in old.get('periods', []) if p.get('sourceType') in ('career-provider', 'reviewed-biography', 'reviewed-secondary'))
    old_meta = previous.get('meta', {})
    for key in ('uefaClubs', 'uefaMatched', 'uefaListB', 'uefaUnmatched', 'historyVersion', 'careerProfiles', 'careerPeriods', 'reviewedSupplementPlayers'):
        if key in old_meta:
            meta[key] = old_meta[key]
    meta['verifiedAt'] = max(AS_OF, old_meta.get('verifiedAt', AS_OF))
    meta['biographyPlayers'] = sum(bool(row.get('periods')) for row in rows.values())
    result = dict(meta=meta, players=rows)
    (ROOT / 'public/data/homegrown.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (official.CACHE / 'homegrown-unmatched.json').write_text(json.dumps(unmatched, ensure_ascii=False, indent=2))
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
