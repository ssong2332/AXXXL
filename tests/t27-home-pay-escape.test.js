// T-27 홈 '남은 납부' 카드 납부 항목 이름 이스케이프 (Architecture 수정 구역 T-27 행, DECISIONS #34)
// app.html의 `var payH = …` 한 줄과 `esc` 정의를 파일 텍스트에서 잘라 new Function으로 실행한다(t24-review.test.js와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function lineOf(head) {
  const a = HTML.indexOf(head);
  assert.ok(a >= 0, head + ' 없음');
  return HTML.slice(a, HTML.indexOf('\n', a));
}
const md = (d) => (d.getMonth() + 1) + '/' + d.getDate();
const D = new Date(2026, 11, 5);

// first 갈래: 이번 달 납부 없음(mb 빈 배열), 다음 달 첫 납부 있음
function payFirst(title) {
  const src = lineOf('  function esc(s) {') + '\n' + lineOf('    var payH = ') + '\nreturn payH;';
  // eslint-disable-next-line no-new-func
  return new Function('md', 'mb', 'bm', 'nb', 'first', src)(md, [], [], undefined, { date: D, title });
}
// nb 갈래: 이번 달 안 낸 다음 납부 있음
function payNext(title) {
  const src = lineOf('  function esc(s) {') + '\n' + lineOf('    var payH = ') + '\nreturn payH;';
  const e = { date: D, title, paid: false };
  // eslint-disable-next-line no-new-func
  return new Function('md', 'mb', 'bm', 'nb', 'first', src)(md, [e], [e], e, null);
}

test('정상: 이름 "월세"는 두 갈래 모두 그대로', () => {
  assert.equal(payFirst('월세'), '이번 달 낼 돈이 없어요 · 첫 납부 12/5 월세');
  assert.equal(payNext('월세'), '다음 · 12/5 월세');
});
test('경계: & 와 따옴표가 든 이름은 엔티티로 (두 갈래)', () => {
  assert.equal(payFirst('관리비&"전기"\'s'), '이번 달 낼 돈이 없어요 · 첫 납부 12/5 관리비&amp;&quot;전기&quot;&#39;s');
  assert.equal(payNext('A&B'), '다음 · 12/5 A&amp;B');
});
test('경계: 빈 이름은 빈 글자로 (두 갈래)', () => {
  assert.equal(payFirst(''), '이번 달 낼 돈이 없어요 · 첫 납부 12/5 ');
  assert.equal(payNext(''), '다음 · 12/5 ');
});
test('예외: <b>굵게</b> 이름은 태그가 아닌 글자로 (first 갈래)', () => {
  const h = payFirst('<b>굵게</b>');
  assert.ok(!/<b>/.test(h), h);
  assert.ok(h.endsWith('&lt;b&gt;굵게&lt;/b&gt;'), h);
});
test('예외: <img src=x> 모양 이름은 태그가 아닌 글자로 (nb 갈래)', () => {
  const h = payNext('<img src=x>');
  assert.ok(!/</.test(h), h);
  assert.equal(h, '다음 · 12/5 &lt;img src=x&gt;');
});
test('예외: <b>굵게</b>(nb 갈래)·<img src=x>(first 갈래)도 같음', () => {
  assert.equal(payNext('<b>굵게</b>'), '다음 · 12/5 &lt;b&gt;굵게&lt;/b&gt;');
  assert.ok(!/</.test(payFirst('<img src=x>')));
});
