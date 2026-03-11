// api/game.js — Vercel serverless handler for game API
// Game data (LOCATIONS, seed logic, scoring) lives in _game-data.js
const crypto = require('crypto');
const {
  getDayNumber,
  getTodayLocations,
  haversineKm,
  scoreFromDistance,
  getLocDifficulty,
} = require('./_game-data');

const { trackPlay, trackGame, trackShare, storeDailyCombo, getDailyAvgScore, getDailyAvgRoundScore, updateUserStats } = require('./_motherduck');

// ── Session helper (inlined to avoid shared module) ──────────────────────────
function getUserIdFromRequest(req) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const raw   = req.headers.cookie || '';
    const match = raw.match(/(?:^|;\s*)pd_session=([^;]+)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    const [h, b, s] = token.split('.');
    const b64url = buf => buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest());
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub || null;
  } catch { return null; }
}

// ── Handler ─────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Resolve logged-in user (if any) from session cookie
  const userId = getUserIdFromRequest(req);

  // Client passes its local date (YYYY-MM-DD) so seed follows user timezone
  const clientDate = (req.method === 'GET'
    ? req.query.date
    : (req.body && req.body.date)) || null;

  const locs = await getTodayLocations(clientDate);

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

    // ── GET /api/game?action=daily-stats[&round=N] ───────────────────────
    if (action === 'daily-stats') {
      const gameDate = clientDate || new Date().toISOString().slice(0, 10);
      const roundNum = req.query.round ? parseInt(req.query.round, 10) : null;
      try {
        if (roundNum && roundNum >= 1 && roundNum <= 5) {
          const stats = await getDailyAvgRoundScore(gameDate, roundNum);
          return res.status(200).json(stats || { avgScore: null });
        }
        const stats = await getDailyAvgScore(gameDate);
        return res.status(200).json(stats || { avgScore: null, playerCount: 0 });
      } catch (e) {
        return res.status(200).json({ avgScore: null, playerCount: 0 });
      }
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
        const [name, description, targetLat, targetLng, perfectRadius = 30] = loc;
        const distKm = haversineKm(guessLat, guessLng, targetLat, targetLng);
        const pts    = scoreFromDistance(distKm, perfectRadius);

        if (!isPreview) {
          // Run analytics concurrently; on round 1 also store the day's combo
          const tasks = [
            trackPlay({
              gameDate,
              dayNumber,
              round:                r + 1,   // store 1-indexed
              location:             name,
              guessLat,
              guessLng,
              targetLat,
              targetLng,
              distKm,
              points:               pts,
              playerId:             playerId ?? null,
              userId:               userId   ?? null,
              timeToGuessSeconds:   Number.isFinite(timeToGuess) ? timeToGuess : null,
              locationDifficulty:   getLocDifficulty(loc),
            }),
          ];
          if (r === 0 && locs.length >= 5) {
            tasks.push(storeDailyCombo({
              gameDate,
              dayNumber,
              locationNames: locs.map(l => l[0]),
            }));
          }
          await Promise.all(tasks);
        }

        return res.status(200).json({ name, description, targetLat, targetLng, distKm, pts });
      }
      return res.status(400).json({ error: 'Bad request' });
    }

    // ── action: complete — game finished, record session-level data ─────
    if (action === 'complete') {
      const {
        totalScore, gameDurationSeconds, streakAtTime,
        gamesPlayedLifetime, deviceType, darkMode,
        timezone, locale, referrer, source,
      } = req.body;

      if (!isPreview) {
        await trackGame({
          gameDate,
          dayNumber,
          playerId:             playerId ?? null,
          userId:               userId   ?? null,
          totalScore:           typeof totalScore === 'number' ? totalScore : 0,
          gameDurationSeconds:  Number.isFinite(gameDurationSeconds) ? gameDurationSeconds : null,
          streakAtTime:         Number.isFinite(streakAtTime) ? streakAtTime : null,
          gamesPlayedLifetime:  Number.isFinite(gamesPlayedLifetime) ? gamesPlayedLifetime : null,
          deviceType:           typeof deviceType === 'string' ? deviceType : null,
          darkMode:             typeof darkMode === 'boolean' ? darkMode : null,
          timezone:             typeof timezone  === 'string' ? timezone  : null,
          locale:               typeof locale    === 'string' ? locale    : null,
          referrer:             typeof referrer  === 'string' ? referrer  : null,
          source:               typeof source    === 'string' ? source    : null,
        });
        // If logged in, keep server-side stats in sync (fire-and-forget)
        if (userId) {
          updateUserStats({
            userId,
            streak:         Number.isFinite(streakAtTime)        ? streakAtTime        : 0,
            bestScore:      typeof totalScore === 'number'       ? totalScore          : 0,
            lastScore:      typeof totalScore === 'number'       ? totalScore          : null,
            gamesPlayed:    Number.isFinite(gamesPlayedLifetime) ? gamesPlayedLifetime : 0,
            lastPlayedDay:  gameDate,
          }).catch(() => {});
        }
      }

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
