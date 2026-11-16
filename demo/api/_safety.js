// 밤길 안전: 방범 CCTV · 보안등 위치 (화면이 집 주변 개수를 센다)
// GET /api/safety?rg=서울특별시 관악구                 → { ok, codes: ['3200000'] }   시·군·구의 지자체 코드
// GET /api/safety?kind=cctv&code=3200000&page=1        → { ok, total, pages, items: [[위도, 경도, 카메라 대수, 설치 목적], ...] }  (한 쪽 100곳)
// GET /api/safety?kind=lamp&code=3200000&page=1        → { ok, total, pages, items: [[위도, 경도, 등 개수], ...], noPos }       (한 쪽 1000곳)
//  - 공공데이터포털 인증키(Decoding 키): 환경변수 TAGO_API_KEY (또는 DATA_GO_KR_KEY). 화면에는 내려주지 않는다.
//    CCTV: 행정안전부_CCTV정보 조회서비스 (apis.data.go.kr/1741000/cctv_info/info)
//    보안등: 전국보안등정보표준데이터 (api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api)
//  - 두 API 모두 좌표(반경)로 거를 수 없고 지자체 코드로만 거를 수 있어서, 시·군·구 자료를 쪽 단위로 받는다.
//    CCTV API는 여러 쪽을 한꺼번에 물으면 한 쪽에 30초 넘게 걸려서(2026-11-16 확인) 화면이 한두 쪽씩 차례로 묻는다.
//  - 위치 자료는 잘 안 바뀌어서 쪽마다 7일 동안 Vercel 캐시를 쓴다. 집 좌표는 서버로 보내지 않는다.
//  - 시·군·구 → 지자체 코드 표: data/inst-codes.json — data/regions.js의 시·군·구마다 행정안전부 행정표준코드 기관코드 API(StanOrgCd2)로 찾은 코드
//    (2026-11-16 만듦. 기관 줄이 없으면 하위 부서들의 대표 코드. 구가 있는 시는 구·시 코드 둘 다)
'use strict';

const CODES = (() => { try { return require('../data/inst-codes.json'); } catch (e) { return {}; } })();

async function getJson(url, ms) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 25000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
function body(d) {
  const root = d.response || d, head = root.header || {};
  if (head.resultCode && !['00', '0', '000'].includes(String(head.resultCode))) throw new Error(head.resultMsg || 'API 오류');
  const b = root.body || {}, it = b.items && (b.items.item !== undefined ? b.items.item : b.items);
  return { total: +b.totalCount || 0, items: list(it) };
}
const pos = (lat, lng) => lat > 33 && lat < 39 && lng > 124 && lng < 132;

const KIND = {
  cctv: {
    size: 100,
    url: (key, code, p) => 'https://apis.data.go.kr/1741000/cctv_info/info?' + new URLSearchParams({ serviceKey: key, pageNo: String(p), numOfRows: '100', returnType: 'json', 'cond[OPN_ATMY_GRP_CD::EQ]': code }),
    pick: (x) => [+(+x.WGS84_LAT).toFixed(6), +(+x.WGS84_LOT).toFixed(6), +x.CAM_CNTOM || 1, String(x.INSTL_PRPS_SE_NM || '').slice(0, 12)]
  },
  lamp: {
    size: 1000,
    url: (key, code, p) => 'https://api.data.go.kr/openapi/tn_pubr_public_scrty_lmp_api?' + new URLSearchParams({ serviceKey: key, pageNo: String(p), numOfRows: '1000', type: 'json', insttCode: code }),
    pick: (x) => [+(+x.latitude).toFixed(6), +(+x.longitude).toFixed(6), +x.installationCo || 1]
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = String(process.env.TAGO_API_KEY || process.env.DATA_GO_KR_KEY || '').trim();
  if (req.query.rg !== undefined) {
    const codes = CODES[String(req.query.rg).trim().slice(0, 40)] || [];
    res.setHeader('Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json({ ok: codes.length > 0, codes, status: codes.length ? undefined : 'NO_REGION' });
  }
  const kind = KIND[req.query.kind], code = String(req.query.code || ''), page = parseInt(req.query.page, 10) || 1;
  if (!kind || !/^\d{7}$/.test(code) || page < 1 || page > 500) return res.status(400).json({ ok: false, error: '요청이 올바르지 않아요.' });
  if (!key) return res.status(200).json({ ok: false, status: 'NO_KEY' });
  try {
    const b = body(await getJson(kind.url(key, code, page)));
    let noPos = 0;
    const items = b.items.map(kind.pick).filter((x) => { if (pos(x[0], x[1])) return true; noPos++; return false; });
    res.setHeader('Cache-Control', 'public, s-maxage=604800');
    return res.status(200).json({ ok: true, total: b.total, pages: Math.max(1, Math.ceil(b.total / kind.size)), items, noPos });
  } catch (e) {
    return res.status(200).json({ ok: false, status: 'ERROR' });
  }
};
