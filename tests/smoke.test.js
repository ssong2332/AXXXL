// T-01 스모크: 하네스가 돌고 demo/engine.js를 Node에서 불러올 수 있는지
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../demo/engine.js');

test('엔진을 불러오고 날짜 더하기가 동작한다', () => {
  assert.equal(E.iso(E.addDays(E.parseDate('2026-11-30'), 1)), '2026-12-01');
});
