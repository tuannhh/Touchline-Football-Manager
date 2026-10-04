/** Pure import helpers. Provider statistics stay facts; no skill ratings are inferred here. */
export const normalizeIdentity = value => String(value || '').toLowerCase().replaceAll('đ','d').replaceAll('ø','o').replaceAll('ł','l').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export function verifiedProfileIdentity(player, profile, expectedId) {
  return !!player?.birthDate && Number(profile?.id) === Number(expectedId)
    && normalizeIdentity(player.name) === normalizeIdentity(profile.name)
    && player.birthDate === profile.birthDate?.utcTime?.slice(0,10);
}

/** Same conservative profile rules as enrich-player-profiles.py, with a strict
 * name + birth date + provider-ID join even when filling a previously empty field.
 */
export function normalizeVerifiedProfileFacts(player, profile, {expectedId, observedAt} = {}) {
  if (!verifiedProfileIdentity(player,profile,expectedId)) return null;
  const allowed = new Set(['GK','CB','LB','RB','LWB','RWB','DM','CM','AM','LM','RM','LW','RW','ST']);
  const rows = profile.positionDescription?.positions || [];
  const positions = values => [...new Set(values.map(row=>String(row.strPosShort?.label || '').toUpperCase()).filter(value=>allowed.has(value)))];
  const naturalPositions = positions(rows.filter(row=>row.isMainPosition===true));
  const otherPositions = positions(rows.filter(row=>row.isMainPosition===false && Number(row.occurences)>=3)).filter(position=>!naturalPositions.includes(position));
  const rawFoot = profile.playerInformation?.find(row=>row.translationKey==='preferred_foot')?.value;
  const preferredFoot = ({left:'left',right:'right',both:'both','both feet':'both'})[String(rawFoot?.key || rawFoot?.fallback || '').toLowerCase()];
  if (!naturalPositions.length && !preferredFoot) return null;
  return {naturalPositions,otherPositions,...(preferredFoot?{preferredFoot}:{}),sourceUrl:`https://www.fotmob.com/players/${Number(expectedId)}`,observedAt};
}

/** Keep at most three recent seasons, separately by team and competition.
 * Do not invent minutes from appearances or mix national teams into club influence.
 */
export function normalizePerformanceHistory(profile, {asOf, observedAt, years = 3} = {}) {
  const year = Number(String(asOf).slice(0,4));
  if (!Number.isInteger(year) || year < 1900) return [];
  const rows = [], seen = new Set();
  for (const season of profile?.careerHistory?.careerItems?.senior?.seasonEntries || []) {
    const startYear = Number(String(season.seasonName).slice(0,4));
    if (!Number.isInteger(startYear) || startYear > year || startYear < year - years + 1) continue;
    for (const competition of season.tournamentStats || []) {
      const appearances = finite(competition.appearances), rating = finite(competition.rating?.rating);
      if (competition.isFriendly || !competition.leagueId || appearances === null || appearances < 1) continue;
      const key = [season.teamId,competition.leagueId,season.seasonName].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const main = profile.mainLeague;
      const isMain = String(main?.leagueId) === String(competition.leagueId) && main?.season === season.seasonName && Number(season.teamId) === Number(profile.primaryTeam?.teamId);
      const mainStats = isMain ? Object.fromEntries((main.stats || []).map(row => [row.localizedTitleId, finite(row.value)])) : {};
      rows.push({season:String(season.seasonName),competitionId:String(competition.leagueId),competitionName:String(competition.leagueName || ''),
        sourceClubId:Number(season.teamId),sourceClub:String(season.team || ''),appearances,minutes:mainStats.minutes_played ?? null,starts:mainStats.started ?? null,
        rating:rating !== null && rating <= 10 ? rating : null,goals:finite(competition.goals),assists:finite(competition.assists),observedAt});
    }
  }
  return rows.sort((a,b) => b.season.localeCompare(a.season) || a.competitionId.localeCompare(b.competitionId) || a.sourceClubId - b.sourceClubId);
}

/** A unique exact normalized club name is a cautious cross-provider join.
 * Unknown/ambiguous names remain unknown; we do not assign the player's old club.
 */
export function sourceGameClubId(clubs, sourceId, sourceName) {
  const direct = clubs.find(club => club.id === `f${sourceId}` || Number(club.fotmobId) === Number(sourceId));
  if (direct) return direct.id;
  if (!normalizeIdentity(sourceName)) return null;
  const matches = clubs.filter(club => [club.name,club.shortName].some(name => normalizeIdentity(name) === normalizeIdentity(sourceName)));
  return matches.length === 1 ? matches[0].id : null;
}

export function normalizeMarketHistory(values, asOf, limit = 6) {
  const latestByDate = new Map();
  for (const row of values || []) {
    const date = typeof row.date === 'string' ? row.date.slice(0,10) : '';
    if (row.currency !== 'EUR' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > asOf || !finite(row.value)) continue;
    latestByDate.set(date,{asOf:date,eur:Number(row.value),provider:row.source === 'scisports' ? 'SciSports via FotMob' : String(row.source || 'FotMob'),kind:'provider_estimate'});
  }
  return [...latestByDate.values()].sort((a,b) => a.asOf.localeCompare(b.asOf)).slice(-limit);
}
