// T-26 조건 입력 금액 단위 확인 안내 (PRD F-14, DECISIONS #33, Architecture 데이터 모델 JS.amountUnitWarn 행)
// app.html 줄은 파일 텍스트에서 잘라 new Function으로 만든다(t24-review.test.js와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const MSG = '만 원 단위가 맞나요?';
const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function lineOf(head) {
  const a = HTML.indexOf(head);
  assert.ok(a >= 0, head + ' 없음');
  return HTML.slice(a, HTML.indexOf('\n', a));
}

// --- 순수 함수 ---
test('정상: 월세 45 → 안내 없음, 월세 450000 → 안내', () => {
  assert.equal(JS.amountUnitWarn('rent', 45), '');
  assert.equal(JS.amountUnitWarn('rent', 450000), MSG);
});

test('경계: 월세 1000 → 없음, 1001 → 안내', () => {
  assert.equal(JS.amountUnitWarn('rent', 1000), '');
  assert.equal(JS.amountUnitWarn('rent', 1001), MSG);
});

test('경계: 보증금 200000 → 없음, 200001 → 안내', () => {
  assert.equal(JS.amountUnitWarn('deposit', 200000), '');
  assert.equal(JS.amountUnitWarn('deposit', 200001), MSG);
});

test('예외: 숫자 아님(문자열 숫자·null·undefined·NaN·객체) → 빈 문자열, 던지지 않음', () => {
  for (const v of ['450000', null, undefined, NaN, {}, []]) {
    assert.equal(JS.amountUnitWarn('rent', v), '', String(v));
    assert.equal(JS.amountUnitWarn('deposit', v), '', String(v));
  }
});

test('예외: 음수·다른 키·키 없음 → 빈 문자열', () => {
  assert.equal(JS.amountUnitWarn('rent', -5000), '');
  assert.equal(JS.amountUnitWarn('fee', 999999), '');
  assert.equal(JS.amountUnitWarn('__proto__', 999999), '');
  assert.equal(JS.amountUnitWarn(undefined, 999999), '');
});

// --- app.html viewInput 보증금·월세 줄 ---
const LINE = lineOf("      f('보증금', num('deposit', '만 원'), 'deposit'");
// f를 가짜로 바꿔 넷째 인자(hint)를 키별로 모은다
function hints(js, AMT_NOTE, S) {
  const got = {};
  const f = (lab, inner, k, hint) => { got[k] = hint; return ''; };
  const num = () => '';
  new Function('JS', 'AMT_NOTE', 'S', 'f', 'num', 'return ' + LINE.trim().replace(/\s*\+$/, ''))(js, AMT_NOTE, S, f, num);
  return got;
}

test('화면 줄: 월세 450000·보증금 200001 → 두 칸 모두 안내, 정상 금액은 빈 값', () => {
  assert.deepEqual(hints(JS, {}, { deposit: 200001, rent: 450000 }), { deposit: MSG, rent: MSG });
  assert.deepEqual(hints(JS, {}, { deposit: 500, rent: 45 }), { deposit: '', rent: '' });
});

test('화면 줄: 해석 실패 안내(AMT_NOTE)가 있는 칸은 단위 안내를 넘기지 않음, screens-core 없으면 빈 값', () => {
  assert.deepEqual(hints(JS, { rent: '450000원' }, { deposit: 200001, rent: 450000 }), { deposit: MSG, rent: '' });
  assert.deepEqual(hints(null, {}, { deposit: 200001, rent: 450000 }), { deposit: '', rent: '' });
});

test('화면 줄: 오류 문구가 있으면 기존 f대로 오류만 보이고 안내는 안 보임', () => {
  const fLine = lineOf('    var f = function (lab, inner, k, hint)');
  const mk = (err) => new Function('INPUT_WIDE', 'err', fLine.trim().replace(/^var f = /, 'return ').replace(/;$/, ''))({}, err);
  const withErr = mk({ rent: '월세를 확인해 주세요.' })('월세', '', 'rent', MSG);
  assert.ok(withErr.includes('role="alert"') && !withErr.includes(MSG));
  const noErr = mk({})('월세', '', 'rent', MSG);
  assert.ok(noErr.includes(MSG) && !noErr.includes('role="alert"'));
});
