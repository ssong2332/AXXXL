// GET /api/places?lat=37.481&lng=126.928&r=1000
// 집 주변 생활시설을 실제 데이터로 돌려준다.
//  - 기본: OpenStreetMap(Overpass API) · 키 필요 없음 · ODbL
//  - 선택: 공공데이터포털 소상공인시장진흥공단 상가(상권)정보 · 환경변수 DATA_GO_KR_KEY 가 있을 때만
// 위치는 약 100m 단위로 흐려서 받고, 아무것도 저장하지 않는다.
'use strict';

const UA = 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app; public-service demo)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const SUB = {
  cafe: '카페', restaurant: '식당', fast_food: '분식·패스트푸드', food_court: '푸드코트', pharmacy: '약국', hospital: '병원', clinic: '의원', doctors: '의원', dentist: '치과',
  library: '도서관', police: '경찰', townhall: '행정복지센터·관공서', community_centre: '주민 시설', post_office: '우체국', convenience: '편의점', supermarket: '마트',
  laundry: '빨래방·세탁소', dry_cleaning: '세탁소', variety_store: '생활용품점', department_store: '백화점', mall: '쇼핑몰', marketplace: '시장', fitness_centre: '헬스장',
  sports_centre: '체육시설', swimming_pool: '수영장', park: '공원', bus_stop: '버스정류장', station: '역', studycafe: '스터디카페'
};

function osmCat(t) {
  const a = t.amenity, s = t.shop, l = t.leisure, name = t['name:ko'] || t.name || '';
  if (a === 'cafe') return /스터디|study/i.test(name) ? ['study', 'studycafe'] : ['cafe', 'cafe'];
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') return ['food', a];
  if (['pharmacy', 'hospital', 'clinic', 'doctors', 'dentist'].includes(a)) return ['medical', a];
  if (a === 'library') return ['study', a];
  if (a === 'police') return ['safety', a];
  if (['townhall', 'community_centre', 'post_office'].includes(a)) return ['public', a];
  if (a === 'marketplace') return ['life', a];
  if (['convenience', 'supermarket', 'laundry', 'dry_cleaning', 'variety_store', 'department_store', 'mall'].includes(s)) return ['life', s];
  if (['fitness_centre', 'sports_centre', 'swimming_pool'].includes(l)) return ['gym', l];
  if (l === 'park') return ['park', 'park'];
  if (t.highway === 'bus_stop') return ['transit', 'bus_stop'];
  if (t.railway === 'station' || t.station === 'subway' || (t.public_transport === 'station' && t.railway)) return ['transit', 'station'];
  return null;
}

function dist(a, b) {
  const R = 6371000, toR = Math.PI / 180, dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function fetchJson(url, init, ms) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms || 15000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctl.signal }, init));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function fromOSM(c, r) {
  const A = `(around:${r},${c.lat},${c.lng})`;
  // 가볍게: 대부분 점(node)으로 찾고, 공원·큰 시설만 면(way)까지 본다
  const q = `[out:json][timeout:15];(
    node${A}[amenity~"^(cafe|restaurant|fast_food|pharmacy|hospital|clinic|doctors|dentist|library|police|townhall|community_centre|post_office|marketplace)$"];
    node${A}[shop~"^(convenience|supermarket|laundry|dry_cleaning|variety_store|department_store|mall)$"];
    node${A}[leisure~"^(fitness_centre|sports_centre|swimming_pool)$"];
    way${A}[leisure~"^(park|sports_centre)$"][name];
    way${A}[amenity~"^(townhall|library|hospital|police|community_centre)$"][name];
    node${A}[highway=bus_stop][name];
    node${A}[railway=station];
  );out center tags 700;`;
  const body = 'data=' + encodeURIComponent(q);
  const tries = OVERPASS.map((ep) => fetchJson(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body }, 14000)
    .then((j) => { if (!j || !Array.isArray(j.elements)) throw new Error(ep + ': bad response'); return j; })
    .catch((e) => { throw new Error(new URL(ep).host + ' ' + (e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || e)); }));
  let j;
  try { j = await Promise.any(tries); } catch (agg) { throw new Error((agg.errors || []).map((e) => e.message).join(' / ')); }
  return (j.elements || []).map((e) => {
    const t = e.tags || {}, cc = osmCat(t), lat = e.lat != null ? e.lat : e.center && e.center.lat, lng = e.lon != null ? e.lon : e.center && e.center.lon;
    const name = t['name:ko'] || t.name;
    if (!cc || lat == null || !name) return null;
    const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || t['addr:full'] || '';
    return { id: 'osm-' + e.type[0] + e.id, src: 'osm', cat: cc[0], sub: SUB[cc[1]] || cc[1], name: String(name).slice(0, 40), lat: +lat.toFixed(6), lng: +lng.toFixed(6), addr: addr.slice(0, 60), hours: (t.opening_hours || '').slice(0, 60) };
  }).filter(Boolean);
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
  const j = await fetchJson(url, { headers: { 'User-Agent': UA } }, 15000);
  const items = (j.body && j.body.items) || [];
  return items.map((it) => {
    const cc = sbizCat(it), lat = +it.lat, lng = +it.lon;
    if (!cc || !lat || !lng || !it.bizesNm) return null;
    return { id: 'sbiz-' + it.bizesId, src: 'sbiz', cat: cc[0], sub: cc[1], name: (it.bizesNm + (it.brchNm ? ' ' + it.brchNm : '')).slice(0, 40), lat, lng, addr: (it.rdnmAdr || it.lnoAdr || '').slice(0, 60), hours: '' };
  }).filter(Boolean);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const lat = Math.round(parseFloat(req.query.lat) * 1000) / 1000, lng = Math.round(parseFloat(req.query.lng) * 1000) / 1000;
  const r = Math.min(Math.max(parseInt(req.query.r, 10) || 1000, 200), 1500);
  // 대한민국 범위 밖이거나 숫자가 아니면 거절
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return res.status(400).json({ ok: false, error: '위치가 올바르지 않아요.' });
  const c = { lat, lng }, sources = [], notes = [];
  let items = [];
  try {
    items = await fromOSM(c, r);
    sources.push({ name: 'OpenStreetMap 기여자', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL' });
  } catch (e) { notes.push('OpenStreetMap 데이터를 불러오지 못했어요.'); console.error('[places] overpass', e && e.message); }
  const key = process.env.DATA_GO_KR_KEY;
  if (key) {
    try {
      const sb = await fromSbiz(c, Math.min(r, 1000), key);
      // 같은 이름이 50m 안에 있으면 하나로 합친다
      sb.forEach((p) => { if (!items.some((q) => q.name.replace(/\s/g, '') === p.name.replace(/\s/g, '') && dist(p, q) < 50)) items.push(p); });
      sources.push({ name: '공공데이터포털 · 소상공인시장진흥공단 상가(상권)정보', url: 'https://www.data.go.kr/data/15012005/openapi.do', license: '공공누리' });
    } catch (e) { notes.push('공공데이터포털 상가정보를 불러오지 못했어요.'); console.error('[places] sbiz', e && e.message); }
  }
  if (!sources.length) return res.status(502).json({ ok: false, error: '주변 데이터를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.', notes });
  // 같은 역이 여러 점으로 들어오는 경우 등 이름·분류가 같고 60m 안이면 하나만
  const seen = [];
  items = items.map((p) => Object.assign(p, { m: dist(c, p) })).filter((p) => p.m <= r).sort((a, b) => a.m - b.m)
    .filter((p) => { if (seen.some((q) => q.cat === p.cat && q.name === p.name && dist(p, q) < 60)) return false; seen.push(p); return true; })
    .slice(0, 400);
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({ ok: true, center: c, radius: r, fetchedAt: new Date().toISOString(), sources, notes, items });
};
