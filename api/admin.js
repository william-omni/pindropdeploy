// api/admin.js — Admin portal (auth-protected)
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { embedSsoDashboard, embedSsoContentDiscovery } = require('@omni-co/embed');
const {
  getDayNumber,
  getLocDifficulty,
  getTodayLocations,
  haversineKm,
  seededRand,
  getDailySeed,
  ROUNDS_PER_GAME,
} = require('./_game-data');
const {
  getAllLocations, replaceAllLocations, getLockedDates, getPlayedDates,
  upsertLocation, deleteLocation, getLastUsedDates, setDayOverride,
} = require('./_motherduck');

// ── Auth helpers ─────────────────────────────────────────────────────────────
function normalizeEnvPassword() {
  // Strip surrounding quotes — common when pasting values into Vercel's UI
  let pw = (process.env.ADMIN_PASSWORD || '').trim();
  if (pw.length >= 2 &&
      ((pw[0] === '"'  && pw[pw.length - 1] === '"')  ||
       (pw[0] === '\'' && pw[pw.length - 1] === '\''))) {
    pw = pw.slice(1, -1);
  }
  return pw;
}
function getExpectedToken() {
  return crypto.createHash('sha256').update(normalizeEnvPassword() + ':pindrop-admin').digest('hex');
}
function isAuthorized(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const auth  = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const query = (req.query && req.query.token) || '';
  return (auth || query) === getExpectedToken();
}

// ── Body parser (handles Vercel auto-parsed object, Buffer, or raw stream) ───
async function parseJsonBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString()); } catch { return {}; }
    }
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body || {};
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

// ── Upcoming challenges ──────────────────────────────────────────────────────
async function getUpcomingDays(fromDateStr, numDays) {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);

  // Compute the last date in the range for the lock query
  const toD = new Date(Date.UTC(fy, fm - 1, fd + numDays - 1));
  const toDateStr = toD.getUTCFullYear() + '-'
    + String(toD.getUTCMonth() + 1).padStart(2,'0') + '-'
    + String(toD.getUTCDate()).padStart(2,'0');
  // comboSet  = dates that have a daily_combinations row (admin override OR player-locked)
  // playedSet = dates that have actual plays — these are truly immutable
  const [comboSet, playedSet] = await Promise.all([
    getLockedDates(fromDateStr, toDateStr),
    getPlayedDates(fromDateStr, toDateStr),
  ]);

  const results = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.UTC(fy, fm - 1, fd + i));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateStr = y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    const dayNum  = getDayNumber(dateStr);
    const locs    = await getTodayLocations(dateStr);

    // Pairwise proximity check
    const proximityWarnings = [];
    for (let a = 0; a < locs.length; a++) {
      for (let b = a + 1; b < locs.length; b++) {
        const dist = Math.round(haversineKm(locs[a][2], locs[a][3], locs[b][2], locs[b][3]));
        if (dist < 500) proximityWarnings.push({ a: locs[a][0], b: locs[b][0], dist });
      }
    }

    const avgDiff = Math.round(locs.reduce((s, l) => s + getLocDifficulty(l), 0) / locs.length * 10) / 10;

    results.push({
      dateStr, dayNum, avgDiff,
      locked:        playedSet.has(dateStr),                              // true only once someone plays
      adminOverride: comboSet.has(dateStr) && !playedSet.has(dateStr),   // combo set but still editable
      proximityWarnings,
      locations: locs.map(loc => ({
        name:          loc[0],
        description:   loc[1],
        lat:           loc[2],
        lng:           loc[3],
        perfectRadius: loc[4] || 30,
        difficulty:    getLocDifficulty(loc),
        daysSinceLastUse: null, // populated below
      })),
    });
  }

  // ── Annotate each location with days-since-last-use ───────────────────────
  try {
    const allNames = [...new Set(
      results.flatMap(day => day.locations.map(l => l.name))
    )];
    const lastUsed  = await getLastUsedDates(allNames);
    const todayMs   = new Date(fromDateStr + 'T00:00:00Z').getTime();
    for (const day of results) {
      for (const loc of day.locations) {
        const lastDate = lastUsed[loc.name];
        if (lastDate) {
          loc.daysSinceLastUse = Math.round(
            (todayMs - new Date(lastDate + 'T00:00:00Z').getTime()) / 86400000
          );
        }
        // else null = never played (set above)
      }
    }
  } catch (e) {
    console.warn('[Admin] getLastUsedDates skipped:', e.message);
    // non-fatal — badge simply won't show
  }

  return results;
}

// ── KV analytics ─────────────────────────────────────────────────────────────
async function getAnalytics() {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return null;

  try {
    // Get set of tracked location names
    const r1 = await fetch(url + '/smembers/tracked_locations', {
      headers: { Authorization: 'Bearer ' + tok },
    });
    const { result: names } = await r1.json();
    if (!names || names.length === 0) return [];

    // Batch HGETALL for every location
    const pipeline = names.map(n => ['HGETALL', 'stats:' + n]);
    const r2 = await fetch(url + '/pipeline', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(pipeline),
    });
    const statsData = await r2.json();

    return names.map((name, i) => {
      const fields = statsData[i].result || [];
      const obj = {};
      for (let j = 0; j < fields.length; j += 2) obj[fields[j]] = parseFloat(fields[j + 1]);
      return {
        name,
        plays:    obj.plays    || 0,
        avgScore: obj.plays ? Math.round(obj.totalPts  / obj.plays) : 0,
        avgDist:  obj.plays ? Math.round(obj.totalDist / obj.plays) : 0,
      };
    }).sort((a, b) => b.plays - a.plays);
  } catch (e) {
    return { error: e.message };
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';

  // ── Serve admin HTML (always public — auth happens client-side) ──────────
  if (!action || action === 'page') {
    const htmlPath = path.join(process.cwd(), '_admin.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  }

  // ── POST /api/admin?action=auth ──────────────────────────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const adminPw = normalizeEnvPassword();
    if (!adminPw) return res.status(503).json({ error: 'ADMIN_PASSWORD env var not set on server' });
    const body = await parseJsonBody(req);
    const pw = (body && body.password) || '';
    if (pw !== adminPw) return res.status(401).json({ error: 'Incorrect password' });
    return res.status(200).json({ token: getExpectedToken() });
  }

  // ── All other actions require auth ───────────────────────────────────────
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  // ── GET upcoming challenges ──────────────────────────────────────────────
  if (action === 'upcoming') {
    const days = Math.min(parseInt((req.query && req.query.days) || '14', 10), 60);
    const from = (req.query && req.query.from) || (() => {
      const d = new Date();
      return d.getUTCFullYear() + '-' +
        String(d.getUTCMonth() + 1).padStart(2,'0') + '-' +
        String(d.getUTCDate()).padStart(2,'0');
    })();
    return res.status(200).json(await getUpcomingDays(from, days));
  }

  // ── GET analytics ────────────────────────────────────────────────────────
  if (action === 'analytics') {
    const data = await getAnalytics();
    if (data === null) return res.status(200).json({ configured: false });
    return res.status(200).json({ configured: true, data });
  }

  // ── GET Omni embed URL ───────────────────────────────────────────────────
  if (action === 'embed-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoDashboard({
        contentId:        '28eb6e3b',
        externalId:       'pd-admin-user',
        name:             'PinDrop Admin',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
        accessBoost:      true,
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate embed URL: ' + e.message });
    }
  }

  // ── GET Omni AI chat embed URL ───────────────────────────────────────────
  if (action === 'embed-chat-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoContentDiscovery({
        path:             '/chat',
        externalId:       'pd-admin-user',
        name:             'PinDrop Admin',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
        accessBoost:      true,
        modelRoles:       { '41562338-24ca-46e3-a1fa-0876d39a0356': 'QUERIER' },
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate chat URL: ' + e.message });
    }
  }

  // ── GET locations list ───────────────────────────────────────────────────
  if (action === 'locations' && req.method === 'GET') {
    try {
      const locations = await getAllLocations();
      if (!locations) return res.status(503).json({ error: 'MotherDuck unavailable' });
      return res.status(200).json({ locations });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load locations: ' + e.message });
    }
  }

  // ── POST geocode a place name ────────────────────────────────────────────
  if (action === 'geocode' && req.method === 'POST') {
    const mapboxToken = process.env.MAPBOX_TOKEN;
    if (!mapboxToken) return res.status(503).json({ error: 'MAPBOX_TOKEN env var not configured' });
    const body = await parseJsonBody(req);
    const query = (body && body.query || '').trim();
    if (!query) return res.status(400).json({ error: 'query is required' });
    try {
      const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        encodeURIComponent(query) + '.json?access_token=' + mapboxToken + '&limit=1';
      const r = await fetch(url);
      const data = await r.json();
      if (!data.features || data.features.length === 0) {
        return res.status(404).json({ error: 'No results found' });
      }
      const [lng, lat] = data.features[0].center;
      return res.status(200).json({ lat, lng, placeName: data.features[0].place_name });
    } catch (e) {
      return res.status(500).json({ error: 'Geocode failed: ' + e.message });
    }
  }

  // ── POST save-locations (write to MotherDuck) ────────────────────────────
  if (action === 'save-locations' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const locations = body && body.locations;
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array is required' });
    }

    // Validate all rows before touching the DB
    const names = new Set();
    for (const l of locations) {
      if (!l.name || !l.description || l.lat == null || l.lng == null || !l.radius || !l.difficulty) {
        return res.status(400).json({ error: 'Missing required fields on: ' + (l.name || '(unnamed)') });
      }
      const key = l.name.toLowerCase().trim();
      if (names.has(key)) return res.status(400).json({ error: 'Duplicate location name: ' + l.name });
      names.add(key);
    }

    // Normalise types before writing
    const normalised = locations.map(l => ({
      name:        String(l.name).trim(),
      description: String(l.description).trim(),
      lat:         Number(l.lat),
      lng:         Number(l.lng),
      radius:      Number(l.radius),
      difficulty:  Number(l.difficulty),
    }));

    try {
      await replaceAllLocations(normalised);
      return res.status(200).json({ saved: normalised.length });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save locations: ' + e.message });
    }
  }

  // ── POST save-locations-delta (upsert changed/new + delete removed) ─────────
  // Accepts { upserts: [...], deletes: ['name1','name2',...] }
  // Only touches the rows that actually changed — far faster than replaceAll.
  if (action === 'save-locations-delta' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const upserts = Array.isArray(body && body.upserts) ? body.upserts : [];
    const deletes = Array.isArray(body && body.deletes) ? body.deletes : [];

    if (upserts.length === 0 && deletes.length === 0) {
      return res.status(400).json({ error: 'Nothing to save' });
    }

    // Validate upsert rows
    for (const l of upserts) {
      if (!l.name || !l.description || l.lat == null || l.lng == null || !l.radius || !l.difficulty) {
        return res.status(400).json({ error: 'Missing required fields on: ' + (l.name || '(unnamed)') });
      }
    }

    try {
      for (const l of upserts) {
        await upsertLocation({
          name:        String(l.name).trim(),
          description: String(l.description).trim(),
          lat:         Number(l.lat),
          lng:         Number(l.lng),
          radius:      Number(l.radius),
          difficulty:  Number(l.difficulty),
        });
      }
      for (const name of deletes) {
        await deleteLocation(String(name).trim());
      }
      return res.status(200).json({ upserted: upserts.length, deleted: deletes.length });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save delta: ' + e.message });
    }
  }

  // ── POST set-day-override (write/overwrite daily_combinations for a date) ───
  // Accepts { dateStr: 'YYYY-MM-DD', locationNames: ['R1','R2','R3','R4','R5'] }
  if (action === 'set-day-override' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const { dateStr, locationNames } = body || {};

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Valid dateStr (YYYY-MM-DD) required' });
    }
    if (!Array.isArray(locationNames) || locationNames.length !== 5) {
      return res.status(400).json({ error: 'Exactly 5 locationNames required' });
    }
    if (new Set(locationNames).size !== 5) {
      return res.status(400).json({ error: 'All 5 locations must be different' });
    }

    // Validate every name exists in the master list
    const allLocs = await getAllLocations();
    if (!allLocs) return res.status(503).json({ error: 'MotherDuck unavailable' });
    const locSet  = new Set(allLocs.map(l => l.name));
    for (const name of locationNames) {
      if (!locSet.has(name)) {
        return res.status(400).json({ error: 'Unknown location: ' + name });
      }
    }

    try {
      const dayNum = getDayNumber(dateStr);
      await setDayOverride({ gameDate: dateStr, dayNumber: dayNum, locationNames });
      return res.status(200).json({ saved: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save override: ' + e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
