// 집 보기 시연판 로컬 서버. 의존성 없이 Node만으로 web/ 폴더를 127.0.0.1에서만 연다.
// 사용: node server.mjs [--port 5180] [--open]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'web');
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const port = portArg >= 0 ? Number(args[portArg + 1]) : 5180;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};
// 외부 요청을 브라우저 차원에서 막는다. 사진·영상은 blob: 주소로만 미리 본다.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end('forbidden'); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('없는 파일이에요');
  }
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `포트 ${port}를 이미 쓰고 있어요. --port 5181 처럼 다른 번호로 실행해 주세요.` : e.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`집 보기 시연판: ${url}  (이 컴퓨터에서만 열려요. 끄려면 Ctrl+C)`);
  if (args.includes('--open')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd);
  }
});
