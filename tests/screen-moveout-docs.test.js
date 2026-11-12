// 퇴거 준비·서류함 화면 개선 (F-10 ①~⑦, F-07 ①~③, N-04) — T-12
// 순수 함수(screens-core T-12 구역) 단위 테스트 + app.html 정적 검사(자기 구역·키 규격·공용 함수 불변)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');

// 2칸 들여쓰기 함수 하나의 본문(선언 줄 ~ 닫는 `  }`)
function fnText(sig) {
  const a = HTML.indexOf('  function ' + sig);
  assert.ok(a >= 0, sig + ' 없음');
  const b = HTML.indexOf('\n  }\n', a);
  assert.ok(b > a, sig + ' 끝 없음');
  return HTML.slice(a, b + 4);
}
function cssZone() {
  const s = '/* ===== mo:T-12 #moveout #docs ===== */', e = '/* ===== /mo:T-12 ===== */';
  const a = HTML.indexOf(s), b = HTML.indexOf(e);
  assert.ok(a >= 0 && b > a, 'T-12 CSS 구역 없음');
  return HTML.slice(a + s.length, b).replace(/\/\*[\s\S]*?\*\//g, ' ');
}

// ---------- dateChipParts (F-10 ②) ----------
test('dateChipParts: 정상 — 2028-09-11(월)은 9월 / 11 / 월요일', () => {
  assert.deepEqual(JS.dateChipParts(new Date(2028, 8, 11)), { month: '9월', day: '11', wd: '월요일', label: '9월 11일 월요일' });
});

test('dateChipParts: 경계 — 연말·연초, 일요일·토요일', () => {
  assert.deepEqual(JS.dateChipParts(new Date(2028, 11, 31)), { month: '12월', day: '31', wd: '일요일', label: '12월 31일 일요일' });
  assert.deepEqual(JS.dateChipParts(new Date(2029, 0, 1)), { month: '1월', day: '1', wd: '월요일', label: '1월 1일 월요일' });
  assert.equal(JS.dateChipParts(new Date(2028, 8, 16)).wd, '토요일');
});

test('dateChipParts: 1년 366일 전부 — 월 뒤에 한 글자 요일이 붙는 표기("9월 월") 0건', () => {
  const bad = /\d+월\s*[일월화수목금토](?!요일)(?![\d일])/;
  for (let i = 0; i < 366; i++) {
    const p = JS.dateChipParts(new Date(2028, 0, 1 + i));
    for (const s of [p.label, p.month + ' ' + p.wd, p.month + p.day + p.wd, p.month + ' ' + p.day + ' ' + p.wd]) {
      assert.doesNotMatch(s, bad, s);
    }
    assert.match(p.wd, /^[일월화수목금토]요일$/);
  }
});

test('dateChipParts: 예외 — 날짜가 아니거나 잘못된 날짜면 null', () => {
  assert.equal(JS.dateChipParts(null), null);
  assert.equal(JS.dateChipParts(undefined), null);
  assert.equal(JS.dateChipParts('2028-09-11'), null);
  assert.equal(JS.dateChipParts(new Date('없는 날짜')), null);
});

// ---------- hideDue (F-10 ①, OQ #8) ----------
test('hideDue: 정상 — 지정한 할 일만 날짜를 지운 복사본, 나머지는 그대로', () => {
  const d1 = new Date(2028, 8, 11), d2 = new Date(2028, 10, 4);
  const src = [{ id: 'o1', title: '갱신 여부 미리 알리기', due: d1 }, { id: 'o2', title: '집 점검', due: d2 }];
  const out = JS.hideDue(src, ['o1']);
  assert.equal(out.length, 2);
  assert.equal(out[0].due, null);
  assert.equal(out[0].title, '갱신 여부 미리 알리기');
  assert.equal(out[0].id, 'o1');
  assert.equal(out[1], src[1], '지정 안 한 할 일은 같은 객체');
  assert.equal(src[0].due, d1, '원본은 바뀌지 않음');
  assert.notEqual(out, src);
});

test('hideDue: 경계 — 빈 목록, 지정 id가 없음', () => {
  assert.deepEqual(JS.hideDue([], ['o1']), []);
  const src = [{ id: 'x1', due: new Date(2028, 0, 1) }];
  const out = JS.hideDue(src, ['o1']);
  assert.equal(out[0], src[0]);
});

test('hideDue: 예외 — 목록이 배열이 아니면 [], id 목록이 배열이 아니면 그대로 복사', () => {
  assert.deepEqual(JS.hideDue(null, ['o1']), []);
  assert.deepEqual(JS.hideDue('o1', ['o1']), []);
  const src = [{ id: 'o1', due: new Date(2028, 0, 1) }];
  const out = JS.hideDue(src, null);
  assert.equal(out[0], src[0]);
  assert.notEqual(out, src);
  assert.deepEqual(JS.hideDue([null, { id: 'o1', due: 1 }], ['o1']), [null, { id: 'o1', due: null }]);
});

// ---------- readyPct (F-10 ⑤ 막대 비율) ----------
test('readyPct: 정상·경계 — 0/5=0, 2/5=40, 1/3=33, 5/5=100', () => {
  assert.equal(JS.readyPct(0, 5), 0);
  assert.equal(JS.readyPct(2, 5), 40);
  assert.equal(JS.readyPct(1, 3), 33);
  assert.equal(JS.readyPct(5, 5), 100);
});

test('readyPct: 예외 — 전체 0, 음수, 초과, 숫자 아님은 0..100으로 자름', () => {
  assert.equal(JS.readyPct(0, 0), 0);
  assert.equal(JS.readyPct(3, 0), 0);
  assert.equal(JS.readyPct(-1, 5), 0);
  assert.equal(JS.readyPct(6, 5), 100);
  assert.equal(JS.readyPct('a', 5), 0);
  assert.equal(JS.readyPct(2, 'b'), 0);
});

// ---------- app.html 정적 검사 ----------
test('퇴거 준비: moBegin/moRoot로 감싸고, 날짜 칩은 새 helper(공용 dateBlk 미사용), 갱신 통지(o1) 날짜 숨김', () => {
  const v = fnText('viewMoveout() {');
  assert.match(v, /moBegin\('moveout'\)/);
  assert.match(v, /return moRoot\('moveout', /);
  assert.doesNotMatch(v, /dateBlk\(/, '중요한 날짜 칩은 새 helper로');
  assert.match(v, /moveoutChip\(k\[0\]\)/, '중요한 날짜는 새 칩 helper');
  assert.match(v, /moveoutTasks\(/, '나가기 전 할 일은 날짜 숨김 helper를 거친다');
  const h = fnText('moveoutTasks(tasks) {');
  assert.match(h, /JS\.hideDue\(tasks, \['o1'\]\)/);
  assert.match(h, /Object\.assign\(\{\}, t, \{ due: null \}\)/, 'screens-core가 없을 때도 같은 규칙');
});

test('서류함: moBegin/moRoot, 준비 막대(progress-line + mo-fill/mo-grow), 숫자 moNum, 업로드 변화 moChanged', () => {
  const v = fnText('viewDocs() {');
  assert.match(v, /moBegin\('docs'\)/);
  assert.match(v, /return moRoot\('docs', /);
  assert.match(v, /docsBar\('docs:pct:' \+ x\.p\.id, r\.ready, r\.total\)/, '지원별 준비 막대');
  const bar = fnText('docsBar(key, ready, total) {');
  assert.match(bar, /progress-line/);
  assert.match(bar, /mo-fill/);
  assert.match(bar, /mo-grow/);
  assert.match(bar, /--mo-from:/);
  assert.match(bar, /moChanged\(key, pct\)/);
  assert.match(v, /moNum\(/);
  assert.match(v, /moChanged\(/);
  assert.match(v, /mo-pop/);
  assert.match(v, /JE\.docReadiness\(/, '서류 준비 판정은 기존 함수 그대로');
});

test('키 규격: 두 화면의 moNum·moChanged·moOpen 키는 화면 접두사(moveout:/docs:)로 시작', () => {
  for (const [sig, scr] of [['viewMoveout() {', 'moveout'], ['viewDocs() {', 'docs']]) {
    const v = fnText(sig);
    const keys = [...v.matchAll(/mo(?:Num|Changed|Open)\(\s*'([^']*)'/g)].map((m) => m[1]);
    assert.ok(keys.length > 0 || scr === 'moveout', scr + ' 키 없음');
    for (const k of keys) assert.ok(k.startsWith(scr + ':'), scr + ' 키 접두사: ' + k);
    for (const m of v.matchAll(/mo(?:Num|Changed|Open)\(\s*([^,'][^,]*),/g)) assert.fail(scr + ' 키가 문자열 리터럴로 시작하지 않음: ' + m[1]);
  }
});

test('공용 함수 불변: dateBlk 줄은 그대로, 퇴거 준비는 taskItem을 o 없이 복사본으로만 부른다', () => {
  const blk = "  function dateBlk(d) { return '<span class=\"date-blk' + (+d === +today ? ' today' : '') + '\"><b>' + d.getDate() + '</b><span>' + (d.getMonth() + 1) + '월 ' + WD[d.getDay()] + '</span></span>'; }";
  assert.equal(HTML.split(blk).length - 1, 1);
  // taskItem 본문은 T-11이 선택 인자 o에 새 속성을 더할 수 있다(Architecture 수정 구역 표) — 본문 고정 대신 T-12 쪽 호출 방식만 검사
  const v = fnText('viewMoveout() {');
  const calls = [...v.matchAll(/taskItem\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(calls, ['t'], '퇴거 준비는 taskItem(t)만 부른다(o 없음)');
  // 날짜 숨김은 복사본으로만 — helper가 원본 할 일 객체의 due를 직접 바꾸지 않는다 (원본 불변은 hideDue 단위 테스트가 단언)
  assert.doesNotMatch(fnText('moveoutTasks(tasks) {'), /\.due\s*=(?!=)/);
});

test('T-12 CSS 구역: 비어 있지 않고 선택자는 .mo-moveout/.mo-docs, keyframes는 mo-moveout-/mo-docs- 접두사', () => {
  const css = cssZone();
  assert.ok(css.trim().length > 0, 'T-12 CSS 구역이 비어 있음');
  const sels = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { sels.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; }
    else if (ch === '}' || ch === ';') buf = '';
    else buf += ch;
  }
  for (const s of sels) {
    if (/^@media\b/.test(s)) continue;
    if (/^@(-webkit-)?keyframes\b/.test(s)) { assert.match(s, /keyframes mo-(moveout|docs)-[\w-]+$/, s); continue; }
    if (/^(from|to|\d+%)/.test(s)) continue;
    for (const part of s.split(',')) assert.match(part.trim(), /^\.mo-(moveout|docs)(?![\w-])/, '범위 밖 선택자: ' + part.trim());
  }
});
