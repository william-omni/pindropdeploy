// api/social.js — Automated X (Twitter) posting for PinDrop
//
// Called by Vercel cron jobs (see vercel.json):
//   daily-drop    — "Day #N is live"   posted each morning (~7am ET)
//   daily-stats   — "Day #N is done"   posted each evening (~8pm ET)
//   send-pending  — checks DB for scheduled manual posts (runs hourly)
//
// Also callable manually via GET with X-Cron-Secret header for testing.

const { getDayNumber } = require('./_game-data');
const { getDailyAvgScore, getPendingScheduledPosts, updateSocialPost } = require('./_motherduck');
const { postTweet } = require('./_twitter');

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

    // ── send-pending: runs hourly — posts any due scheduled manual posts ─────
    if (action === 'send-pending') {
      const pending = await getPendingScheduledPosts();
      if (!pending.length) {
        return res.status(200).json({ ok: true, processed: 0 });
      }

      const results = [];
      for (const post of pending) {
        try {
          const result = await postTweet(post.body, creds);
          const tweetId = result.data?.id;
          await updateSocialPost({
            id:       post.id,
            status:   'sent',
            tweetId,
            postedAt: new Date().toISOString(),
          });
          console.log('[social] scheduled post sent, id:', tweetId);
          results.push({ id: post.id, status: 'sent', tweetId });
        } catch (e) {
          await updateSocialPost({ id: post.id, status: 'failed', errorMsg: e.message });
          console.error('[social] scheduled post failed:', e.message);
          results.push({ id: post.id, status: 'failed', error: e.message });
        }
      }
      return res.status(200).json({ ok: true, processed: results.length, results });
    }

    return res.status(400).json({ error: 'Unknown action. Use daily-drop, daily-stats, or send-pending.' });

  } catch (e) {
    console.error('[social] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
