// api/feedback.js — Vercel serverless handler for user feedback submissions
const { trackFeedback } = require('./_motherduck');
const crypto = require('crypto');

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await parseJsonBody(req);
  const { feedbackText, playerId, screenshotB64 } = body;

  if (!feedbackText || !feedbackText.trim()) {
    return res.status(400).json({ error: 'feedbackText required' });
  }

  const id       = crypto.randomUUID();
  const gameDate = new Date().toISOString().split('T')[0];

  // Fire-and-forget — don't let DB issues block the user response
  trackFeedback({
    id,
    gameDate,
    playerId:     playerId  ?? null,
    feedbackText: feedbackText.trim(),
    screenshotB64: screenshotB64 ?? null,
  }).catch(e => console.error('[feedback] trackFeedback failed:', e.message));

  return res.status(200).json({ ok: true, id });
};
