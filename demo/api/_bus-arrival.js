// GET /api/bus-arrival?src=tago&city=22&node=DGB7001004100   TAGO 정류장의 지나는 노선과 도착 예정
// GET /api/bus-arrival?src=seoul&ars=21243                    서울 정류장(정류장 번호 arsId)의 노선별 도착 예정
//  - 공공데이터포털 인증키(Decoding 키): 환경변수 TAGO_API_KEY (또는 DATA_GO_KR_KEY). bus-stops.js 와 같은 키. 화면에는 내려주지 않는다.
//    TAGO: 버스도착정보(ArvlInfoInqireService) + 버스정류소정보의 정류소별 경유노선(getSttnThrghRouteList)
//    서울: 정류소정보조회(stationinfo/getStationByUid) — 정류장 찾기(getStationByPos)와 같은 서비스
//  - 도착 정보는 금방 바뀌어서 20초만 Vercel 캐시를 쓴다. 아무것도 저장하지 않는다.
'use strict';

async function getJson(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 6000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
function tagoItems(d) {
  const head = (d.response && d.response.header) || {};
  if (String(head.resultCode) !== '00') throw new Error(head.resultMsg || 'TAGO 오류');
  let items = (d.response.body && d.response.body.items) || {};
  items = items && !Array.isArray(items) ? items.item : items;
  return list(items);
}
// 노선 번호 순서: 숫자 앞부분 → 글자 (예: 2, 11, 101, 급행2, 마을01)
function byNo(a, b) {
  const na = parseInt(a.no, 10), nb = parseInt(b.no, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1;
  return a.no.localeCompare(b.no, 'ko');
}
function arrText(sec, stops) {
  const min = Math.round(sec / 60);
  return (sec < 60 ? '곧 도착' : min + '분 후') + (stops > 0 ? ' (' + stops + '정거장 전)' : '');
}

async function tago(city, node, key) {
  const base = 'https://apis.data.go.kr/1613000/';
  const q = (o) => new URLSearchParams(Object.assign({ serviceKey: key, _type: 'json', numOfRows: '100', pageNo: '1' }, o));
  // 지나는 노선은 실패해도 도착 정보만으로 보여 준다
  const [arr, thr] = await Promise.all([
    getJson(base + 'ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList?' + q({ cityCode: city, nodeId: node })).then(tagoItems),
    getJson(base + 'BusSttnInfoInqireService/getSttnThrghRouteList?' + q({ cityCode: city, nodeid: node })).then(tagoItems).catch(() => [])
  ]);
  const by = {};
  const add = (no, type) => { no = String(no == null ? '' : no).trim(); if (!no) return null; return by[no] || (by[no] = { no, type: String(type || '').replace(/버스$/, ''), at: [] }); };
  thr.forEach((x) => add(x.routeno, x.routetp));
  arr.forEach((x) => { const r = add(x.routeno, x.routetp); if (r && +x.arrtime >= 0) r.at.push([+x.arrtime, +x.arrprevstationcnt || 0]); });
  return Object.values(by).map((r) => {
    r.at.sort((a, b) => a[0] - b[0]);
    return { no: r.no, type: r.type, arr: r.at.slice(0, 2).map((a) => arrText(a[0], a[1])), first: r.at.length ? r.at[0][0] : Infinity };
  });
}

async function seoul(ars, key) {
  const d = await getJson('http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?' + new URLSearchParams({ serviceKey: key, arsId: ars, resultType: 'json' }));
  const head = d.msgHeader || {};
  if (!['0', '4'].includes(String(head.headerCd))) throw new Error(head.headerMsg || '서울시 버스 API 오류');   // 4 = 결과 없음
  const TYPE = { 1: '공항', 2: '마을', 3: '간선', 4: '지선', 5: '순환', 6: '광역', 7: '인천', 8: '경기', 9: '폐지', 0: '공용' };
  // arrmsg 예: '3분12초후[2번째 전]', '곧 도착', '운행종료', '출발대기' → '3분 후 (2정거장 전)'처럼 맞춘다
  const tidy = (m) => {
    m = String(m || '').trim();
    const a = /^(\d+)분(?:\d+초)?후\[(\d+)번째 전\]/.exec(m), b = /^(\d+)초후\[(\d+)번째 전\]/.exec(m);
    if (a) return { t: +a[1] * 60, s: arrText(+a[1] * 60, +a[2]) };
    if (b) return { t: +b[1], s: arrText(+b[1], +b[2]) };
    if (/곧 도착/.test(m)) return { t: 30, s: '곧 도착' };
    return m && !/운행종료|정보없음/.test(m) ? { t: Infinity, s: m.replace(/\[.*\]$/, '') } : null;
  };
  return list((d.msgBody || {}).itemList).map((x) => {
    const at = [tidy(x.arrmsg1), tidy(x.arrmsg2)].filter(Boolean);
    return { no: String(x.rtNm || x.busRouteAbrv || '').trim(), type: TYPE[x.routeType] || '', arr: at.map((a) => a.s), first: at.length ? at[0].t : Infinity };
  }).filter((r) => r.no);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const src = String(req.query.src || ''), city = String(req.query.city || ''), node = String(req.query.node || ''), ars = String(req.query.ars || '');
  const okTago = src === 'tago' && /^\d{1,6}$/.test(city) && /^[A-Z0-9]{3,24}$/.test(node), okSeoul = src === 'seoul' && /^\d{4,6}$/.test(ars);
  if (!okTago && !okSeoul) return res.status(400).json({ ok: false, error: '정류장 정보가 올바르지 않아요.' });
  const key = String(process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY || '').trim();
  if (!key) return res.status(200).json({ ok: false, status: 'NO_KEY', routes: [] });
  try {
    const routes = (okTago ? await tago(city, node, key) : await seoul(ars, key))
      .sort((a, b) => (a.first - b.first) || byNo(a, b))   // 먼저 오는 버스부터, 도착 정보 없는 노선은 번호 순서로 뒤에
      .map(({ first, ...r }) => r);
    res.setHeader('Cache-Control', 'public, s-maxage=20');
    return res.status(200).json({ ok: true, src, routes, at: new Date().toISOString() });
  } catch (e) {
    return res.status(200).json({ ok: false, status: 'ERROR', routes: [] });
  }
};
