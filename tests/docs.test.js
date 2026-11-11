// 서류함 (F-06): 지원 공고의 서류 이름 → 서류함 칸, 지원별 준비 현황
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');
const RC = require('../demo/rules-core.js');
const SEED = require('../demo/rules/seed.js');

const PROGS = RC.publicView(SEED, new Date(2026, 10, 11)).programs;
const rent = PROGS.find((p) => p.id === 'rent');
const move = PROGS.find((p) => p.id === 'move');

test('서류 칸: 공고에 흔한 이름을 서류함 칸으로 연결', () => {
  assert.equal(E.docSlot('임대차계약서'), 'contract');
  assert.equal(E.docSlot('주민등록등본'), 'resident');
  assert.equal(E.docSlot('최근 3개월 월세 이체 내역'), 'rentpay');
  assert.equal(E.docSlot('본인 명의 통장 사본'), 'bank');
});
test('서류 칸: 확정일자가 붙은 계약서는 일반 계약서 칸이 아니라 확정일자 칸 (경계)', () => {
  assert.equal(E.docSlot('임대차계약서 (확정일자 포함)'), 'fixed');
});
test('서류 칸: 계약금·잔금 이체확인증은 월세 이체 칸이 아님 (경계)', () => {
  assert.equal(E.docSlot('계약금 이체확인증'), 'deposit');
  assert.equal(E.docSlot('잔금 이체확인증'), 'balance');
});
test('서류 칸: 서류함에 칸이 없는 서류는 null', () => {
  assert.equal(E.docSlot('건강보험료 납부확인서'), null);
  assert.equal(E.docSlot('중개보수 영수증'), null);
  assert.equal(E.docSlot(''), null);
  assert.equal(E.docSlot(undefined), null);
});

test('준비 현황: 청년월세 서류 5개 중 넣어 둔 칸 3개면 3/5', () => {
  const r = E.docReadiness(rent.docs, { fixed: 1, rentpay: 2, bank: 1 });
  assert.equal(r.total, 5);
  assert.equal(r.ready, 3);
  assert.deepEqual(r.items.map((x) => x.ready), [true, true, true, false, false]);
});
test('준비 현황: 일반 계약서만 있으면 확정일자 계약서는 준비 안 됨', () => {
  const r = E.docReadiness(rent.docs, { contract: 1 });
  assert.equal(r.ready, 0);
  assert.equal(r.items[0].slot, 'fixed');
});
test('준비 현황: 칸이 없는 서류는 준비 수에 넣지 않고 slot null로 표시', () => {
  const r = E.docReadiness(move.docs, { contract: 1, resident: 1, etc: 3 });
  assert.equal(r.total, 4);
  assert.equal(r.ready, 2);
  assert.deepEqual(r.items.filter((x) => x.slot === null).map((x) => x.name), ['중개보수 영수증', '이사비 영수증']);
});
test('준비 현황: 서류가 하나도 없거나 목록이 비어도 오류 없이 0', () => {
  assert.deepEqual(E.docReadiness(rent.docs, {}).ready, 0);
  assert.deepEqual(E.docReadiness([], { contract: 1 }), { total: 0, ready: 0, items: [] });
  assert.deepEqual(E.docReadiness(undefined, undefined), { total: 0, ready: 0, items: [] });
});
