export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Privacy Policy — PinDrop</title>
  <link rel="icon" href="/icon_round.png" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0f14; --surface: #161a22; --border: rgba(255,255,255,.07);
      --accent: #e8ff47; --text: #e8eaf0; --muted: #6b7a94;
    }
    body {
      background: var(--bg); color: var(--text);
      font-family: 'DM Mono', monospace; font-weight: 300;
      font-size: 15px; line-height: 1.75;
      padding: 0; min-height: 100vh;
    }
    .page { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
    .logo-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 48px;
    }
    .logo-row img { width: 36px; height: 36px; border-radius: 10px; }
    .logo-row span {
      font-family: 'Syne', sans-serif; font-size: 20px;
      font-weight: 800; color: var(--text);
    }
    .logo-row a { text-decoration: none; display: flex; align-items: center; gap: 10px; }
    h1 {
      font-family: 'Syne', sans-serif; font-size: 32px;
      font-weight: 800; color: var(--text); margin-bottom: 8px;
    }
    .effective {
      font-size: 12px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-bottom: 40px;
    }
    h2 {
      font-family: 'Syne', sans-serif; font-size: 17px;
      font-weight: 700; color: var(--accent);
      margin: 36px 0 10px;
    }
    p { margin-bottom: 14px; color: var(--text); }
    ul { margin: 0 0 14px 20px; }
    li { margin-bottom: 6px; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .divider {
      border: none; border-top: 1px solid var(--border);
      margin: 40px 0;
    }
    .contact-box {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px 24px; margin-top: 40px;
    }
    .contact-box p { margin: 0; }
  </style>
</head>
<body>
<div class="page">

  <div class="logo-row">
    <a href="https://playpindrop.app">
      <img src="/icon_round.png" alt="PinDrop">
      <span>PinDrop</span>
    </a>
  </div>

  <h1>Privacy Policy</h1>
  <p class="effective">Effective date: March 11, 2026 &nbsp;·&nbsp; Last updated: March 11, 2026</p>

  <p>PinDrop ("we," "our," or "us") is a daily geography guessing game available at <a href="https://playpindrop.app">playpindrop.app</a>. This Privacy Policy explains what information we collect, how we use it, and your choices.</p>

  <p>By using PinDrop you agree to the practices described in this policy.</p>

  <hr class="divider">

  <h2>1. Information We Collect</h2>

  <p><strong>Information you provide when signing in</strong></p>
  <p>If you choose to sign in with Google, we receive from Google the information you authorize, which may include:</p>
  <ul>
    <li>Your name and email address</li>
    <li>Your Google profile picture</li>
    <li>A unique Google account identifier</li>
  </ul>
  <p>Signing in is optional. You may play PinDrop without creating an account.</p>

  <p><strong>Gameplay data</strong></p>
  <p>When you play, we record:</p>
  <ul>
    <li>Your guesses (approximate coordinates you pinned on the map)</li>
    <li>Your scores and distances per round</li>
    <li>The date you played and which daily challenge you completed</li>
    <li>Your streak and total games played</li>
  </ul>
  <p>Anonymous gameplay data (no personal identifiers) is used to calculate daily average scores displayed to all players.</p>

  <p><strong>Feedback you submit</strong></p>
  <p>If you submit feedback through the in-app feedback form, we collect the message text, an optional screenshot you attach, and the page you submitted from. Feedback is stored securely and used only to improve the game.</p>

  <p><strong>Device and usage data</strong></p>
  <p>We use Vercel Analytics to collect anonymised, aggregate data about how the game is used (page views, device type, country). This data does not identify you personally.</p>

  <hr class="divider">

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To operate and deliver the game, including saving your progress and streak</li>
    <li>To display your score relative to other players (aggregate averages only — individual scores are never publicly attributed)</li>
    <li>To respond to feedback you submit</li>
    <li>To improve the game through aggregate analytics</li>
    <li>To authenticate you when you sign in with Google</li>
  </ul>
  <p>We do not sell your personal information. We do not use your data for advertising or share it with third-party advertisers.</p>

  <hr class="divider">

  <h2>3. Local Storage</h2>
  <p>PinDrop stores game state (your current game, history, streak, and preferences) in your browser's local storage. This data stays on your device and is not transmitted to our servers unless you are signed in. Clearing your browser data will erase this information.</p>

  <hr class="divider">

  <h2>4. Third-Party Services</h2>
  <p>PinDrop uses the following third-party services, each with their own privacy practices:</p>
  <ul>
    <li><strong>Google OAuth</strong> — for optional sign-in. Governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google's Privacy Policy</a>.</li>
    <li><strong>Mapbox</strong> — for map rendering. Governed by <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener">Mapbox's Privacy Policy</a>. Mapbox may collect your IP address and map interaction data.</li>
    <li><strong>Vercel</strong> — for hosting and analytics. Governed by <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">Vercel's Privacy Policy</a>.</li>
    <li><strong>MotherDuck / DuckDB</strong> — for secure data storage of game analytics and feedback.</li>
  </ul>

  <hr class="divider">

  <h2>5. Data Retention</h2>
  <p>We retain gameplay analytics in aggregate, indefinitely, to track game trends. Personal information associated with a signed-in account is retained for as long as your account is active. Feedback submissions are retained until manually deleted. You may request deletion of your data at any time by contacting us.</p>

  <hr class="divider">

  <h2>6. Children's Privacy</h2>
  <p>PinDrop is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</p>

  <hr class="divider">

  <h2>7. Your Rights</h2>
  <p>Depending on your location, you may have the right to:</p>
  <ul>
    <li>Access the personal information we hold about you</li>
    <li>Request correction of inaccurate data</li>
    <li>Request deletion of your personal data</li>
    <li>Withdraw consent at any time (including revoking Google sign-in access via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account settings</a>)</li>
  </ul>
  <p>To exercise any of these rights, contact us at the address below.</p>

  <hr class="divider">

  <h2>8. Security</h2>
  <p>We use industry-standard measures to protect your information, including HTTPS encryption in transit and access-controlled storage. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

  <hr class="divider">

  <h2>9. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of PinDrop after changes constitutes acceptance of the updated policy.</p>

  <hr class="divider">

  <h2>10. Contact Us</h2>
  <div class="contact-box">
    <p>Questions or requests about this Privacy Policy can be sent to:<br><br>
    <strong>PinDrop</strong><br>
    <a href="mailto:privacy@playpindrop.app">privacy@playpindrop.app</a><br>
    <a href="https://playpindrop.app">playpindrop.app</a></p>
  </div>

</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(html);
}
