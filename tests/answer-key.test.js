// T-03 정답표 30개 — 계획서 필수 ① "테스트 조건 30개 판정이 정답표와 100% 일치", ② "기한 계산 100% 정확"
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');
const RULES = require('../demo/rules.js');
const KEY = require('./answer-key.json');

const V = { eligible: 'E', check: 'C', ineligible: 'I' };

test('정답표는 정확히 30개다', () => {
  assert.equal(KEY.cases.length, 30);
});

for (const c of KEY.cases) {
  test(`정답표 ${c.no}: ${c.name}`, () => {
    const R = E.evaluate(Object.assign({}, KEY.base, c.in), RULES);
    const want = Object.assign({}, KEY.baseExpect, c.expect);
    const got = {
      reportRequired: R.report.required,
      reportDue: E.iso(R.report.due),
      moveinDue: E.iso(R.movein.due),
      end: E.iso(R.end),
      renewDue: E.iso(R.renewDue),
      rent: V[R.programs.find((x) => x.p.id === 'rent').verdict],
      move: V[R.programs.find((x) => x.p.id === 'move').verdict]
    };
    if ('early' in want) got.early = R.report.early;
    assert.deepEqual(got, want);
  });
}
