// api/social.js — Automated X (Twitter) posting for PinDrop
//
// Called by Vercel cron jobs (see vercel.json):
//   daily-drop    — "Day #N is live"   posted each morning (~7am ET)
//   daily-stats   — yesterday's recap  posted each morning (~9am ET)
//   send-pending  — checks DB for scheduled manual posts
//
// Also callable manually via GET with X-Cron-Secret header for testing.

const { getDayNumber } = require('./_game-data');
const { getYesterdayGameStats, getPendingScheduledPosts, updateSocialPost } = require('./_motherduck');
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

    // ── daily-stats: posted ~9am ET (cron: 0 14 * * *) ─────────────────────
    // Morning recap of yesterday's completed game day.
    if (action === 'daily-stats') {
      const { summary, easiest, hardest } = await getYesterdayGameStats();
      if (!summary || !summary.player_count || summary.player_count === 0) {
        console.log('[social] daily-stats: no data for yesterday — skipping');
        return res.status(200).json({ ok: false, reason: 'no data' });
      }

      // Format avg duration as "Xm Ys"
      const dur     = parseInt(summary.avg_duration_s, 10);
      const avgTime = isNaN(dur) ? '—' : `${Math.floor(dur / 60)}m ${dur % 60}s`;

      // Yesterday's display date (UTC)
      const yd = new Date(now);
      yd.setUTCDate(yd.getUTCDate() - 1);
      const displayDate = yd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

      // Location name trimmer to keep tweet tight
      const trim = (s, max = 26) => s && s.length > max ? s.slice(0, max - 1) + '…' : (s || '—');

      const lines = [
        `📍 PinDrop — ${displayDate}`,
        ``,
        `${summary.player_count} ${summary.player_count === 1 ? 'player' : 'players'} dropped pins`,
        ``,
        `🎯 Avg Score: ${summary.avg_score} / 1000`,
        `⏱ Avg Time: ${avgTime}`,
        easiest ? `🟢 Easiest: ${trim(easiest.location)} (avg ${Number(easiest.avg_dist_km).toLocaleString('en-US')} km off)` : null,
        hardest ? `🔴 Hardest: ${trim(hardest.location)} (avg ${Number(hardest.avg_dist_km).toLocaleString('en-US')} km off)` : null,
        ``,
        `playpindrop.app`,
        ``,
        `#PinDrop`,
      ].filter(l => l !== null).join('\n');

      const result = await postTweet(lines, creds);
      console.log('[social] daily-stats posted, id:', result.data?.id);
      return res.status(200).json({ ok: true, id: result.data?.id, players: summary.player_count });
    }

    // ── send-pending: runs hourly — posts any due scheduled manual posts ─────
    if (action === 'send-pending') {
      console.log('[social] send-pending invoked at', new Date().toISOString());

      const pending = await getPendingScheduledPosts();
      console.log('[social] pending posts found:', pending.length);

      if (!pending.length) {
        return res.status(200).json({ ok: true, processed: 0 });
      }

      const results = [];
      for (const post of pending) {
        try {
          console.log('[social] posting scheduled post', post.id, 'scheduled_for:', post.scheduled_for);
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
