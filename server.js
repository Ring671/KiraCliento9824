// Run: node server.js   then open http://localhost:3000   (Node 18+)
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const STRIP = ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
               'content-encoding', 'content-length', 'transfer-encoding', 'connection'];

const inject = base => `<base href="${base}"><script>
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a || a.href.startsWith('javascript:') || a.href.startsWith('#')) return;
  e.preventDefault();
  const t = a.href;
  if (a.target === '_blank') window.open('/proxy?url=' + encodeURIComponent(t));
  else location.href = '/proxy?url=' + encodeURIComponent(t);
}, true);
</script>`;

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/proxy') {
    const target = u.searchParams.get('url');
    try {
      const r = await fetch(target, { redirect: 'follow', headers: {
        'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'accept': req.headers['accept'] || '*/*',
        'accept-language': req.headers['accept-language'] || 'en-US,en;q=0.9' } });
      const headers = {};
      r.headers.forEach((v, k) => { if (!STRIP.includes(k)) headers[k] = v; });
      const type = r.headers.get('content-type') || '';
      if (type.includes('text/html')) {
        let html = await r.text();
        const tag = inject(r.url);
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + tag) : tag + html;
        res.writeHead(r.status, headers); res.end(html);
      } else {
        res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer()));
      }
    } catch (err) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Could not load ' + target + '\n' + err.message);
    }
    return;
  }
  fs.readFile(path.join(__dirname, 'url-viewer.html'), (e, d) => {
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(d);
  });
}).listen(PORT, () => console.log('Kira Client running at http://localhost:' + PORT));
