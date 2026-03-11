// api/omni.js — PinDrop read-only demo portal (no spoilers, no edits)
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { embedSsoDashboard, embedSsoContentDiscovery } = require('@omni-co/embed');
const { getAllLocations, getPlayedDates } = require('./_motherduck');
const { getDayNumber } = require('./_game-data');

// ── Auth helpers (uses OMNI_DEMO_KEY, separate from ADMIN_PASSWORD) ─────────
function normalizeEnvPassword() {
  let pw = (process.env.OMNI_DEMO_KEY || '').trim();
  if (pw.length >= 2 &&
      ((pw[0] === '"'  && pw[pw.length - 1] === '"')  ||
       (pw[0] === '\'' && pw[pw.length - 1] === '\''))) {
    pw = pw.slice(1, -1);
  }
  return pw;
}
function getExpectedToken() {
  return crypto.createHash('sha256').update(normalizeEnvPassword() + ':pindrop-demo').digest('hex');
}
function isAuthorized(req) {
  if (!process.env.OMNI_DEMO_KEY) return false;
  const auth  = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const query = (req.query && req.query.token) || '';
  return (auth || query) === getExpectedToken();
}

// ── Body parser ─────────────────────────────────────────────────────────────
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

// ── Deterministic LCG — seeded from date string, separate from the game engine seed
function lcgRand(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function dateSeed(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (y * 10000 + m * 100 + d + 1337) >>> 0;
}

// ── Upcoming builder — fake combos only, no real game data ever read ──────────
// Uses dateSeed (separate from the game engine seed) so results differ from real
// combos. Enforces cross-day deduplication and within-day proximity filtering.
const { haversineKm, ROUNDS_PER_GAME } = require('./_game-data');
async function getUpcomingDays(fromDateStr, numDays) {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const toD = new Date(Date.UTC(fy, fm - 1, fd + numDays - 1));
  const toDateStr = toD.getUTCFullYear() + '-'
    + String(toD.getUTCMonth() + 1).padStart(2,'0') + '-'
    + String(toD.getUTCDate()).padStart(2,'0');

  const [playedSet, allLocations] = await Promise.all([
    getPlayedDates(fromDateStr, toDateStr),
    getAllLocations(),
  ]);

  if (!allLocations) return [];

  const usedAcrossDays = new Set(); // cross-day deduplication
  const days = [];

  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.UTC(fy, fm - 1, fd + i));
    const dateStr = d.getUTCFullYear() + '-'
      + String(d.getUTCMonth() + 1).padStart(2,'0') + '-'
      + String(d.getUTCDate()).padStart(2,'0');
    const dayNum = getDayNumber(dateStr);
    const locked = playedSet.has(dateStr);

    // Use dateSeed (not the game seed) — deliberately different from real combos
    const rng  = lcgRand(dateSeed(dateStr));
    // Only draw from locations not already used in an earlier day this window
    const pool = allLocations.filter(l => !usedAcrossDays.has(l.name));

    const picked = [];
    const usedCountries = new Map();
    for (let attempt = 0; attempt < pool.length * 5 && picked.length < ROUNDS_PER_GAME; attempt++) {
      const idx = Math.floor(rng() * pool.length);
      const loc = pool[idx];
      if (picked.some(p => p.name === loc.name)) continue;
      const country = loc.name.split(',').pop().trim();
      const isUSA   = country === 'USA';
      const cur     = usedCountries.get(country) || 0;
      if (isUSA && cur >= 2) continue;
      if (!isUSA && cur >= 1) continue;
      // Skip if within 500 km of an already-picked location
      if (picked.some(p => haversineKm(p.lat, p.lng, loc.lat, loc.lng) < 500)) continue;
      picked.push(loc);
      usedCountries.set(country, cur + 1);
    }

    picked.forEach(l => usedAcrossDays.add(l.name));

    const avgDiff = picked.length
      ? +(picked.reduce((s, l) => s + (l.difficulty || 3), 0) / picked.length).toFixed(1)
      : 0;

    // Proximity warnings on whatever was picked (should be empty given the filter above)
    const proximityWarnings = [];
    for (let a = 0; a < picked.length; a++) {
      for (let b = a + 1; b < picked.length; b++) {
        const dist = Math.round(haversineKm(picked[a].lat, picked[a].lng, picked[b].lat, picked[b].lng));
        if (dist < 500) proximityWarnings.push({ a: picked[a].name, b: picked[b].name, dist });
      }
    }

    days.push({
      dateStr, dayNum, locked, adminOverride: false,
      locations: picked.map(l => ({
        name: l.name, description: l.description,
        lat: l.lat, lng: l.lng,
        difficulty: l.difficulty || 3,
        perfectRadius: l.radius || l.perfectRadius || 30,
        daysSinceLastUse: null,
      })),
      avgDiff, proximityWarnings,
    });
  }
  return days;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';

  // ── Serve demo HTML ──────────────────────────────────────────────────────
  if (!action || action === 'page') {
    const htmlPath = path.join(process.cwd(), '_omni.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // ── POST auth ─────────────────────────────────────────────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const demoPw = normalizeEnvPassword();
    if (!demoPw) return res.status(503).json({ error: 'OMNI_DEMO_KEY env var not set on server' });
    const body = await parseJsonBody(req);
    const pw = (body && body.password) || '';
    if (pw !== demoPw) return res.status(401).json({ error: 'Incorrect password' });
    return res.status(200).json({ token: getExpectedToken() });
  }

  // ── All other actions require auth ───────────────────────────────────────
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  // ── Token ping ────────────────────────────────────────────────────────────
  if (action === 'ping') {
    return res.status(200).json({ ok: true });
  }

  // ── GET Omni dashboard embed URL ─────────────────────────────────────────
  if (action === 'embed-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoDashboard({
        contentId:        '0a46b105',
        externalId:       'pd-demo-user',
        name:             'PinDrop Demo',
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

  // ── GET Omni AI chat embed URL ────────────────────────────────────────────
  if (action === 'embed-chat-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoContentDiscovery({
        path:             '/chat',
        externalId:       'pd-demo-user',
        name:             'PinDrop Demo',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
        accessBoost:      true,
        modelRoles:       { '597663fe-56fa-4cc6-84a1-d914da84bf4f': 'QUERIER' },
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate chat URL: ' + e.message });
    }
  }

  // ── POST geocode (Mapbox lookup — read-only, no mutations) ───────────────
  if (action === 'geocode' && req.method === 'POST') {
    const token = process.env.MAPBOX_TOKEN;
    if (!token) return res.status(503).json({ error: 'MAPBOX_TOKEN not configured' });
    const body  = await parseJsonBody(req);
    const query = ((body && body.query) || '').trim();
    if (!query) return res.status(400).json({ error: 'query required' });
    try {
      const r    = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`);
      const data = await r.json();
      if (!data.features || !data.features.length) return res.status(404).json({ error: 'Location not found' });
      const [lng, lat] = data.features[0].center;
      return res.status(200).json({ lat, lng, placeName: data.features[0].place_name });
    } catch (e) {
      return res.status(500).json({ error: 'Geocode failed: ' + e.message });
    }
  }

  // ── GET locations (read-only) ─────────────────────────────────────────────
  if (action === 'locations' && req.method === 'GET') {
    try {
      const locations = await getAllLocations();
      if (!locations) return res.status(503).json({ error: 'MotherDuck unavailable' });
      return res.status(200).json({ locations });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load locations: ' + e.message });
    }
  }

  // ── GET upcoming (fake combos — no real game data, deduped, proximity-filtered) ─
  if (action === 'upcoming' && req.method === 'GET') {
    try {
      const numDays = Math.min(parseInt((req.query && req.query.days) || '14', 10), 60);
      const from = (req.query && req.query.from) || (() => {
        const d = new Date();
        return d.getUTCFullYear() + '-' +
          String(d.getUTCMonth() + 1).padStart(2,'0') + '-' +
          String(d.getUTCDate()).padStart(2,'0');
      })();
      const days = await getUpcomingDays(from, numDays);
      return res.status(200).json(days);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load upcoming: ' + e.message });
    }
  }

  return res.status(404).json({ error: 'Unknown action' });
};
