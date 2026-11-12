// 타임라인 화면 개선 (F-09 ①~⑧, F-07, N-04) — T-11
// 순수 함수 scrollTarget 단위 테스트 + app.html 정적 검사(taskItem 호환·viewTimeline 연결·T-11 CSS 구역)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');

function fnText(head, next) {
  const a = HTML.indexOf(head);
  const b = HTML.indexOf(next, a + head.length);
  assert.ok(a >= 0 && b > a, head + ' 함수 없음');
  return HTML.slice(a, b);
}
const viewTimeline = () => fnText('  function viewTimeline() {', '\n  function calBase()');
function zoneCss() {
  const A = '/* ===== mo:T-11 #timeline ===== */', B = '/* ===== /mo:T-11 ===== */';
  const a = HTML.indexOf(A), b = HTML.indexOf(B);
  assert.ok(a >= 0 && b > a, 'T-11 CSS 구역 없음');
  return HTML.slice(a + A.length, b);
}

// ---------- scrollTarget (F-09 ②, OQ #4) ----------
const ST = [
  { key: 'pre', done: true }, { key: 'cday', done: true }, { key: 'prep', done: false },
  { key: 'mday', done: false }, { key: 'report', done: false }, { key: 'out', done: false }
];
test('scrollTarget: 함수가 있다', () => {
  assert.equal(typeof JS.scrollTarget, 'function');
});
test('scrollTarget: \'지금\' 단계가 있으면 그 단계 키 (정상)', () => {
  assert.equal(JS.scrollTarget(ST, 'prep'), 'prep');
  assert.equal(JS.scrollTarget(ST, 'report'), 'report');
});
test('scrollTarget: 모든 단계가 완료면 마지막 단계 키 — \'지금\' 키가 있어도 (OQ #4, 경계)', () => {
  const all = ST.map((s) => ({ key: s.key, done: true }));
  assert.equal(JS.scrollTarget(all, 'report'), 'out');
  assert.equal(JS.scrollTarget(all, null), 'out');
});
test('scrollTarget: \'지금\'이 첫 단계(계약 전)면 이동 없이 맨 위 → null (경계)', () => {
  assert.equal(JS.scrollTarget(ST.map((s) => ({ key: s.key, done: false })), 'pre'), null);
});
test('scrollTarget: \'지금\' 키가 없거나 목록에 없으면 null (예외)', () => {
  assert.equal(JS.scrollTarget(ST, null), null);
  assert.equal(JS.scrollTarget(ST, undefined), null);
  assert.equal(JS.scrollTarget(ST, 'apply'), null);
});
test('scrollTarget: 단계 목록이 비었거나 배열이 아니면 null (예외)', () => {
  assert.equal(JS.scrollTarget([], 'prep'), null);
  assert.equal(JS.scrollTarget(null, 'prep'), null);
  assert.equal(JS.scrollTarget(undefined, undefined), null);
});
test('scrollTarget: 단계 하나뿐이고 완료면 그 단계 (경계)', () => {
  assert.equal(JS.scrollTarget([{ key: 'only', done: true }], 'only'), 'only');
});

// ---------- taskItem 호환 (퇴거 준비도 같은 함수) ----------
function makeTaskItem() {
  const src = fnText('  function taskItem(t, o) {', '\n  function remindSelect()');
  const deps = {
    S: { done: { a: false, b: true } },
    badge: (x) => '<B:' + x[1] + '>', dueTag: (t) => ['', 'due-' + t.id], lateNote: () => '',
    ic: (n) => '<I:' + n + '>', ext: () => '', srcLink: (s) => '<S:' + s + '>'
  };
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(deps), src + '\nreturn taskItem;')(...Object.values(deps));
}
const TA = { id: 'a', title: '할 일', desc: '설명', src: '근거', docs: '신분증', where: '센터', act: ['열기', '#docs'] };
const TB = { id: 'b', title: '끝난 일', desc: '설명2', src: '근거2' };
test('taskItem: 새 속성이 없으면 출력이 기존과 같다 (T-11 전 출력 고정)', () => {
  const f = makeTaskItem();
  assert.equal(f(TA), '<div class="task"><input class="chk" type="checkbox" id="k-a" data-act="task" data-id="a"><div class="body"><div class="t"><label for="k-a">할 일</label><B:due-a></div><p class="d">설명</p><div class="meta"><span class="pill"><b>준비물</b>신분증</span><span class="pill"><b>어디서</b>센터</span></div><div class="act"><a class="btn ghost sm" href="#docs">열기</a><S:근거></div></div></div>');
  assert.equal(f(TB, { num: 2, pfx: 'x' }), '<div class="task done"><span class="num" aria-hidden="true">2</span><input class="chk" type="checkbox" id="k-xb" data-act="task" data-id="b" checked><div class="body"><div class="t"><label for="k-xb">끝난 일</label><B:due-b></div><p class="d">설명2</p><div class="act"><S:근거2></div></div></div>');
  assert.equal(f(TA, {}), f(TA));
});
test('taskItem: o.chkCls가 있으면 체크 상자 클래스에 덧붙는다 (F-09 ⑤)', () => {
  const f = makeTaskItem();
  assert.match(f(TB, { chkCls: 'mo-tl-draw' }), /<input class="chk mo-tl-draw" type="checkbox"/);
  assert.match(f(TB, { chkCls: '' }), /<input class="chk" type="checkbox"/);
});

// ---------- viewTimeline 연결 ----------
test('viewTimeline: moBegin(\'timeline\')로 시작하고 moRoot(\'timeline\', …)로 감싼다 (F-07)', () => {
  const v = viewTimeline();
  assert.match(v, /moBegin\('timeline'\)/);
  assert.match(v, /return moRoot\('timeline',/);
});
test('viewTimeline: 다 끝난 단계는 moOpen 기본값으로 접힘, moToggle·moPanel로 접기 (F-09 ①⑥)', () => {
  const v = viewTimeline();
  assert.match(v, /moOpen\('timeline:stage:' \+/);
  assert.match(v, /moToggle\(/);
  assert.match(v, /moPanel\(/);
});
test('viewTimeline: \'지금\' 단계 이동은 등장 때만, scrollTarget + 즉시 스크롤 (F-09 ②, DECISIONS #15)', () => {
  const v = viewTimeline();
  assert.match(v, /JS\.scrollTarget\(/);
  assert.match(v, /moAfter\(/);
  assert.match(v, /scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.doesNotMatch(v, /smooth/);
});
test('viewTimeline: 진행 막대 0→현재(.mo-fill), 완료 수 카운트(moNum) (F-09 ④)', () => {
  const v = viewTimeline();
  assert.match(v, /mo-fill/);
  assert.match(v, /moNum\('timeline:done'/);
});
test('viewTimeline: 체크 그리기는 \'timeline:task:\'+id 변화(false→true)일 때만 (F-09 ⑤, Architecture §6 키 규격)', () => {
  const v = viewTimeline();
  assert.match(v, /moChanged\('timeline:task:' \+ t\.id/);
  assert.match(v, /chkCls/);
});

// ---------- T-11 CSS 구역 ----------
test('CSS T-11: \'지금\' 단계 이동 때 고정 상단바에 가리지 않게 scroll-margin-top (F-09 ②)', () => {
  assert.match(zoneCss(), /\.mo-timeline \.stage\s*\{[^}]*scroll-margin-top/);
});
test('CSS T-11: 체크 그리기 keyframes mo-timeline-draw를 짧게(--mo-short) 1회, no-preference 안에서만 (F-09 ⑤⑦)', () => {
  const css = zoneCss();
  assert.match(css, /@keyframes mo-timeline-draw\b/);
  const np = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.ok(np >= 0, 'no-preference 블록 없음');
  assert.match(css.slice(np), /animation:\s*mo-timeline-draw var\(--mo-short\)/);
});

// ---------- F-09 ⑧ 기한 계산 불변 ----------
test('기한 계산(buildTimeline~openTasks) 텍스트가 T-11 전과 같다 (F-09 ⑧, N-05)', () => {
  const block = fnText('  function buildTimeline(R) {', '  // ---------- 캘린더 계산 ----------');
  // T-18(2026-11-12)이 '신고 대상인지 모름(null)' 할 일을 의도적으로 추가해 기준값을 갱신했다 — 이전 448c9a4c…678d. 리뷰 권고 #1 esc 추가로 한 번 더 갱신 — 직전 c34c6ca6…ef71
  assert.equal(crypto.createHash('sha256').update(block).digest('hex'), '873ab0d4927b62a839403ba89ff8d11a1d30b83579e62fec8e246a4524bc54f9');
});
