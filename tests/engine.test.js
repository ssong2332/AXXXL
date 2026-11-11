// T-02 계약·신고 계산 엔진 단위 테스트 (F-02 신고, F-03 자격, F-04/F-05 기한)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');
const RULES = require('../demo/rules.js');

const base = {
  gu: '관악구', deposit: 1000, rent: 45, contract: '2026-11-14', move: '2026-12-01', term: 2,
  birth: '2002-03', income: '150', homeless: 'yes', dup: 'no'
};
const run = (over) => E.evaluate(Object.assign({}, base, over), RULES);
const prog = (R, id) => R.programs.find((x) => x.p.id === id);

// ---------- F-02 전월세 신고 ----------
test('신고: 보증금 6,000만·월세 30만 정확히는 대상 아님 (경계)', () => {
  assert.equal(run({ deposit: 6000, rent: 30 }).report.required, false);
});
test('신고: 보증금 6,001만이면 대상', () => {
  const R = run({ deposit: 6001, rent: 0 });
  assert.equal(R.report.required, true);
  assert.equal(R.report.reason, '보증금 6천만 원 초과');
});
test('신고: 월세 31만이면 대상, 기한은 계약일+30일 (월 넘김)', () => {
  const R = run({ deposit: 500, rent: 31, contract: '2026-11-14' });
  assert.equal(R.report.required, true);
  assert.equal(R.report.reason, '월세 30만 원 초과');
  assert.equal(E.iso(R.report.due), '2026-12-14');
});
test('신고: 서울 밖 시군구면 판정하지 않고 확인 필요(null)', () => {
  assert.equal(run({ gu: '수원시', rent: 50 }).report.required, null);
});
test('신고: 결과에 근거 링크와 기준일이 있다', () => {
  const R = run({});
  assert.match(R.report.url, /^https:\/\//);
  assert.ok(R.report.basis);
});

// ---------- F-04 / F-05 기한 ----------
test('전입신고 법정 기한은 입주일+14일 (연 넘김)', () => {
  assert.equal(E.iso(run({ move: '2026-12-25' }).movein.due), '2027-01-08');
});
test('계약 만료 = 입주일 + 계약 기간 − 1일', () => {
  assert.equal(E.iso(run({ move: '2026-12-01', term: 2 }).end), '2028-11-30');
});
test('계약 만료: 2/29 입주 2년이면 2/28 만료 (윤년 경계)', () => {
  assert.equal(E.iso(run({ move: '2028-02-29', term: 2 }).end), '2030-02-28');
});
test('갱신 통지 마감 = 만료 2개월 전 같은 날', () => {
  assert.equal(E.iso(run({ move: '2026-12-01', term: 2 }).renewDue), '2028-09-30');
});
test('갱신 통지 마감: 그 달에 같은 날이 없으면 그 달 말일 (4/30 만료 → 2/28)', () => {
  // 입주 2025-05-01, 2년 → 만료 2027-04-30 → 2개월 전 2027-02-30 없음 → 2027-02-28
  assert.equal(E.iso(run({ move: '2025-05-01', term: 2 }).renewDue), '2027-02-28');
});
test('신고 기한이 입주보다 먼저면 early, 아니면 전입신고와 합칠 수 있음(merge)', () => {
  const a = run({ rent: 50, contract: '2026-10-01', move: '2026-12-01' });
  assert.equal(a.report.early, true); assert.equal(a.report.merge, false);
  const b = run({ rent: 50, contract: '2026-11-14', move: '2026-12-01' });
  assert.equal(b.report.early, false); assert.equal(b.report.merge, true);
});

// ---------- 만 나이 ----------
test('만 나이: 생일 달이 지났으면 그대로, 안 지났으면 1살 적게', () => {
  assert.equal(E.age('2002-03', E.parseDate('2026-11-14')), 24);
  assert.equal(E.age('2002-12', E.parseDate('2026-11-14')), 23);
});
test('만 나이: 생일 달과 기준 달이 같으면 확정 불가(null)', () => {
  assert.equal(E.age('2002-11', E.parseDate('2026-11-14')), null);
});
test('만 나이: 출생연월이 비었거나 형식이 틀리면 null', () => {
  assert.equal(E.age('', E.parseDate('2026-11-14')), null);
  assert.equal(E.age('2002-13', E.parseDate('2026-11-14')), null);
});

// ---------- F-03 지원 자격 ----------
test('자격: 조건을 모두 충족하면 해당 가능', () => {
  assert.equal(prog(run({}), 'rent').verdict, 'eligible');
});
test('자격: 하나라도 어긋나면 해당 안 됨 (만 40세)', () => {
  assert.equal(prog(run({ birth: '1986-01' }), 'rent').verdict, 'ineligible');
});
test('자격: 모름이 있으면 확인 필요 (소득 모름)', () => {
  assert.equal(prog(run({ income: 'unknown' }), 'rent').verdict, 'check');
});
test('자격: 무주택 아님이면 해당 안 됨, 모름이면 확인 필요', () => {
  assert.equal(prog(run({ homeless: 'no' }), 'rent').verdict, 'ineligible');
  assert.equal(prog(run({ homeless: 'unknown' }), 'rent').verdict, 'check');
});
test('자격: 유사 지원을 이미 받으면 청년월세는 해당 안 됨', () => {
  assert.equal(prog(run({ dup: 'yes' }), 'rent').verdict, 'ineligible');
});
test('자격: 어긋난 조건은 내 값과 함께 남는다', () => {
  const x = prog(run({ rent: 61 }), 'rent');
  const bad = x.res.filter((r) => r.ok === false);
  assert.equal(bad.length, 1);
  assert.match(bad[0].mine, /61만/);
});
test('자격: 지원마다 모집 상태·선정 방식·원문 링크·기준일이 있고, 금액 합산 필드는 없다', () => {
  const R = run({});
  for (const x of R.programs) {
    assert.ok(['모집 중', '마감', '다음 공고 대기'].includes(x.statusLabel), x.p.id);
    assert.ok(x.p.select);
    assert.match(x.p.url, /^https:\/\//);
    assert.ok(x.p.basis);
  }
  assert.equal('total' in R, false);
});
test('자격: 입력값이 이상하면(보증금 음수) 예외 없이 오류 목록을 돌려준다', () => {
  const v = E.validate(Object.assign({}, base, { deposit: -1, move: '' }));
  assert.ok(v.deposit); assert.ok(v.move);
  assert.deepEqual(E.validate(base), {});
});
