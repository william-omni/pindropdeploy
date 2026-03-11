// api/auth.js — User authentication for PinDrop
//
// Supports:
//   Google OAuth 2.0 (server-side Authorization Code flow)
//   Email + password  (scrypt hashing via Node built-in crypto)
//
// Session: HTTP-only `pd_session` cookie, HS256 JWT signed with JWT_SECRET.
// All user data is stored in MotherDuck (pindrop.users, pindrop.user_stats).
//
// Routes (all via ?action=):
//   GET  me                 — return current user + stats from cookie
//   GET  login-google       — redirect to Google OAuth
//   GET  callback-google    — handle Google OAuth callback
//   POST email-signup       — register with email + password
//   POST email-login        — sign in with email + password
//   POST import-stats       — import localStorage stats (first login only)
//   POST logout             — clear session cookie
//   GET  dev-login          — create test session (non-production only)

const crypto = require('crypto');
const {
  findUserByProvider, findUserByEmail, upsertUser,
  createEmailPasswordUser, verifyEmailPasswordUser,
  getUserWithStats, importUserStats,
} = require('./_motherduck');

// ── JWT (HS256, zero npm deps) ────────────────────────────────────────────────

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload, secret) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(Buffer.from(JSON.stringify(payload)));
  const sig    = b64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token, secret) {
  try {
    const [h, b, s] = token.split('.');
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${b}`).digest());
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

function setSessionCookie(res, token) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  res.setHeader('Set-Cookie',
    `pd_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'pd_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

function getSessionFromRequest(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)pd_session=([^;]+)/);
  if (!match) return null;
  return verifyJwt(decodeURIComponent(match[1]), secret);
}

// ── KV helpers (Upstash/Vercel KV REST API) ───────────────────────────────────

async function kvSet(key, value, ttlSeconds) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return false;
  // Use pipeline for safe key encoding
  const r = await fetch(url + '/pipeline', {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body:    JSON.stringify([['SETEX', key, ttlSeconds, value]]),
  });
  return r.ok;
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return null;
  const r = await fetch(url + `/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: 'Bearer ' + tok },
  });
  if (!r.ok) return null;
  const { result } = await r.json();
  return result || null;
}

async function kvDel(key) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url || !tok) return;
  await fetch(url + '/pipeline', {
    method:  'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body:    JSON.stringify([['DEL', key]]),
  });
}

// ── Password helpers (scrypt via Node crypto) ─────────────────────────────────

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `$scrypt$${salt}$${hash}`;
}

// ── Body parser ───────────────────────────────────────────────────────────────

function parseJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// ── User ID generator ─────────────────────────────────────────────────────────

function newUserId() {
  return 'usr_' + crypto.randomUUID().replace(/-/g, '');
}

// ── App base URL (for OAuth redirects) ───────────────────────────────────────

function getAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;
  // Use the Host header (reflects the actual URL the user accessed — stable across redeployments).
  // Fall back to VERCEL_URL only if the host header is missing.
  const host = req.headers.host || process.env.VERCEL_URL || 'localhost:3000';
  const proto = (host.startsWith('localhost') || host.startsWith('127.')) ? 'http' : 'https';
  return `${proto}://${host}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';
  const secret = process.env.JWT_SECRET;

  // Actions that create sessions require JWT_SECRET to be configured
  const SESSION_ACTIONS = new Set([
    'email-signup', 'email-login', 'callback-google', 'dev-login',
  ]);
  if (SESSION_ACTIONS.has(action) && !secret) {
    return res.status(503).json({ error: 'Auth not configured on this deployment (missing JWT_SECRET). Set it in Vercel → Settings → Environment Variables.' });
  }

  // ── GET debug-url — show computed app URL (non-production only) ──────────
  if (action === 'debug-url') {
    const appUrl = getAppUrl(req);
    return res.status(200).json({
      appUrl,
      redirectUri: `${appUrl}/api/auth?action=callback-google`,
      host: req.headers.host,
      vercelUrl: process.env.VERCEL_URL || null,
    });
  }

  // ── GET me ── return current session user + stats ─────────────────────────
  if (action === 'me') {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(200).json({ user: null, stats: null });
    const data = await getUserWithStats(session.sub);
    if (!data) return res.status(200).json({ user: null, stats: null });
    return res.status(200).json(data);
  }

  // ── POST logout ───────────────────────────────────────────────────────────
  if (action === 'logout' && req.method === 'POST') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  // ── GET login-google — redirect to Google OAuth ───────────────────────────
  if (action === 'login-google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google OAuth not configured' });

    const state = crypto.randomBytes(16).toString('hex');
    await kvSet(`oauth_state:${state}`, '1', 600); // 10-min CSRF token

    const appUrl = getAppUrl(req);
    const redirectUri = `${appUrl}/api/auth?action=callback-google`;
    const params = new URLSearchParams({
      client_id:    clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope:        'openid email profile',
      state,
      access_type:  'online',
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // ── GET callback-google — exchange code for token, create session ──────────
  if (action === 'callback-google') {
    const { code, state, error } = req.query;
    const appUrl = getAppUrl(req);

    if (error || !code || !state) {
      return res.redirect(302, `${appUrl}/?auth=error`);
    }

    // Verify CSRF state
    const stored = await kvGet(`oauth_state:${state}`);
    if (!stored) return res.redirect(302, `${appUrl}/?auth=error`);
    await kvDel(`oauth_state:${state}`);

    try {
      // Exchange auth code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          code,
          client_id:     process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:  `${appUrl}/api/auth?action=callback-google`,
          grant_type:    'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) return res.redirect(302, `${appUrl}/?auth=error`);

      // Fetch user profile
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      if (!profile.sub) return res.redirect(302, `${appUrl}/?auth=error`);

      // Find or create user
      let user = await findUserByProvider('google', profile.sub);
      if (!user) {
        user = await upsertUser({
          id:          newUserId(),
          email:       profile.email || null,
          displayName: profile.name  || profile.given_name || null,
          avatarUrl:   profile.picture || null,
          provider:    'google',
          providerId:  profile.sub,
        });
      }
      if (!user) return res.redirect(302, `${appUrl}/?auth=error`);

      // Set session cookie and redirect
      const jwt = signJwt(
        { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 },
        secret
      );
      setSessionCookie(res, jwt);
      return res.redirect(302, `${appUrl}/?auth=success`);

    } catch (e) {
      console.error('[Auth] callback-google error:', e.message);
      return res.redirect(302, `${appUrl}/?auth=error`);
    }
  }

  // ── POST email-signup — register with email + password ────────────────────
  if (action === 'email-signup' && req.method === 'POST') {
    const body     = await parseJsonBody(req);
    const email    = ((body && body.email) || '').toLowerCase().trim();
    const password = (body && body.password) || '';
    const name     = (body && body.displayName) || '';

    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
    if (password.length < 8)            return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Check if email already exists
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });

    try {
      const id   = newUserId();
      const hash = hashPassword(password);
      await createEmailPasswordUser({ id, email, passwordHash: hash, displayName: name || null });

      const jwt = signJwt(
        { sub: id, email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 },
        secret
      );
      setSessionCookie(res, jwt);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[Auth] email-signup error:', e.message);
      return res.status(500).json({ error: 'Could not create account. Please try again.' });
    }
  }

  // ── POST email-login — sign in with email + password ─────────────────────
  if (action === 'email-login' && req.method === 'POST') {
    const body     = await parseJsonBody(req);
    const email    = ((body && body.email) || '').toLowerCase().trim();
    const password = (body && body.password) || '';

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await verifyEmailPasswordUser(email, password);
    if (!user) return res.status(401).json({ error: 'Incorrect email or password' });

    const jwt = signJwt(
      { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 },
      secret
    );
    setSessionCookie(res, jwt);
    return res.status(200).json({ ok: true });
  }

  // ── POST import-stats — one-time localStorage migration ───────────────────
  if (action === 'import-stats' && req.method === 'POST') {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'Not signed in' });

    const body = await parseJsonBody(req);
    const imported = await importUserStats({
      userId:            session.sub,
      streak:            body.streak            || 0,
      bestScore:         body.bestScore         || 0,
      lastScore:         body.lastScore         || null,
      gamesPlayed:       body.gamesPlayed       || 0,
      lastPlayedDay:     body.lastPlayedDay     || null,
      anonymousPlayerId: body.anonymousPlayerId || null,
    });
    return res.status(200).json({ ok: true, imported });
  }

  // ── GET dev-login — create a test session (non-production only) ───────────
  if (action === 'dev-login' && process.env.VERCEL_ENV !== 'production') {
    const testId   = 'usr_devtest00000000000000000000';
    const testUser = await upsertUser({
      id:          testId,
      email:       'devtest@example.com',
      displayName: 'Dev User',
      provider:    'dev',
    });
    const jwt = signJwt(
      { sub: testId, email: 'devtest@example.com', exp: Math.floor(Date.now() / 1000) + 3600 },
      secret
    );
    setSessionCookie(res, jwt);
    const appUrl = getAppUrl(req);
    return res.redirect(302, `${appUrl}/?auth=success`);
  }

  return res.status(404).json({ error: 'Unknown action' });
};
