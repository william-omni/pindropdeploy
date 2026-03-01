// api/_motherduck.js — MotherDuck analytics writer for PinDrop
//
// Three tables in my_db.pindrop:
//   plays  — one row per scored round
//   games  — one row per completed game
//   shares — one row each time a player shares their score
//
// Gracefully no-ops if MOTHERDUCK_TOKEN is not set.

let _instance   = null;   // singleton DuckDB instance (reused across warm Vercel invocations)
let _tablesReady = false; // only run CREATE TABLE once per warm instance

async function getInstance() {
  if (_instance) return _instance;

  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) return null; // integration not configured — skip silently

  // Vercel Lambda needs a writable HOME for DuckDB's temp files
  process.env.HOME = '/tmp';

  const { DuckDBInstance } = require('@duckdb/node-api');
  _instance = await DuckDBInstance.create(
    `md:my_db?motherduck_token=${token}`
  );
  return _instance;
}

async function ensureTables(conn) {
  if (_tablesReady) return;

  await conn.run(`CREATE SCHEMA IF NOT EXISTS pindrop`);

  // One row per scored round
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pindrop.plays (
      played_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
      game_date             DATE        NOT NULL,
      day_number            INTEGER     NOT NULL,
      round                 INTEGER     NOT NULL,   -- 1–5
      location              VARCHAR     NOT NULL,
      guess_lat             DOUBLE      NOT NULL,
      guess_lng             DOUBLE      NOT NULL,
      dist_km               DOUBLE      NOT NULL,
      points                INTEGER     NOT NULL,   -- 0–200
      player_id             VARCHAR,
      time_to_guess_seconds INTEGER,               -- clue shown → pin locked
      location_difficulty   INTEGER                -- 1–5 from DIFFICULTY_MAP
    )
  `);

  // One row per completed game
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pindrop.games (
      completed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      game_date             DATE        NOT NULL,
      day_number            INTEGER     NOT NULL,
      player_id             VARCHAR,
      total_score           INTEGER     NOT NULL,   -- 0–1000
      game_duration_seconds INTEGER,               -- startGame → finishGame
      streak_at_time        INTEGER,               -- player's streak when they played
      games_played_lifetime INTEGER,               -- total games ever by this player
      device_type           VARCHAR,               -- 'mobile' | 'desktop'
      dark_mode             BOOLEAN
    )
  `);

  // One row each time a player shares their score
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pindrop.shares (
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      game_date   DATE        NOT NULL,
      player_id   VARCHAR,
      method      VARCHAR                          -- 'native' | 'clipboard'
    )
  `);

  _tablesReady = true;
}

// ── trackPlay ────────────────────────────────────────────────────────────────
async function trackPlay({
  gameDate, dayNumber, round, location,
  guessLat, guessLng, distKm, points, playerId,
  timeToGuessSeconds, locationDifficulty,
}) {
  try {
    const inst = await getInstance();
    if (!inst) return;

    const conn = await inst.connect();
    try {
      await ensureTables(conn);
      await conn.run(
        `INSERT INTO pindrop.plays
           (game_date, day_number, round, location,
            guess_lat, guess_lng, dist_km, points,
            player_id, time_to_guess_seconds, location_difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameDate, dayNumber, round, location,
         guessLat, guessLng, distKm, points,
         playerId ?? null,
         timeToGuessSeconds ?? null,
         locationDifficulty ?? null]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] trackPlay error:', e.message);
  }
}

// ── trackGame ────────────────────────────────────────────────────────────────
async function trackGame({
  gameDate, dayNumber, playerId, totalScore,
  gameDurationSeconds, streakAtTime, gamesPlayedLifetime,
  deviceType, darkMode,
}) {
  try {
    const inst = await getInstance();
    if (!inst) return;

    const conn = await inst.connect();
    try {
      await ensureTables(conn);
      await conn.run(
        `INSERT INTO pindrop.games
           (game_date, day_number, player_id, total_score,
            game_duration_seconds, streak_at_time, games_played_lifetime,
            device_type, dark_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameDate, dayNumber, playerId ?? null, totalScore,
         gameDurationSeconds ?? null,
         streakAtTime ?? null,
         gamesPlayedLifetime ?? null,
         deviceType ?? null,
         darkMode ?? null]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] trackGame error:', e.message);
  }
}

// ── trackShare ───────────────────────────────────────────────────────────────
async function trackShare({ gameDate, playerId, method }) {
  try {
    const inst = await getInstance();
    if (!inst) return;

    const conn = await inst.connect();
    try {
      await ensureTables(conn);
      await conn.run(
        `INSERT INTO pindrop.shares (game_date, player_id, method)
         VALUES (?, ?, ?)`,
        [gameDate, playerId ?? null, method ?? null]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] trackShare error:', e.message);
  }
}

module.exports = { trackPlay, trackGame, trackShare };
