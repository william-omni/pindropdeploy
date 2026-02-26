const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const token = process.env.MAPBOX_TOKEN || '';

  if (!token) {
    res.status(500).send('Server misconfiguration: missing MAPBOX_TOKEN environment variable.');
    return;
  }

  const htmlPath = path.join(process.cwd(), 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Inject the token at request time — never stored in source code
  html = html.replace('__MAPBOX_TOKEN__', token);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // Don't cache — token is injected per-request
  res.status(200).send(html);
};
