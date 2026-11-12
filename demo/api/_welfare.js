// GET /api/welfare?sido=경기도&sgg=수원시 장안구   복지로에 등록된 청년 대상 복지서비스
//  - 지자체복지서비스(한국사회보장정보원): 내 시군구 사업 + 시도 전체 사업
//  - 중앙부처복지서비스: 전국 공통 사업 중 주거·생활지원·서민금융 주제
//  - 키는 DATA_GO_KR_KEY. 자격은 판정하지 않고 목록과 복지로 상세 주소만 준다.
'use strict';

const O = require('./_open.js');
const REGIONS = require('../data/regions.js');
const SIDO = REGIONS.map((r) => r[0]);
const THEMES = /주거|생활지원|서민금융/;

function safe(u) { return /^https:\/\/www\.bokjiro\.go\.kr\//.test(u) ? u : ''; }

async function loadLocal(sido, key) {
  const xml = await O.getText('https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist?serviceKey=' + key + '&pageNo=1&numOfRows=500&lifeArray=004&ctpvNm=' + encodeURIComponent(sido), 20000);
  if (O.tag(xml, 'resultCode') !== '0') throw new Error('bad result');
  return O.blocks(xml, 'servList').map((b) => ({
    id: O.tag(b, 'servId'), name: O.tag(b, 'servNm'), sum: O.tag(b, 'servDgst').slice(0, 260), sgg: O.tag(b, 'sggNm'), dept: O.tag(b, 'bizChrDeptNm'),
    how: O.tag(b, 'aplyMtdNm'), cycle: O.tag(b, 'sprtCycNm'), kind: O.tag(b, 'srvPvsnNm'), theme: O.tag(b, 'intrsThemaNmArray'), upd: O.tag(b, 'lastModYmd'), url: safe(O.tag(b, 'servDtlLink'))
  }));
}
async function loadNational(key) {
  const xml = await O.getText('https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001?serviceKey=' + key + '&callTp=L&pageNo=1&numOfRows=500&srchKeyCode=001&lifeArray=004', 20000);
  if (O.tag(xml, 'resultCode') !== '0') throw new Error('bad result');
  return O.blocks(xml, 'servList').map((b) => ({
    id: O.tag(b, 'servId'), name: O.tag(b, 'servNm'), sum: O.tag(b, 'servDgst').slice(0, 260), sgg: '', dept: [O.tag(b, 'jurMnofNm'), O.tag(b, 'jurOrgNm')].filter(Boolean).join(' '),
    how: O.tag(b, 'onapPsbltYn') === 'Y' ? '온라인 신청 가능' : '', cycle: O.tag(b, 'sprtCycNm'), kind: O.tag(b, 'srvPvsnNm'), theme: O.tag(b, 'intrsThemaArray'), tel: O.tag(b, 'rprsCtadr'), upd: O.tag(b, 'svcfrstRegTs'), url: safe(O.tag(b, 'servDtlLink'))
  })).filter((x) => THEMES.test(x.theme));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sido = String(req.query.sido || ''), sgg = String(req.query.sgg || '').slice(0, 30);
  if (SIDO.indexOf(sido) < 0) return O.send(res, 400, { ok: false, error: '지역을 다시 골라 주세요.' });
  const key = O.portalKey();
  if (!key) return O.send(res, 200, { ok: false, reason: 'nokey' });
  if (O.limited(req, 'welfare', 180, 60000)) return O.send(res, 429, { ok: false, error: '잠시 뒤 다시 시도해 주세요.' });
  try {
    const [loc, nat] = await Promise.all([O.cached('wf:' + sido, 12 * 3600e3, () => O.retry(() => loadLocal(sido, key), 2)), O.cached('wf:national', 12 * 3600e3, () => O.retry(() => loadNational(key), 2))]);
    // 복지로는 시군구 이름을 '수원시'처럼 시 단위로 준다
    const names = [sgg, sgg.split(' ')[0]].filter(Boolean);
    const mine = loc.value.filter((x) => names.indexOf(x.sgg) >= 0), wide = loc.value.filter((x) => !x.sgg);
    return O.send(res, 200, { ok: true, sido, sgg, local: mine, sidoWide: wide, national: nat.value, fetchedAt: O.iso(Math.min(loc.at, nat.at)), stale: loc.stale || nat.stale, source: '복지로 지자체·중앙부처 복지서비스 (한국사회보장정보원)' }, 'public, s-maxage=3600');
  } catch (e) {
    return O.send(res, 502, { ok: false, reason: 'upstream', error: '복지 서비스 목록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
  }
};
