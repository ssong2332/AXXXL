// rules-core 지원 자격: 무주택·중복 수혜 입력 반영 (계약·신고 담당 보강, F-03)
// 원칙: 이용자가 값을 넘기지 않으면(관리자 미리보기·페르소나 시뮬레이션) 기존처럼 판정에 영향 없음
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../demo/rules-core.js');
const SEED = require('../demo/rules/seed.js');

const TODAY = new Date(2026, 10, 11);
const P = R.publicView(SEED, TODAY).programs;
const rent = P.find((p) => p.id === 'rent');
const move = P.find((p) => p.id === 'move');
const u = (over) => Object.assign({ age: 25, income: '100', deposit: 500, rent: 45, gu: '관악구' }, over);
const v = (p, over) => R.verdict(R.evalProgram(p, u(over)));

test('무주택: 예면 충족(true)으로 표시', () => {
  const x = R.evalProgram(rent, u({ homeless: 'yes' }));
  assert.equal(x.res.find((r) => r.type === 'homeless').ok, true);
  assert.equal(R.verdict(x), '해당 가능');
});
test('무주택: 아니오면 해당 안 됨', () => {
  assert.equal(v(rent, { homeless: 'no' }), '해당 안 됨');
  assert.equal(v(move, { homeless: 'no' }), '해당 안 됨');
});
test('무주택: 모름이라고 답하면 확인 필요', () => {
  assert.equal(v(rent, { homeless: 'unknown' }), '확인 필요');
});
test('무주택: 값을 넘기지 않으면 기존처럼 해당 가능 (관리자·시뮬레이션 호환)', () => {
  assert.equal(v(rent, {}), '해당 가능');
});
test('중복 수혜: 승인본에 함께 받을 수 없는 지원이 있으면 조건이 생긴다', () => {
  assert.ok(rent.exclusions.length > 0);
  assert.ok(rent.conds.some((c) => c.type === 'dup'));
  assert.ok(!move.conds.some((c) => c.type === 'dup'));
});
test('중복 수혜: 받고 있으면 해당 안 됨, 모름이면 확인 필요, 아니면 해당 가능', () => {
  assert.equal(v(rent, { dup: 'yes' }), '해당 안 됨');
  assert.equal(v(rent, { dup: 'unknown' }), '확인 필요');
  assert.equal(v(rent, { dup: 'no', homeless: 'yes' }), '해당 가능');
});
test('중복 수혜: 값을 넘기지 않으면 판정에 영향 없음', () => {
  assert.equal(v(rent, {}), '해당 가능');
});
test('승인본 점검: 추가한 중복 수혜 근거 문장이 원문에 있다', () => {
  const f = SEED.notices.rent.fields.exclusions;
  assert.ok(R.inSource(f.evidence, SEED.notices.rent.sourceText));
});
