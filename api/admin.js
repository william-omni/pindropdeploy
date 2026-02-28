// api/admin.js — Admin portal (auth-protected)
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const {
  LOCATIONS,
  getDayNumber,
  getLocDifficulty,
  getTodayLocations,
  haversineKm,
  seededRand,
  getDailySeed,
  ROUNDS_PER_GAME,
} = require('./_game-data');

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getExpectedToken() {
  const pw = (process.env.ADMIN_PASSWORD || '').trim();
  return crypto.createHash('sha256').update(pw + ':pindrop-admin').digest('hex');
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
function getUpcomingDays(fromDateStr, numDays) {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const results = [];
  for (let i = 0; i < numDays; i++) {
    const d = new Date(Date.UTC(fy, fm - 1, fd + i));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateStr = y + '-' + String(m).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    const dayNum  = getDayNumber(dateStr);
    const locs    = getTodayLocations(dateStr);

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
      proximityWarnings,
      locations: locs.map(loc => ({
        name:          loc[0],
        description:   loc[1],
        lat:           loc[2],
        lng:           loc[3],
        perfectRadius: loc[4] || 5,
        difficulty:    getLocDifficulty(loc),
      })),
    });
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
    const adminPw = (process.env.ADMIN_PASSWORD || '').trim();
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
    return res.status(200).json(getUpcomingDays(from, days));
  }

  // ── GET analytics ────────────────────────────────────────────────────────
  if (action === 'analytics') {
    const data = await getAnalytics();
    if (data === null) return res.status(200).json({ configured: false });
    return res.status(200).json({ configured: true, data });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
