// api/_motherduck.js — MotherDuck analytics writer for PinDrop
//
// Five tables in my_db.pindrop:
//   plays               — one row per scored round
//   games               — one row per completed game
//   shares              — one row each time a player shares their score
//   daily_combinations  — one row per calendar day (location set for that day)
//   locations           — master location list (name, description, lat, lng, radius, difficulty)
//
// Gracefully no-ops if MOTHERDUCK_TOKEN is not set.

// ── Analytics instance (production-only to keep test plays out of stats) ──────
let _instance    = null;   // singleton DuckDB instance (reused across warm Vercel invocations)
let _tablesReady = false;  // only run CREATE/ALTER TABLE once per warm instance

async function getInstance() {
  if (_instance) return _instance;

  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) return null; // integration not configured — skip silently

  // Skip analytics writes in preview and development deployments so test plays
  // never pollute production data. VERCEL_ENV is injected automatically by Vercel:
  // 'production' | 'preview' | 'development'
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return null;

  // Vercel Lambda needs a writable HOME for DuckDB's temp files
  process.env.HOME = '/tmp';

  const { DuckDBInstance } = require('@duckdb/node-api');
  _instance = await DuckDBInstance.create(
    `md:my_db?motherduck_token=${token}`
  );
  return _instance;
}

// ── Data instance (all environments — used for reading game locations) ─────────
let _dataInstance = null;  // separate singleton for read operations

async function getDataInstance() {
  if (_dataInstance) return _dataInstance;

  const token = process.env.MOTHERDUCK_TOKEN;
  if (!token) return null;

  // Allow HOME to be set for DuckDB temp files
  if (!process.env.HOME) process.env.HOME = '/tmp';
  else process.env.HOME = '/tmp'; // always use /tmp on Lambda

  const { DuckDBInstance } = require('@duckdb/node-api');
  _dataInstance = await DuckDBInstance.create(
    `md:my_db?motherduck_token=${token}`
  );
  return _dataInstance;
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
  await conn.run(`ALTER TABLE pindrop.plays ADD COLUMN IF NOT EXISTS target_lat            DOUBLE`);
  await conn.run(`ALTER TABLE pindrop.plays ADD COLUMN IF NOT EXISTS target_lng            DOUBLE`);

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

  // Columns added to games after initial creation — idempotent, safe to re-run
  await conn.run(`ALTER TABLE pindrop.games ADD COLUMN IF NOT EXISTS timezone VARCHAR`);
  await conn.run(`ALTER TABLE pindrop.games ADD COLUMN IF NOT EXISTS locale   VARCHAR`);
  await conn.run(`ALTER TABLE pindrop.games ADD COLUMN IF NOT EXISTS referrer VARCHAR`);
  await conn.run(`ALTER TABLE pindrop.games ADD COLUMN IF NOT EXISTS source   VARCHAR`);

  _tablesReady = true;
}

// ── trackPlay ────────────────────────────────────────────────────────────────
async function trackPlay({
  gameDate, dayNumber, round, location,
  guessLat, guessLng, targetLat, targetLng, distKm, points, playerId,
  timeToGuessSeconds, locationDifficulty,
}) {
  try {
    const inst = await getInstance();
    if (!inst) return;

    const conn = await inst.connect();
    try {
      await ensureTables(conn);

      // Server-side idempotency guard — reject duplicate (player_id, game_date, round)
      // submissions that can occur from rapid double-taps on the "Lock it in" button.
      // Anonymous plays (null player_id) cannot be deduplicated so they pass through.
      if (playerId) {
        const dupCheck = await conn.runAndReadAll(
          `SELECT EXISTS(
             SELECT 1 FROM pindrop.plays
             WHERE player_id = ? AND game_date = ? AND round = ?
           ) AS already_recorded`,
          [playerId, gameDate, round]
        );
        const rows = dupCheck.getRowObjects();
        if (rows[0] && rows[0].already_recorded === true) {
          return; // duplicate round — silently skip, client already has the result
        }
      }

      await conn.run(
        `INSERT INTO pindrop.plays
           (game_date, day_number, round, location,
            guess_lat, guess_lng, target_lat, target_lng, dist_km, points,
            player_id, time_to_guess_seconds, location_difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameDate, dayNumber, round, location,
         guessLat, guessLng,
         targetLat ?? null, targetLng ?? null,
         distKm, points,
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
  timezone, locale, referrer, source,
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
            device_type, dark_mode,
            timezone, locale, referrer, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [gameDate, dayNumber, playerId ?? null, totalScore,
         gameDurationSeconds ?? null,
         streakAtTime ?? null,
         gamesPlayedLifetime ?? null,
         deviceType ?? null,
         darkMode ?? null,
         timezone ?? null,
         locale ?? null,
         referrer ?? null,
         source ?? null]
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

// ── Location CRUD ─────────────────────────────────────────────────────────────
// These functions read/write pindrop.locations (the master location list).
// They use the data instance which works in all environments.

// Returns array of { name, description, lat, lng, radius, difficulty } objects,
// ordered by order_idx (preserving original insertion order for RNG determinism).
// Returns null if MotherDuck is unavailable.
async function getAllLocations() {
  try {
    const inst = await getDataInstance();
    if (!inst) return null;
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT name, description, lat, lng, radius, difficulty
         FROM pindrop.locations
         ORDER BY order_idx ASC NULLS LAST, name ASC`
      );
      return res.getRowObjects();
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getAllLocations error:', e.message);
    return null;
  }
}

// Returns the locked 5-location names for a given date (from daily_combinations),
// or null if the date has not yet been played / locked.
async function getLockedDailyCombo(dateStr) {
  try {
    const inst = await getDataInstance();
    if (!inst) return null;
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT round_1, round_2, round_3, round_4, round_5
         FROM pindrop.daily_combinations
         WHERE game_date = ?`,
        [dateStr]
      );
      const rows = res.getRowObjects();
      if (!rows.length) return null;
      const r = rows[0];
      return [r.round_1, r.round_2, r.round_3, r.round_4, r.round_5];
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getLockedDailyCombo error:', e.message);
    return null;
  }
}

// Returns { 'YYYY-MM-DD': ['R1','R2','R3','R4','R5'] } for every locked date in range.
// Used by _game-data.js to incorporate admin overrides into the 28-day cooldown loop.
async function getLockedCombosForRange(fromDateStr, toDateStr) {
  try {
    const inst = await getDataInstance();
    if (!inst) return {};
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT CAST(game_date AS VARCHAR) AS game_date,
                round_1, round_2, round_3, round_4, round_5
         FROM pindrop.daily_combinations
         WHERE game_date BETWEEN ? AND ?`,
        [fromDateStr, toDateStr]
      );
      const result = {};
      res.getRowObjects().forEach(r => {
        result[r.game_date] = [r.round_1, r.round_2, r.round_3, r.round_4, r.round_5];
      });
      return result;
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getLockedCombosForRange error:', e.message);
    return {};
  }
}

// Returns { [locationName]: 'YYYY-MM-DD' } with the most recent game_date each
// location was played.  Names never played are absent from the result.
async function getLastUsedDates(locationNames) {
  if (!locationNames || locationNames.length === 0) return {};
  try {
    const inst = await getDataInstance();
    if (!inst) return {};
    const conn = await inst.connect();
    try {
      const placeholders = locationNames.map(() => '?').join(', ');
      const res = await conn.runAndReadAll(
        `SELECT location, CAST(MAX(game_date) AS VARCHAR) AS last_date
         FROM pindrop.plays
         WHERE location IN (${placeholders})
         GROUP BY location`,
        locationNames
      );
      const result = {};
      res.getRowObjects().forEach(r => { result[r.location] = r.last_date; });
      return result;
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getLastUsedDates error:', e.message);
    return {};
  }
}

// Write (or overwrite) the 5-location combo for a given date.
// Unlike storeDailyCombo (ON CONFLICT DO NOTHING), this uses DO UPDATE so admin
// overrides can replace a combo that was already locked by player activity.
async function setDayOverride({ gameDate, dayNumber, locationNames }) {
  const inst = await getDataInstance();
  if (!inst) throw new Error('MotherDuck not available');
  const conn = await inst.connect();
  try {
    await conn.run(
      `INSERT INTO pindrop.daily_combinations
         (game_date, day_number, round_1, round_2, round_3, round_4, round_5)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (game_date) DO UPDATE SET
         round_1   = EXCLUDED.round_1,
         round_2   = EXCLUDED.round_2,
         round_3   = EXCLUDED.round_3,
         round_4   = EXCLUDED.round_4,
         round_5   = EXCLUDED.round_5,
         stored_at = now()`,
      [gameDate, dayNumber,
       locationNames[0], locationNames[1], locationNames[2],
       locationNames[3], locationNames[4]]
    );
  } finally {
    conn.closeSync();
  }
}

// Returns a Set of date strings (YYYY-MM-DD) that have at least one play row in the range.
// A day is only truly locked (admin cannot re-override it) once a real player has played it.
async function getPlayedDates(fromDateStr, toDateStr) {
  try {
    const inst = await getDataInstance();
    if (!inst) return new Set();
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT DISTINCT CAST(game_date AS VARCHAR) AS game_date
         FROM pindrop.plays
         WHERE game_date BETWEEN ? AND ?`,
        [fromDateStr, toDateStr]
      );
      return new Set(res.getRowObjects().map(r => r.game_date));
    } finally { conn.closeSync(); }
  } catch (e) {
    console.error('[MotherDuck] getPlayedDates error:', e.message);
    return new Set();
  }
}

// Returns a Set of date strings (YYYY-MM-DD) that have a locked combo in the range.
// Used by the admin upcoming view to display the lock icon.
async function getLockedDates(fromDateStr, toDateStr) {
  try {
    const inst = await getDataInstance();
    if (!inst) return new Set();
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT CAST(game_date AS VARCHAR) AS game_date
         FROM pindrop.daily_combinations
         WHERE game_date BETWEEN ? AND ?`,
        [fromDateStr, toDateStr]
      );
      return new Set(res.getRowObjects().map(r => r.game_date));
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getLockedDates error:', e.message);
    return new Set();
  }
}

// Insert or update a single location.
async function upsertLocation({ name, description, lat, lng, radius, difficulty }) {
  try {
    const inst = await getDataInstance();
    if (!inst) return;
    const conn = await inst.connect();
    try {
      await conn.run(
        `INSERT INTO pindrop.locations (name, description, lat, lng, radius, difficulty)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           lat         = EXCLUDED.lat,
           lng         = EXCLUDED.lng,
           radius      = EXCLUDED.radius,
           difficulty  = EXCLUDED.difficulty`,
        [name, description, lat, lng, radius, difficulty]
      );
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] upsertLocation error:', e.message);
    throw e;
  }
}

// Delete a location by name.
async function deleteLocation(name) {
  try {
    const inst = await getDataInstance();
    if (!inst) return;
    const conn = await inst.connect();
    try {
      await conn.run(`DELETE FROM pindrop.locations WHERE name = ?`, [name]);
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] deleteLocation error:', e.message);
    throw e;
  }
}

// Replace the entire location list atomically (used by admin save-locations).
// Deletes any location not present in the new list, upserts all provided rows.
async function replaceAllLocations(locations) {
  const inst = await getDataInstance();
  if (!inst) throw new Error('MotherDuck not available');
  const conn = await inst.connect();
  try {
    // Delete rows whose name is not in the new list
    const names = locations.map(l => l.name);
    if (names.length > 0) {
      // Build parameterised NOT IN clause
      const placeholders = names.map(() => '?').join(', ');
      await conn.run(
        `DELETE FROM pindrop.locations WHERE name NOT IN (${placeholders})`,
        names
      );
    } else {
      await conn.run(`DELETE FROM pindrop.locations`);
    }
    // Upsert each row (order_idx = array position to preserve RNG determinism)
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const orderIdx = loc.order_idx !== undefined ? loc.order_idx : i;
      await conn.run(
        `INSERT INTO pindrop.locations (name, description, lat, lng, radius, difficulty, order_idx)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           lat         = EXCLUDED.lat,
           lng         = EXCLUDED.lng,
           radius      = EXCLUDED.radius,
           difficulty  = EXCLUDED.difficulty,
           order_idx   = EXCLUDED.order_idx`,
        [loc.name, loc.description, loc.lat, loc.lng, loc.radius, loc.difficulty, orderIdx]
      );
    }
  } finally {
    conn.closeSync();
  }
}

// ── getDailyAvgRoundScore ─────────────────────────────────────────────────────
// Returns { avgScore: Number } for a specific round (1-indexed) on a given date,
// or null if no plays recorded yet. Reads from pindrop.plays.
async function getDailyAvgRoundScore(gameDate, round) {
  try {
    const inst = await getDataInstance();
    if (!inst) return null;
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT ROUND(AVG(points)) AS avg_score, COUNT(*) AS guess_count
         FROM pindrop.plays
         WHERE game_date = CAST(? AS DATE) AND round = ?`,
        [gameDate, round]
      );
      const rows = res.getRowObjects();
      if (!rows.length || !rows[0].guess_count || Number(rows[0].guess_count) === 0) return null;
      return { avgScore: Math.round(Number(rows[0].avg_score)) };
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getDailyAvgRoundScore error:', e.message);
    return null;
  }
}

// ── getDailyAvgScore ──────────────────────────────────────────────────────────
// Returns { avgScore: Number, playerCount: Number } for a given date,
// or null if no games have been recorded yet (e.g. early in the day).
// Reads from pindrop.games (one row per completed game).
async function getDailyAvgScore(gameDate) {
  try {
    const inst = await getDataInstance();
    if (!inst) return null;
    const conn = await inst.connect();
    try {
      const res = await conn.runAndReadAll(
        `SELECT ROUND(AVG(total_score)) AS avg_score, COUNT(*) AS player_count
         FROM pindrop.games
         WHERE game_date = CAST(? AS DATE)`,
        [gameDate]
      );
      const rows = res.getRowObjects();
      if (!rows.length || !rows[0].player_count || Number(rows[0].player_count) === 0) return null;
      return {
        avgScore:    Math.round(Number(rows[0].avg_score)),
        playerCount: Number(rows[0].player_count),
      };
    } finally {
      conn.closeSync();
    }
  } catch (e) {
    console.error('[MotherDuck] getDailyAvgScore error:', e.message);
    return null;
  }
}

module.exports = {
  trackPlay, trackGame, trackShare, storeDailyCombo,
  getAllLocations, getLockedDailyCombo, getLockedDates, getPlayedDates,
  getLockedCombosForRange, getLastUsedDates, setDayOverride,
  upsertLocation, deleteLocation, replaceAllLocations,
  getDailyAvgScore, getDailyAvgRoundScore,
};
