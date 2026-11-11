// 계약·신고 계산 엔진 단위 테스트 (F-02 신고, F-04/F-05 기한, F-01 입력) + 지원 자격 연결(F-03, rules-core)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');
const RC = require('../demo/rules-core.js');
const SEED = require('../demo/rules/seed.js');

const base = {
  gu: '관악구', deposit: 1000, rent: 45, contract: '2026-11-14', move: '2026-12-01', term: 2,
  birth: '2002-03', income: '150', homeless: 'yes', dup: 'no'
};
const run = (over) => E.deadlines(Object.assign({}, base, over));
// 지원 자격: 승인본(seed) → toProgram → evalProgram. 모집 상태가 날짜에 따라 바뀌지 않게 기준일 고정
const TODAY = new Date(2026, 10, 11);
const PROGS = RC.publicView(SEED, TODAY).programs;
const judge = (over, id) => RC.verdict(RC.evalProgram(PROGS.find((p) => p.id === id), E.toUser(Object.assign({}, base, over))));

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
  assert.match(R.movein.url, /^https:\/\//);
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

// ---------- F-01 입력 ----------
test('입력 검사: 보증금 음수·입주일 없음은 오류, 정상 값은 오류 없음', () => {
  const v = E.validate(Object.assign({}, base, { deposit: -1, move: '' }));
  assert.ok(v.deposit); assert.ok(v.move);
  assert.deepEqual(E.validate(base), {});
});
test('toUser: 계약일 기준 만 나이와 입력값을 rules-core 형식으로 넘긴다', () => {
  assert.deepEqual(E.toUser(base), { age: 24, income: '150', deposit: 1000, rent: 45, gu: '관악구', homeless: 'yes', dup: 'no' });
  assert.equal(E.toUser(Object.assign({}, base, { birth: '2002-11' })).age, null);
});
// 무주택·중복 수혜: 값이 없음 = 아직 답하지 않음, 'unknown' = 모른다고 답함. 둘을 섞지 않는다 (11/11, 예전 사용자 '확인 필요' 문제)
test('toUser: 무주택·중복 수혜를 답하지 않았으면 unknown으로 채우지 않고 그대로(undefined) 넘긴다', () => {
  const noAnswer = Object.assign({}, base); delete noAnswer.homeless; delete noAnswer.dup;
  const u = E.toUser(noAnswer);
  assert.equal(u.homeless, undefined); assert.equal(u.dup, undefined);
  // '아직 안 정함'(빈칸)이나 null로 저장된 값도 답 없음
  const blank = E.toUser(Object.assign({}, base, { homeless: '', dup: null }));
  assert.equal(blank.homeless, undefined); assert.equal(blank.dup, undefined);
});
test('toUser: yes·no·unknown으로 답했으면 그대로 넘긴다', () => {
  for (const a of ['yes', 'no', 'unknown']) {
    const u = E.toUser(Object.assign({}, base, { homeless: a, dup: a }));
    assert.equal(u.homeless, a); assert.equal(u.dup, a);
  }
});

// ---------- F-03 지원 자격 (rules-core 연결) ----------
test('자격: 조건을 모두 충족하면 해당 가능', () => {
  assert.equal(judge({}, 'rent'), '해당 가능');
});
test('자격: 만 40세면 해당 안 됨', () => {
  assert.equal(judge({ birth: '1986-01' }, 'rent'), '해당 안 됨');
});
test('자격: 소득 모름이면 확인 필요', () => {
  assert.equal(judge({ income: 'unknown' }, 'rent'), '확인 필요');
});
test('자격: 생일 달이라 나이를 모르면 확인 필요', () => {
  assert.equal(judge({ birth: '2002-11' }, 'rent'), '확인 필요');
});
test('자격: 지원마다 모집 상태·선정 방식·원문 링크·승인 기준일이 있다', () => {
  for (const p of PROGS) {
    assert.ok(p.status, p.id); assert.ok(p.select); assert.match(p.url, /^https:\/\//); assert.ok(p.basis);
  }
});
test('자격: 무주택 아님이면 해당 안 됨', () => {
  assert.equal(judge({ homeless: 'no' }, 'rent'), '해당 안 됨');
});
test('자격: 유사 지원을 이미 받으면 청년월세는 해당 안 됨', () => {
  assert.equal(judge({ dup: 'yes' }, 'rent'), '해당 안 됨');
});
// 자격 판정 화면 표시(engine.verdict): 답하지 않은 무주택·중복 수혜는 '답하면 판정'
const show = (over, id) => E.verdict(RC.evalProgram(PROGS.find((p) => p.id === id), E.toUser(Object.assign({}, base, over))));
test('화면 판정: 모두 충족이면 해당 가능', () => {
  assert.equal(show({}, 'rent'), '해당 가능');
});
test('화면 판정: 무주택·중복 수혜를 답하지 않았으면 답하면 판정', () => {
  assert.equal(show({ homeless: undefined }, 'rent'), '답하면 판정');
  assert.equal(show({ dup: undefined }, 'rent'), '답하면 판정');
  assert.equal(show({ homeless: undefined }, 'move'), '답하면 판정');
});
test('화면 판정: 중복 수혜 조건이 없는 지원은 dup을 안 답해도 해당 가능', () => {
  assert.equal(show({ dup: undefined }, 'move'), '해당 가능');
});
test('화면 판정: 해당 안 됨이 답하면 판정보다 먼저', () => {
  assert.equal(show({ homeless: undefined, birth: '1980-01' }, 'rent'), '해당 안 됨');
});
test('화면 판정: 다른 조건이 모르면(소득 모름) 확인 필요가 답하면 판정보다 먼저', () => {
  assert.equal(show({ homeless: undefined, income: 'unknown' }, 'rent'), '확인 필요');
  assert.equal(show({ homeless: 'unknown' }, 'rent'), '확인 필요');
});
test('자격: 무주택·중복 수혜를 답하지 않았으면 판정에서 빼고(해당 가능), 모른다고 답했으면 확인 필요', () => {
  assert.equal(judge({ homeless: undefined, dup: undefined }, 'rent'), '해당 가능');
  assert.equal(judge({ homeless: 'unknown' }, 'rent'), '확인 필요');
  assert.equal(judge({ dup: 'unknown' }, 'rent'), '확인 필요');
});
