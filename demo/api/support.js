// GET /api/support?zip=41111&cat=주거   내 지역 청년 정책 (온통청년 청년정책 API)
//  - zip: 법정동코드 앞 5자리(시군구). cat: 주거 | 금융･복지･문화 | 일자리 | 교육･직업훈련 | 참여･기반
//  - 키는 YOUTH_API_KEY 환경변수. 없으면 { ok:false, reason:'nokey' } 를 돌려주고 화면은 승인된 공고만 보여 준다.
//  - 이용자 정보는 받지 않는다. 지역 코드와 분류만 받는다. 조건 대조는 이용자 기기에서 한다.
'use strict';

const O = require('./_open.js');
const S = require('../support-core.js');
const REGIONS = require('../data/regions.js');

const ZIP = {}, SIDO_SIZE = {}, WHERE = {};
REGIONS.forEach(([sido, list]) => list.forEach(([code, name]) => { ZIP[code] = sido + ' ' + name; WHERE[code] = [sido, name]; SIDO_SIZE[code.slice(0, 2)] = (SIDO_SIZE[code.slice(0, 2)] || 0) + 1; }));
const CATS = S.CATS.map((c) => c[0]);

async function loadZip(zip, key) {
  // 한 번에 1000건을 받으면 응답이 25초를 넘길 때가 있어(2026-11-11 측정) 200건씩 나눠 동시에 받는다
  const SIZE = 200, base = 'https://www.youthcenter.go.kr/go/ythip/getPlcy?rtnType=json&pageSize=' + SIZE + '&zipCd=' + zip + '&apiKeyNm=' + encodeURIComponent(key);
  // 한 쪽이라도 실패하면 목록 전체가 안 나오므로, 쪽마다 세 번까지 다시 부른다
  const pageOf = (n) => O.retry(async () => {
    const j = await O.getJson(base + '&pageNum=' + n, 12000);
    // 끝을 넘긴 쪽은 목록이 비어 올 수 있다. 첫 쪽은 반드시 목록이 있어야 한다
    if (!j || !j.result || (n === 1 && !Array.isArray(j.result.youthPolicyList))) throw new Error('bad response');
    return { list: j.result.youthPolicyList || [], total: +((j.result.pagging || {}).totCount) || 0 };
  }, 3, 400);
  const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  let pages = await Promise.all(range(1, 5).map(pageOf));
  const total = pages[0].total || pages.reduce((n, p) => n + p.list.length, 0), last = Math.min(Math.ceil(total / SIZE), 30);
  if (last > 5) pages = pages.concat(await Promise.all(range(6, last).map(pageOf)));
  const all = [].concat(...pages.map((p) => p.list));
  // 승인된 정책만, 접수가 '마감'으로 등록된 것은 뺀다
  const live = all.filter((p) => p.plcyAprvSttsCd === '0044002' && p.aplyPrdSeCd !== '0057003').map((p) => S.normalize(p, SIDO_SIZE, REGIONS));
  // 같은 기관(최상위 기관 기준)이 같은 이름으로 여러 번 등록한 정책은 가장 최근에 고친 것 하나만 남긴다
  const seen = new Map();
  live.forEach((it) => { const k = it.name + '|' + (it.top || it.org), old = seen.get(k); if (!old || it.upd > old.upd) seen.set(k, it); });
  // 다른 지자체가 '전국 대상'으로 등록해 둔 사업은 뺀다. 내 시·도, 내 시·군·구가 운영하는 사업과 중앙부처 사업만 남긴다
  const merged = Array.from(seen.values()), items = merged.filter((it) => S.forRegion(it, WHERE[zip][0], WHERE[zip][1]));
  return { items, total, closed: all.length - live.length, merged: live.length - merged.length, hidden: merged.length - items.length };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const zip = String(req.query.zip || ''), cat = String(req.query.cat || '주거');
  if (!ZIP[zip]) return O.send(res, 400, { ok: false, error: '지역을 다시 골라 주세요.' });
  if (CATS.indexOf(cat) < 0) return O.send(res, 400, { ok: false, error: '분류를 다시 골라 주세요.' });
  const key = process.env.YOUTH_API_KEY;
  if (!key) return O.send(res, 200, { ok: false, reason: 'nokey' });
  if (O.limited(req, 'support', 180, 60000)) return O.send(res, 429, { ok: false, error: '잠시 뒤 다시 시도해 주세요.' });
  try {
    const c = await O.cached('youth:' + zip, 6 * 3600e3, () => loadZip(zip, key));
    const counts = {}; CATS.forEach((k) => { counts[k] = 0; });
    c.value.items.forEach((it) => { if (it.cat in counts) counts[it.cat]++; });
    return O.send(res, 200, { ok: true, zip, region: ZIP[zip], cat, counts, closed: c.value.closed, hidden: c.value.hidden, items: c.value.items.filter((it) => it.cat === cat), fetchedAt: O.iso(c.at), stale: c.stale, source: '온통청년 청년정책 (한국고용정보원)' }, 'public, s-maxage=1800');
  } catch (e) {
    console.warn('[support] 온통청년 호출 실패:', e && e.name === 'AbortError' ? '시간 초과' : String((e && e.message) || e).slice(0, 80)); // 주소·키는 남기지 않는다
    return O.send(res, 502, { ok: false, reason: 'upstream', error: '정책 목록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
  }
};
module.exports.loadZip = loadZip;
