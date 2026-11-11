// 공공 API 서버 함수 공용: 시간 제한 있는 요청, 인스턴스 메모리 캐시, 요청 제한
// 밑줄(_)로 시작하는 파일은 Vercel이 주소로 열지 않는다. 키는 환경변수에서만 읽고 응답·로그에 넣지 않는다.
'use strict';

const UA = 'jachwi-navi/0.3 (+https://jachwi-navi.vercel.app; public-service demo)';

async function getText(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 15000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function getJson(url, ms) { return JSON.parse(await getText(url, ms)); }
// 공공 API는 가끔 한 번씩 오류(400·5xx·시간 초과)를 낸다. 잠깐 쉬고 다시 부른다. (2026-11-11 온통청년: 같은 요청이 400 → 바로 다시 부르면 200)
async function retry(fn, tries, waitMs) {
  let err;
  for (let i = 0; i < (tries || 3); i++) {
    try { return await fn(); } catch (e) { err = e; if (i < (tries || 3) - 1) await new Promise((ok) => setTimeout(ok, (waitMs || 400) * (i + 1))); }
  }
  throw err;
}

// ---------- 공고 원문 페이지 읽기 ----------
// 공고 주소는 등록 자료에서 오므로 아무 주소나 열지 않는다: 공개 인터넷의 http(s)만, 내부망·이 서버 주소는 막는다.
// 주소를 옮겨 갈 때(redirect)마다 다시 검사하고, 크기(2MB)와 시간(8초)에 한도를 둔다.
const dns = require('dns'), net = require('net');
const PAGE_UA = 'Mozilla/5.0 (compatible; jachwi-navi/0.3; +https://jachwi-navi.vercel.app)';
function privateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const s = String(ip).toLowerCase();
  if (s.startsWith('::ffff:')) return privateIp(s.slice(7));
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80');
}
async function publicUrl(s) {
  let u; try { u = new URL(s); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes('.') || net.isIP(h) || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  try { const addrs = await dns.promises.lookup(h, { all: true }); if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null; } catch (e) { return null; }
  return u;
}
async function getPage(url, ms, maxBytes) {
  const end = Date.now() + (ms || 8000); let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = await publicUrl(cur); if (!u) throw new Error('blocked');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), Math.max(500, end - Date.now()));
    try {
      const r = await fetch(u.href, { headers: { 'User-Agent': PAGE_UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: ctl.signal, redirect: 'manual' });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { cur = new URL(r.headers.get('location'), u).href; continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (ct && !/html|xml|text\/plain/i.test(ct)) throw new Error('not a page');
      const chunks = [], rd = r.body.getReader(); let n = 0;
      for (;;) { const x = await rd.read(); if (x.done) break; chunks.push(Buffer.from(x.value)); n += x.value.length; if (n > (maxBytes || 2e6)) { try { await rd.cancel(); } catch (e) { /* 이미 닫힘 */ } break; } }
      const buf = Buffer.concat(chunks);
      let cs = ((/charset=["']?([\w-]+)/i.exec(ct) || [])[1] || (/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.toString('latin1', 0, Math.min(buf.length, 4096))) || [])[1] || 'utf-8').toLowerCase();
      if (/ks_c_5601|euc-kr|cp949|ksc5601|windows-949/.test(cs)) cs = 'euc-kr'; // 오래된 공공기관 누리집은 EUC-KR이 많다
      let html; try { html = new TextDecoder(cs).decode(buf); } catch (e) { html = buf.toString('utf8'); }
      return { html, url: u.href };
    } finally { clearTimeout(t); }
  }
  throw new Error('too many redirects');
}

// 공공데이터포털 키는 인코딩 전 값(Decoding)이든 인코딩된 값이든 받는다
function portalKey() { const k = process.env.DATA_GO_KR_KEY || ''; return k ? (/%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k)) : ''; }

const store = new Map();
// 같은 키로 동시에 들어온 요청은 한 번만 원본을 부른다. 실패하면 지난 값이 있을 때 그 값을 돌려준다(stale: true).
async function cached(key, ttlMs, load) {
  const hit = store.get(key), now = Date.now();
  if (hit && hit.value !== undefined && now - hit.at < ttlMs) return { value: hit.value, at: hit.at, stale: false };
  if (hit && hit.pending) return hit.pending;
  const pending = (async () => {
    try { const value = await load(); const at = Date.now(); store.set(key, { value, at }); return { value, at, stale: false }; }
    catch (e) {
      if (hit && hit.value !== undefined) { store.set(key, { value: hit.value, at: hit.at }); return { value: hit.value, at: hit.at, stale: true }; }
      store.delete(key); throw e;
    }
  })();
  store.set(key, Object.assign({}, hit, { pending }));
  if (store.size > 400) { const first = store.keys().next().value; if (first !== key) store.delete(first); }
  return pending;
}

const hits = new Map();
function limited(req, name, max, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const k = name + ':' + ip, now = Date.now(), arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  // 막힌 요청은 세지 않는다. 세면 계속 누르는 동안 제한이 풀리지 않는다 (발표장처럼 여러 명이 한 주소로 들어올 때도 같다)
  if (arr.length >= max) { hits.set(k, arr); return true; }
  arr.push(now); hits.set(k, arr); if (hits.size > 5000) hits.clear();
  return false;
}

function send(res, code, body, cache) { res.setHeader('Cache-Control', cache || 'no-store'); res.status(code).json(body); }
const iso = (ms) => new Date(ms).toISOString();

// XML 한 덩어리에서 태그 값을 꺼낸다 (복지로 API는 XML만 준다)
function unesc(s) { return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim(); }
function tag(block, name) { const m = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>').exec(block); return m ? unesc(m[1]) : ''; }
function blocks(xml, name) { return String(xml).split('<' + name + '>').slice(1).map((b) => b.split('</' + name + '>')[0]); }

module.exports = { getText, getJson, getPage, publicUrl, privateIp, retry, portalKey, cached, limited, send, iso, tag, blocks };
