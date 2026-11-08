// GET /api/places?lat=37.481&lng=126.928&r=1000
// 집 주변 생활시설을 실제 데이터로 돌려준다.
//  - 기본: OpenStreetMap 데이터 (Photon 검색 API, komoot) · 키 필요 없음 · ODbL
//  - 선택: 공공데이터포털 소상공인시장진흥공단 상가(상권)정보 · 환경변수 DATA_GO_KR_KEY 가 있을 때만
// 위치는 약 100m 단위로 흐려서 받고, 아무것도 저장하지 않는다.
// 공개 서버가 느리거나 막혀도 20초 안에 받은 만큼만 돌려주고, 브라우저가 나머지를 직접 시도한다.
'use strict';

const P = require('../places-core.js');
const UA = 'jachwi-navi/0.3 (+https://jachwi-navi.vercel.app; public-service demo)';

async function fetchJson(url, init, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctl.signal }, init));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function fromOSM(c, r, deadline) {
  const items = [], failed = [];
  for (let i = 0; i < P.GROUPS.length; i++) { // 한 번에 하나씩 (공개 서버 예의)
    const left = deadline - Date.now();
    if (left < 2500) { failed.push(i); continue; }
    try {
      const j = await fetchJson(P.photonUrl(c, r, P.GROUPS[i]), { headers: { 'User-Agent': UA } }, Math.min(7000, left - 1000));
      items.push.apply(items, P.fromPhoton(j.features));
    } catch (e) { failed.push(i); console.error('[places] photon group', i, e && e.message); }
  }
  return { items, failed };
}

// 공공데이터포털 · 소상공인시장진흥공단_상가(상권)정보 · 반경 내 상가 조회 (키가 있을 때만)
function sbizCat(it) {
  const s = [it.indsLclsNm, it.indsMclsNm, it.indsSclsNm].join(' ');
  if (/카페|커피/.test(s)) return ['cafe', '카페'];
  if (/독서실|스터디/.test(s)) return ['study', '스터디카페'];
  if (/약국/.test(s)) return ['medical', '약국'];
  if (/치과/.test(s)) return ['medical', '치과'];
  if (/의원|병원/.test(s)) return ['medical', '의원'];
  if (/편의점/.test(s)) return ['life', '편의점'];
  if (/슈퍼|마트|식료품/.test(s)) return ['life', '마트'];
  if (/세탁|빨래/.test(s)) return ['life', '빨래방·세탁소'];
  if (/헬스|피트니스|체력/.test(s)) return ['gym', '헬스장'];
  if (/^음식|음식 /.test(s) || /한식|분식|중식|일식|양식|식당/.test(s)) return ['food', it.indsMclsNm || '식당'];
  return null;
}
async function fromSbiz(c, r, key) {
  const url = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=' + encodeURIComponent(key) +
    '&pageNo=1&numOfRows=1000&radius=' + r + '&cx=' + c.lng + '&cy=' + c.lat + '&type=json';
  const j = await fetchJson(url, { headers: { 'User-Agent': UA } }, 9000);
  const items = (j.body && j.body.items) || [];
  return items.map((it) => {
    const cc = sbizCat(it), lat = +it.lat, lng = +it.lon;
    if (!cc || !lat || !lng || !it.bizesNm) return null;
    return { id: 'sbiz-' + it.bizesId, src: 'sbiz', cat: cc[0], sub: cc[1], name: (it.bizesNm + (it.brchNm ? ' ' + it.brchNm : '')).slice(0, 40), lat, lng, addr: (it.rdnmAdr || it.lnoAdr || '').slice(0, 60), hours: '' };
  }).filter(Boolean);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const deadline = Date.now() + 20000;
  const lat = Math.round(parseFloat(req.query.lat) * 1000) / 1000, lng = Math.round(parseFloat(req.query.lng) * 1000) / 1000;
  const r = Math.min(Math.max(parseInt(req.query.r, 10) || 1000, 200), 1500);
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return res.status(400).json({ ok: false, error: '위치가 올바르지 않아요.' });
  const c = { lat, lng }, sources = [], notes = [], key = process.env.DATA_GO_KR_KEY;
  const [osm, sb] = await Promise.all([
    fromOSM(c, r, deadline),
    key ? fromSbiz(c, Math.min(r, 1000), key).catch((e) => { console.error('[places] sbiz', e && e.message); notes.push('공공데이터포털 상가정보를 불러오지 못했어요.'); return null; }) : Promise.resolve(null)
  ]);
  let items = osm.items;
  if (osm.items.length) sources.push({ name: 'OpenStreetMap 기여자 (Photon 검색)', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' });
  if (sb) {
    sb.forEach((p) => { if (!items.some((q) => q.name.replace(/\s/g, '') === p.name.replace(/\s/g, '') && P.dist(p, q) < 50)) items.push(p); });
    sources.push({ name: '공공데이터포털 · 소상공인시장진흥공단 상가(상권)정보', url: 'https://www.data.go.kr/data/15012005/openapi.do', license: '공공누리' });
  }
  if (!items.length) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, error: '주변 데이터 서버가 바빠요. 잠시 뒤 다시 시도해 주세요.', failedGroups: osm.failed, notes });
  }
  items = P.finish(items, c, r);
  // 다 받았으면 7일, 일부만 받았으면 10분만 캐시 (공개 서버를 덜 부르도록)
  res.setHeader('Cache-Control', osm.failed.length ? 'public, s-maxage=600' : 'public, s-maxage=604800, stale-while-revalidate=604800');
  res.status(200).json({ ok: true, center: c, radius: r, fetchedAt: new Date().toISOString(), sources, notes, failedGroups: osm.failed, items });
};
