// api/game.js — Vercel serverless handler for game API
// Game data (LOCATIONS, seed logic, scoring) lives in _game-data.js
const {
  getDayNumber,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
  getLocDifficulty,
} = require('./_game-data');

const { trackPlay, trackGame, trackShare } = require('./_motherduck');

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

  // ── POST /api/game ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, playerId, preview } = req.body || {};
    const isPreview = preview === true; // skip all analytics for test plays
    const gameDate = clientDate || new Date().toISOString().slice(0, 10);
    const dayNumber = getDayNumber(clientDate);

    // ── action: score — player submitted a guess ────────────────────────
    if (action === 'score') {
      const { round, guessLat, guessLng, timeToGuess } = req.body;
      const r = parseInt(round, 10);
      if (!isNaN(r) && r >= 0 && r < locs.length
          && typeof guessLat === 'number' && typeof guessLng === 'number') {
        const loc = locs[r];
        const [name, description, targetLat, targetLng, perfectRadius = 5] = loc;
        const distKm = haversineKm(guessLat, guessLng, targetLat, targetLng);
        const pts    = scoreFromDistance(distKm, perfectRadius);

        if (!isPreview) await trackPlay({
          gameDate,
          dayNumber,
          round:                r + 1,   // store 1-indexed
          location:             name,
          guessLat,
          guessLng,
          distKm,
          points:               pts,
          playerId:             playerId ?? null,
          timeToGuessSeconds:   Number.isFinite(timeToGuess) ? timeToGuess : null,
          locationDifficulty:   getLocDifficulty(loc),
        });

        return res.status(200).json({ name, description, targetLat, targetLng, distKm, pts });
      }
      return res.status(400).json({ error: 'Bad request' });
    }

    // ── action: complete — game finished, record session-level data ─────
    if (action === 'complete') {
      const {
        totalScore, gameDurationSeconds, streakAtTime,
        gamesPlayedLifetime, deviceType, darkMode,
      } = req.body;

      if (!isPreview) await trackGame({
        gameDate,
        dayNumber,
        playerId:             playerId ?? null,
        totalScore:           typeof totalScore === 'number' ? totalScore : 0,
        gameDurationSeconds:  Number.isFinite(gameDurationSeconds) ? gameDurationSeconds : null,
        streakAtTime:         Number.isFinite(streakAtTime) ? streakAtTime : null,
        gamesPlayedLifetime:  Number.isFinite(gamesPlayedLifetime) ? gamesPlayedLifetime : null,
        deviceType:           typeof deviceType === 'string' ? deviceType : null,
        darkMode:             typeof darkMode === 'boolean' ? darkMode : null,
      });

      return res.status(200).json({ ok: true });
    }

    // ── action: share — player shared their score ────────────────────────
    if (action === 'share') {
      const { method } = req.body;

      if (!isPreview) await trackShare({
        gameDate,
        playerId: playerId ?? null,
        method:   typeof method === 'string' ? method : null,
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Bad request' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
