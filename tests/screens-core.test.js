// 내 화면 6개(계약·신고) 모션 순수 함수 단위 테스트 (F-07 ②③, N-04) — T-09
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

// ---------- 토큰 ----------
test('토큰: 9개 값이 Architecture 토큰 표와 같다', () => {
  assert.deepEqual(JS.T, {
    short: 200, base: 300, long: 400, step: 50, maxStep: 6, total: 600, shift: 8,
    ease: 'cubic-bezier(0.2, 0, 0, 1)', easeIO: 'cubic-bezier(0.4, 0, 0.2, 1)'
  });
});
test('토큰: 모션 하나 길이는 0.2~0.4초 안 (N-04)', () => {
  for (const k of ['short', 'base', 'long']) assert.ok(JS.T[k] >= 200 && JS.T[k] <= 400, k);
});
test('토큰: 마지막 차례 지연 + 기본 길이 = 전체 상한 600ms 이하 (F-07 ③)', () => {
  assert.equal(JS.T.step * JS.T.maxStep + JS.T.base, JS.T.total);
  assert.ok(JS.T.total <= 600);
});
test('토큰: 바꿀 수 없다 (단일 원본)', () => {
  assert.ok(Object.isFrozen(JS.T));
});

// ---------- 등장 판정 ----------
test('isEnter: 다른 화면에서 들어오면 등장', () => {
  assert.equal(JS.isEnter('home', 'result'), true);
});
test('isEnter: 첫 로드(직전 화면 빈 문자열)는 등장 (경계)', () => {
  assert.equal(JS.isEnter('', 'result'), true);
});
test('isEnter: 같은 화면 다시 그리기(render(true))는 등장 아님', () => {
  assert.equal(JS.isEnter('result', 'result'), false);
});
test('isEnter: 직전 화면 undefined·null도 등장으로 본다 (예외)', () => {
  assert.equal(JS.isEnter(undefined, 'timeline'), true);
  assert.equal(JS.isEnter(null, 'timeline'), true);
});

test('shouldAnimate: 줄이기 꺼짐 + 등장일 때만 참', () => {
  assert.equal(JS.shouldAnimate(false, true), true);
  assert.equal(JS.shouldAnimate(true, true), false);
  assert.equal(JS.shouldAnimate(false, false), false);
  assert.equal(JS.shouldAnimate(true, false), false);
});
test('shouldAnimate: 값이 비면 재생하지 않는 쪽으로 (예외)', () => {
  assert.equal(JS.shouldAnimate(undefined, undefined), false);
  assert.equal(JS.shouldAnimate(false, 1), true);
});

// ---------- 차례 ----------
test('stepIndex: 0~6은 그대로', () => {
  assert.equal(JS.stepIndex(0), 0);
  assert.equal(JS.stepIndex(3), 3);
  assert.equal(JS.stepIndex(6), 6);
});
test('stepIndex: 6 초과는 6 (경계)', () => {
  assert.equal(JS.stepIndex(7), 6);
  assert.equal(JS.stepIndex(1000), 6);
  assert.equal(JS.stepIndex(Infinity), 6);
});
test('stepIndex: 음수·NaN·숫자 아님은 0 (예외)', () => {
  assert.equal(JS.stepIndex(-1), 0);
  assert.equal(JS.stepIndex(NaN), 0);
  assert.equal(JS.stepIndex(undefined), 0);
  assert.equal(JS.stepIndex('abc'), 0);
});
test('stepIndex: 소수는 내림, 숫자 문자열은 숫자로', () => {
  assert.equal(JS.stepIndex(2.9), 2);
  assert.equal(JS.stepIndex('4'), 4);
});
test('stepDelay: 차례 × 50ms, 최대 300ms', () => {
  assert.equal(JS.stepDelay(0), 0);
  assert.equal(JS.stepDelay(2), 100);
  assert.equal(JS.stepDelay(99), 300);
  assert.equal(JS.stepDelay(-5), 0);
  assert.ok(JS.stepDelay(99) + JS.T.base <= JS.T.total);
});

// ---------- 숫자 카운트 ----------
test('countAt: 시작 0, 끝은 정확히 목표값', () => {
  assert.equal(JS.countAt(0, 100, 0), 0);
  assert.equal(JS.countAt(0, 100, 1), 100);
  assert.equal(JS.countAt(3, 7, 1), 7);
});
test('countAt: 중간은 감속 곡선 — 절반 시간에 절반보다 많이 와 있다', () => {
  const v = JS.countAt(0, 100, 0.5);
  assert.ok(Number.isInteger(v));
  assert.ok(v > 50 && v < 100, String(v));
});
test('countAt: 진행이 늘면 값이 줄지 않는다', () => {
  let prev = -1;
  for (let i = 0; i <= 20; i++) { const v = JS.countAt(0, 40, i / 20); assert.ok(v >= prev); prev = v; }
});
test('countAt: 줄어드는 방향도 (직전 값 → 새 값)', () => {
  assert.equal(JS.countAt(10, 4, 0), 10);
  assert.equal(JS.countAt(10, 4, 1), 4);
  const m = JS.countAt(10, 4, 0.5);
  assert.ok(m >= 4 && m <= 10);
});
test('countAt: 진행값은 0..1로 자른다 (경계)', () => {
  assert.equal(JS.countAt(0, 100, -0.5), 0);
  assert.equal(JS.countAt(0, 100, 1.5), 100);
});
test('countAt: 진행값 NaN은 0, 시작값이 숫자 아니면 목표값 (예외)', () => {
  assert.equal(JS.countAt(0, 100, NaN), 0);
  assert.equal(JS.countAt(undefined, 9, 0), 9);
  assert.equal(JS.countAt('x', 9, 0.5), 9);
});
test('countAt: 목표값이 숫자 아니면 0, 던지지 않는다 (예외)', () => {
  assert.equal(JS.countAt(0, undefined, 1), 0);
  assert.equal(JS.countAt(5, NaN, 1), 0);
});

// ---------- 화면 작업 구역 (T-10~T-13 동시 작업) ----------
test('screens-core.js: T-09~T-13 구역 마커가 각 1번, 순서대로', () => {
  const src = fs.readFileSync(path.join(__dirname, '../demo/screens-core.js'), 'utf8');
  const ids = ['T-09', 'T-10', 'T-11', 'T-12', 'T-13'];
  let at = -1;
  for (const id of ids) {
    for (const m of ['// ===== ' + id + ' =====', '// ===== /' + id + ' =====']) {
      const parts = src.split(m);
      assert.equal(parts.length - 1, 1, m + ' 개수');
      const i = src.indexOf(m);
      assert.ok(i > at, m + ' 순서');
      at = i;
    }
  }
});
test('screens-core.js: DOM·저장소·전역 상태에 손대지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../demo/screens-core.js'), 'utf8');
  assert.doesNotMatch(src, /\b(document|localStorage|window\.|setTimeout|S\.)/);
});
