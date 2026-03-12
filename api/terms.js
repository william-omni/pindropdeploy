export default function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Terms of Service — PinDrop</title>
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

  <h1>Terms of Service</h1>
  <p class="effective">Effective date: March 11, 2026 &nbsp;·&nbsp; Last updated: March 11, 2026</p>

  <p>Welcome to PinDrop. These Terms of Service ("Terms") govern your access to and use of the PinDrop game and website located at <a href="https://playpindrop.app">playpindrop.app</a> (the "Service"), operated by PinDrop ("we," "our," or "us").</p>

  <p>By accessing or using the Service you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

  <hr class="divider">

  <h2>1. Description of Service</h2>
  <p>PinDrop is a free, browser-based daily geography game. Each day, players are presented with five locations and must drop a pin on a map to guess where each one is. Scores are based on how close each guess is to the actual location. A new challenge is available every day.</p>

  <hr class="divider">

  <h2>2. Eligibility</h2>
  <p>You must be at least 13 years old to use PinDrop. By using the Service you represent that you meet this requirement. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms.</p>

  <hr class="divider">

  <h2>3. Accounts and Authentication</h2>
  <p>PinDrop offers optional sign-in via Google OAuth. If you create an account:</p>
  <ul>
    <li>You are responsible for maintaining the security of your account</li>
    <li>You agree not to share your credentials or allow others to access your account</li>
    <li>You may revoke PinDrop's access to your Google account at any time through your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Google Account settings</a></li>
  </ul>
  <p>An account is not required to play. Game progress without an account is stored locally in your browser.</p>

  <hr class="divider">

  <h2>4. Acceptable Use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Use automated tools, bots, or scripts to play the game or manipulate scores</li>
    <li>Attempt to access, tamper with, or disrupt the Service's servers or infrastructure</li>
    <li>Circumvent any security or rate-limiting measures</li>
    <li>Attempt to reverse-engineer or extract location data, algorithms, or source code for commercial purposes</li>
    <li>Submit feedback or content that is abusive, defamatory, or in violation of any law</li>
    <li>Impersonate any person or entity</li>
  </ul>

  <hr class="divider">

  <h2>5. Intellectual Property</h2>
  <p>All content, design, code, graphics, and branding associated with PinDrop — including the PinDrop name, logo, and game mechanics — are owned by or licensed to us and protected by applicable intellectual property laws.</p>
  <p>You are granted a limited, non-exclusive, non-transferable license to access and use the Service for personal, non-commercial purposes only. This license does not include the right to copy, modify, distribute, sell, or create derivative works from any part of the Service.</p>

  <hr class="divider">

  <h2>6. User-Submitted Content</h2>
  <p>If you submit feedback, suggestions, or other content through the Service, you grant us a worldwide, royalty-free, perpetual license to use, reproduce, and incorporate that content for the purpose of improving the Service. You represent that you own or have the rights to any content you submit.</p>

  <hr class="divider">

  <h2>7. Third-Party Services</h2>
  <p>PinDrop uses third-party services including Mapbox (mapping), Google (authentication), and Vercel (hosting). Your use of those services is subject to their respective terms and policies. We are not responsible for the practices of third-party providers.</p>

  <hr class="divider">

  <h2>8. Disclaimers</h2>
  <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
  <p>We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components. Geographic data and location information are provided for entertainment purposes and may not be perfectly accurate.</p>

  <hr class="divider">

  <h2>9. Limitation of Liability</h2>
  <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
  <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED $50 USD.</p>

  <hr class="divider">

  <h2>10. Indemnification</h2>
  <p>You agree to indemnify and hold harmless PinDrop and its operators from any claims, losses, liabilities, damages, costs, and expenses (including reasonable attorneys' fees) arising out of your use of the Service, your violation of these Terms, or your infringement of any rights of a third party.</p>

  <hr class="divider">

  <h2>11. Modifications to the Service</h2>
  <p>We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at any time, with or without notice. We are not liable to you or any third party for any such modification, suspension, or discontinuation.</p>

  <hr class="divider">

  <h2>12. Changes to These Terms</h2>
  <p>We may revise these Terms from time to time. Updated Terms will be posted at this URL with a new "Last updated" date. Your continued use of the Service after changes constitutes your acceptance of the new Terms.</p>

  <hr class="divider">

  <h2>13. Governing Law</h2>
  <p>These Terms are governed by the laws of the State of Illinois, United States, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved in the state or federal courts located in Cook County, Illinois, and you consent to personal jurisdiction in those courts.</p>

  <hr class="divider">

  <h2>14. Severability</h2>
  <p>If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.</p>

  <hr class="divider">

  <h2>15. Entire Agreement</h2>
  <p>These Terms, together with our <a href="/privacy">Privacy Policy</a>, constitute the entire agreement between you and PinDrop regarding your use of the Service and supersede all prior agreements and understandings.</p>

  <hr class="divider">

  <h2>16. Contact Us</h2>
  <div class="contact-box">
    <p>Questions about these Terms can be sent to:<br><br>
    <strong>PinDrop</strong><br>
    <a href="mailto:legal@playpindrop.app">legal@playpindrop.app</a><br>
    <a href="https://playpindrop.app">playpindrop.app</a></p>
  </div>

</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(html);
}
