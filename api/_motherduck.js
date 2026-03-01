// api/_motherduck.js — MotherDuck analytics writer for PinDrop
//
// Writes one row per scored round to:  my_db.pindrop.plays
// Gracefully no-ops if MOTHERDUCK_TOKEN is not set, so the game
// never breaks if the integration is misconfigured.
//
// The schema and table are created automatically on first run.

let _instance  = null;   // singleton DuckDB instance (reused on warm Vercel invocations)
let _tableReady = false; // only run CREATE TABLE once per warm instance

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

async function ensureTable(conn) {
  if (_tableReady) return;

  // Create a dedicated schema inside my_db so PinDrop data stays organised
  await conn.run(`CREATE SCHEMA IF NOT EXISTS my_db.pindrop`);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS my_db.pindrop.plays (
      played_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      game_date   DATE        NOT NULL,   -- player's local date (YYYY-MM-DD)
      day_number  INTEGER     NOT NULL,   -- Day #1 = 2026-03-04
      round       INTEGER     NOT NULL,   -- 1–5
      location    VARCHAR     NOT NULL,   -- e.g. "Eiffel Tower, Paris"
      guess_lat   DOUBLE      NOT NULL,
      guess_lng   DOUBLE      NOT NULL,
      dist_km     DOUBLE      NOT NULL,
      points      INTEGER     NOT NULL    -- 0–200
    )
  `);

  _tableReady = true;
}

/**
 * Fire-and-forget. Call without await from the route handler.
 * @param {object} p
 * @param {string} p.gameDate   — 'YYYY-MM-DD'
 * @param {number} p.dayNumber
 * @param {number} p.round      — 1-indexed (1–5)
 * @param {string} p.location   — location name
 * @param {number} p.guessLat
 * @param {number} p.guessLng
 * @param {number} p.distKm
 * @param {number} p.points
 */
async function trackPlay({ gameDate, dayNumber, round, location, guessLat, guessLng, distKm, points }) {
  try {
    const inst = await getInstance();
    if (!inst) return; // no token — silently skip

    const conn = await inst.connect();
    try {
      await ensureTable(conn);
      await conn.run(
        `INSERT INTO my_db.pindrop.plays
           (game_date, day_number, round, location, guess_lat, guess_lng, dist_km, points)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameDate, dayNumber, round, location, guessLat, guessLng, distKm, points]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    // Non-critical — log but never surface to the player
    console.error('[MotherDuck] trackPlay error:', e.message);
  }
}

module.exports = { trackPlay };
