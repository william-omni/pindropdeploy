// api/game.js — Vercel serverless handler for game API
// Game data (LOCATIONS, seed logic, scoring) lives in _game-data.js
const {
  getDayNumber,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
} = require('./_game-data');

// ── Optional Vercel KV analytics (gracefully skipped if not configured) ─────
async function trackPlay(name, pts, distKm) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return;
  const key = 'stats:' + name;
  try {
    await fetch(url + '/pipeline', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['HINCRBY',      key, 'plays',     1],
        ['HINCRBYFLOAT', key, 'totalPts',  pts],
        ['HINCRBYFLOAT', key, 'totalDist', distKm],
        ['SADD', 'tracked_locations', name],
      ]),
    });
  } catch (e) { /* non-critical — don't break the game */ }
}

// ── Handler ─────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Client passes its local date (YYYY-MM-DD) so seed follows user timezone
  const clientDate = (req.method === 'GET'
    ? req.query.date
    : (req.body && req.body.date)) || null;

  const locs = getTodayLocations(clientDate);

  // ── GET /api/game?action=clue&round=N ──────────────────────────────────
  if (req.method === 'GET') {
    const { action, round } = req.query;
    const r = parseInt(round, 10);
    if (action === 'clue' && !isNaN(r) && r >= 0 && r < locs.length) {
      return res.status(200).json({
        name:        locs[r][0],
        totalRounds: locs.length,
        dayNumber:   getDayNumber(clientDate),
      });
    }
    return res.status(400).json({ error: 'Bad request' });
  }

  // ── POST /api/game  { action, round, guessLat, guessLng, date } ─────────
  if (req.method === 'POST') {
    const { action, round, guessLat, guessLng } = req.body || {};
    const r = parseInt(round, 10);
    if (action === 'score' && !isNaN(r) && r >= 0 && r < locs.length
        && typeof guessLat === 'number' && typeof guessLng === 'number') {
      const loc = locs[r];
      const [name, description, targetLat, targetLng, perfectRadius = 5] = loc;
      const distKm = haversineKm(guessLat, guessLng, targetLat, targetLng);
      const pts    = scoreFromDistance(distKm, perfectRadius);

      // Fire-and-forget analytics (non-blocking)
      trackPlay(name, pts, distKm).catch(() => {});

      return res.status(200).json({ name, description, targetLat, targetLng, distKm, pts });
    }
    return res.status(400).json({ error: 'Bad request' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
