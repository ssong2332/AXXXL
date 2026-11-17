// GET /api/period?zip=41111&ids=정책번호,정책번호   정책마다 공고 원문을 열어 접수 기간을 읽는다 (한 번에 12건까지)
//  - 등록된 접수 기간은 믿기 어려워 마감일은 공고 원문에서 읽은 것만 쓴다. 규칙으로만 읽고(AI 없음), 못 읽으면 까닭(why)을 돌려준다.
//  - 등록된 신청·참고 주소 중 첫 화면이 아닌 것만 연다. 내부망 주소는 막는다(_open.js getPage).
//  - 등록 주소가 공고 대신 기관 첫 화면·오류 화면으로 넘어가거나 없어졌으면 dead로 알려 준다(why: 'dead'는 모두 그런 경우).
'use strict';

const O = require('./_open.js');
const S = require('../support-core.js');
const support = require('./_support.js');

// 등록된 공고 주소(셋까지)를 모두 열어 본다. 열면 기관 첫 화면·오류 화면으로 넘어가거나 없어진 주소는 dead에 담아 화면에서 링크로 내지 않게 한다
async function readOne(it, getPage) {
  const urls = (it.notices || []).slice(0, 3);
  if (!urls.length) return { state: 'none', why: 'nolink' };
  const got = await Promise.all(urls.map(async (url) => {
    try {
      const page = await (getPage || O.getPage)(url, 8000);
      if (S.deadPage(url, page.url, page.html)) return { url, dead: true };
      return { url, r: S.readNotice(S.htmlText(page.html), it) };
    } catch (e) { return e && e.gone ? { url, dead: true } : { url }; }
  }));
  const dead = got.filter((g) => g.dead).map((g) => g.url), live = got.filter((g) => !g.dead);
  const tag = (o) => (dead.length ? Object.assign(o, { dead }) : o);
  if (!live.length) return tag({ state: 'none', why: 'dead' });
  const hit = live.filter((g) => g.r && (g.r.state === 'found' || g.r.state === 'always'))[0];
  if (hit) return tag(Object.assign({ url: hit.url }, hit.r));
  // 기간은 못 읽었어도 이 사업 글인 주소를 먼저 쓴다
  const read = live.filter((g) => g.r && g.r.why !== 'unrelated')[0] || live.filter((g) => g.r)[0];
  return tag(read ? { state: 'none', why: read.r.why, line: read.r.line, url: read.url } : { state: 'none', why: 'unreachable', url: live[0].url });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const zip = String(req.query.zip || ''), ids = String(req.query.ids || '').split(',').filter((x) => /^\w{6,40}$/.test(x)).slice(0, 12);
  if (!support.isZip(zip) || !ids.length) return O.send(res, 400, { ok: false, error: '요청을 확인해 주세요.' });
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
module.exports.readOne = readOne;
