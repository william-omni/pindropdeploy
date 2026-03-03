// api/admin.js — Admin portal (auth-protected)
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { embedSsoDashboard } = require('@omni-co/embed');
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
        perfectRadius: loc[4] || 30,
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
    return res.status(200).json(getUpcomingDays(from, days));
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
        contentId:        '502c7f55',
        externalId:       'pd-admin-user',
        name:             'PinDrop Admin',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate embed URL: ' + e.message });
    }
  }

  // ── GET locations list ───────────────────────────────────────────────────
  if (action === 'locations' && req.method === 'GET') {
    try {
      // Clear require cache so edits are reflected after a save-locations commit+redeploy
      const locsPath = require.resolve('./_locations.json');
      const diffPath = require.resolve('./_difficulty.json');
      delete require.cache[locsPath];
      delete require.cache[diffPath];
      const locsRaw = require('./_locations.json');
      const diffMap = require('./_difficulty.json');
      const locations = locsRaw.map(l => ({
        name:        l.name,
        description: l.description,
        lat:         l.lat,
        lng:         l.lng,
        radius:      l.radius,
        difficulty:  diffMap[l.name] !== undefined ? diffMap[l.name] : 3,
      }));
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

  // ── POST save-locations (commit both JSON files via GitHub API) ──────────
  if (action === 'save-locations' && req.method === 'POST') {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) return res.status(503).json({ error: 'GITHUB_TOKEN env var not configured' });

    const body = await parseJsonBody(req);
    const locations = body && body.locations;
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array is required' });
    }

    // Validate
    const names = new Set();
    for (const l of locations) {
      if (!l.name || !l.description || l.lat == null || l.lng == null || !l.radius || !l.difficulty) {
        return res.status(400).json({ error: 'Missing required fields on: ' + (l.name || '(unnamed)') });
      }
      const key = l.name.toLowerCase().trim();
      if (names.has(key)) return res.status(400).json({ error: 'Duplicate location name: ' + l.name });
      names.add(key);
    }

    // Build JSON file contents
    const locsJson = JSON.stringify(
      locations.map(({ difficulty, ...l }) => l), null, 2
    ) + '\n';
    const diffJson = JSON.stringify(
      Object.fromEntries(locations.map(l => [l.name, Number(l.difficulty)])), null, 2
    ) + '\n';

    // GitHub Git Trees API helper
    const REPO = process.env.GITHUB_REPO || 'william-omni/pindropdeploy';
    async function ghApi(method, apiPath, ghBody) {
      const r = await fetch('https://api.github.com' + apiPath, {
        method,
        headers: {
          Authorization: 'token ' + githubToken,
          'Content-Type': 'application/json',
          'User-Agent': 'pindrop-admin',
          'Accept': 'application/vnd.github+json',
        },
        body: ghBody ? JSON.stringify(ghBody) : undefined,
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error('GitHub ' + method + ' ' + apiPath + ' → ' + r.status + ': ' + txt);
      }
      return r.json();
    }

    try {
      // 1. Get current HEAD commit SHA
      const ref    = await ghApi('GET', `/repos/${REPO}/git/ref/heads/main`);
      const sha    = ref.object.sha;
      // 2. Get current commit tree SHA
      const commit = await ghApi('GET', `/repos/${REPO}/git/commits/${sha}`);
      const treeSha = commit.tree.sha;
      // 3. Create blobs
      const [blob1, blob2] = await Promise.all([
        ghApi('POST', `/repos/${REPO}/git/blobs`, { content: locsJson, encoding: 'utf-8' }),
        ghApi('POST', `/repos/${REPO}/git/blobs`, { content: diffJson, encoding: 'utf-8' }),
      ]);
      // 4. Create new tree
      const newTree = await ghApi('POST', `/repos/${REPO}/git/trees`, {
        base_tree: treeSha,
        tree: [
          { path: 'api/_locations.json', mode: '100644', type: 'blob', sha: blob1.sha },
          { path: 'api/_difficulty.json', mode: '100644', type: 'blob', sha: blob2.sha },
        ],
      });
      // 5. Create commit
      const newCommit = await ghApi('POST', `/repos/${REPO}/git/commits`, {
        message: 'admin: update locations (' + locations.length + ' entries)',
        tree: newTree.sha,
        parents: [sha],
      });
      // 6. Update HEAD ref
      await ghApi('PATCH', `/repos/${REPO}/git/refs/heads/main`, { sha: newCommit.sha });
      return res.status(200).json({ commitSha: newCommit.sha });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
