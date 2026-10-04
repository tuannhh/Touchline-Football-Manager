# Match venues, weather and crowds

The venue reference snapshot was checked on **4 October 2026**. A saved career retains its own `stadiums` snapshot. A later source update does not silently enlarge a stadium in an existing career.

The source date and link are carried with each sourced venue. Capacity means the value in that dated source, not a guarantee that every fixture can sell every seat. Planned expansions are not assumed complete.

## Venue sources

| Coverage | Source | Treatment |
| --- | --- | --- |
| 20 English clubs listed for 2026/27 | [Premier League stadium guide, 26 September 2026](https://www.premierleague.com/en/news/4725666/all-you-need-to-know-about-the-20-premier-league-stadiums/) | Current capacities in that guide; Villa Park retains the reduced capacity during redevelopment. |
| Liverpool | [Liverpool FC, 9 August 2024](https://www.liverpoolfc.com/news/new-anfield-capacity-confirmed-ahead-2024-25) | 61,276 seats, also consistent with the newer league guide. |
| Barcelona | [FC Barcelona phase 1C occupancy announcement, 10 March 2026](https://www.fcbarcelona.es/es/noticias/4465846/comunicado-del-fc-barcelona/amp) | **62,652** permitted seats. No future third-tier capacity is included. |
| Bayern Munich | [Allianz Arena facts](https://allianz-arena.com/en/arena/facts/general-information) | 75,024 domestic seats; the source also allows this capacity for Champions League games under the UEFA pilot. |
| Paris Saint-Germain | [PSG venue overview](https://www.psg.fr/en/the-club/facilities/parc-des-princes/overview) | 47,929 seats. |
| Juventus | [Lega Serie A stadium listing](https://www.legaseriea.it/team/juventus/stadium) | 41,507 seats in the league listing; announced construction alone does not increase capacity. |
| AC Milan / Internazionale | [Lega Serie A Giuseppe Meazza listing](https://www.legaseriea.it/team/milan/stadium) | 75,725 seats at the shared ground. |
| Benfica | [SL Benfica, 12 July 2025](https://www.slbenfica.pt/pt-pt/agora/bnews/2025/07/12) | 68,100 seats following the completed first expansion stage. |
| FC Porto | [Club supporter guide hosted by Liga Portugal, 2025/26](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/FC_Porto_Guia_do_Adepto_2025_26_b06a1c43ad.pdf) | 50,033 seats. |
| Ajax | [SKIDATA venue case study](https://www.skidata.com/nl-nl/references/johancruijff-arena-amsterdam-nederland) | 55,865 seats; provenance explicitly identifies the stadium access-system supplier. |
| Clubs whose database stadium is Mỹ Đình | [VPF venue listing, 2 January 2019](https://vpf.vn/venue/svd-my-dinh/) | 40,000 capacity in this dated reference. The club-to-ground assignment comes from the selected roster database. |

The dated `src/stadium-data.mjs` snapshot additionally supplies **132 real ground names and cities**, covering every club in the seven European top divisions in the current database. These names come from each team's latest non-neutral home fixture in ESPN's public 2026 season schedule, with the source URL and event date retained per club. For example, [Real Sociedad's home-fixture schedule](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams/89/schedule?season=2026) identifies Reale Arena. Regenerate this local snapshot with `python3 scripts/import-stadiums.py`; it refuses a refresh with less than 85% coverage.

Other clubs retain their database ground name when available. A missing name is generated and marked as estimated. ESPN's schedule endpoint does not provide usable capacity. Capacity is estimated from country, division and reputation and is **always marked estimated** unless there is a capacity source above. Real Madrid and Sporting retain sourced names but have explicitly approximate capacities. Pitch dimensions default to **105 × 68 m, simulated**, not a claim that every real ground has these dimensions.

Neutral finals use a clearly labelled fictional neutral venue. They do not use the nominal home team's ground or claim a real UEFA host appointment.

## Simulation behavior

- Weather uses the fixture's game date, region and a deterministic fixture seed. It is **not a live forecast**. The seasonal temperature and rain envelopes are game parameters, not observed meteorological data. Northern and southern Vietnamese clubs use different winter temperature envelopes when location is identifiable.
- Match context never consumes the match or transfer random-number stream. A different random career ID, preview, browser reload or unrelated action cannot reroll conditions.
- The attendance forecast depends on home and away reputation, competition, friendly status, weather and stadium capacity. Attendance never exceeds capacity. Home and away allocations add up to attendance; a neutral final allocates supporters approximately equally.
- Ticket prices and gate receipts are simulated in euros. `gateReceipts` is rounded attendance × average ticket price. It is gross matchday revenue; the finance system determines operating costs and any neutral-ground distribution. It is not a published club accounting figure.
- Once a live or completed match stores its environment, that snapshot takes precedence over recomputing a forecast. No historic gate receipts are fabricated for old results that lack a recorded environment.
- This update supplies match information and matchday economics. Weather does not independently modify shot probabilities or injury risk.

The module's tests cover source provenance, every database club, save/reload consistency, neutral venues, seasonal weather, bounded attendance, receipt reconciliation and malformed-save rejection.
