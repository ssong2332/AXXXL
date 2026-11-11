// GET /api/period?zip=41111&ids=정책번호,정책번호   정책마다 공고 원문을 열어 접수 기간을 읽는다 (한 번에 12건까지)
//  - 온통청년에 등록된 접수 기간은 자리만 채운 값이 많아서(2026-11-11 점검), 마감일은 공고 원문에서 읽은 것만 쓴다.
//  - 규칙으로만 읽는다(AI 없음). 읽지 못하면 못 읽은 이유를 돌려주고, 화면은 '확인 필요'로 보여 준다.
//  - 공고 주소는 등록 자료의 신청·참고 주소 중 첫 화면이 아닌 것만 연다. 내부망 주소는 막는다(_open.js getPage).
'use strict';

const O = require('./_open.js');
const S = require('../support-core.js');
const support = require('./support.js');

async function readOne(it) {
  const urls = (it.notices || []).slice(0, 2);
  if (!urls.length) return { state: 'none', why: 'nolink' };
  let miss = null;
  for (const url of urls) {
    try {
      const page = await O.getPage(url, 8000);
      const r = S.readNotice(S.htmlText(page.html), it);
      if (r.state === 'found' || r.state === 'always') return Object.assign({ url }, r);
      if (!miss || miss.why === 'unreachable') miss = { state: 'none', why: r.why, line: r.line, url };
    } catch (e) { if (!miss) miss = { state: 'none', why: 'unreachable', url }; }
  }
  return miss;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const zip = String(req.query.zip || ''), ids = String(req.query.ids || '').split(',').filter((x) => /^\w{6,40}$/.test(x)).slice(0, 12);
  if (!/^\d{5}$/.test(zip) || !ids.length) return O.send(res, 400, { ok: false, error: '요청을 확인해 주세요.' });
  const key = process.env.YOUTH_API_KEY;
  if (!key) return O.send(res, 200, { ok: false, reason: 'nokey' });
  if (O.limited(req, 'period', 240, 60000)) return O.send(res, 429, { ok: false, error: '잠시 뒤 다시 시도해 주세요.' });
  try {
    const c = await O.cached('youth:' + zip, 6 * 3600e3, () => support.loadZip(zip, key));
    const byId = new Map(c.value.items.map((it) => [it.id, it])), notices = {};
    await Promise.all(ids.map(async (id) => {
      const it = byId.get(id); if (!it) return;
      // 같은 정책은 지역이 달라도 공고가 같으므로 정책 번호로 12시간 기억한다
      try { notices[id] = (await O.cached('period:' + id, 12 * 3600e3, () => readOne(it))).value; } catch (e) { notices[id] = { state: 'none', why: 'unreachable' }; }
    }));
    return O.send(res, 200, { ok: true, notices }, 'public, s-maxage=3600');
  } catch (e) {
    return O.send(res, 502, { ok: false, reason: 'upstream' });
  }
};
