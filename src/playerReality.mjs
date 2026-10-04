/** Dated source observations. These are never a live feed into an existing save. */
const finite = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dateOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const roleKeys = {GK:['reflexes','handling','positioning','composure','decisions'],DF:['tackling','positioning','heading','strength','pace','decisions'],MF:['passing','vision','teamwork','dribbling','stamina','decisions'],FW:['finishing','dribbling','pace','composure','positioning','heading']};

export function normalizeSourcePerformance(league) {
  if (!league?.season || !Array.isArray(league.stats)) return null;
  const stats = Object.fromEntries(league.stats.map(row => [row.localizedTitleId, finite(row.value)]));
  const result = {season:String(league.season), competitionId:String(league.leagueId), competitionName:String(league.leagueName || '')};
  for (const [key, sourceKey] of Object.entries({rating:'rating',appearances:'matches_uppercase',minutes:'minutes_played',goals:'goals',assists:'assists',yellowCards:'yellow_cards',redCards:'red_cards'})) {
    const value = stats[sourceKey];
    result[key] = value !== undefined && value !== null && value >= 0 && (key !== 'rating' || value <= 10) ? value : null;
  }
  return result;
}

/** A deliberately small form adjustment, not purported measured 1–20 skills. */
export function calibratePerformance(performance) {
  if (!performance || performance.rating === null || !Number.isFinite(performance.rating) || performance.minutes < 270 || !Number.isFinite(performance.minutes)) return null;
  const confidence = performance.minutes / (performance.minutes + 900);
  return {basis:'performance_estimate',season:performance.season,minutes:performance.minutes,
    overallDelta:Math.round(clamp((performance.rating - 6.8) * 4 * confidence, -3, 3) * 10) / 10,
    note:'Small, sample-shrunk adjustment to simulated skills from a provider match rating; not official ability or potential.'};
}

export function normalizeSourceAvailability(injury, {observedAt, sourceUrl, confirmedCurrent = false} = {}) {
  if (!injury) return {status:'not_reported',observedAt,sourceUrl,description:null,reportedAt:null,expectedReturnText:null,expectedReturnDate:null,competitionId:null};
  const expected = injury.expectedReturn?.expectedReturnFallback || injury.expectedReturn || '';
  const text = typeof expected === 'string' ? expected : '';
  const description = String(injury.name || injury.description || 'Injury reported');
  const exactReturn = dateOnly(injury.expectedReturnDate || injury.expectedReturn?.date || (/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null));
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthMatch = text.match(/(?:Early |Mid |Late )?([A-Z][a-z]+) (\d{4})/);
  const monthIndex = monthMatch ? months.indexOf(monthMatch[1]) : -1;
  // An approximate return month that has entirely elapsed is stale evidence;
  // do not turn the provider's approximate wording into a precise return date.
  const latestReturnMonth = monthIndex >= 0 ? new Date(Date.UTC(Number(monthMatch[2]),monthIndex+1,0)).toISOString().slice(0,10) : null;
  const suspended = /suspend|suspension|banned|red card/i.test(description);
  const expiry = exactReturn || latestReturnMonth;
  const expired = expiry && dateOnly(observedAt) && expiry < dateOnly(observedAt);
  return {
    status:expired ? 'historical' : suspended ? 'reported_suspended' : /doubtful|day to day/i.test(text) ? 'doubtful' : 'injured',
    description,observedAt,sourceUrl,reportedAt:dateOnly(injury.lastUpdated?.utcTime || injury.reportedAt),
    expectedReturnText:text || null,expectedReturnDate:exactReturn,
    competitionId:injury.competitionId ? String(injury.competitionId) : null,
    currentConfirmed:!!confirmedCurrent && !expired,
  };
}

/** Attach only by stable game ID. Never mutate immutable releases or input objects. */
export function applyPlayerRealitySnapshot(database, snapshot) {
  if (!database || !Array.isArray(database.players) || snapshot?.version !== 1 || !snapshot.players) return database;
  return {...database,meta:{...database.meta,playerReality:{version:1,asOf:snapshot.asOf,importedAt:snapshot.importedAt,coverage:snapshot.coverage}},
    players:database.players.map(player => {
      const observation = snapshot.players[player.id];
      return observation?.playerId === player.id ? {...player,realWorld:structuredClone(observation)} : player;
    })};
}

/** Call once after generating a NEW career player. Availability remains dated evidence. */
export function applyPlayerReality(player, raw = player, gameDate = null) {
  const observation = raw?.realWorld;
  if (!observation || observation.playerId !== player.id) return player;
  const result = {...player,realWorld:structuredClone(observation)};
  const value = finite(observation.marketValue?.eur);
  if (value !== null && value > 0 && value <= 2_000_000_000) result.value = Math.round(value);
  const contract = dateOnly(observation.contractUntil);
  if (contract && (!gameDate || contract >= gameDate)) {result.contractUntil = Number(contract.slice(0,4));result.contractEndDate = contract;}
  const calibration = observation.calibration;
  if (calibration?.basis === 'performance_estimate' && Number.isFinite(calibration.overallDelta) && result.attributes) {
    result.attributes = {...result.attributes};
    const delta = clamp(calibration.overallDelta, -3, 3) / 5;
    // Spread the rounded total across role attributes deterministically so a
    // modest (<1 per attribute) signal is not rounded away or multiplied.
    const keys = roleKeys[player.position] || [];
    let remaining = Math.round(delta * keys.length);
    for (const key of keys) {
      if (!remaining || !Number.isFinite(result.attributes[key])) continue;
      const step = Math.sign(remaining);
      result.attributes[key] = clamp(result.attributes[key] + step, 1, 20);
      remaining -= step;
    }
    if (keys.length) result.potential = Math.max(result.potential || 0, Math.round(keys.reduce((sum,key) => sum + result.attributes[key],0) / keys.length * 5));
  }
  // Source card totals are historical statistics, never a count of matches
  // left on a ban. Unknown duration/competition must not remove eligibility.
  return result;
}
