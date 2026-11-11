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
  arr.push(now); hits.set(k, arr); if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function send(res, code, body, cache) { res.setHeader('Cache-Control', cache || 'no-store'); res.status(code).json(body); }
const iso = (ms) => new Date(ms).toISOString();

// XML 한 덩어리에서 태그 값을 꺼낸다 (복지로 API는 XML만 준다)
function unesc(s) { return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim(); }
function tag(block, name) { const m = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>').exec(block); return m ? unesc(m[1]) : ''; }
function blocks(xml, name) { return String(xml).split('<' + name + '>').slice(1).map((b) => b.split('</' + name + '>')[0]); }

module.exports = { getText, getJson, portalKey, cached, limited, send, iso, tag, blocks };
