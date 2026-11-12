// app.html 정적 검사 — 내 화면 6개 모션 구역·범위·움직임 줄이기·토큰 (F-07 ①③④, N-04) — T-09
// T-10~T-13도 이 검사를 계속 통과해야 한다 (Architecture "정적 검사" Z1~Z7).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
const LINES = HTML.split('\n');

const CSS_MARKS = [
  ['/* ===== mo:T-09 내 화면 6개 모션 (계약·신고 전용) ===== */', '/* ===== /mo:T-09 ===== */'],
  ['/* ===== mo:T-10 #result ===== */', '/* ===== /mo:T-10 ===== */'],
  ['/* ===== mo:T-11 #timeline ===== */', '/* ===== /mo:T-11 ===== */'],
  ['/* ===== mo:T-12 #moveout #docs ===== */', '/* ===== /mo:T-12 ===== */'],
  ['/* ===== mo:T-13 #input #contract ===== */', '/* ===== /mo:T-13 ===== */']
];
const JS_MARKS = ['// ===== mo:T-09 =====', '// ===== /mo:T-09 ====='];
const REDUCE_RULE = '@media (prefers-reduced-motion: reduce) { * { transition: none !important } }';
const NO_PREF = /^@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)$/;

const count = (s, sub) => s.split(sub).length - 1;
const lineIndex = (text) => LINES.findIndex((l) => l.trim() === text);
const nextNonBlank = (i) => { let j = i + 1; while (j < LINES.length && !LINES[j].trim()) j++; return LINES[j] === undefined ? '' : LINES[j].trim(); };

// 모든 CSS 구역(T-09 시작 ~ T-13 끝) 텍스트, 주석 제거
function zoneCss() {
  const a = HTML.indexOf(CSS_MARKS[0][0]);
  const b = HTML.indexOf(CSS_MARKS[4][1]);
  assert.ok(a >= 0 && b > a, 'CSS 구역 없음');
  return HTML.slice(a, b + CSS_MARKS[4][1].length).replace(/\/\*[\s\S]*?\*\//g, ' ');
}
function jsBlock() {
  const a = HTML.indexOf(JS_MARKS[0]);
  const b = HTML.indexOf(JS_MARKS[1]);
  assert.ok(a >= 0 && b > a, 'JS T-09 블록 없음');
  return HTML.slice(a, b);
}

// 중괄호 깊이 스캔: 규칙(선택자·@규칙)과 선언을 감싼 블록 경로와 함께 모은다
function scan(css) {
  const rules = [], decls = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { const pre = buf.trim().replace(/\s+/g, ' '); rules.push({ pre, stack: stack.slice() }); stack.push(pre); buf = ''; }
    else if (ch === '}') { if (buf.trim()) decls.push({ text: buf.trim(), stack: stack.slice() }); stack.pop(); buf = ''; }
    else if (ch === ';') { if (buf.trim()) decls.push({ text: buf.trim(), stack: stack.slice() }); buf = ''; }
    else buf += ch;
  }
  assert.equal(stack.length, 0, '중괄호 짝 안 맞음');
  return { rules, decls };
}
const prop = (d) => d.text.split(':')[0].trim().toLowerCase();
const isMotion = (d) => /^(animation|transition)(-|$)/.test(prop(d));
const inKeyframes = (st) => st.some((p) => /^@(-webkit-)?keyframes\b/.test(p));
const TOKEN_LINE = (l) => /^\s*\.mo\s*\{\s*--mo-short\s*:/.test(l);

test('Z1: CSS 구역 마커 T-09~T-13과 JS 마커 T-09가 각 1번, 순서대로', () => {
  let at = -1;
  for (const pair of CSS_MARKS) for (const m of pair) {
    assert.equal(count(HTML, m), 1, m + ' 개수');
    const i = HTML.indexOf(m); assert.ok(i > at, m + ' 순서'); at = i;
  }
  assert.equal(nextNonBlank(lineIndex(CSS_MARKS[4][1])), '</style>', '마지막 CSS 구역 다음은 </style>');
  for (let k = 0; k < 4; k++) {
    const end = lineIndex(CSS_MARKS[k][1]);
    assert.equal(LINES[end + 1].trim(), '', CSS_MARKS[k][1] + ' 다음 빈 줄 1개');
    assert.equal(LINES[end + 2].trim(), CSS_MARKS[k + 1][0], CSS_MARKS[k + 1][0] + ' 위치');
  }
  for (const m of JS_MARKS) assert.equal(count(HTML, m), 1, m + ' 개수');
  assert.ok(HTML.indexOf(JS_MARKS[0]) < HTML.indexOf(JS_MARKS[1]));
  assert.equal(nextNonBlank(lineIndex(JS_MARKS[1])), '// ---------- 메뉴 구조 ----------', 'JS 블록 다음은 메뉴 구조');
  assert.ok(HTML.indexOf(JS_MARKS[0]) > HTML.indexOf('</style>'), 'JS 블록은 script 안');
});

test('Z2: screens-core.js 태그가 1번, engine.js 태그 바로 다음 줄', () => {
  const tag = '<script src="screens-core.js" defer></script>';
  assert.equal(count(HTML, tag), 1);
  const e = lineIndex('<script src="engine.js" defer></script>');
  assert.ok(e >= 0);
  assert.equal(LINES[e + 1].trim(), tag);
});

test('Z3: 공용 움직임 줄이기 규칙이 정확히 1번 그대로', () => {
  assert.equal(count(HTML, REDUCE_RULE), 1);
});

test('Z4: 구역 안 animation·transition 선언은 모두 no-preference 미디어 쿼리 안', () => {
  const { decls } = scan(zoneCss());
  const motion = decls.filter((d) => isMotion(d) && !inKeyframes(d.stack));
  assert.ok(motion.length > 0, '모션 선언이 하나도 없음');
  for (const d of motion) assert.ok(d.stack.some((p) => NO_PREF.test(p)), '미디어 쿼리 밖: ' + d.text);
});

test('Z5: 구역 안 선택자는 .mo로 시작, keyframes 이름은 mo- 접두사', () => {
  const { rules } = scan(zoneCss());
  const sel = rules.filter((r) => !r.pre.startsWith('@') && !inKeyframes(r.stack));
  assert.ok(sel.length > 0);
  for (const r of sel) for (const s of r.pre.split(',')) {
    assert.match(s.trim(), /^\.mo(?![\w])|^\.mo-[\w-]/, '범위 밖 선택자: ' + s.trim());
  }
  const kf = rules.filter((r) => /^@(-webkit-)?keyframes\b/.test(r.pre));
  assert.ok(kf.length >= 4, 'keyframes 4개(mo-in mo-fill mo-grow mo-pop) 이상');
  for (const r of kf) assert.match(r.pre, /^@(-webkit-)?keyframes mo-[\w-]+$/, r.pre);
  for (const r of rules.filter((x) => inKeyframes(x.stack))) assert.match(r.pre, /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/, r.pre);
  for (const name of ['mo-in', 'mo-fill', 'mo-grow', 'mo-pop']) assert.ok(kf.some((r) => r.pre.endsWith(' ' + name)), name);
});

test('Z6: 시간 값은 토큰 줄에만, 토큰 CSS 값 = JachwiScreens.T', () => {
  const zoneStart = HTML.indexOf(CSS_MARKS[0][0]);
  const zoneEnd = HTML.indexOf(CSS_MARKS[4][1]);
  const zoneLines = HTML.slice(zoneStart, zoneEnd).split('\n').map((l) => l.replace(/\/\*[\s\S]*?\*\//g, ''));
  const tokenLines = zoneLines.filter(TOKEN_LINE);
  assert.equal(tokenLines.length, 1, '토큰 줄 1개');
  for (const l of zoneLines) if (!TOKEN_LINE(l)) assert.doesNotMatch(l, /(^|[^\w-])\d*\.?\d+m?s\b/, '토큰 줄 밖 시간 값: ' + l.trim());
  const tok = {};
  tokenLines[0].replace(/--(mo-[\w-]+)\s*:\s*([^;}]+)/g, (_, k, v) => { tok[k] = v.trim(); });
  assert.deepEqual(tok, {
    'mo-short': JS.T.short + 'ms', 'mo-base': JS.T.base + 'ms', 'mo-long': JS.T.long + 'ms',
    'mo-step': JS.T.step + 'ms', 'mo-shift': JS.T.shift + 'px', 'mo-ease': JS.T.ease, 'mo-ease-io': JS.T.easeIO
  });
  // 길이는 짧게·기본·길게 토큰만, 지연은 calc(var(--mo-step) * n), n ≤ 6
  const css = zoneCss();
  const rest = css.split('\n').filter((l) => !TOKEN_LINE(l)).join('\n');
  for (const m of rest.matchAll(/--mo-step/g)) {
    const around = rest.slice(Math.max(0, m.index - 10), m.index + 30);
    assert.match(around, /calc\(var\(--mo-step\) \* [0-6]\)/, '차례 지연 형식: ' + around);
  }
  for (const n of rest.matchAll(/calc\(var\(--mo-step\) \* (\d+)\)/g)) assert.ok(+n[1] <= JS.T.maxStep);
  const { decls } = scan(css);
  for (const d of decls.filter(isMotion)) {
    for (const v of d.text.matchAll(/var\(--(mo-[\w-]+)\)/g)) {
      assert.ok(['mo-short', 'mo-base', 'mo-long', 'mo-step', 'mo-ease', 'mo-ease-io'].includes(v[1]), '모션 선언 안 토큰: ' + v[1]);
    }
  }
});

test('Z7: 반복 모션 0개 (infinite·animation-iteration-count 없음)', () => {
  const css = zoneCss();
  assert.equal(count(css, 'infinite'), 0);
  assert.equal(count(css, 'animation-iteration-count'), 0);
  assert.doesNotMatch(jsBlock(), /iterations\s*:\s*(Infinity|[2-9]|\d{2,})/);
});

test('JS T-09 블록: 인터페이스 헬퍼를 모두 정의', () => {
  const js = jsBlock();
  for (const f of ['moBegin', 'moRoot', 'moStep', 'moNum', 'moChanged', 'moOpen', 'moToggle', 'moPanel', 'moAfter', 'moReduce']) {
    assert.match(js, new RegExp('function ' + f + '\\('), f);
  }
  assert.match(js, /var MO = \{ prev: \{\}, open: \{\}, enter: \{\}, jobs: \[\]/);
});

test('JS T-09 블록: 리스너는 click 1개, render·setTimeout·저장 호출 없음', () => {
  const js = jsBlock();
  assert.equal(count(js, 'addEventListener('), 1);
  assert.match(js, /document\.addEventListener\('click'/);
  assert.match(js, /\[data-mo-toggle\]/);
  assert.doesNotMatch(js, /\brender\(|setTimeout|setInterval|\bsave\(|localStorage/);
  assert.doesNotMatch(js, /\blast\s*=[^=]/, 'last에 쓰지 않는다');
});
