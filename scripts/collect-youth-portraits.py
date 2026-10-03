"""Collect additional official academy portraits; never edits database or saves."""
import importlib.util
import json
from pathlib import Path
import urllib.parse

spec = importlib.util.spec_from_file_location('official', Path(__file__).with_name('collect-official-portraits.py'))
official = importlib.util.module_from_spec(spec)
spec.loader.exec_module(official)
ROOT, CACHE = official.ROOT, official.CACHE

# Explicit source profiles keep this collector reproducible without a cache.
MADRID = [
    ('e84349', 'castilla/javier-navarro-jimenez'),
    ('e350351', 'castilla/sergio-mestre-sanchez'),
    ('e330352', 'castilla/mario-rivas-lagos'),
    ('e388339', 'castilla/joan-martinez-lozano'),
    ('e405544', 'castilla/jesus-fortea-tejedo'),
    ('e409318', 'castilla/sergio-martinez-montero'),
    ('e3117407', 'juvenil-a/alexis-ciria-flores'),
    ('e376422', 'castilla/daniel-yanez-barla'),
]

# Each official article was inspected: the hero photograph contains one named
# player. The square regions below were checked visually in its 1280x720 image.
# Pin the image asset so an updated article cannot silently reuse an old crop.
JUVENTUS = [
    ('e126879', 'juve-guerra', '/it/news/articoli/next-gen-simone-guerra-rinnova-fino-al-2027', 'tg62tlgwch6isnxaje5f', (500, 290, 280, 280)),
    ('e421739', 'juve-radu', '/it/news/articoli/next-gen-radu-e-rinnovo', 'trhubcjxeg91edghzz0a', (500, 220, 330, 330)),
    ('e414157', 'juve-mangiapoco-sign', '/it/news/articoli/juventus-next-gen-stefano-mangiapoco-nuovo-giocatore', 'w75ngzilczzfyhhmnod7', (480, 200, 280, 280)),
    ('e349101', 'juve-oboavwoduo', '/it/news/articoli/next-gen-justin-oboavwoduo-e-un-nuovo-giocatore-della-juventus', 'xzbo4sxqpfutzzyyvnyc', (450, 100, 300, 300)),
    ('e397259', 'juve-montero', '/it/news/articoli/next-gen-alfonso-montero-rinnova-con-la-juventus-fino-al-2028', 'u96siitd7mowu8anwjl8', (500, 150, 300, 300)),
    ('e3121497', 'juve-savio', '/it/news/articoli/federico-savio-juventus-rinnovo-contratto', 'ztziv2jxpcq6xl9aw5id', (500, 85, 300, 300)),
    ('e3117539', 'juve-ripani', '/it/news/articoli/u20-diego-ripani-rinnova-fino-al-2027', 'ag2qstabe8zmvjvtcda8', (510, 300, 290, 290)),
    ('e397463', 'juve-rizzo', '/it/news/articoli/juventus-u20-rizzo-rinnovo-2028', 'r6gd3vl6uwzgim16m7ij', (540, 150, 350, 350)),
    ('e387434', 'juve-pagnucco', '/it/news/articoli/juventus-u20-filippo-pagnucco-rinnovo-2028', 'q5xmfrwdxywylpmblyjy', (490, 165, 340, 340)),
    ('e3121505', 'juve-amaradio', '/it/news/articoli/next-gen-luca-amaradio-rinnova-fino-al-2028', 'npkjxp90rvwszc3x8qep', (440, 120, 350, 350)),
    ('e422958', 'juve-corigliano', '/it/news/articoli/juventus-u17-thomas-corigliano-primo-contratto-professionista-2025', 'axicqfd4ys6v0ckg7sds', (500, 280, 310, 310)),
    ('e346959', 'juve-corradi', '/it/news/articoli/next-gen-christian-corradi-e-un-nuovo-giocatore-bianconero', 'l6ugde9cjleivia0ylki', (500, 270, 300, 300)),
    ('e76017', 'juve-nico-news', '/en/news/articles/nico-gonzalez-is-bianconero', 'cwdlulnqv3qpi9n84zxr', (400, 35, 500, 500)),
]


def main():
    players = {p['id']: p for p in json.loads((ROOT / 'public/data/database.json').read_text())['players']}
    targets = [{'playerId': pid, 'url': 'https://www.realmadrid.com/en-US/football/academy/' + path} for pid, path in MADRID]
    rows = []
    for target in targets:
        p = players[target['playerId']]
        profile = official.read_page('youth-' + p['id'], target['url'])
        for tag in profile.select('script[type="application/ld+json"]'):
            person = json.loads(tag.get_text())
            if person.get('@type') != 'Person':
                continue
            full_name = (person.get('givenName', '') + ' ' + person.get('familyName', '')).strip()
            tokens_match = set(official.slug(p['name']).split('-')) <= set(official.slug(full_name).split('-'))
            heading = profile.h1.get_text(' ', strip=True) if profile.h1 else ''
            name_match = official.norm(heading) == official.norm(p['name'])
            dob_match = p.get('birthDate') and p['birthDate'] == person.get('birthDate')
            if not tokens_match or not (dob_match or (not p.get('birthDate') and name_match)):
                continue
            image = next((image for image in profile.select('img') if image.get('alt', '').strip() == heading
                and image.get('src', '').startswith('https://assets.realmadrid.com/is/image/realmadrid/')), None)
            if not image:
                continue
            rows.append({'playerId': p['id'], 'name': p['name'], 'sourcePlayerName': full_name,
                'sourceBirthDate': person.get('birthDate'), 'imageUrl': urllib.parse.quote(image['src'], safe=':/?&=+$,%'), 'sourceUrl': target['url'],
                'sourceName': 'Real Madrid official academy website', 'sourceType': 'official-club',
                'matchEvidence': ('Name tokens match official full name and exact DOB ' + person['birthDate']) if dob_match
                    else 'Exact normalized display name on official academy profile and same club; official DOB recorded (database DOB absent)',
                'portraitEvidence': 'Main portrait of named academy player, not team or news photograph'})
    for pid, label, path, expected_asset, crop in JUVENTUS:
        p = players[pid]
        url = 'https://www.juventus.com' + path
        article = official.read_page(label, url)
        main_text = (article.select_one('main') or article).get_text(' ', strip=True)
        assert official.norm(p['name']) in official.norm(main_text), f'Article no longer names {p["name"]}'
        hero = next(image for image in article.select('img')
            if '/t_editorial_landscape_12_desktop/' in image.get('src', ''))
        image_url = hero['src']
        if expected_asset:
            assert expected_asset in image_url, f'Hero image changed for {p["name"]}'
        x, y, w, h = crop
        rows.append({'playerId': pid, 'name': p['name'], 'sourcePlayerName': p['name'],
            'imageUrl': image_url, 'sourceUrl': url,
            'sourceName': 'Juventus official website', 'sourceType': 'official-club',
            'matchEvidence': 'Exact normalized full name in official club signing/contract article; same database club',
            'portraitEvidence': 'Official solo photograph of the named player, visually verified; portrait crop recorded; kit reflects article date',
            'cropBox': {'x': x / 1280, 'y': y / 720, 'w': w / 1280, 'h': h / 720}})
    assert len(rows) == len({p['playerId'] for p in rows}) == len({p['imageUrl'] for p in rows})
    path = CACHE / 'official-youth-portraits.json'
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print('Verified additional official portraits:', len(rows))


if __name__ == '__main__':
    main()
