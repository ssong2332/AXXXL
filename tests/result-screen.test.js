// 자격 판정 화면 개선 (F-08 ①~⑤, 진단 D2·D3·D4·M2) — T-10
// 순수 함수(screens-core T-10 구역) 단위 테스트 + app.html T-10 구역 정적 검사.
// 판정 값 불변(F-08 ⑥)은 answer-key.test.js(정답표 30/30)가 맡는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
const CORE = fs.readFileSync(path.join(__dirname, '../demo/screens-core.js'), 'utf8').replace(/\r\n/g, '\n');

function between(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + 1);
  assert.ok(i >= 0 && j > i, '구역 없음: ' + a);
  return src.slice(i, j);
}
const VIEW = () => between(HTML, '// ---------- 자격 판정 (필수 ①) ----------', '// ===== mo:T-09 =====');
const CSS10 = () => between(HTML, '/* ===== mo:T-10 #result ===== */', '/* ===== /mo:T-10 ===== */')
  .replace('/* ===== mo:T-10 #result ===== */', '').replace(/\/\*[\s\S]*?\*\//g, ' ');

// ---------- resultSummary (F-08 ①) ----------
test('resultSummary: 신고 대상이면 할 일 2개(전월세 신고 + 전입신고), 판정별 개수', () => {
  const s = JS.resultSummary({ reportRequired: true, verdicts: ['해당 가능', '해당 가능', '확인 필요'] });
  assert.equal(s.tasks, 2);
  assert.equal(s.taskUnsure, 0);
  assert.deepEqual(s.byVerdict, { '해당 가능': 2, '확인 필요': 1 });
  assert.equal(s.ok, 2);
});
test('resultSummary: 신고 대상 아님이면 할 일 1개(전입신고만) (경계)', () => {
  const s = JS.resultSummary({ reportRequired: false, verdicts: ['해당 안 됨'] });
  assert.equal(s.tasks, 1);
  assert.equal(s.taskUnsure, 0);
  assert.equal(s.ok, 0);
  assert.deepEqual(s.byVerdict, { '해당 안 됨': 1 });
});
test('resultSummary: 신고 대상을 모르면 할 일 1개 + 확인 필요 1개 (경계)', () => {
  const s = JS.resultSummary({ reportRequired: null, verdicts: [] });
  assert.equal(s.tasks, 1);
  assert.equal(s.taskUnsure, 1);
});
test('resultSummary: 지원 0건이면 판정 개수 비어 있고 해당 가능 0 (경계)', () => {
  const s = JS.resultSummary({ reportRequired: true, verdicts: [] });
  assert.deepEqual(s.byVerdict, {});
  assert.equal(s.ok, 0);
});
test('resultSummary: 판정 개수 합 = 목록 길이 (요약 숫자 = 아래 목록 개수)', () => {
  const v = ['해당 가능', '확인 필요', '답하면 판정', '해당 안 됨', '마감', '해당 가능'];
  const s = JS.resultSummary({ reportRequired: true, verdicts: v });
  assert.equal(Object.values(s.byVerdict).reduce((a, b) => a + b, 0), v.length);
  assert.equal(s.byVerdict['마감'], 1);
  assert.equal(s.byVerdict['답하면 판정'], 1);
});
test('resultSummary: 입력이 없거나 배열이 아니어도 던지지 않는다 (예외)', () => {
  for (const bad of [undefined, null, {}, { verdicts: 'x' }, { reportRequired: 'yes', verdicts: null }]) {
    const s = JS.resultSummary(bad);
    assert.equal(s.tasks, 1);
    assert.deepEqual(s.byVerdict, {});
    assert.equal(s.ok, 0);
  }
});
test('resultSummary: 문자열이 아니거나 빈 판정은 세지 않는다 (예외)', () => {
  const s = JS.resultSummary({ reportRequired: true, verdicts: ['해당 가능', '', null, 3, undefined] });
  assert.deepEqual(s.byVerdict, { '해당 가능': 1 });
});

// ---------- allMet (F-08 ③) ----------
test('allMet: 조건이 모두 충족(ok === true)이면 참', () => {
  assert.equal(JS.allMet([{ ok: true }, { ok: true }]), true);
});
test('allMet: 하나라도 안 맞음·확인 필요·답하면 판정(ok false/null)이면 거짓', () => {
  assert.equal(JS.allMet([{ ok: true }, { ok: false }]), false);
  assert.equal(JS.allMet([{ ok: true }, { ok: null }]), false);
  assert.equal(JS.allMet([{ ok: true }, {}]), false);
});
test('allMet: 조건 0개는 거짓 — 접을 것이 없다 (경계)', () => {
  assert.equal(JS.allMet([]), false);
});
test('allMet: ok가 참 같은 값이어도 true가 아니면 거짓 (경계)', () => {
  assert.equal(JS.allMet([{ ok: 1 }, { ok: 'true' }]), false);
});
test('allMet: 배열이 아니거나 빈 항목이 있으면 거짓, 던지지 않는다 (예외)', () => {
  for (const bad of [undefined, null, 'x', {}, [null], [{ ok: true }, undefined]]) assert.equal(JS.allMet(bad), false);
});

test('screens-core.js: T-10 함수는 T-10 구역 안에서만 정의', () => {
  const zone = between(CORE, '// ===== T-10 =====', '// ===== /T-10 =====');
  assert.match(zone, /api\.resultSummary\s*=/);
  assert.match(zone, /api\.allMet\s*=/);
  assert.equal(CORE.split('api.resultSummary =').length - 1, 1);
  assert.equal(CORE.split('api.allMet =').length - 1, 1);
});

// ---------- app.html T-10 구역 (F-08 ①~⑤, F-07 범위) ----------
test('viewResult: 시작에 등장 판정, 모든 반환을 .mo-result 루트로 감싼다 (F-07)', () => {
  const v = VIEW();
  const body = v.slice(v.indexOf('function viewResult()'));
  assert.match(body, /function viewResult\(\) \{\n\s+moBegin\('result'\);/, '첫 줄에서 moBegin');
  assert.match(body, /if \(Object\.keys\(err\)\.length\) return moRoot\('result', /, '오류 조기 반환도 감싼다');
  assert.equal(body.split("moRoot('result', ").length - 1, 2, '반환 2곳 모두');
});
test('viewResult: 결과 요약은 resultSummary 값과 moNum 숫자로 (F-08 ①⑤)', () => {
  const v = VIEW();
  assert.match(v, /JS\.resultSummary\(/);
  assert.match(v, /moNum\('result:sum:tasks'/);
  assert.match(v, /moNum\('result:sum:ok'/);
});
test('viewResult: 카드는 차례 등장 클래스(moStep) (F-08 ⑤)', () => {
  assert.ok(VIEW().split('moStep(').length - 1 >= 3);
});
test('viewResult: 조건 줄은 접기 — 기본값은 모두 충족이면 접힘 (F-08 ③)', () => {
  const v = VIEW();
  assert.match(v, /moOpen\('result:cond:' \+/);
  assert.match(v, /!\(JS && JS\.allMet\(/);
  assert.match(v, /moToggle\('result:cond:' \+/);
  assert.match(v, /moPanel\('result:cond:' \+/);
});
test("viewResult: 전입신고 '모두 해당' 배지는 경고색(due·no)이 아니다 (F-08 ④)", () => {
  const v = VIEW();
  const m = v.match(/<span class="badge([^"]*)">모두 해당<\/span>/);
  assert.ok(m, "'모두 해당' 배지 없음");
  assert.doesNotMatch(m[1], /\b(due|no)\b/);
});
test('T-10 CSS: 해당 가능(.badge.brand) 배지에 배경을 되돌린다 — 글자색만이 아님 (F-08 ②)', () => {
  const css = CSS10();
  const rule = css.match(/\.mo-result \.badge\.brand\s*\{([^}]*)\}/);
  assert.ok(rule, '.mo-result .badge.brand 규칙 없음');
  assert.match(rule[1], /background\s*:\s*var\(--brand-tint\)/);
  assert.match(rule[1], /padding\s*:\s*0 8px/);
});
test('T-10 CSS: 선택자는 .mo-result로 시작, keyframes는 mo-result- 접두사 (Architecture 수정 구역)', () => {
  const css = CSS10();
  const sels = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') { sels.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; }
    else if (ch === '}' || ch === ';') buf = '';
    else buf += ch;
  }
  assert.ok(sels.length > 0, 'T-10 CSS 구역이 비어 있음');
  for (const s of sels) {
    if (s.startsWith('@media')) continue;
    if (s.startsWith('@keyframes')) { assert.match(s, /^@keyframes mo-result-[\w-]+$/); continue; }
    if (/^(from|to|\d+%)/.test(s)) continue;
    for (const one of s.split(',')) assert.match(one.trim(), /^\.mo-result\b/, '범위 밖: ' + one.trim());
  }
});
