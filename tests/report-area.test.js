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

// ---------- T-21: PR #37 리뷰 반영 (2026-11-12) ----------
// 리뷰 원문: "시·군·구 미선택 및 서로 다른 지역 값이 섞인 상태에 대한 테스트를 추가해 주세요"
test('T-21 reportArea: 일반 도·강원 등에서 시·군·구를 아직 안 골랐으면 확인 필요(null)', () => {
  for (const s of ['경상북도', '충청남도', '강원특별자치도', '전북특별자치도']) {
    for (const g of ['', undefined, '  ']) {
      const r = E.reportArea(s, g);
      assert.equal(r.inArea, null, s + '/' + g);
      assert.match(r.reason, /시·군·구/);
    }
  }
});
test('T-21 reportArea: 시·도와 맞지 않는 시·군·구(경상북도 + 서울 구 이름)는 확인 필요(null)', () => {
  for (const g of ['관악구', '노원구', '중구']) {
    const r = E.reportArea('경상북도', g);
    assert.equal(r.inArea, null, g);
    assert.match(r.reason, /맞지 않/);
  }
  assert.equal(E.reportArea('강원특별자치도', '마포구').inArea, null);
});
test('T-21 reportArea: 경계 — 도의 정상 값(시, 시 일반구, 군)은 그대로 판정', () => {
  assert.equal(E.reportArea('경상북도', '포항시 남구').inArea, true);
  assert.equal(E.reportArea('충청남도', '천안시').inArea, true);
  assert.equal(E.reportArea('경상북도', '청송군').inArea, false);
  assert.equal(E.reportArea('강원특별자치도', '홍천군').inArea, null);
  // 광역시·경기·세종·제주는 시·군·구와 상관없이 전역 대상
  assert.equal(E.reportArea('부산광역시', '').inArea, true);
  assert.equal(E.reportArea('부산광역시', '관악구').inArea, true);
});
test('T-21 deadlines: 시·군·구 미선택 도는 금액이 커도 required=null', () => {
  const S = { contract: '2026-11-01', move: '2026-11-10', term: 2, deposit: 9000, rent: 80, sido: '경상북도', gu: '관악구' };
  assert.equal(E.deadlines(S).report.required, null);
});

const APP = require('node:fs').readFileSync(require('node:path').join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
test('T-21 지역 선택: 시·도를 바꾸면 S.gu도 새 시·군·구(없으면 빈 값)로 맞춘다 — 이전 구가 남지 않음', () => {
  const a = APP.indexOf("if (w === 'sido')"), b = APP.indexOf('save(); render(true);', a);
  const body = APP.slice(a, b);
  assert.doesNotMatch(body, /if \(S\.zip\) S\.gu = S\.sgg;/, '시·군·구가 정해졌을 때만 바꾸면 이전 구가 남는다');
  assert.match(body, /S\.gu = S\.zip \? S\.sgg : ''/);
});
test('T-21 물어보기(qaAnswer): 전월세 답이 false/null을 구분하고 false 이유는 rep.reason을 쓴다', () => {
  const a = APP.indexOf('[/전월세|임대차 ?신고/'), b = APP.indexOf('[/전입/', a);
  const body = APP.slice(a, b);
  assert.match(body, /rep\.required === null/, 'null(확인 필요) 분기');
  assert.doesNotMatch(body, /'보증금 6천만 원 이하, 월세 30만 원 이하라 전월세 신고 대상이 아니에요/, '금액 이유를 고정 문구로 말하지 않는다');
  assert.match(body, /esc\(rep\.reason\) \+ '라 전월세 신고 대상이 아니에요/);
});
test('T-21 물어보기(qaAnswer): 확정일자 답도 null이면 "대상이 아니라서"라고 하지 않는다', () => {
  const a = APP.indexOf('[/확정일자/'), b = APP.indexOf('[/전월세|임대차 ?신고/', a);
  assert.match(APP.slice(a, b), /rep\.required === null/);
});
test('T-21 내 계약: 전월세 신고 칸은 true=기한, false=대상 아님, null=확인 필요', () => {
  assert.match(APP, /R\.report\.required === null \? '확인 필요' : R\.report\.required \? md\(R\.report\.due\) \+ '까지' : '대상 아님'/);
});

// ADR-0004 (2026-11-12 사용자 답 "승인 (Recommended)") — 이름 표로 소속 판단
const REGIONS_SRC = require('node:fs').readFileSync(require('node:path').join(__dirname, '../demo/data/regions.js'), 'utf8');
const REGIONS = JSON.parse(REGIONS_SRC.match(/var R = (\[.*?\]\]\]);/s)[1]);
test('T-21 ADR-0004: 광주 단독 구(전남광주통합특별시 + 광산구·동구)는 대상 지역(true) — T-18 회귀 없음', () => {
  assert.equal(E.reportArea('전남광주통합특별시', '광산구').inArea, true);
  assert.equal(E.reportArea('전남광주통합특별시', '동구').inArea, true);
});
test('T-21 ADR-0004: 다른 시·도의 정상 이름이 섞이면 확인 필요(경상북도 + 보은군·천안시)', () => {
  for (const g of ['보은군', '천안시']) {
    const r = E.reportArea('경상북도', g);
    assert.equal(r.inArea, null, g);
    assert.equal(r.reason, '시·도와 시·군·구가 맞지 않음');
  }
});
test('T-21 ADR-0004: 같은 이름 두 시·도 — 경상남도 고성군 false, 강원 고성군 null', () => {
  assert.equal(E.reportArea('경상남도', '고성군').inArea, false);
  assert.equal(E.reportArea('강원특별자치도', '고성군').inArea, null);
});
test('T-21 ADR-0004: engine.js 이름 표(reportAreaSgg)는 regions.js의 7개 시·도 목록과 같다', () => {
  const T = E.reportAreaSgg;
  assert.ok(T && typeof T === 'object', 'reportAreaSgg 없음');
  const want = ['충청북도', '충청남도', '경상북도', '경상남도', '강원특별자치도', '전북특별자치도', '전남광주통합특별시'];
  assert.deepEqual(Object.keys(T).sort(), want.slice().sort());
  let n = 0;
  for (const s of want) {
    const src = REGIONS.find((r) => r[0] === s)[1].map((x) => x[1]);
    assert.deepEqual(T[s].slice().sort(), src.slice().sort(), s);
    n += T[s].length;
  }
  assert.equal(n, 136);
});
