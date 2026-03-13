// api/_game-data.js — Server-side game logic (Vercel serverless function)
// Location data is fetched from MotherDuck at runtime and cached in memory
// so it is never bundled into the repo or exposed in the client HTML.

const { getAllLocations, getLockedCombosForRange } = require('./_motherduck');

// ── Module-level location cache ───────────────────────────────────────────────
// _locs    : array of [name, description, lat, lng, radius] tuples
// _diffMap : { name → difficulty } used by getLocDifficulty()
// _cacheExp: timestamp (ms) after which cache is considered stale
let _locs     = null;
let _diffMap  = null;
let _cacheExp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // refresh location list every 5 minutes

// ── Module-level locked-combo cache ──────────────────────────────────────────
// Populated via a single batch DB query covering all dates from FIRST_DAY to
// the requested date.  Refreshed on the same 5-minute TTL as the location list
// so admin overrides propagate quickly.
// { 'YYYY-MM-DD': ['R1','R2','R3','R4','R5'] }
const _lockedComboCache = {};
let _lockedCacheUpTo = ''; // max dateStr currently loaded into _lockedComboCache
let _lockedCacheExp  = 0;  // expiry timestamp for the locked-combo batch

// Ensures _lockedComboCache is populated from the first game day up to upToDateStr.
async function _ensureLockedLoaded(upToDateStr) {
  const now = Date.now();
  if (now < _lockedCacheExp && _lockedCacheUpTo >= upToDateStr) return; // still fresh
  const locked = await getLockedCombosForRange('2026-02-28', upToDateStr);
  Object.assign(_lockedComboCache, locked);
  _lockedCacheExp  = now + CACHE_TTL_MS;
  if (upToDateStr > _lockedCacheUpTo) _lockedCacheUpTo = upToDateStr;
}

async function _ensureLoaded() {
  const now = Date.now();
  if (_locs && _diffMap && now < _cacheExp) return; // cache still fresh

  const rows = await getAllLocations();

  if (!rows || rows.length === 0) {
    // MotherDuck unavailable — keep using stale cache if we have one
    if (_locs) {
      console.warn('[PinDrop] MotherDuck unavailable, using stale location cache');
      return;
    }
    throw new Error('[PinDrop] No location data available — MotherDuck returned no rows');
  }

  _locs    = rows.map(r => [r.name, r.description, r.lat, r.lng, r.radius]);
  _diffMap = Object.fromEntries(rows.map(r => [r.name, r.difficulty]));
  _cacheExp = now + CACHE_TTL_MS;
}


const ROUNDS_PER_GAME = 5;

// ── Deterministic LCG RNG ──────────────────────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function getDailySeed(dateStr) {
  // Use client-supplied local date (YYYY-MM-DD) so daily reset follows the
  // user's timezone, not the server's UTC clock.
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return y * 10000 + m * 100 + d;
  }
  // Fallback: server UTC date
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function getDayNumber(dateStr) {
  const epoch = 1772582400000; // 2026-03-04 00:00:00 UTC — Official launch day (Day 1)
  let nowMs;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    nowMs = Date.UTC(y, m - 1, d);
  } else {
    nowMs = Date.now();
  }
  return Math.floor((nowMs - epoch) / 86400000) + 1;
}

// ── Difficulty lookup ─────────────────────────────────────────────────────────
// Reads from _diffMap (populated by _ensureLoaded from MotherDuck).
// Anything not listed → 3 (medium).
// 1 = Major world city   2 = World-famous landmark
// 3 = Well-known dest.   4 = Needs real geo knowledge   5 = Obscure / remote

// Difficulty: 1=major city  2=famous landmark  3=medium (default)  4=hard  5=very hard
function getLocDifficulty(loc) {
  if (!_diffMap) return 3; // cache not yet loaded — default
  return _diffMap[loc[0]] !== undefined ? _diffMap[loc[0]] : 3;
}

// Extract the country name from a location string (e.g. "Paris, France" → "France").
// Special cases handle entries with no comma or US state names.
function getCountry(locName) {
  const OVERRIDES = {
    'Hong Kong': 'China',
    'Singapore': 'Singapore',
    'Detroit, USA': 'USA',
    'Mount Mitchell, NC, USA': 'USA',
    'Edinburgh, Scotland': 'UK',
  };
  if (OVERRIDES[locName]) return OVERRIDES[locName];
  const parts = locName.split(', ');
  return parts.length > 1 ? parts[parts.length - 1] : locName;
}

async function getTodayLocations(dateStr) {
  // Ensure location data is loaded from MotherDuck (uses cache after first call)
  await _ensureLoaded();

  // ── Batch-load all locked combos up to this date ─────────────────────────────
  // One DB call (cached 5 min) covers the full history range so:
  //   (a) admin overrides applied to past dates are respected by the cooldown loop
  //   (b) the early-exit below returns the locked combo for this exact date
  if (dateStr) await _ensureLockedLoaded(dateStr);

  // ── Early exit: this date is already locked in daily_combinations ─────────
  if (dateStr && _lockedComboCache[dateStr]) {
    const names = _lockedComboCache[dateStr];
    return names.map(name => _locs.find(l => l[0] === name)).filter(Boolean);
  }

  // ── Build full difficulty pools ───────────────────────────────────────────
  const allPools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  _locs.forEach(loc => {
    const d = getLocDifficulty(loc);
    if (allPools[d]) allPools[d].push(loc);
  });

  // ── Pick 5 locations from (possibly cooldown-filtered) pools ─────────────
  // Uses loc[0] (name string) for dedup so same-day picks never repeat.
  function pickForPools(pools, rand, prevR1Country) {
    const usedToday = new Set();
    const countryCount = {}; // tracks how many times each country appears today
    function pick(pool, excludeCountry) {
      // Name-dedup is always applied first and preserved through all fallbacks
      const noDup = pool.filter(l => !usedToday.has(l[0]));
      let avail = noDup;
      if (excludeCountry) {
        const noSameCountry = avail.filter(l => getCountry(l[0]) !== excludeCountry);
        if (noSameCountry.length > 0) avail = noSameCountry; // only apply if non-empty (safety)
      }
      // Within-day country dedup: max 1 per country, max 2 for USA
      const countryFiltered = avail.filter(l => {
        const c = getCountry(l[0]);
        const limit = c === 'USA' ? 2 : 1;
        return (countryCount[c] || 0) < limit;
      });
      if (countryFiltered.length > 0) avail = countryFiltered; // only apply if non-empty (safety)
      // Fallback order: drop country constraints → drop name-dedup (absolute last resort)
      const src = avail.length ? avail : (noDup.length ? noDup : pool);
      const loc = src[Math.floor(rand() * src.length)];
      usedToday.add(loc[0]);
      const c = getCountry(loc[0]);
      countryCount[c] = (countryCount[c] || 0) + 1;
      return loc;
    }
    return [
      pick(pools[1], prevR1Country),        // R1: major city, no same country as prev day R1
      pick(pools[1]),                       // R2: different major city
      pick(pools[2]),                       // R3: world-famous landmark
      pick([...pools[3], ...pools[4]]),     // R4: medium or hard
      pick([...pools[4], ...pools[5]]),     // R5: hard or very hard
    ];
  }

  // ── 28-day cooldown via iterative forward computation ────────────────────
  // We iterate from the first ever game day up to dateStr.  Each day sees
  // what the previous 27 days picked and excludes those locations from its
  // own pools.  This is fully deterministic: same dateStr always yields the
  // same result regardless of when the function is called.
  const FIRST_DAY_MS = Date.UTC(2026, 1, 28); // 2026-02-28 — soft-launch day
  const [ty, tm, td] = dateStr.split('-').map(Number);
  const targetMs = Date.UTC(ty, tm - 1, td);

  // Dates before the game existed: pick with no cooldown (no history yet)
  if (targetMs < FIRST_DAY_MS) {
    return pickForPools(allPools, seededRand(getDailySeed(dateStr)));
  }

  // ── Special date overrides — pinned locations for specific days ──────────
  // These bypass the seeded RNG entirely for that date.  The pinned locations
  // still participate in the 28-day cooldown (future days exclude them).
  const DATE_OVERRIDES = {
    '2026-03-02': [                          // Soft-launch day 3 — pinned to protect active game
      ['Cairo, Egypt',               "Africa's largest city, spread along the Nile with the Great Pyramid visible from its suburbs", 30.0444,  31.2357, 1],
      ['Kraków, Poland',             "Poland's royal capital and cultural heart — a stunning medieval old town on the Vistula River", 50.0647,  19.9450, 1],
      ['Dubrovnik Old City, Croatia',"Walled medieval city on the Adriatic coast, known as the Pearl of the Adriatic",               42.6507,  18.0944, 2],
      ['Shenzhen, China',            "China's tech boomtown, transformed from fishing village to megacity in one generation",         22.5431, 114.0579, 3],
      ['Sahara Desert, Algeria',     "World's largest hot desert, stretching across North Africa",                                   23.4162,   5.0418, 75],
    ],
    '2026-03-03': [                          // Day 2 — R2 swapped to Amsterdam (was Xi'an, China)
      'Riyadh, Saudi Arabia',
      'Amsterdam, Netherlands',
      'Varanasi Ghats, India',
      'Khartoum, Sudan',
      'Svalbard Global Seed Vault',
    ],
    '2026-03-04': [                          // Launch day — parents' anniversary
      'Detroit, USA',
      'Mount Mitchell, NC, USA',
      'Mont Saint-Michel, France',
      'The Matterhorn, Switzerland',
      'Salisbury Cathedral',
    ],
  };

  const history = {}; // "YYYY-MM-DD" → [loc, loc, loc, loc, loc]

  for (let ms = FIRST_DAY_MS; ms <= targetMs; ms += 86400000) {
    const dt = new Date(ms);
    const ds = dt.getUTCFullYear() + '-'
             + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-'
             + String(dt.getUTCDate()).padStart(2, '0');

    // If this date has a pinned hard-coded override, use it directly and skip RNG
    if (DATE_OVERRIDES[ds]) {
      history[ds] = DATE_OVERRIDES[ds].map(entry => Array.isArray(entry) ? entry : _locs.find(l => l[0] === entry));
      continue;
    }

    // If this date was admin-overridden (stored in daily_combinations), use it.
    // This also makes those locations count against the 28-day cooldown for
    // subsequent RNG-generated days.
    if (_lockedComboCache[ds]) {
      history[ds] = _lockedComboCache[ds].map(name => _locs.find(l => l[0] === name)).filter(Boolean);
      continue;
    }

    // Collect every location name used in the previous 27 days
    const excluded = new Set();
    for (let i = 1; i <= 27; i++) {
      const pMs = ms - i * 86400000;
      if (pMs < FIRST_DAY_MS) break; // nothing before day-1 to exclude
      const pd  = new Date(pMs);
      const pds = pd.getUTCFullYear() + '-'
                + String(pd.getUTCMonth() + 1).padStart(2, '0') + '-'
                + String(pd.getUTCDate()).padStart(2, '0');
      if (history[pds]) history[pds].forEach(l => excluded.add(l[0]));
    }

    // Also pre-exclude any override locations whose special day falls within
    // the next 1–27 days — so pinned locations can't appear randomly just
    // before their anniversary date.
    for (const [overrideDate, overrideNames] of Object.entries(DATE_OVERRIDES)) {
      const daysUntil = Math.round((new Date(overrideDate).getTime() - ms) / 86400000);
      if (daysUntil > 0 && daysUntil <= 27) {
        overrideNames.forEach(entry => excluded.add(Array.isArray(entry) ? entry[0] : entry));
      }
    }

    // Filter each difficulty tier; fall back to full tier if cooldown
    // would empty it entirely (safety net, shouldn't occur in practice)
    const pools = {};
    for (const k in allPools) {
      const filtered = allPools[k].filter(l => !excluded.has(l[0]));
      pools[k] = filtered.length > 0 ? filtered : allPools[k];
    }

    // R1 country dedup: prevent same country as previous day's R1
    const prevMs2 = ms - 86400000;
    let prevR1Country = null;
    if (prevMs2 >= FIRST_DAY_MS) {
      const pd2  = new Date(prevMs2);
      const pds2 = pd2.getUTCFullYear() + '-'
                 + String(pd2.getUTCMonth() + 1).padStart(2, '0') + '-'
                 + String(pd2.getUTCDate()).padStart(2, '0');
      if (history[pds2] && history[pds2][0]) {
        prevR1Country = getCountry(history[pds2][0][0]);
      }
    }

    history[ds] = pickForPools(pools, seededRand(getDailySeed(ds)), prevR1Country);
  }

  return history[dateStr];
}

// ── Scoring ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function scoreFromDistance(km, perfectRadius = 30) {
  if (km <= perfectRadius) return 200;           // inside perfect radius → 200 pts
  if (km <= 500) {
    // Inner zone: perfectRadius → 500 km maps 200 → 100 pts
    const t = (500 - km) / (500 - perfectRadius);
    return Math.round(100 + 100 * t);
  }
  if (km <= 5000) {
    // Outer zone: 500 → 5000 km maps 100 → 0 pts
    const t = (5000 - km) / 4500;
    return Math.round(100 * t);
  }
  return 0;                                      // beyond 5000 km → 0 pts
}

// ── Vercel Handler ────────────────────────────────────────────────────────

// Bust the locked-combo cache — call this before any admin read that needs
// up-to-date daily_combinations data (e.g. the Upcoming tab after a manual edit).
function clearLockedComboCache() {
  _lockedCacheExp  = 0;
  _lockedCacheUpTo = '';
}

module.exports = {
  ROUNDS_PER_GAME,
  seededRand,
  getDailySeed,
  getDayNumber,
  getLocDifficulty,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
  clearLockedComboCache,
};
