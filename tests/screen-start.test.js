// 첫 실행 길잡이 #start 온보딩 모션 (F-12 ②③④⑤⑥, F-07, N-04) — T-16
// 길이·끝 시각·움직임 줄이기 실측은 브라우저로만 확인한다(Architecture "실측 절차" — 온보딩 단계 등장).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
const count = (s, sub) => s.split(sub).length - 1;
const NO_PREF = /^@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)$/;

function between(a, b) {
  const i = HTML.indexOf(a);
  const j = HTML.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, '구역 없음: ' + a);
  return HTML.slice(i, j);
}
const jsBlock = () => between('// ===== mo:T-16 =====', '// ===== /mo:T-16 =====');
const cssZone = () => between('/* ===== mo:T-16 #start ===== */', '/* ===== /mo:T-16 ===== */').replace(/\/\*[\s\S]*?\*\//g, ' ');
// viewStart 함수 본문: 정의부터 다음 함수(backupJson) 앞까지
const viewStart = () => between('function viewStart() {', 'function backupJson()');

// 중괄호 깊이 스캔 (screens-zones.test.js와 같은 방식): 선언마다 선택자·@규칙 경로를 붙인다
function scan(css) {
  const rules = [], decls = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { const pre = buf.trim().replace(/\s+/g, ' '); rules.push({ pre, stack: stack.slice() }); stack.push(pre); buf = ''; }
    else if (ch === '}') { if (buf.trim()) decls.push({ text: buf.trim().replace(/\s+/g, ' '), stack: stack.slice() }); stack.pop(); buf = ''; }
    else if (ch === ';') { if (buf.trim()) decls.push({ text: buf.trim().replace(/\s+/g, ' '), stack: stack.slice() }); buf = ''; }
    else buf += ch;
  }
  assert.equal(stack.length, 0, '중괄호 짝 안 맞음');
  return { rules, decls };
}
const owner = (d) => d.stack[d.stack.length - 1];
const inNoPref = (d) => d.stack.some((p) => NO_PREF.test(p));
const declsOf = (decls, selector, text) => decls.filter((d) => owner(d) === selector && d.text === text);

// ---------- JS.stepEnter (screens-core T-16 구역) ----------
test('stepEnter 정상: 같은 단계 다시 그리기는 등장 아님 (F-12 ③ 재생 0회)', () => {
  assert.equal(JS.stepEnter('start', 'start:2', 'start', 'start:2'), false);
});

test("stepEnter: '다음'(1→2)·'이전'(3→2) 단계 이동은 등장 (F-12 ③)", () => {
  assert.equal(JS.stepEnter('start', 'start:1', 'start', 'start:2'), true);
  assert.equal(JS.stepEnter('start', 'start:3', 'start', 'start:2'), true);
});

test('stepEnter: 다른 화면에서 들어오면 단계 키가 같아도 등장 (F-12 ②)', () => {
  assert.equal(JS.stepEnter('home', 'start:2', 'start', 'start:2'), true);
});

test('stepEnter 경계: 첫 로드(직전 화면·단계 키 빈 값)는 등장', () => {
  assert.equal(JS.stepEnter('', '', 'start', 'start:1'), true);
});

test('stepEnter 경계: 직전 단계 키가 undefined·null이면 빈 값으로 보고 등장', () => {
  assert.equal(JS.stepEnter('start', undefined, 'start', 'start:1'), true);
  assert.equal(JS.stepEnter('start', null, 'start', 'start:1'), true);
});

test("stepEnter 타입: 'start:'+2와 'start:2'는 같은 키 → 등장 아님", () => {
  assert.equal(JS.stepEnter('start', 'start:' + 2, 'start', 'start:2'), false);
});

test('stepEnter 예외: 이상한 입력에도 던지지 않고 불리언을 돌려준다', () => {
  assert.doesNotThrow(() => JS.stepEnter(undefined, undefined, 'start', 'start:1'));
  assert.equal(JS.stepEnter(undefined, undefined, 'start', 'start:1'), true);
  assert.equal(JS.stepEnter(null, 'start:1', 'start', 'start:1'), true, '직전 화면 null = 빈 값 → 화면 이동');
  assert.equal(typeof JS.stepEnter('start', 'start:1', 'start', 'start:1'), 'boolean');
});

// ---------- T-16 JS 블록 ----------
test('T-16 JS 블록: moSubKey 초기값 빈 값, moBeginStep 정의, moBegin 호출', () => {
  const js = jsBlock();
  assert.match(js, /var moSubKey = '';/);
  assert.match(js, /function moBeginStep\(/);
  assert.match(js, /\bmoBegin\(/);
  assert.match(js, /JS\.stepEnter\(/);
});

test('T-16 JS 블록: render·타이머·저장·리스너 호출 없음, last에 쓰지 않음', () => {
  const js = jsBlock();
  for (const bad of ['render(', 'setTimeout', 'setInterval', 'save(', 'localStorage', 'addEventListener(']) {
    assert.equal(count(js, bad), 0, bad);
  }
  assert.doesNotMatch(js, /\blast\s*=[^=]/, 'last에 쓰지 않는다');
});

// ---------- viewStart ----------
test("viewStart: moBeginStep('start'·moRoot('start'가 각 1번, moStep( 0건", () => {
  const v = viewStart();
  assert.equal(count(v, "moBeginStep('start'"), 1);
  assert.equal(count(v, "moRoot('start'"), 1);
  assert.equal(count(v, 'moStep('), 0);
});

test('viewStart: moBeginStep은 단계 값(st)을 정한 줄 바로 다음 줄에서 st로 부른다', () => {
  const lines = viewStart().split('\n').map((l) => l.trim());
  const i = lines.indexOf('var st = +S.obStep || 1, R = evaluate();');
  assert.ok(i >= 0, '단계 값 줄');
  assert.equal(lines[i + 1], "moBeginStep('start', st);");
});

test('viewStart: return 식 전체가 moRoot로 감싸이고 공용 마크업 클래스는 그대로', () => {
  const v = viewStart();
  assert.match(v, /return moRoot\('start', '<div class="ob">/);
  assert.match(v, /<ol class="ob-steps" aria-label="입력 단계">/);
  assert.match(v, /<section class="card stack ob-card">/);
  assert.match(v, /<\/span><\/div><\/div>'\);\n\s*}\s*$/, 'moRoot 닫는 괄호로 끝남');
});

// ---------- T-16 CSS 구역 ----------
test('T-16 CSS: keyframes mo-start-fill(scaleX 0에서)이 1번', () => {
  const css = cssZone();
  assert.equal(count(css, '@keyframes mo-start-fill'), 1);
  const { rules, decls } = scan(css);
  const from = decls.filter((d) => d.stack.includes('@keyframes mo-start-fill') && owner(d) === 'from');
  assert.deepEqual(from.map((d) => d.text), ['transform: scaleX(0)']);
  assert.ok(rules.some((r) => r.pre === '@keyframes mo-start-fill'));
});

test('T-16 CSS: 진행 칸 막대 기준점은 왼쪽(레이아웃 줄, 미디어 쿼리 밖)', () => {
  const { decls } = scan(cssZone());
  const d = declsOf(decls, '.mo-start .ob-steps li.now::before', 'transform-origin: left center');
  assert.equal(d.length, 1);
  assert.ok(!inNoPref(d[0]));
});

test('T-16 CSS: 현재 칸 채우기는 [data-mo-enter] 아래·no-preference 안, 길게·감속 (F-12 ④)', () => {
  const { decls } = scan(cssZone());
  const d = declsOf(decls, '.mo-start[data-mo-enter] .ob-steps li.now::before', 'animation: mo-start-fill var(--mo-long) var(--mo-ease) both');
  assert.equal(d.length, 1);
  assert.ok(inNoPref(d[0]));
  const anyFill = decls.filter((x) => /mo-start-fill/.test(x.text));
  assert.equal(anyFill.length, 1, 'mo-start-fill 사용은 1곳');
});

test('T-16 CSS: ob-card 직계 자식 차례 등장 — mo-in 기본 길이·감속, no-preference 안 (F-12 ②③)', () => {
  const { decls } = scan(cssZone());
  const d = declsOf(decls, '.mo-start[data-mo-enter] .ob-card > *', 'animation: mo-in var(--mo-base) var(--mo-ease) both');
  assert.equal(d.length, 1);
  assert.ok(inNoPref(d[0]));
});

test('T-16 CSS: nth-child(2..6) 지연 1..5, n+7은 6 — 각 1번, no-preference 안 (F-12 ⑥)', () => {
  const { decls } = scan(cssZone());
  const want = [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5], ['n+7', 6]];
  for (const [k, n] of want) {
    const d = declsOf(decls, '.mo-start[data-mo-enter] .ob-card > :nth-child(' + k + ')', 'animation-delay: calc(var(--mo-step) * ' + n + ')');
    assert.equal(d.length, 1, 'nth-child(' + k + ')');
    assert.ok(inNoPref(d[0]), 'nth-child(' + k + ') 미디어 쿼리 안');
  }
  assert.equal(decls.filter((x) => /^animation-delay/.test(x.text)).length, want.length, '그 밖의 지연 없음');
});

test('T-16 CSS: 마지막 차례 끝 시각이 전체 상한(930ms) 이하 (F-12 ②, N-04)', () => {
  const steps = [...cssZone().matchAll(/calc\(var\(--mo-step\) \* (\d+)\)/g)].map((m) => +m[1]);
  assert.ok(steps.length > 0);
  const last = Math.max(...steps) * JS.T.step + JS.T.base;
  assert.ok(last <= JS.T.total, last + 'ms');
  assert.equal(JS.T.total, 930);
});
