// api/auth.js — User authentication for PinDrop
//
// Sign-in: passwordless magic link (15-min token stored in MotherDuck + Resend email)
// Session: HTTP-only `pd_session` cookie, HS256 JWT signed with JWT_SECRET.
// All user data + magic link tokens stored in MotherDuck (pindrop schema).
//
// Routes (all via ?action=):
//   GET  me                 — return current user + stats from cookie
//   POST magic-link-request — send sign-in link to email
//   GET  magic-link-verify  — verify magic link token, set session
//   POST import-stats       — import localStorage stats (first login only)
//   POST update-profile     — save name, birthday, city, country
//   POST logout             — clear session cookie
//   GET  dev-login          — create test session (non-production only)

const crypto = require('crypto');
const {
  findUserByEmail, upsertUser,
  getUserWithStats, importUserStats, updateUserProfile,
  storeMagicToken, getMagicToken, deleteMagicToken,
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

  // magic-link-verify and dev-login create sessions; both need JWT_SECRET
  if ((action === 'magic-link-verify' || action === 'dev-login') && !secret) {
    return res.status(503).json({ error: 'Auth not configured on this deployment (missing JWT_SECRET). Set it in Vercel → Settings → Environment Variables.' });
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

  // ── POST magic-link-request — send sign-in email ──────────────────────────
  if (action === 'magic-link-request' && req.method === 'POST') {
    const body  = await parseJsonBody(req);
    const email = (body && body.email || '').toLowerCase().trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(503).json({ error: 'Email not configured' });

    const token  = crypto.randomBytes(32).toString('hex');
    const appUrl = getAppUrl(req);
    const link   = `${appUrl}/api/auth?action=magic-link-verify&token=${token}`;

    const stored = await storeMagicToken(token, email, 900); // 15-minute TTL
    if (!stored) console.error('[Auth] magic-link-request: storeMagicToken failed — token not stored');

    try {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'PinDrop <noreply@contact.playpindrop.app>',
          to:      [email],
          subject: 'Your PinDrop sign-in link',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h2 style="margin:0 0 8px;font-size:22px;">Sign in to PinDrop</h2>
              <p style="color:#666;margin:0 0 24px;">Click the link below to sign in. It expires in 15 minutes.</p>
              <a href="${link}"
                 style="display:inline-block;background:#3b82f6;color:#fff;padding:14px 28px;
                        border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
                Sign In to PinDrop
              </a>
              <p style="color:#999;margin:24px 0 0;font-size:12px;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        }),
      });
      if (!sendRes.ok) {
        const errBody = await sendRes.json().catch(() => ({}));
        console.error('[Auth] Resend send failed:', sendRes.status, JSON.stringify(errBody));
      }
    } catch (e) {
      console.error('[Auth] Resend error:', e.message);
    }

    // Always return ok — don't reveal whether the email exists
    return res.status(200).json({ ok: true });
  }

  // ── GET magic-link-verify — consume token, create session ─────────────────
  if (action === 'magic-link-verify') {
    const { token } = req.query;
    const appUrl    = getAppUrl(req);

    if (!token) return res.redirect(302, `${appUrl}/?auth=expired`);

    const email = await getMagicToken(token);
    if (!email)  return res.redirect(302, `${appUrl}/?auth=expired`);

    // Consume token immediately (single-use)
    await deleteMagicToken(token);

    try {
      let user = await findUserByEmail(email);
      if (!user) {
        user = await upsertUser({
          id:       newUserId(),
          email,
          provider: 'email',
        });
      }
      if (!user) return res.redirect(302, `${appUrl}/?auth=error`);

      const jwt = signJwt(
        { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 30 * 86400 },
        secret
      );
      setSessionCookie(res, jwt);
      return res.redirect(302, `${appUrl}/?auth=success`);

    } catch (e) {
      console.error('[Auth] magic-link-verify error:', e.message);
      return res.redirect(302, `${appUrl}/?auth=error`);
    }
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

  // ── POST update-profile — save name, birthday, city, country ─────────────
  if (action === 'update-profile' && req.method === 'POST') {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'Not signed in' });

    const body = await parseJsonBody(req);
    const ok = await updateUserProfile({
      userId:      session.sub,
      displayName: (body.displayName || '').trim() || null,
      birthday:    body.birthday    || null,
      city:        (body.city       || '').trim() || null,
      country:     (body.country    || '').trim() || null,
    });
    if (!ok) return res.status(500).json({ error: 'Failed to save profile' });
    // Return updated user so the client can refresh _authUser
    const updated = await getUserWithStats(session.sub);
    return res.status(200).json({ ok: true, user: updated?.user || null });
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
