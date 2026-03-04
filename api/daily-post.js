// api/daily-post.js — Posts yesterday's PinDrop stats to X (@PlayPinDrop)
//
// Triggered by Vercel cron (see vercel.json) daily at 10:00 UTC.
// Can also be called manually: GET /api/daily-post
// (Vercel auto-injects CRON_SECRET and passes it as the Authorization header
//  on cron calls; any direct call without it is rejected.)
//
// Required env vars:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
//   MOTHERDUCK_TOKEN

const crypto = require('crypto');

// ── Percent-encode helper (RFC 3986) ─────────────────────────────────────────
function pct(s) { return encodeURIComponent(String(s)); }

// ── Build OAuth 1.0a Authorization header ────────────────────────────────────
// For JSON-body requests the body parameters are NOT included in the signature.
function buildOAuthHeader(method, url) {
  const consumerKey    = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const tokenKey       = process.env.X_ACCESS_TOKEN;
  const tokenSecret    = process.env.X_ACCESS_TOKEN_SECRET;

  const nonce     = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            tokenKey,
    oauth_version:          '1.0',
  };

  const paramStr = Object.keys(oauthParams)
    .sort()
    .map(k => `${pct(k)}=${pct(oauthParams[k])}`)
    .join('&');

  const baseString = [method.toUpperCase(), pct(url), pct(paramStr)].join('&');
  const signingKey = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  const signature  = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const headerStr = Object.keys(headerParams)
    .sort()
    .map(k => `${pct(k)}="${pct(headerParams[k])}"`)
    .join(', ');

  return `OAuth ${headerStr}`;
}

// ── Post a tweet via X API v2 ────────────────────────────────────────────────
async function postTweet(text) {
  const url  = 'https://api.twitter.com/2/tweets';
  const auth = buildOAuthHeader('POST', url);

  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`X API error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Query MotherDuck for yesterday's game stats ───────────────────────────────
async function getYesterdayStats() {
  process.env.HOME = '/tmp'; // DuckDB needs a writable HOME in Lambda
  const { DuckDBInstance } = require('@duckdb/node-api');
  const inst = await DuckDBInstance.create(
    `md:my_db?motherduck_token=${process.env.MOTHERDUCK_TOKEN}`
  );
  const conn = await inst.connect();
  try {
    // Game-level summary
    const summaryRows = (await conn.runAndReadAll(`
      SELECT
        COUNT(*)::VARCHAR                            AS player_count,
        ROUND(AVG(total_score))::VARCHAR             AS avg_score,
        ROUND(AVG(game_duration_seconds))::VARCHAR   AS avg_duration_s
      FROM pindrop.games
      WHERE game_date = (CURRENT_DATE - INTERVAL 1 DAY)
    `)).getRowObjects();

    // Easiest location — lowest avg distance from target
    const easiestRows = (await conn.runAndReadAll(`
      SELECT
        location,
        ROUND(AVG(dist_km))::VARCHAR AS avg_dist_km
      FROM pindrop.plays
      WHERE game_date = (CURRENT_DATE - INTERVAL 1 DAY)
      GROUP BY location
      HAVING COUNT(*) >= 2
      ORDER BY AVG(dist_km) ASC
      LIMIT 1
    `)).getRowObjects();

    // Hardest location — highest avg distance from target
    const hardestRows = (await conn.runAndReadAll(`
      SELECT
        location,
        ROUND(AVG(dist_km))::VARCHAR AS avg_dist_km
      FROM pindrop.plays
      WHERE game_date = (CURRENT_DATE - INTERVAL 1 DAY)
      GROUP BY location
      HAVING COUNT(*) >= 2
      ORDER BY AVG(dist_km) DESC
      LIMIT 1
    `)).getRowObjects();

    return {
      summary: summaryRows[0] || null,
      easiest: easiestRows[0] || null,
      hardest: hardestRows[0] || null,
    };
  } finally {
    conn.closeSync();
  }
}

// ── Format the tweet (must fit within 280 chars) ──────────────────────────────
function formatTweet({ summary, easiest, hardest }) {
  const count = parseInt(summary?.player_count || '0', 10);
  if (!count) return null; // No plays — skip posting

  const avgScore = summary.avg_score || '—';

  // Duration: seconds → "Xm Ys"
  const dur     = parseInt(summary.avg_duration_s, 10);
  const avgTime = isNaN(dur) ? '—' : `${Math.floor(dur / 60)}m ${dur % 60}s`;

  // Truncate long location names so the tweet stays under 280 chars
  const trim = (s, max = 26) =>
    s && s.length > max ? s.slice(0, max - 1) + '…' : (s || '—');

  const easiestName = trim(easiest?.location);
  const hardestName = trim(hardest?.location);
  const easiestDist = easiest?.avg_dist_km
    ? `${Number(easiest.avg_dist_km).toLocaleString('en-US')} km off` : '—';
  const hardestDist = hardest?.avg_dist_km
    ? `${Number(hardest.avg_dist_km).toLocaleString('en-US')} km off` : '—';

  // Yesterday's date label (UTC)
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  const lines = [
    `📍 PinDrop — ${dateStr}`,
    ``,
    `${count} ${count === 1 ? 'player' : 'players'} dropped pins`,
    ``,
    `🎯 Avg Score: ${avgScore} / 1000`,
    `⏱ Avg Time: ${avgTime}`,
    `🟢 Easiest: ${easiestName} (avg ${easiestDist})`,
    `🔴 Hardest: ${hardestName} (avg ${hardestDist})`,
    ``,
    `playpindrop.app`,
  ];

  return lines.join('\n');
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel cron passes CRON_SECRET as Bearer token; reject anything else.
  // If CRON_SECRET isn't set yet, allow through (for initial testing).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Skip on non-production deployments so test runs don't post live tweets
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return res.status(200).json({ skipped: true, reason: 'Non-production environment' });
  }

  // ── Credential pre-flight ──────────────────────────────────────────────────
  const credKeys = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  const missing  = credKeys.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('[daily-post] Missing env vars:', missing);
    return res.status(500).json({ error: 'Missing X credentials', missing });
  }

  // ?dry_run=1 — build tweet + OAuth header but skip the actual X API call
  const url    = req.url || '';
  const dryRun = url.includes('dry_run=1');

  try {
    const stats = await getYesterdayStats();
    const tweet = formatTweet(stats);

    if (!tweet) {
      console.log('[daily-post] No plays yesterday — skipping');
      return res.status(200).json({ skipped: true, reason: 'No plays yesterday' });
    }

    console.log('[daily-post] Posting tweet:\n', tweet);

    if (dryRun) {
      console.log('[daily-post] dry_run=1 — skipping actual POST to X');
      return res.status(200).json({ dry_run: true, tweet });
    }

    const result = await postTweet(tweet);
    console.log('[daily-post] Posted:', result.data?.id);

    return res.status(200).json({ ok: true, tweetId: result.data?.id, tweet });
  } catch (e) {
    console.error('[daily-post] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
