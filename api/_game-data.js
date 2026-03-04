// api/game.js — Server-side game logic (Vercel serverless function)
// LOCATIONS, seed functions, and scoring are kept here so they are never
// exposed in the client HTML.

const LOCATIONS_DATA = require('./_locations.json');
const LOCATIONS = LOCATIONS_DATA.map(l => [l.name, l.description, l.lat, l.lng, l.radius]);


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
  const epoch = 1741046400000; // 2026-03-04 00:00:00 UTC — Official launch day (Day 1)
  let nowMs;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    nowMs = Date.UTC(y, m - 1, d);
  } else {
    nowMs = Date.now();
  }
  return Math.floor((nowMs - epoch) / 86400000) + 1;
}

// ── Difficulty map ────────────────────────────────────────────────────────────
// Override difficulty per location name. Anything not listed → 3 (medium).
// 1 = Major world city   2 = World-famous landmark
// 3 = Well-known dest.   4 = Needs real geo knowledge   5 = Obscure / remote
const DIFFICULTY_MAP = require('./_difficulty.json');

// Difficulty: 1=major city  2=famous landmark  3=medium (default)  4=hard  5=very hard
function getLocDifficulty(loc) {
  return DIFFICULTY_MAP[loc[0]] !== undefined ? DIFFICULTY_MAP[loc[0]] : 3;
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

function getTodayLocations(dateStr) {
  // ── Build full difficulty pools ───────────────────────────────────────────
  const allPools = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  LOCATIONS.forEach(loc => {
    const d = getLocDifficulty(loc);
    if (allPools[d]) allPools[d].push(loc);
  });

  // ── Pick 5 locations from (possibly cooldown-filtered) pools ─────────────
  // Uses loc[0] (name string) for dedup so same-day picks never repeat.
  function pickForPools(pools, rand, prevR1Country) {
    const usedToday = new Set();
    const countryCount = {}; // tracks how many times each country appears today
    function pick(pool, excludeCountry) {
      let avail = pool.filter(l => !usedToday.has(l[0]));
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
      const src = avail.length ? avail : pool; // safety fallback
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

    // If this date has a pinned override, use it directly and skip RNG
    if (DATE_OVERRIDES[ds]) {
      history[ds] = DATE_OVERRIDES[ds].map(entry => Array.isArray(entry) ? entry : LOCATIONS.find(l => l[0] === entry));
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

module.exports = {
  LOCATIONS,
  ROUNDS_PER_GAME,
  seededRand,
  getDailySeed,
  getDayNumber,
  getLocDifficulty,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
};
