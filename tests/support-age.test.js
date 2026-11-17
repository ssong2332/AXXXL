// 지원사업 판정 나이는 계약일이 아니라 오늘(신청하는 날) 기준 만 나이 — 실행: node --test tests/support-age.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../demo/engine.js');

test('계약일 기준과 오늘 기준 나이가 다른 예: 1986-06생, 2026-03 계약, 2026-11 오늘', () => {
  assert.equal(E.age('1986-06', E.parseDate('2026-03-10')), 39);
  assert.equal(E.age('1986-06', E.parseDate('2026-11-17')), 40);
  // 생일 달이면 일을 몰라 정하지 않는다 (오늘 기준이어도 같다)
  assert.equal(E.age('1986-11', E.parseDate('2026-11-17')), null);
});

test('앱의 나이(curAge)는 오늘 기준으로 세고, 지원사업 판정은 모두 curAge를 쓴다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
  const cur = /function curAge\(\) \{[^\n]*/.exec(html)[0];
  assert.ok(/JE\.age\(S\.birth, today\)/.test(cur), cur);
  assert.ok(!/pd\(S\.contract\)/.test(cur), cur);
  // 승인 공고(userOf)·온통청년 정책(supUser·supCtx) 모두 같은 나이
  assert.ok(/function userOf\(\) \{[^\n]*u\.age = curAge\(\)/.test(html));
  assert.ok(/function supUser\(\) \{[^\n]*age: curAge\(\)/.test(html));
  assert.ok(/function supCtx\(r\) \{[^\n]*age: curAge\(\)/.test(html));
});
