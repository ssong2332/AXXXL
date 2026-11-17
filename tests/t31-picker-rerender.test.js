// T-31 날짜 칸 달력(브라우저 선택 창)을 처음 누르면 바로 닫히는 버그
// 원인: 선택 창이 열린 직후 render(true)가 #app을 통째로 다시 만들어 그 칸이 바뀐다.
//   ① 다른 칸을 고친 뒤(pendRender) 누르면 pointerup 뒤 flushRender ② 로그인 중 기록 저장이 끝나면 accPaint → render(true)
// app.html의 다시 그리기 보류 블록(`var pendRender` ~ 'pointercancel' 줄)과 render 첫 줄의 보류 조건을
// 파일 텍스트에서 잘라 가짜 document 위에서 실행한다(t27과 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function block() {
  const a = HTML.indexOf('  var pendRender = false, ptrDown = false;');
  assert.ok(a >= 0, 'pendRender 블록 없음');
  const p = HTML.indexOf("'pointercancel'", a);
  return HTML.slice(a, HTML.indexOf('\n', p));
}
// render 안의 보류 조건(고치기 전에는 없다 → 빈 줄)
function gate() {
  const a = HTML.indexOf('  function render(keep) {\n');
  const body = HTML.slice(a, HTML.indexOf('\n  }\n', a));
  const m = body.split('\n').find((l) => /picking/.test(l));
  return m || '';
}

function el(tag, type) {
  return {
    tagName: tag, type: type || '', isConnected: true,
    matches(sel) {
      return sel.split(',').some((s) => {
        s = s.trim();
        const m = /^(\w+)(?:\[type=["']?(\w+)["']?\])?$/.exec(s);
        return !!m && m[1].toUpperCase() === tag && (!m[2] || m[2] === type);
      });
    }
  };
}

function setup() {
  const L = {}, timers = [], calls = [];
  const document = { addEventListener(ev, fn) { (L[ev] = L[ev] || []).push(fn); } };
  const setTimeout = (fn) => { timers.push(fn); };
  const src = 'var render = function (keep) {\n' + gate() + '\n pendRender = false; calls.push(keep); };\n' + block() +
    '\nreturn { render: render, setPend: function () { pendRender = true; }, pend: function () { return pendRender; } };';
  // eslint-disable-next-line no-new-func
  const api = new Function('document', 'setTimeout', 'calls', src)(document, setTimeout, calls);
  const fire = (ev, target, extra) => (L[ev] || []).forEach((fn) => fn(Object.assign({ target }, extra)));
  const run = () => { while (timers.length) timers.shift()(); };
  // 실제 클릭 순서: pointerdown → (이전 칸 change·focusout) → focusin → pointerup → click
  const click = (target, before) => { fire('pointerdown', target); if (before) before(); fire('focusin', target); fire('pointerup', target); fire('click', target); };
  return Object.assign(api, { fire, run, click, calls });
}

test('재현①(#input): 다른 칸을 고친 뒤 날짜 칸을 누르면, 누른 직후 다시 그리지 않는다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.setPend();   // 보증금 칸 change → pendRender = true (ptrDown 중이라 바로 안 그림)
  h.click(date);
  h.run();
  assert.deepEqual(h.calls, [], '선택 창이 열린 직후 render가 불렸다');
  assert.equal(h.pend(), true, '미룬 다시 그리기를 잃으면 안 된다');
});

test('재현②(#start 로그인): 날짜 칸을 누른 뒤 배경 render(true)는 미룬다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date);
  h.run();
  h.render(true);   // accPaint → render(true)
  assert.deepEqual(h.calls, []);
  assert.equal(h.pend(), true);
});

test('정상: 날짜를 고르면(change) 미뤄 둔 다시 그리기를 바로 한다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date);
  h.render(true);
  h.fire('change', date);
  h.setPend(); h.render(true);   // 앱의 change 처리: setField → pendRender → flushRender
  assert.deepEqual(h.calls, [true]);
});

test('정상: 고르지 않고 칸을 떠나면(focusout) 미뤄 둔 다시 그리기를 한다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date);
  h.render(true);
  h.fire('focusout', date);
  h.run();
  assert.deepEqual(h.calls, [true]);
});

test('경계: 월(month)·시간(time)·목록(select)도 같은 보호를 받는다', () => {
  for (const t of [el('INPUT', 'month'), el('INPUT', 'time'), el('SELECT')]) {
    const h = setup();
    h.click(t); h.run(); h.render(true);
    assert.deepEqual(h.calls, [], t.tagName + ' ' + t.type);
  }
});

test('회귀: 숫자 칸을 고친 뒤 버튼을 누르면 예전처럼 pointerup 뒤에 다시 그린다', () => {
  const h = setup(), btn = el('BUTTON');
  h.setPend();
  h.click(btn);
  h.run();
  assert.deepEqual(h.calls, [true]);
});

test('회귀: 글자 칸(input text)을 누른 경우도 그대로 다시 그린다', () => {
  const h = setup(), txt = el('INPUT', 'text');
  h.setPend();
  h.click(txt);
  h.run();
  assert.deepEqual(h.calls, [true]);
});

test('회귀: 화면 이동(render(false))은 날짜 칸을 누른 중에도 미루지 않는다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date);
  h.render(false);
  assert.deepEqual(h.calls, [false]);
});

// 리뷰 치명 #1: 선택 창이 안 열린 채 끝난 누르기(휴대폰 스크롤 = pointercancel)는 보류를 남기면 안 된다
test('예외: 목록 칸에서 시작한 스크롤(pointercancel) 뒤 다른 버튼을 누르면 다시 그린다', () => {
  const h = setup(), sel = el('SELECT'), btn = el('BUTTON');
  h.fire('pointerdown', sel); h.fire('pointercancel', sel); h.run();
  h.click(btn); h.run();
  h.render(true);   // 납부 체크·항목 추가 등
  assert.deepEqual(h.calls, [true]);
});

test('예외: 날짜 칸 위 pointercancel만으로 끝나도 이후 render(true)를 막지 않는다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.fire('pointerdown', date); h.fire('pointercancel', date); h.run();
  h.render(true);
  assert.deepEqual(h.calls, [true]);
});

// PR #106 리뷰 1: Escape로 선택 창만 닫으면 포커스가 칸에 남아 change·focusout이 오지 않는다
test('예외: 선택 창을 Escape로 닫으면 미뤄 둔 다시 그리기를 바로 한다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date); h.run();
  h.render(true);   // 창이 열린 동안 온 배경 갱신 → 보류
  assert.deepEqual(h.calls, []);
  h.fire('keydown', date, { key: 'Escape' }); h.run();
  assert.deepEqual(h.calls, [true]);
  h.render(true);   // 닫은 뒤 갱신은 바로
  assert.deepEqual(h.calls, [true, true]);
});

test('경계: 다른 키(Tab 아닌 화살표)나 다른 칸의 Escape는 보류를 풀지 않는다', () => {
  const h = setup(), date = el('INPUT', 'date'), other = el('INPUT', 'text');
  h.click(date); h.run(); h.render(true);
  h.fire('keydown', date, { key: 'ArrowDown' }); h.fire('keydown', other, { key: 'Escape' }); h.run();
  assert.deepEqual(h.calls, []);
});

test('경계: 누른 날짜 칸이 이미 화면에서 사라졌으면 미루지 않는다', () => {
  const h = setup(), date = el('INPUT', 'date');
  h.click(date);
  date.isConnected = false;
  h.render(true);
  assert.deepEqual(h.calls, [true]);
});
