// api/game.js — Vercel serverless handler for game API
// Game data (LOCATIONS, seed logic, scoring) lives in _game-data.js
const {
  getDayNumber,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
} = require('./_game-data');

const { trackPlay } = require('./_motherduck');

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

      // Fire-and-forget — never block the response waiting for analytics
      trackPlay({
        gameDate:  clientDate || new Date().toISOString().slice(0, 10),
        dayNumber: getDayNumber(clientDate),
        round:     r + 1,        // store as 1-indexed (Round 1–5)
        location:  name,
        guessLat,
        guessLng,
        distKm,
        points:    pts,
      }).catch(() => {});

      return res.status(200).json({ name, description, targetLat, targetLng, distKm, pts });
    }
    return res.status(400).json({ error: 'Bad request' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
