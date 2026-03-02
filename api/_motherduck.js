// api/_motherduck.js — MotherDuck analytics writer for PinDrop
//
// Four tables in my_db.pindrop:
//   plays               — one row per scored round
//   games               — one row per completed game
//   shares              — one row each time a player shares their score
//   daily_combinations  — one row per calendar day (location set for that day)
//
// Gracefully no-ops if MOTHERDUCK_TOKEN is not set.

let _instance    = null;   // singleton DuckDB instance (reused across warm Vercel invocations)
let _tablesReady = false;  // only run CREATE/ALTER TABLE once per warm instance

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

  // ── plays ─────────────────────────────────────────────────────────────────
  // One row per scored round.
  // CREATE TABLE establishes the base schema; ALTER TABLE adds columns that
  // were introduced after the table was first created in production.
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
      points                INTEGER     NOT NULL    -- 0–200
    )
  `);
  // Columns added after the table was originally created — safe to re-run
  await conn.run(`ALTER TABLE pindrop.plays ADD COLUMN IF NOT EXISTS player_id             VARCHAR`);
  await conn.run(`ALTER TABLE pindrop.plays ADD COLUMN IF NOT EXISTS time_to_guess_seconds INTEGER`);
  await conn.run(`ALTER TABLE pindrop.plays ADD COLUMN IF NOT EXISTS location_difficulty   INTEGER`);

  // ── games ─────────────────────────────────────────────────────────────────
  // One row per completed game.
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

  // ── shares ────────────────────────────────────────────────────────────────
  // One row each time a player shares their score.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pindrop.shares (
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      game_date   DATE        NOT NULL,
      player_id   VARCHAR,
      method      VARCHAR                          -- 'native' | 'clipboard'
    )
  `);

  // ── daily_combinations ────────────────────────────────────────────────────
  // One row per calendar day recording which 5 locations were used.
  // game_date is the PRIMARY KEY so duplicate inserts silently no-op via
  // ON CONFLICT DO NOTHING.  Stored on first player's round-1 guess each day.
  await conn.run(`
    CREATE TABLE IF NOT EXISTS pindrop.daily_combinations (
      game_date   DATE        PRIMARY KEY,
      day_number  INTEGER     NOT NULL,
      round_1     VARCHAR     NOT NULL,
      round_2     VARCHAR     NOT NULL,
      round_3     VARCHAR     NOT NULL,
      round_4     VARCHAR     NOT NULL,
      round_5     VARCHAR     NOT NULL,
      stored_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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

// ── storeDailyCombo ───────────────────────────────────────────────────────────
// Records the 5-location combination for a given day.
// Idempotent: ON CONFLICT DO NOTHING means only the first call per day wins;
// subsequent calls (from other players) are silently ignored.
async function storeDailyCombo({ gameDate, dayNumber, locationNames }) {
  try {
    const inst = await getInstance();
    if (!inst) return;

    const conn = await inst.connect();
    try {
      await ensureTables(conn);
      await conn.run(
        `INSERT INTO pindrop.daily_combinations
           (game_date, day_number, round_1, round_2, round_3, round_4, round_5)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (game_date) DO NOTHING`,
        [gameDate, dayNumber,
         locationNames[0], locationNames[1], locationNames[2],
         locationNames[3], locationNames[4]]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] storeDailyCombo error:', e.message);
  }
}

module.exports = { trackPlay, trackGame, trackShare, storeDailyCombo };
