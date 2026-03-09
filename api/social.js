// api/social.js — Automated X (Twitter) posting for PinDrop
//
// Called by two Vercel cron jobs (see vercel.json):
//   daily-drop  — "Day #N is live"   posted each morning (~7am ET)
//   daily-stats — "Day #N is done"   posted each evening (~8pm ET)
//
// Also callable manually via GET with X-Cron-Secret header for testing.

const crypto = require('crypto');
const { getDayNumber } = require('./_game-data');
const { getDailyAvgScore } = require('./_motherduck');

// ── OAuth 1.0a ────────────────────────────────────────────────────────────────

function pct(str) {
  return encodeURIComponent(String(str))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauthHeader(method, url, creds) {
  const params = {
    oauth_consumer_key:     creds.apiKey,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            creds.accessToken,
    oauth_version:          '1.0',
  };

  // For JSON-body requests the body params are NOT included in the OAuth signature
  const paramStr = Object.keys(params).sort()
    .map(k => `${pct(k)}=${pct(params[k])}`).join('&');

  const base = `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
  const key  = `${pct(creds.apiSecret)}&${pct(creds.accessTokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');

  return 'OAuth ' + Object.keys(params).sort()
    .map(k => `${pct(k)}="${pct(params[k])}"`)
    .join(', ');
}

async function postTweet(text, creds) {
  const url = 'https://api.twitter.com/2/tweets';
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': oauthHeader('POST', url, creds),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`X API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // Auth: Vercel sets x-vercel-cron: 1 on cron calls; manual calls pass X-Cron-Secret
  const isCron   = req.headers['x-vercel-cron'] === '1';
  const secret   = process.env.SOCIAL_CRON_SECRET;
  const hasToken = secret && req.headers['x-cron-secret'] === secret;

  if (!isCron && !hasToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const creds = {
    apiKey:             process.env.X_API_KEY,
    apiSecret:          process.env.X_API_SECRET,
    accessToken:        process.env.X_ACCESS_TOKEN,
    accessTokenSecret:  process.env.X_ACCESS_TOKEN_SECRET,
  };

  if (!creds.apiKey || !creds.accessToken) {
    return res.status(503).json({ error: 'X API credentials not configured' });
  }

  // Server-side UTC date string (same format as game analytics)
  const now     = new Date();
  const dateStr = now.getUTCFullYear() + '-' +
    String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(now.getUTCDate()).padStart(2, '0');
  const dayNum  = getDayNumber(dateStr);

  const { action } = req.query;

  try {
    // ── daily-drop: posted ~7am ET (cron: 0 12 * * *) ──────────────────────
    if (action === 'daily-drop') {
      const text =
        `Day #${dayNum} is live 📍\n\n` +
        `5 locations. 1000 points on the table.\n` +
        `How well do you know the world?\n\n` +
        `→ playpindrop.app\n\n` +
        `#PinDrop #DailyGame`;

      const result = await postTweet(text, creds);
      console.log('[social] daily-drop posted, id:', result.data?.id);
      return res.status(200).json({ ok: true, id: result.data?.id, day: dayNum });
    }

    // ── daily-stats: posted ~8pm ET (cron: 0 1 * * *) ──────────────────────
    // Note: 01:00 UTC runs after midnight UTC, so the date is already tomorrow.
    // We want yesterday's date (= the day players just finished).
    if (action === 'daily-stats') {
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const gameDate = yesterday.getUTCFullYear() + '-' +
        String(yesterday.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(yesterday.getUTCDate()).padStart(2, '0');
      const statsDay = getDayNumber(gameDate);

      const stats = await getDailyAvgScore(gameDate);
      if (!stats || stats.avgScore == null) {
        console.log('[social] daily-stats: no data for', gameDate, '— skipping');
        return res.status(200).json({ ok: false, reason: 'no data', date: gameDate });
      }

      const text =
        `Day #${statsDay} is done 🌍\n\n` +
        `Today's avg score: ${stats.avgScore} / 1000\n\n` +
        `Did you beat the average? Drop your score below 👇\n\n` +
        `#PinDrop`;

      const result = await postTweet(text, creds);
      console.log('[social] daily-stats posted, id:', result.data?.id);
      return res.status(200).json({ ok: true, id: result.data?.id, avgScore: stats.avgScore });
    }

    return res.status(400).json({ error: 'Unknown action. Use daily-drop or daily-stats.' });

  } catch (e) {
    console.error('[social] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
