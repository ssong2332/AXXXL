// GET /api/bus-stops?lat=위도&lng=경도   주변 버스정류장 (반경 약 500m, 서비스 지역 전국)
//  - TAGO(국토교통부 버스정류소정보)는 서울 버스가 빠져 있어서, 서울과 그 주변은 서울시 정류소정보조회 API를 같이 부른다.
//  - 둘 다 공공데이터포털 인증키(Decoding 키)를 쓴다: 환경변수 TAGO_API_KEY (또는 DATA_GO_KR_KEY). 화면에는 내려주지 않는다.
//  - 좌표는 저장하지 않는다. 정류장은 잘 안 바뀌어서 같은 요청은 7일 동안 Vercel 캐시를 쓴다.
'use strict';

const SEOUL_NEAR = { s: 37.40, n: 37.73, w: 126.70, e: 127.30 };   // 서울 + 경계 근처

async function getJson(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// 정류장 번호: '0'·'00000'·'-' 처럼 의미 없는 값은 번호 없음('')으로 본다 (예: 가천대(미정차) 번호 0)
const stopNo = (v) => { const t = String(v == null ? '' : v).trim(); return !t || /^[0-]+$/.test(t) ? '' : t; };
// 버스가 서지 않는 통과 지점(미정차)·가상 정류장은 이름에 표시가 붙어 온다 — 정류장이 아니므로 뺀다
const NOT_A_STOP = /미정차|가상정류|가상 정류/;

async function tagoStops(lat, lng, key) {
  const qs = new URLSearchParams({ serviceKey: key, gpsLati: lat.toFixed(6), gpsLong: lng.toFixed(6), numOfRows: '100', pageNo: '1', _type: 'json' });
  const d = await getJson('https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList?' + qs);
  const head = (d.response && d.response.header) || {};
  if (String(head.resultCode) !== '00') throw new Error(head.resultMsg || 'TAGO 오류');
  let items = (d.response.body && d.response.body.items) || {};
  items = items && !Array.isArray(items) ? items.item : items;
  return list(items).filter((x) => x.gpslati && x.gpslong).map((x) => ({ id: 'tago-' + x.nodeid, name: String(x.nodenm || '').trim(), lat: +x.gpslati, lng: +x.gpslong, no: stopNo(x.nodeno), src: 'tago', city: String(x.citycode || ''), node: String(x.nodeid || '') }));
}

async function seoulStops(lat, lng, key) {
  const qs = new URLSearchParams({ serviceKey: key, tmX: lng.toFixed(6), tmY: lat.toFixed(6), radius: '500', resultType: 'json' });
  const d = await getJson('http://ws.bus.go.kr/api/rest/stationinfo/getStationByPos?' + qs);
  const head = d.msgHeader || {};
  if (!['0', '4'].includes(String(head.headerCd))) throw new Error(head.headerMsg || '서울시 버스 API 오류');   // 4 = 결과 없음
  return list((d.msgBody || {}).itemList).filter((x) => x.gpsX && x.gpsY).map((x) => ({ id: 'seoul-' + x.stationId, name: String(x.stationNm || '').trim(), lat: +x.gpsY, lng: +x.gpsX, no: stopNo(x.arsId), src: 'seoul', city: 'seoul' }));
}

// 집이 있는 시·군의 TAGO 도시코드: 카카오 좌표→행정구역(KAKAOREST_API_KEY)으로 시·군 이름을 알아내 TAGO 도시 목록과 맞춘다.
// 광역·특별시(대구광역시·대전광역시/계룡시·세종특별시 등)는 시·도 이름으로, 그 밖은 시·군 이름(경산시·칠곡군)으로. 서울은 'seoul'.
const normCity = (n) => String(n || '').split('/')[0].trim().replace(/(특별자치시|특별자치도|특별시|광역시|자치시|자치도|도)$/, '');
let TAGO_CITIES = null;   // 함수가 켜져 있는 동안 기억
async function tagoCities(key) {
  if (TAGO_CITIES) return TAGO_CITIES;
  const d = await getJson('https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCtyCodeList?' + new URLSearchParams({ serviceKey: key, _type: 'json', numOfRows: '300' }));
  let items = (d.response && d.response.body && d.response.body.items) || {};
  items = items && !Array.isArray(items) ? items.item : items;
  TAGO_CITIES = {};
  list(items).forEach((x) => { TAGO_CITIES[String(x.citycode)] = String(x.cityname || ''); });
  return TAGO_CITIES;
}
async function localCityCodes(lat, lng, tagoKey) {
  const kakao = String(process.env.KAKAOREST_API_KEY || process.env.KAKAO_REST_KEY || '').trim();
  if (!kakao) return new Set();
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?' + new URLSearchParams({ x: lng.toFixed(6), y: lat.toFixed(6) }), { headers: { Authorization: 'KakaoAK ' + kakao }, signal: ctl.signal }).finally(() => clearTimeout(t));
    const docs = (await r.json()).documents || [];
    const reg = docs.find((d) => d.region_type === 'B') || docs[0];
    if (!reg) return new Set();
    const r1 = reg.region_1depth_name || '', r2 = String(reg.region_2depth_name || '').split(' ')[0];
    if (r1.startsWith('서울')) return new Set(['seoul']);
    const metro = /(특별시|광역시|특별자치시)$/.test(r1), want = metro ? normCity(r1) : r2;
    const cities = await tagoCities(tagoKey);
    return new Set(Object.keys(cities).filter((code) => (metro ? normCity(cities[code]) === want : cities[code].split('/')[0] === want)));
  } catch (e) { return new Set(); }
}

// 정류장 번호가 없는 TAGO 정류장은 지나는 버스가 있는지 한 번 더 묻고(정류소별 경유노선), 0개면 뺀다.
// 예) 하양: 대구 BIS의 '하양읍사무소 건너'(번호 없음)는 0개(옛 자료), 경산 BIS의 '대구가톨릭대학교 건너(산업도로)'(번호 없음)는 818번이 지나서 남긴다.
// 묻다가 오류가 나면 지우지 않는다. 번호 없는 정류장은 몇 개 안 돼서 하루 사용량 부담이 작다.
async function routeCount(city, node, key) {
  try {
    const d = await getJson('https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnThrghRouteList?' + new URLSearchParams({ serviceKey: key, cityCode: city, nodeid: node, numOfRows: '1', _type: 'json' }));
    if (String(((d.response || {}).header || {}).resultCode) !== '00') return null;
    return +(((d.response.body || {}).totalCount) || 0);
  } catch (e) { return null; }
}
async function dropDead(items, key) {
  const check = items.filter((x) => x.src === 'tago' && !x.no && x.node && x.city);
  if (!check.length) return items;
  const counts = await Promise.all(check.map((x) => routeCount(x.city, x.node, key)));
  const dead = new Set(check.filter((x, i) => counts[i] === 0));
  return items.filter((x) => !dead.has(x));
}

// 같은 정류장이 여러 도시 BIS에 겹쳐 오는 경우를 하나로 합친다.
// 예) 하양(경산시)에는 경산·대구·영천 BIS가 같은 정류장을 각자 번호·이름으로 올린다.
//     '하양읍행정복지센터 건너'(경산, 17031)와 '하양읍사무소 건너'(대구, 번호 없음)는 좌표가 완전히 같다.
// 같은 정류장 기준: 15m 안(이름이 달라도) · 정류장 번호가 같고 60m 안 · 이름이 같고 20m 안.
// 남길 자료: 집이 있는 시·군(local) 자료 → 정류장 번호가 있는 것 → 이름이 더 자세한(긴) 것.
function meters(a, b) { const dy = (a.lat - b.lat) * 110540, dx = (a.lng - b.lng) * 111320 * 0.8; return Math.sqrt(dx * dx + dy * dy); }
function dedupe(items, local) {
  const groups = [];
  items.forEach((x) => {
    if (!x.name) return;
    const g = groups.find((g) => g.some((y) => meters(x, y) < 15 || (x.no && x.no === y.no && meters(x, y) < 60) || (x.name === y.name && meters(x, y) < 20)));
    if (g) g.push(x); else groups.push([x]);
  });
  const rank = (y) => [local.has(y.city) ? 1 : 0, y.no ? 1 : 0, y.name.length];
  const better = (a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i] ? a : b; return a; };
  return groups.map((g) => { const { city, node, ...keep } = g.reduce(better); return keep; });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const lat = +req.query.lat, lng = +req.query.lng;
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return res.status(400).json({ ok: false, error: '대한민국 안의 좌표만 찾을 수 있어요.' });
  const key = String(process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY || '').trim();
  if (!key) return res.status(200).json({ ok: false, status: 'NO_KEY', items: [] });
  const items = [], sources = [], errors = [];
  try { items.push(...await tagoStops(lat, lng, key)); sources.push('tago'); } catch (e) { errors.push('tago'); }
  if (lat > SEOUL_NEAR.s && lat < SEOUL_NEAR.n && lng > SEOUL_NEAR.w && lng < SEOUL_NEAR.e) {
    try { items.push(...await seoulStops(lat, lng, key)); sources.push('seoul'); } catch (e) { errors.push('seoul'); }
  }
  const live = await dropDead(items.filter((x) => !NOT_A_STOP.test(x.name)), key);   // 미정차·가상 정류장 빼고, 번호 없고 지나는 버스 없는 옛 자료 빼기
  const local = live.length ? await localCityCodes(lat, lng, key) : new Set();
  const out = { ok: sources.length > 0, items: dedupe(live, local), sources, errors };
  if (out.ok && !errors.length) res.setHeader('Cache-Control', 'public, s-maxage=604800');
  return res.status(200).json(out);
};
