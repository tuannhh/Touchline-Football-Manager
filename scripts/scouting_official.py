"""Explicit men's squad pages. Match names within a club, never search-result photos."""
import re
from urllib.parse import urljoin, quote

SOURCES=[
 ('palmeiras','Palmeiras','https://www.palmeiras.com.br/elenco/'),
 ('olympiacos','Olympiacos','https://www.olympiacos.org/en/team/'),
 ('boca','Boca Juniors','https://www.bocajuniors.com.ar/futbol-masculino'),
 ('galatasaray','Galatasaray','https://www.galatasaray.org/pl/futbol-takim-kadrosu/9'),
 ('hilal','Al Hilal','https://alhilal.com/en/teams/mens-team'),
 ('sydney','Sydney FC','https://sydneyfc.com/squads/men/'),
 ('miami','Inter Miami CF','https://www.intermiamicf.com/club/roster/'),
 ('legia','Legia Warszawa','https://legia.com/'),
 ('vissel-jp','Vissel Kobe','https://www.vissel-kobe.co.jp/profile/'),
]
def official_candidates(key,doc,url):
 rows=[]
 def add(name,img,link=None):
  if not name or img is None:return
  src=img.get('data-src') or img.get('src','')
  if src.startswith('data:'):return
  src=urljoin(url,src).replace('http://','https://')
  rows.append((name,quote(src,safe=":/?=&%+#@;"),urljoin(url,link or '')))
 if key=='palmeiras':
  for card in doc.select('.futebolprofissional.box-elenco'):add(card.select_one('h6').get_text(' ',strip=True),card.select_one('a > img'),card.select_one('a')['href'])
 elif key=='olympiacos':
  for card in doc.select('.player-cell'):add(card.select_one('.player-item-details-name').get_text(' ',strip=True),card.select_one('.regular-pimage'),card['href'])
 elif key=='boca':
  for card in doc.select('.deporte_card'):
   name=card.select_one('.deporte_card-name')
   if name:add(name.get_text(' ',strip=True),card.select_one('.deporte_card-img'))
 elif key=='sydney':
  for card in doc.select('.card_background'):
   name=card.select_one('.description .h5--headline')
   if name:add(re.sub(r'\s*\(C\)$','',name.get_text(' ',strip=True)),card.select_one('.player-img'))
 elif key=='galatasaray':
  for card in doc.select('.photolist_block'):
   name=card.select_one('.title');a=card.select_one('a')
   if name:add(re.sub(r'^\d+\s*-\s*','',name.get_text(' ',strip=True)),card.select_one('img'),a['href'] if a else None)
 elif key=='vissel-jp':
  for card in doc.select('a[href*="mode=detail"]'):
   img=card.find('img')
   # Japanese card also publishes the player's Romanized name.
   text=card.get_text(' ',strip=True);parts=re.findall(r'[A-Za-z][A-Za-z .\x27-]+',text)
   parts=[s.strip() for s in parts if s.strip() not in ['GK','DF','MF','FW']]
   if parts:add(parts[-1],img,card['href'])
 else:
  for img in doc.select('img[alt]'):
   name=img['alt'];name=re.sub(r'^#?\d+\s*-\s*','',name);name=re.sub(r' Image$','',name)
   if key=='legia' and not img.find_parent('a',href=re.compile('/players/')):continue
   if key=='miami' and not re.match(r'^#\d+\s*-',img['alt']):continue
   add(name,img)
 return rows

def enrich_official(clubs,players,fetch,norm,errors,stamp):
 reports=[]
 for key,name,url in SOURCES:
  matches=[c for c in clubs if norm(c['name'])==norm(name)]
  if len(matches)!=1:
   matches=[c for c in clubs if norm(name) in norm(c['name']) or norm(c['name']) in norm(name)]
  if len(matches)!=1:errors.append({'club':name,'sourceUrl':url,'reason':'Ambiguous or missing club identity'});continue
  c=matches[0];squad=[p for p in players if p['clubId']==c['id']];count=0
  try:
   candidates=official_candidates(key,fetch(url),url)
   for label,photo,profile in candidates:
    found=[p for p in squad if norm(p['name'])==norm(label)]
    if len(found)!=1:continue
    p=found[0]
    if p.get('officialRosterUrl'):continue
    p.update(photoUrl=photo,photoCandidateSource='Official club website',photoCandidateSourceUrl=profile or url,officialRosterUrl=url,officialCheckedAt=stamp);count+=1
   c['officialRosterUrl']=url
   reports.append({'club':name,'sourceUrl':url,'matchedPlayers':count,'publishedCards':len(candidates)})
   print('Official cross-check',name,count,'/',len(candidates),flush=True)
  except Exception as e:errors.append({'club':name,'sourceUrl':url,'reason':str(e)})
 return reports
