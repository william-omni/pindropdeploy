// api/feedback.js — User feedback submission endpoint
//
// POST /api/feedback
//   { feedbackText: string, playerId?: string, screenshotB64?: string }
//
// Writes to pindrop.feedback in MotherDuck (production only).
// Always returns 200 to the client — DB errors are logged but not surfaced.

const { trackFeedback } = require('./_motherduck');
const crypto = require('crypto');

async function parseJsonBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString()); } catch { return {}; }
    }
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body || {};
  }
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = await parseJsonBody(req);
  const { feedbackText, playerId, screenshotB64 } = body;

  if (!feedbackText || !feedbackText.trim()) {
    return res.status(400).json({ error: 'feedbackText is required' });
  }

  const id       = crypto.randomUUID();
  const gameDate = new Date().toISOString().split('T')[0];

  // Await the write — Vercel lambdas terminate immediately after the response
  // is sent, so fire-and-forget will never complete. Errors are caught and
  // logged but never surfaced to the user.
  try {
    await trackFeedback({
      id,
      gameDate,
      playerId:      playerId  ?? null,
      feedbackText:  feedbackText.trim(),
      screenshotB64: screenshotB64 ?? null,
    });
  } catch (e) {
    console.error('[feedback] DB write failed:', e.message);
  }

  return res.status(200).json({ ok: true, id });
};
