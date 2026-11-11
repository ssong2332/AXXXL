// 로컬 실행용 작은 서버 — Vercel 없이 화면과 서버 함수(api/*.js)를 함께 띄운다.
//   실행:  node dev-server.js        (demo 폴더에서, 기본 포트 4173)
//   키:    demo/.env 에 KEY=값 형식으로 적는다. 이 파일은 .gitignore 로 제외돼 저장소에 올라가지 않는다.
// 의존성 없이 Node 20 이상에서 돈다. AI·Blob을 쓰는 함수는 패키지를 설치(npm install)해야 동작한다.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname, PORT = +process.env.PORT || 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };

// .env 읽기 (이미 있는 환경변수는 덮어쓰지 않는다)
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* .env 가 없으면 키 없이 동작 */ }

function wrap(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return res; };
  res.send = (body) => { if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body); if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(body); return res; };
  return res;
}
function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve(undefined);
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve(b); } });
  });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(u.pathname);
  if (p === '/') { res.writeHead(302, { Location: '/app.html' }); return res.end(); }
  if (p === '/admin') p = '/admin.html';
  if (p === '/cal.ics') p = '/api/calendar';
  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/\.js$/, '');
    const file = path.join(ROOT, 'api', name + '.js');
    if (!/^[a-z0-9-]+$/i.test(name) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    req.query = Object.fromEntries(u.searchParams.entries());
    req.body = await readBody(req);
    try { await require(file)(req, wrap(res)); }
    catch (e) { if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: '서버 함수 오류: ' + (e && e.message) })); } }
    return;
  }
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || /(^|[\\/])\.env/.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  const has = (k) => (process.env[k] ? '있음' : '없음');
  console.log('자취 계약 내비 로컬 서버  http://localhost:' + PORT + '/app.html');
  console.log('키: YOUTH_API_KEY ' + has('YOUTH_API_KEY') + ' · DATA_GO_KR_KEY ' + has('DATA_GO_KR_KEY') + ' · KAKAO_REST_KEY ' + has('KAKAO_REST_KEY'));
});
