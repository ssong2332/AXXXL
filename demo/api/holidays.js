// GET /api/holidays?year=2026   그 해 공휴일 (한국천문연구원 특일 정보). 접수 마감일이 쉬는 날인지 알려 주는 데 쓴다.
//  - 키는 DATA_GO_KR_KEY. 없으면 { ok:false, reason:'nokey' } — 화면은 주말만 따진다.
'use strict';

const O = require('./_open.js');

async function load(year, key) {
  const j = await O.getJson('https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?ServiceKey=' + key + '&solYear=' + year + '&numOfRows=100&_type=json', 15000);
  const body = j && j.response && j.response.body; if (!body) throw new Error('bad response');
  let it = body.items && body.items.item; it = Array.isArray(it) ? it : it ? [it] : [];
  return it.filter((x) => x.isHoliday === 'Y').map((x) => ({ date: String(x.locdate), name: String(x.dateName || '').slice(0, 30) }));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const year = +req.query.year;
  if (!(year >= 2024 && year <= 2030)) return O.send(res, 400, { ok: false, error: '연도를 확인해 주세요.' });
  const key = O.portalKey();
  if (!key) return O.send(res, 200, { ok: false, reason: 'nokey' });
  try {
    const c = await O.cached('holi:' + year, 7 * 86400e3, () => O.retry(() => load(year, key), 2));
    return O.send(res, 200, { ok: true, year, items: c.value, source: '특일 정보 (한국천문연구원)' }, 'public, s-maxage=86400');
  } catch (e) {
    return O.send(res, 502, { ok: false, reason: 'upstream' });
  }
};
