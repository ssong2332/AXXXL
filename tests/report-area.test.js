// T-18: 전월세 신고 대상 지역 판정 (부동산 거래신고법 시행령 제4조의3 — 특별자치시·특별자치도·시·군(광역시·경기도의 군만)·구)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');

const base = { deposit: 1000, rent: 45, contract: '2026-11-14', move: '2026-12-01', term: 2 };
const run = (over) => E.deadlines(Object.assign({}, base, over));
const area = (sido, gu) => E.reportArea(sido, gu);

// ---------- 판정표 각 행 ----------
test('광역시: 부산 해운대구는 대상 지역', () => { assert.equal(area('부산광역시', '해운대구').inArea, true); });
test('광역시의 군: 부산 기장군·인천 강화군도 대상 지역', () => {
  assert.equal(area('부산광역시', '기장군').inArea, true);
  assert.equal(area('인천광역시', '강화군').inArea, true);
});
test('서울: 관악구 대상 지역', () => { assert.equal(area('서울특별시', '관악구').inArea, true); });
test('경기도의 군: 가평군도 대상 지역', () => { assert.equal(area('경기도', '가평군').inArea, true); });
test('세종·제주: 대상 지역', () => {
  assert.equal(area('세종특별자치시', '세종시').inArea, true);
  assert.equal(area('제주특별자치도', '서귀포시').inArea, true);
});
test('일반 도의 시·일반구: 청주시 상당구, 경산시는 대상 지역', () => {
  assert.equal(area('충청북도', '청주시 상당구').inArea, true);
  assert.equal(area('경상북도', '경산시').inArea, true);
});
test('일반 도의 군: 충북 보은군은 대상 지역 아님(false)', () => {
  const r = area('충청북도', '보은군');
  assert.equal(r.inArea, false);
  assert.match(r.reason, /군/);
});
test('강원·전북특별자치도·전남광주통합특별시의 군: 확인 필요(null)', () => {
  assert.equal(area('강원특별자치도', '홍천군').inArea, null);
  assert.equal(area('전북특별자치도', '완주군').inArea, null);
  assert.equal(area('전남광주통합특별시', '담양군').inArea, null);
});
test('강원·전북특별자치도·통합특별시의 시·구: 대상 지역', () => {
  assert.equal(area('강원특별자치도', '춘천시').inArea, true);
  assert.equal(area('전북특별자치도', '전주시 완산구').inArea, true);
});

// ---------- 경계·예외 ----------
test('시도 없음: 서울 구 이름이면 서울로 본다(이전 데이터 호환)', () => { assert.equal(area('', '마포구').inArea, true); });
test('시도 없음·서울 구 아님: 확인 필요(null)', () => {
  assert.equal(area('', '수원시').inArea, null);
  assert.equal(area(undefined, undefined).inArea, null);
});
test('목록에 없는 시도: 확인 필요(null), 던지지 않음', () => {
  assert.equal(area('어딘가도', '무슨군').inArea, null);
  assert.doesNotThrow(() => area(null, 123));
});

// ---------- deadlines 연결 (금액 기준 그대로) ----------
test('deadlines: 부산 + 월세 45만이면 신고 대상', () => {
  const R = run({ sido: '부산광역시', gu: '해운대구' });
  assert.equal(R.report.required, true);
  assert.equal(R.report.reason, '월세 30만 원 초과');
});
test('deadlines: 부산이어도 금액 기준 이하면 대상 아님', () => {
  const R = run({ sido: '부산광역시', gu: '해운대구', deposit: 5000, rent: 30 });
  assert.equal(R.report.required, false);
});
test('deadlines: 일반 도의 군은 금액이 커도 대상 아님(false)이고 이유는 지역', () => {
  const R = run({ sido: '경상남도', gu: '함안군', deposit: 9000, rent: 60 });
  assert.equal(R.report.required, false);
  assert.match(R.report.reason, /군/);
});
test('deadlines: 강원 군은 확인 필요(null)', () => {
  assert.equal(run({ sido: '강원특별자치도', gu: '홍천군' }).report.required, null);
});

// ---------- 화면: '확인 필요'(null)를 '대상 아님'으로 말하지 않는다 ----------
const fs = require('node:fs');
const path = require('node:path');
const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
test('타임라인: 신고 대상 여부를 모르면(null) "확정일자 받기(대상 아님)" 대신 확인 할 일을 둔다', () => {
  assert.match(HTML, /rep\.required === null\s*\)\s*rt\.push\(\{ id: 'rp', title: '전월세 신고 대상인지 확인'/);
});
test('자격 판정: 신고 대상 여부를 모르면(null) 주민센터 확인과 기한을 안내한다', () => {
  assert.match(HTML, /rp\.required === null \? '<p class="s13 sub">신고 대상 지역인지 행정복지센터에 확인하세요/);
});
test('첫 실행 길잡이 2단계: null이면 "대상은 아니에요"라고 말하지 않는다', () => {
  assert.match(HTML, /R\.report\.required === null \? '전월세 신고 대상 지역인지 확인이 필요해요/);
});

// ---------- 코치(coach-core, 다른 팀원 영역 — 수정 없이) 문장이 새 이유와 자연스럽게 이어지는지 ----------
const C = require('../demo/coach-core.js');
const RC2 = require('../demo/rules-core.js');
const SEED2 = require('../demo/rules/seed.js');
function coachFacts(over) {
  const progs = Object.values(SEED2.notices).map((n) => RC2.toProgram(n, new Date('2026-11-10')));
  const cards = SEED2.cards.concat(RC2.noticeCards(progs));
  const facts = Object.assign({ today: '2026.11.10', move: '2026.11.11', end: '2028.11.10', noticeBy: '2028.09.10', reportDue: '2026.11.26', moveinDue: '2026.11.25', deposit: 1000, rent: 45, fee: 7, brokerBase: 55000000, brokerCap: 220000, programList: [] }, over);
  return { cards, facts };
}
test('코치: 일반 도의 군(false)이면 "…소재라 전월세 신고 대상이 아니에요"로 답한다', () => {
  const D = run({ sido: '충청북도', gu: '보은군' });
  const { cards, facts } = coachFacts({ reportRequired: D.report.required, reportReason: D.report.reason });
  const a = C.answer({ q: '전월세 신고 해야 해?', cards, facts });
  assert.ok(a.text.includes('충청북도 보은군) 소재라 전월세 신고 대상이 아니에요'), a.text);
});
test('코치: 강원 군(null)이면 판정하지 못했다고 하고 기한을 알려 준다', () => {
  const D = run({ sido: '강원특별자치도', gu: '홍천군' });
  const { cards, facts } = coachFacts({ reportRequired: D.report.required, reportReason: D.report.reason });
  const a = C.answer({ q: '전월세 신고 해야 해?', cards, facts });
  assert.ok(a.text.includes('판정하지 못했어요') && a.text.includes('홍천군') && a.text.includes('2026.11.26'), a.text);
  assert.ok(!a.text.includes('신고 대상이 아니에요'));
});

// 리뷰 권고 #1(2026-11-12): reason에는 사용자가 고른 시도·시군구 이름이 들어가므로 HTML에 넣을 때 esc를 거친다
test('null 안내 두 곳(타임라인 할 일·길잡이 2단계)은 reason을 esc로 감싼다', () => {
  const H = require('node:fs').readFileSync(require('node:path').join(__dirname, '../demo/app.html'), 'utf8');
  assert.match(H, /판정하지 못했어요\(' \+ esc\(rep\.reason\) \+ '\)/);
  assert.match(H, /확인이 필요해요\(' \+ esc\(R\.report\.reason\) \+ '\)/);
  assert.doesNotMatch(H, /판정하지 못했어요\(' \+ rep\.reason/);
});
