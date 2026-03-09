// api/_twitter.js — Shared X (Twitter) OAuth 1.0a posting helper
const crypto = require('crypto');

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
  const paramStr = Object.keys(params).sort()
    .map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  const base = `${method.toUpperCase()}&${pct(url)}&${pct(paramStr)}`;
  const key  = `${pct(creds.apiSecret)}&${pct(creds.accessTokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(params).sort()
    .map(k => `${pct(k)}="${pct(params[k])}"`).join(', ');
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

module.exports = { postTweet };
