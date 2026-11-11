// 정답표 30개 — 계획서 필수 ① "테스트 조건 30개 판정이 정답표와 100% 일치", ② "기한 계산 100% 정확"
// 신고·기한은 engine.js, 지원 자격은 rules-core.js(승인본 seed)로 계산한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');
const RC = require('../demo/rules-core.js');
const SEED = require('../demo/rules/seed.js');
const KEY = require('./answer-key.json');

const V = { '해당 가능': 'E', '확인 필요': 'C', '해당 안 됨': 'I', '마감': 'X' };
const TODAY = new Date(2026, 10, 11); // 모집 상태가 날짜에 따라 바뀌지 않게 고정
const PROGS = RC.publicView(SEED, TODAY).programs;
const verdictOf = (S, id) => V[RC.verdict(RC.evalProgram(PROGS.find((p) => p.id === id), E.toUser(S)))];

test('정답표는 정확히 30개다', () => {
  assert.equal(KEY.cases.length, 30);
});

for (const c of KEY.cases) {
  const opts = c.todo ? { todo: c.todo } : {};
  test(`정답표 ${c.no}: ${c.name}`, opts, () => {
    const S = Object.assign({}, KEY.base, c.in);
    const R = E.deadlines(S);
    const want = Object.assign({}, KEY.baseExpect, c.expect);
    const got = {
      reportRequired: R.report.required,
      reportDue: E.iso(R.report.due),
      moveinDue: E.iso(R.movein.due),
      end: E.iso(R.end),
      renewDue: E.iso(R.renewDue),
      rent: verdictOf(S, 'rent'),
      move: verdictOf(S, 'move')
    };
    if ('early' in want) got.early = R.report.early;
    assert.deepEqual(got, want);
  });
}
