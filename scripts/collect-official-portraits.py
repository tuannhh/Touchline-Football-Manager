"""Collect identity-matched official club portrait candidates without editing game data.

Run before enrich-portraits.py --official-only. Only this manifest and source HTML
cache change. Use the asset importer to validate image files before applying them.
Squad numbers are never identity keys. Every accepted image belongs to a named
player card/profile, not a news article, team photograph, badge or sponsor.
"""
import concurrent.futures as cf
import datetime as dt
import json
from pathlib import Path
import re
import ssl
import time
import unicodedata
import urllib.parse
import urllib.request

import certifi
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache'
TLS = ssl.create_default_context(cafile=certifi.where())


def norm(value):
    text = unicodedata.normalize('NFKD', value.lower().replace('ø', 'o').replace('đ', 'd'))
    return re.sub('[^a-z0-9]', '', text.encode('ascii', 'ignore').decode())


def slug(value):
    text = unicodedata.normalize('NFKD', value.lower().replace('ø', 'o'))
    return re.sub('[^a-z0-9]+', '-', text.encode('ascii', 'ignore').decode()).strip('-')


def read_page(label, url):
    path = CACHE / ('official-' + label + '.html')
    if not path.exists() or time.time() - path.stat().st_mtime > 86400:
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Touchline personal game portrait import)'})
        with urllib.request.urlopen(request, timeout=25, context=TLS) as response:
            data = response.read()
        path.write_bytes(data)
    return BeautifulSoup(path.read_text(), 'xml' if url.endswith('.xml') else 'html.parser')


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def main():
    db = json.loads((ROOT / 'public/data/database.json').read_text())
    players = db['players']
    rows, failures = {}, []

    def match(name, club_id):
        hits = [p for p in players if p['clubId'] == club_id and norm(p['name']) == norm(name)]
        return hits[0] if len(hits) == 1 else None

    def add(player, name, image, url, source, evidence=None):
        if not player or not image or not image.startswith('https://'):
            return
        if any(word in image.lower() for word in ['placeholder', 'contentful-profile-transparent', 'noimage', 'no-image', 'default-player']):
            return
        rows[player['id']] = {'playerId': player['id'], 'name': player['name'],
            'sourcePlayerName': name, 'imageUrl': image, 'sourceUrl': url,
            'sourceName': source, 'sourceType': 'official-club',
            'matchEvidence': evidence or 'Exact normalized full/display name in the official club player card and same database club',
            'portraitEvidence': 'Portrait image attached to the named official player profile/card'}

    for label, path in [('barca', 'first-team'), ('barca-b', 'barca-b')]:
        url = f'https://www.fcbarcelona.com/en/football/{path}/players'
        try:
            doc = read_page(label, url)
            for card in doc.select('a.team-person'):
                if '/players/' not in card.get('href', ''):
                    continue
                name = ' '.join(n.get_text(' ', strip=True) for n in card.select('.team-person__first-name, .team-person__last-name'))
                image = card.select_one('picture[data-img-src]')
                if image:
                    player = match(name, 'e83')
                    evidence = None
                    # Barcelona displays Hamza's full legal name in its squad card.
                    if not player and name == 'Hamza Mohamed Abdelkarim Elsayed Selim':
                        profile = read_page('barca-hamza', card['href'])
                        p = next((p for p in players if p['id'] == 'e399200'), None)
                        bio = profile.get_text(' ', strip=True)
                        if p and p.get('birthDate') == '2008-01-01' and 'Date of birth 01/01/2008' in bio and 'Hamza Abdelkarim' in bio:
                            player = p
                            evidence = 'Official full-name profile also calls him Hamza Abdelkarim in biography; matching DOB 2008-01-01 and Barcelona'
                    add(player, name, image['data-img-src'] + '?width=470&height=470', card['href'], 'FC Barcelona official website', evidence)
        except Exception as error:
            failures.append({'sourceUrl': url, 'error': str(error)})

    sitemap_url = 'https://www.arsenal.com/sitemaps/players/sitemap.xml'
    try:
        sitemap = read_page('arsenal-player-sitemap', sitemap_url)
        arsenal_urls = [tag.get_text() for tag in sitemap.select('loc')]
    except Exception as error:
        arsenal_urls = []
        failures.append({'sourceUrl': sitemap_url, 'error': str(error)})

    def arsenal(player):
        target = slug(player['name']) if player['name'] != 'Gabriel Magalhães' else 'gabriel'
        candidates = [url for url in arsenal_urls if re.search('/(?:men|academy)/players/' + re.escape(target) + '-a[A-Za-z0-9]+$', url)]
        candidates.append('https://www.arsenal.com/men/players/' + slug(player['name']))
        if player['name'] == 'Gabriel Magalhães':
            candidates.append('https://www.arsenal.com/men/players/gabriel')
        if player['name'] == 'Cristhian Mosquera':
            candidates.append('https://www.arsenal.com/men/players/cristhian-mosquera-0')
        candidates.append('https://www.arsenal.com/academy/players/' + slug(player['name']))
        for url in candidates:
            try:
                doc = read_page('arsenal-' + player['id'], url)
                data = json.loads(doc.select_one('#__NEXT_DATA__').get_text())
                article = data['props']['pageProps'].get('article') or {}
                name = article.get('title', '')
                gabriel_verified = (player['id'] == 'e236322' and name == 'Gabriel'
                    and 'gabriel-magalhaes' in (article.get('promoImage') or ''))
                if article.get('articleType') != 'Player' or (norm(name) != norm(player['name']) and not gabriel_verified):
                    continue
                image = next((x['src'] for x in article.get('promoImageRenditions', []) if x.get('type') == 'medium_square'), article.get('promoImage'))
                return player, name, image, urllib.parse.urljoin(url, article['path'])
            except Exception as error:
                last_error = str(error)
        return {'playerId': player['id'], 'name': player['name'], 'error': locals().get('last_error', 'Official profile name could not be verified')}

    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(arsenal, [p for p in players if p['clubId'] == 'e359']):
            if isinstance(result, tuple):
                add(*result, 'Arsenal official website')
                if result[0]['id'] == 'e236322':
                    rows['e236322']['matchEvidence'] = 'Official Gabriel player profile explicitly identifies attached portrait asset as Gabriel Magalhaes; same Arsenal club'
            else:
                failures.append(result)

    url = 'https://www.liverpoolfc.com/team/mens'
    try:
        doc = read_page('liverpool', url)
        for script in doc.select('script'):
            packet = re.fullmatch(r'self\.__next_f\.push\((.*)\)', script.get_text(), re.S)
            if not packet:
                continue
            decoded = json.loads(packet.group(1))
            if len(decoded) < 2 or not isinstance(decoded[1], str):
                continue
            for line in decoded[1].splitlines():
                try:
                    data = json.loads(line.split(':', 1)[1])
                except (ValueError, IndexError):
                    continue
                for profile in walk(data):
                    if not all(k in profile for k in ['firstName', 'surname', 'image', 'url']):
                        continue
                    name = (profile['firstName'] + ' ' + profile['surname']).strip()
                    images = list(walk(profile['image']))
                    image = next((v.get('url') for v in images if v.get('url', '').startswith('https://images.ctfassets.net/')), None)
                    if image:
                        add(match(name, 'e364'), name, image + '?w=480&h=480&fit=pad&fm=png', urllib.parse.urljoin(url, profile['url']), 'Liverpool FC official website')
    except Exception as error:
        failures.append({'sourceUrl': url, 'error': str(error)})

    url = 'https://www.realmadrid.com/en-US/football/first-team/players'
    try:
        doc = read_page('madrid', url)
        unmatched = []
        for card in doc.select('a[href*="/football/first-team/players/"]'):
            image = card.select_one('img.profile-card__img')
            if not image:
                continue
            names = [card['href'].rsplit('/', 1)[1].replace('-', ' '), image.get('alt', '')]
            for name in names:
                player = match(name, 'e86')
                if player:
                    add(player, name, image['src'], urllib.parse.urljoin(url, card['href']), 'Real Madrid official website', 'Exact normalized full name in official profile URL (or display name in player card) and same database club')
                    break
            else:
                unmatched.append((urllib.parse.urljoin(url, card['href']), image['src']))

        def madrid_profile(candidate):
            profile_url, image = candidate
            try:
                profile = read_page('madrid-profile-' + profile_url.rsplit('/', 1)[1], profile_url)
                for tag in profile.select('script[type="application/ld+json"]'):
                    person = json.loads(tag.get_text())
                    if person.get('@type') != 'Person':
                        continue
                    full_name = (person.get('givenName', '') + ' ' + person.get('familyName', '')).strip()
                    tokens = set(slug(full_name).split('-'))
                    hits = [p for p in players if p['clubId'] == 'e86' and p.get('birthDate') and p['birthDate'] == person.get('birthDate')
                        and len(slug(p['name']).split('-')) >= 2 and set(slug(p['name']).split('-')) <= tokens]
                    if len(hits) == 1:
                        return hits[0], full_name, image, profile_url, person['birthDate']
            except Exception as error:
                return {'sourceUrl': profile_url, 'error': str(error)}
            return None

        with cf.ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(madrid_profile, unmatched):
                if isinstance(result, tuple):
                    player, full_name, image, source_url, dob = result
                    add(player, full_name, image, source_url, 'Real Madrid official website', 'Name tokens match official full legal name with exact DOB ' + dob + ' and same club; unique database match')
                elif result:
                    failures.append(result)
    except Exception as error:
        failures.append({'sourceUrl': url, 'error': str(error)})

    # Other official squads keep identity text beside portrait cards or in the
    # public page's own serialized rendering data. No roster-number joins.
    other_sources = [
        ('psg', 'https://en.psg.fr/teams/first-team/squad', 'e160', 'Paris Saint-Germain official website'),
        ('inter', 'https://www.inter.it/en/teams/first-team', 'e110', 'Inter official website'),
        ('juventus', 'https://www.juventus.com/en/teams/first-team-men/squad/', 'e111', 'Juventus official website'),
        ('manunited', 'https://www.manutd.com/en/players-and-staff/first-team', 'e360', 'Manchester United official website'),
        ('chelsea', 'https://www.chelseafc.com/en/teams/men', 'e363', 'Chelsea official website'),
        ('sporting', 'https://www.sporting.pt/en/football/main-team/squad', 'e2250', 'Sporting CP official website'),
        ('ajax', 'https://english.ajax.nl/teams/ajax-1/', 'e139', 'Ajax official website'),
    ]
    for label, url, club_id, source_name in other_sources:
        before = len(rows)
        try:
            doc = read_page(label, url)
            candidates = []
            if label == 'psg':
                for card in doc.select('a[href*="/players/"]:has(img)'):
                    name = ' '.join(h.get_text(' ', strip=True) for h in card.select('h3') if not h.get_text(strip=True).isdigit())
                    image = card.select_one('img')
                    image_url = image['src'].replace('/w_3840/', '/w_480/').replace('/f_avif,', '/f_png,')
                    candidates.append((name, image_url, card['href']))
            elif label == 'inter':
                data = json.loads(doc.select_one('#__NEXT_DATA__').get_text())
                for profile in data['props']['pageProps']['players']:
                    if not profile.get('image'):
                        continue
                    image_url = profile['image'][0].get('thumbnails', {}).get('transformBaseUrl')
                    if not image_url:
                        continue
                    full_name = (profile.get('firstName', '') + ' ' + profile.get('lastName', '')).strip()
                    # The official public profile slug is an additional full
                    # display name, e.g. Josep Martinez / Martinez Riera.
                    name = full_name if match(full_name, club_id) else profile['slug'].replace('-', ' ')
                    candidates.append((name, image_url + '?quality=85&io=transform:fill,width:400,height:480&format=webp', '/en/teams/first-team/' + profile['slug']))
            elif label == 'juventus':
                for card in doc.select('a[href*="/first-team-men/squad/"]:has(img)'):
                    image = card.select_one('img')
                    name = card.get('aria-label') or image.get('alt', '')
                    candidates.append((name, image['src'], card['href']))
            elif label == 'manunited':
                for card in doc.select('a[href*="/teams/mens-team/"]:has(img)'):
                    first, last = card.select_one('[data-testid="profile-card__first-name"]'), card.select_one('[data-testid="profile-card__last-name"]')
                    if not first or not last:
                        continue
                    name = first.get_text(' ', strip=True) + ' ' + last.get_text(' ', strip=True)
                    candidates.append((name, card.select_one('img')['src'], card['href']))
            elif label == 'chelsea':
                for element in doc.select('[data-props]'):
                    if 'playerFirstName' not in element['data-props']:
                        continue
                    for profile in walk(json.loads(element['data-props'])):
                        if not profile.get('playerImage') or 'playerFirstName' not in profile:
                            continue
                        if 'mensteam' not in profile.get('teams', []):
                            continue
                        name = (profile.get('playerFirstName', '') + ' ' + profile.get('playerLastName', '')).strip()
                        image_url = profile['playerImage'].get('file', {}).get('url', '').replace('http://', 'https://')
                        image_url = image_url.replace('/image/upload/', '/image/upload/w_480,f_png/')
                        candidates.append((name, image_url, profile.get('playerProfileLink', {}).get('url', url)))
            elif label == 'sporting':
                for card in doc.select('a[href*="/football/main-team/squad/"]:has(img)'):
                    name_tag = card.select_one('.item__name')
                    if not name_tag:
                        continue
                    image = card.select_one('img')
                    name = name_tag.get_text(' ', strip=True)
                    if not match(name, club_id):
                        name = image.get('alt', '')
                    candidates.append((name, image['src'], card['href']))
            elif label == 'ajax':
                for card in doc.select('.players-block__player'):
                    image = card.select_one('.players-block__player-image')
                    anchor = card.select_one('.players-block__player-name')
                    if image and anchor:
                        candidates.append((image.get('alt', ''), urllib.parse.urljoin(url, image.get('data-src') or image.get('src', '')), anchor['href']))
            for name, image_url, profile_url in candidates:
                add(match(name, club_id), name, image_url, urllib.parse.urljoin(url, profile_url), source_name)
            print(label, len(rows) - before, 'official portraits', flush=True)
        except Exception as error:
            failures.append({'sourceUrl': url, 'error': str(error)})

    manifest = list(rows.values())
    # A shared placeholder must never be distributed as multiple real faces.
    image_ids = {}
    for row in manifest:
        image_ids.setdefault(row['imageUrl'], []).append(row['playerId'])
    duplicates = {url: ids for url, ids in image_ids.items() if len(ids) > 1}
    if duplicates:
        failures.extend({'imageUrl': url, 'playerIds': ids, 'error': 'Shared image excluded; may be a placeholder'} for url, ids in duplicates.items())
        manifest = [row for row in manifest if row['imageUrl'] not in duplicates]
    (CACHE / 'official-portraits.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    (CACHE / 'official-portraits-report.json').write_text(json.dumps({'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'matched': len(manifest), 'bySource': {s: sum(r['sourceName'] == s for r in manifest) for s in sorted({r['sourceName'] for r in manifest})},
        'unresolved': failures}, ensure_ascii=False, indent=2))
    print('Official portrait candidates:', len(manifest), flush=True)
    print('Sources:', {s: sum(r['sourceName'] == s for r in manifest) for s in sorted({r['sourceName'] for r in manifest})}, flush=True)


if __name__ == '__main__':
    main()
