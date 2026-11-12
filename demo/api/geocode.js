// GET /api/geocode?q=관악구 신림동      주소·장소 이름 → 좌표 (최대 5개)
// GET /api/geocode?lat=37.48&lng=126.92  좌표 → 대략적인 주소 (현재 위치 표시용)
//  - KAKAOREST_API_KEY(또는 KAKAO_REST_KEY) 환경변수가 있으면 카카오 로컬 API, 없으면 OpenStreetMap Nominatim
// 검색어와 좌표는 저장하지 않는다.
'use strict';

const UA = 'jachwi-navi/0.2 (+https://jachwi-navi.vercel.app; public-service demo)';

async function getJson(url, headers) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, 'Accept-Language': 'ko' }, headers || {}), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function kakaoSearch(q, key) {
  const h = { Authorization: 'KakaoAK ' + key };
  const a = await getJson('https://dapi.kakao.com/v2/local/search/address.json?size=5&query=' + encodeURIComponent(q), h);
  let items = (a.documents || []).map((d) => ({ label: d.road_address ? d.road_address.address_name : d.address_name, lat: +d.y, lng: +d.x }));
  if (!items.length) {
    const k = await getJson('https://dapi.kakao.com/v2/local/search/keyword.json?size=5&query=' + encodeURIComponent(q), h);
    items = (k.documents || []).map((d) => ({ label: d.place_name + ' · ' + (d.road_address_name || d.address_name), lat: +d.y, lng: +d.x }));
  }
  return items;
}
async function kakaoReverse(lat, lng, key) {
  const j = await getJson('https://dapi.kakao.com/v2/local/geo/coord2address.json?x=' + lng + '&y=' + lat, { Authorization: 'KakaoAK ' + key });
  const d = (j.documents || [])[0];
  return d ? (d.road_address ? d.road_address.address_name : d.address.address_name) : '';
}
function shortLabel(n) {
  const a = n.address || {};
  const parts = [a.city || a.province, a.borough || a.city_district || a.county, a.quarter || a.suburb || a.neighbourhood, a.road, a.house_number].filter(Boolean);
  return parts.length >= 2 ? parts.join(' ') : String(n.display_name || '').split(',').slice(0, 4).reverse().join(' ').trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.KAKAOREST_API_KEY || process.env.KAKAO_REST_KEY;   // 도보 경로(api/route.js)와 같은 키 이름도 받는다
  try {
    if (req.query.lat && req.query.lng) {
      const lat = +(+req.query.lat).toFixed(4), lng = +(+req.query.lng).toFixed(4);
      if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return res.status(400).json({ ok: false, error: '대한민국 안의 위치만 찾을 수 있어요.' });
      let label = '';
      if (key) label = await kakaoReverse(lat, lng, key);
      else { const n = await getJson('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=' + lat + '&lon=' + lng); label = shortLabel(n); }
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      return res.status(200).json({ ok: true, label, source: key ? 'kakao' : 'osm' });
    }
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q.length < 2) return res.status(400).json({ ok: false, error: '두 글자 이상 입력해 주세요.' });
    let items;
    if (key) items = await kakaoSearch(q, key);
    else {
      const j = await getJson('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=kr&limit=5&q=' + encodeURIComponent(q));
      items = (j || []).map((n) => ({ label: shortLabel(n), lat: +n.lat, lng: +n.lon }));
    }
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ ok: true, source: key ? 'kakao' : 'osm', items: items.filter((x) => x.lat && x.lng).slice(0, 5) });
  } catch (e) {
    return res.status(502).json({ ok: false, error: '주소를 찾지 못했어요. 잠시 뒤 다시 시도하거나 지도에서 직접 골라 주세요.' });
  }
};
