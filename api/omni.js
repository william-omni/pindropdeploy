// api/omni.js — PinDrop read-only demo portal (no spoilers, no edits)
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { embedSsoDashboard, embedSsoContentDiscovery } = require('@omni-co/embed');

// ── Auth helpers (mirrors admin.js but uses OMNI_DEMO_KEY) ─────────────────
function normalizeEnvPassword() {
  let pw = (process.env.OMNI_DEMO_KEY || '').trim();
  if (pw.length >= 2 &&
      ((pw[0] === '"'  && pw[pw.length - 1] === '"')  ||
       (pw[0] === '\'' && pw[pw.length - 1] === '\''))) {
    pw = pw.slice(1, -1);
  }
  return pw;
}
function getExpectedToken() {
  return crypto.createHash('sha256').update(normalizeEnvPassword() + ':pindrop-demo').digest('hex');
}
function isAuthorized(req) {
  if (!process.env.OMNI_DEMO_KEY) return false;
  const auth  = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const query = (req.query && req.query.token) || '';
  return (auth || query) === getExpectedToken();
}

// ── Body parser ─────────────────────────────────────────────────────────────
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
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';

  // ── Serve demo HTML (auth happens client-side) ───────────────────────────
  if (!action || action === 'page') {
    const htmlPath = path.join(process.cwd(), '_omni.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // ── POST auth ─────────────────────────────────────────────────────────────
  if (action === 'auth' && req.method === 'POST') {
    const demoPw = normalizeEnvPassword();
    if (!demoPw) return res.status(503).json({ error: 'OMNI_DEMO_KEY env var not set on server' });
    const body = await parseJsonBody(req);
    const pw = (body && body.password) || '';
    if (pw !== demoPw) return res.status(401).json({ error: 'Incorrect password' });
    return res.status(200).json({ token: getExpectedToken() });
  }

  // ── All other actions require auth ───────────────────────────────────────
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  // ── Token ping (used on bootstrap to validate stored token) ──────────────
  if (action === 'ping') {
    return res.status(200).json({ ok: true });
  }

  // ── GET Omni dashboard embed URL ─────────────────────────────────────────
  if (action === 'embed-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoDashboard({
        contentId:        '502c7f55',
        externalId:       'pd-demo-user',
        name:             'PinDrop Demo',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
        accessBoost:      true,
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate embed URL: ' + e.message });
    }
  }

  // ── GET Omni AI chat embed URL ────────────────────────────────────────────
  if (action === 'embed-chat-url') {
    const secret = process.env.OMNI_EMBED_SECRET;
    if (!secret) return res.status(503).json({ error: 'OMNI_EMBED_SECRET env var not configured' });
    try {
      const url = await embedSsoContentDiscovery({
        path:             '/chat',
        externalId:       'pd-demo-user',
        name:             'PinDrop Demo',
        organizationName: 'williamwatkins',
        secret,
        prefersDark:      'true',
        accessBoost:      true,
        connectionRoles:  { 'aeb200a8-bf3b-4590-82aa-02e4fde504a3': 'QUERIER' },
      });
      return res.status(200).json({ url });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate chat URL: ' + e.message });
    }
  }

  return res.status(404).json({ error: 'Unknown action' });
};
