// T-24 PR #66 리뷰 반영 R1~R3 (DECISIONS #29, Architecture 수정 구역 T-24 행)
// app.html 함수·줄은 파일 텍스트에서 잘라 new Function으로 만든다(t23-bugfix.test.js와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JE = require('../demo/engine.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function fnText(head, next) {
  const a = HTML.indexOf(head);
  const b = HTML.indexOf(next, a + head.length);
  assert.ok(a >= 0 && b > a, head + ' 없음');
  return HTML.slice(a, b);
}
function lineOf(head) {
  const a = HTML.indexOf(head);
  assert.ok(a >= 0, head + ' 없음');
  return HTML.slice(a, HTML.indexOf('\n', a));
}
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const realToday = () => new Date(2026, 10, 16);
const pd = (s) => { const p = String(s || '').split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? realToday() : d; };

// ---------- R0 공용 검사 inputErr ----------
function runInputErr(S, AMT_NOTE) {
  const src = lineOf('  function birthErr(err) {') + '\n' + fnText('  function inputErr() {', '\n  function viewInput() {');
  // eslint-disable-next-line no-new-func
  return new Function('JE', 'S', 'pd', 'iso', 'realToday', 'AMT_NOTE', src + '\nreturn inputErr;')(JE, S, pd, iso, realToday, AMT_NOTE || {})();
}
const OK = { deposit: 500, rent: 50, term: 2, contract: '2026-11-01', move: '2026-11-20', birth: '2000-05' };
const S0 = (o) => Object.assign({}, OK, o);
const MOVE_MSG = '입주일이 계약일보다 빨라요. 날짜를 확인해 주세요.';
const BIRTH_MSG = '출생연월이 계약일이나 이번 달보다 늦어요. 날짜를 확인해 주세요.';

test('R0: 올바른 값·금액 안내 없음 → 고칠 칸 0개 (정상)', () => {
  assert.deepEqual(runInputErr(S0({})), {});
});
test('R1: 보증금·월세 해석 실패(AMT_NOTE) → 그 칸을 고칠 칸으로 셈, 문구는 빈 값 (정상 — 리뷰 1)', () => {
  const e = runInputErr(S0({}), { deposit: '오백만원인가' });
  assert.deepEqual(Object.keys(e), ['deposit']);
  assert.equal(e.deposit, '');
  assert.deepEqual(Object.keys(runInputErr(S0({}), { deposit: 'x', rent: 'y' })).sort(), ['deposit', 'rent']);
});
test('R1: 관리비만 해석 실패 → #input 고칠 칸에 세지 않음 (경계 — 판정에 안 쓰는 칸)', () => {
  assert.deepEqual(runInputErr(S0({}), { fee: '이천' }), {});
});
test('R1: validate 오류가 이미 있는 칸은 그 문구를 덮지 않음 (예외)', () => {
  const e = runInputErr(S0({ deposit: -1 }), { deposit: 'x' });
  assert.equal(e.deposit, JE.validate(S0({ deposit: -1 })).deposit);
  assert.ok(e.deposit.length > 0);
});
test('R2: 입주일 < 계약일 → 같은 문구 (정상 — 리뷰 2)', () => {
  assert.equal(runInputErr(S0({ contract: '2026-11-20', move: '2026-11-10' })).move, MOVE_MSG);
});
test('R2: 같은 날 → 없음, 계약일 비어 있음 → 기존 계약일 문구만 (경계·예외)', () => {
  assert.deepEqual(runInputErr(S0({ contract: '2026-11-20', move: '2026-11-20' })), {});
  const e = runInputErr(S0({ contract: '', move: '2026-11-10' }));
  assert.equal(e.move, undefined);
  assert.equal(e.contract, '계약일을 넣어 주세요');
});
test('R0: 미래 출생연월 → birthErr 문구, 형식 오류 문구는 그대로 (예외)', () => {
  assert.equal(runInputErr(S0({ birth: '2030-01' })).birth, BIRTH_MSG);
  assert.equal(runInputErr(S0({ birth: '2030-13' })).birth, '출생연월 형식이 맞지 않아요');
});
test('R0: inputErr 본문 줄 나눔·B5 줄 글자 그대로 (설계 7줄)', () => {
  const body = fnText('  function inputErr() {', '\n  function viewInput() {').split('\n');
  assert.deepEqual(body, [
    '  function inputErr() {',
    '    var err = JE.validate(S);',
    "    if (!err.contract && !err.move && pd(S.move) < pd(S.contract)) err.move = '입주일이 계약일보다 빨라요. 날짜를 확인해 주세요.';",
    '    birthErr(err);',
    "    ['deposit', 'rent'].forEach(function (k) { if (AMT_NOTE[k] && !err[k]) err[k] = ''; });",
    '    return err;',
    '  }'
  ]);
});

// ---------- R1·R2 viewInput·viewResult가 같은 기준 ----------
test('R1·R2: viewInput·viewResult가 inputErr()를 각 1번 쓰고 JE.validate(S)를 직접 부르지 않음 (정적 — 리뷰 2)', () => {
  const vi = fnText('  function viewInput() {', '\n    var f = function');
  const vr = fnText('  function viewResult() {', '\n    var R = evaluate()');
  [vi, vr].forEach((v) => {
    assert.equal(v.split('var err = inputErr();').length - 1, 1);
    assert.equal(v.split('JE.validate(S)').length - 1, 0);
    assert.equal(v.split('birthErr(err);').length - 1, 0);
  });
  assert.match(vr, /if \(Object\.keys\(err\)\.length\) return moRoot\('result', .*조건에 고칠 칸이 있어 판정할 수 없어요/);
});

// ---------- R1 길잡이 2단계 '다음' ----------
function obnextBlock() { return fnText("    else if (a === 'obnext') {", "\n    else if (a === 'obprev')"); }
function runObnextR1(st, AMT_NOTE) {
  const line = obnextBlock().split('\n').filter((l) => /AMT_NOTE\.deposit \|\| AMT_NOTE\.rent \|\| AMT_NOTE\.fee/.test(l));
  assert.equal(line.length, 1, 'obnext에 금액 해석 실패 검사 줄 없음');
  const log = [];
  // eslint-disable-next-line no-new-func
  const blocked = new Function('st', 'AMT_NOTE', 'toast', line[0] + '\nreturn false;')(st, AMT_NOTE, (m) => log.push(m));
  return { blocked: blocked === undefined, log };
}
test('R1: 길잡이 2단계에서 금액 해석 실패면 다음을 막고 안내 (정상 — 리뷰 1)', () => {
  const r = runObnextR1(2, { rent: '오십' });
  assert.equal(r.blocked, true);
  assert.deepEqual(r.log, ['금액으로 읽지 못한 칸이 있어요. 칸 아래 안내대로 고쳐 주세요.']);
  assert.equal(runObnextR1(2, { fee: '이천' }).blocked, true); // 2단계에 보이는 관리비도 막음
});
test('R1: 해석 실패 없음·다른 단계 → 막지 않음 (경계)', () => {
  assert.deepEqual(runObnextR1(2, {}), { blocked: false, log: [] });
  assert.deepEqual(runObnextR1(3, { deposit: 'x' }), { blocked: false, log: [] });
});
test('R1: 검사 줄 위치 — 1단계 날짜 줄 다음, 2단계 금액 0 검사 줄 앞 (정적)', () => {
  const lines = obnextBlock().split('\n');
  const i1 = lines.findIndex((l) => l.includes("if (st === 1 && pd(S.move) < pd(S.contract))"));
  const iR = lines.findIndex((l) => l.includes('AMT_NOTE.deposit || AMT_NOTE.rent || AMT_NOTE.fee'));
  const i2 = lines.findIndex((l) => l.includes("if (st === 2 && !(+S.deposit > 0 || +S.rent > 0))"));
  assert.ok(i1 >= 0 && iR === i1 + 1 && i2 === iR + 1, [i1, iR, i2].join(','));
});

// ---------- R3 길잡이 4단계 완료 ----------
function runObdone(oe) {
  let line = lineOf("    else if (a === 'obdone') {").trim().replace(/^else /, '');
  const env = { S: { onboarded: false, obStep: 4, done: { x: true } }, saved: 0, toasts: [], loc: { hash: 'start' }, rendered: 0 };
  // eslint-disable-next-line no-new-func
  new Function('a', 'S', 'save', 'location', 'render', 'toast', 'inputErr', line)('obdone', env.S, () => env.saved++, env.loc, () => env.rendered++, (m) => env.toasts.push(m), () => oe);
  return env;
}
test('R3: 미래 출생연월이면 완료를 막고 그 문구로 안내 (정상 — 리뷰 3)', () => {
  const e = runObdone({ birth: BIRTH_MSG });
  assert.equal(e.S.onboarded, false);
  assert.equal(e.saved, 0);
  assert.equal(e.loc.hash, 'start');
  assert.deepEqual(e.toasts, [BIRTH_MSG]);
});
test('R3: 출생연월 문제 없음 → 지금처럼 완료 (경계)', () => {
  const e = runObdone({});
  assert.equal(e.S.onboarded, true);
  assert.equal(e.S.obStep, 1);
  assert.deepEqual(e.S.done, {});
  assert.equal(e.saved, 1);
  assert.equal(e.loc.hash, 'home');
  assert.equal(e.toasts.length, 1);
});
test('R3: 다른 칸 오류(birth 없음)로는 막지 않음 (예외 — 범위 밖 흐름 불변)', () => {
  const e = runObdone({ deposit: '보증금을(를) 0 이상 숫자로 넣어 주세요', move: MOVE_MSG });
  assert.equal(e.S.onboarded, true);
});
test('R3: 완료 줄 뒤쪽은 그대로, 검사는 S.onboarded 앞 (정적)', () => {
  assert.equal(lineOf("    else if (a === 'obdone') {"), "    else if (a === 'obdone') { var oe = inputErr(); if (oe.birth) { toast(oe.birth); return; } S.onboarded = true; S.obStep = 1; S.done = {}; save(); location.hash = 'home'; render(false); toast('내 일정으로 계산했어요. 할 일을 하나씩 체크해 보세요.'); }");
});

// ---------- R4 값 통째 교체 시 금액 안내 비우기 (DECISIONS #30) ----------
function runBranch(act, opts) {
  const line = lineOf("    else if (a === '" + act + "') {").trim().replace(/^else /, '');
  const env = { save: 0, render: 0, toasts: [], loc: { hash: 'input' } };
  const S = { demo: !!opts.demo, deposit: 500 };
  // eslint-disable-next-line no-new-func
  const out = new Function('a', 'S', 'AMT_NOTE', 'DEMO', 'FRESH', 'clone', 'save', 'render', 'toast', 'confirm', 'location', 'PC', 'DATA',
    line + '\nreturn { S: S, AMT_NOTE: AMT_NOTE };')(act, S, opts.note, { demo: true, deposit: 1000 }, { demo: false, deposit: 0 },
    (o) => JSON.parse(JSON.stringify(o)), () => env.save++, () => env.render++, (m) => env.toasts.push(m), () => opts.confirm !== false, env.loc, {}, null);
  return Object.assign(env, out);
}
test('R4: 예시 reset 뒤 금액 안내가 빈 객체 (정상 — 예시 둘러보기 demo·startreal은 없앰)', () => {
  const r1 = runBranch('reset', { demo: true, note: { deposit: '이천' } });
  assert.deepEqual(r1.AMT_NOTE, {}); assert.equal(r1.S.deposit, 1000);
});
test('R4: 실제 사용자 reset 확인 → 비움, 취소 → 안내·값 그대로 (예외)', () => {
  const ok = runBranch('reset', { demo: false, note: { deposit: '이천' }, confirm: true });
  assert.deepEqual(ok.AMT_NOTE, {}); assert.equal(ok.loc.hash, 'start');
  const no = runBranch('reset', { demo: false, note: { deposit: '이천' }, confirm: false });
  assert.equal(no.AMT_NOTE.deposit, '이천'); assert.equal(no.S.deposit, 500); assert.equal(no.save, 0); assert.equal(no.render, 0);
});
test('R4: 이미 빈 객체여도 빈 객체, save·render 호출 수 그대로 (경계)', () => {
  [['reset', { demo: true }, 1, 1], ['reset', { demo: false, confirm: true }, 1, 1]].forEach(([act, o, sv, rd]) => {
    const r = runBranch(act, Object.assign({ note: {} }, o));
    assert.deepEqual(r.AMT_NOTE, {}); assert.equal(r.save, sv, act); assert.equal(r.render, rd, act);
  });
});
test('R4: AMT_NOTE = {}; 정확히 6번, 각각 S 통째 대입 바로 뒤, 다른 줄 불변 (정적)', () => {
  assert.equal((HTML.match(/(?<!var )AMT_NOTE = \{\};/g) || []).length, 6); // 선언 `var AMT_NOTE = {};` 1번은 빼고 셈 (계정 동기화 2곳·boot 예시 정리 포함)
  ['S = clone(DEMO); AMT_NOTE = {}; save(); render(true);',
    'S = clone(FRESH); AMT_NOTE = {}; save(); DATA = ',
    'if (S.demo) { S = clone(FRESH); AMT_NOTE = {}; save(); }',   // boot: 예시 데이터로 보던 기기는 빈 상태로
    'S = migrate(Object.assign(clone(FRESH), o, { onboarded: true, demo: false, sim: null })); AMT_NOTE = {}; save();',
    'S = clone(FRESH); AMT_NOTE = {}; try { localStorage.setItem(STORE',   // 계정: 다른 계정이 로그인하면 이 기기 기록 비움
    'S = Object.assign(clone(FRESH), keep); AMT_NOTE = {}; }'                // 계정: 빈 기기에 서버 기록 불러오기
  ].forEach((s) => assert.equal(HTML.split(s).length - 1, 1, s));
  const assigns = HTML.split('\n').filter((l) => /\bS = (clone|migrate)\(/.test(l)).length;
  assert.equal(assigns, 5); // var S 첫 값·restoreJson·reset(두 갈래 한 줄)·boot 예시 정리·계정 주인 바뀜
  assert.equal(lineOf('  var AMT_NOTE = {};'), '  var AMT_NOTE = {};   // T-23 B6: 금액으로 읽지 못한 원문(칸별, 저장 안 함) — DECISIONS #24');
  assert.ok(!/data-act="demo"/.test(HTML) && !/a === 'demo'\)/.test(HTML), '예시 둘러보기 진입점 없음');
});

// ---------- R5 금액 칸에 입력 원문 보이기 (DECISIONS #31) ----------
const JSC = require('../demo/screens-core.js');
const escR5 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function makeAmt(S) {
  const three = lineOf('  var AMT_NOTE = {};') + '\n' + lineOf('  function amtNote(k)') + '\n' + lineOf('  function amtVal(k, v)');
  const sf = fnText('  function setField(t) {', '\n  document.addEventListener(\'submit\'');
  const env = { saved: 0 };
  // eslint-disable-next-line no-new-func
  const r = new Function('esc', 'S', 'save', 'JS', three + '\n' + sf + '\nreturn { AMT_NOTE: AMT_NOTE, amtVal: amtVal, setField: setField };')(escR5, S || {}, () => env.saved++, JSC);
  r.env = env;
  r.set = (k, v) => r.setField({ value: v, dataset: { field: k }, hasAttribute: (a) => a === 'data-num' });
  return r;
}
test('R5: 해석 실패 원문이 있으면 칸 값은 그 원문 (정상)', () => {
  const r = makeAmt();
  r.AMT_NOTE.deposit = '이천';
  assert.equal(r.amtVal('deposit', 500), '이천');
});
test('R5: 기록 없음·빈 원문이면 지금 값 그대로 (경계)', () => {
  const r = makeAmt();
  assert.equal(r.amtVal('deposit', 500), '500');
  assert.equal(r.amtVal('fee', ''), '');
  r.AMT_NOTE.deposit = '';
  assert.equal(r.amtVal('deposit', 500), '500');
});
test('R5: 원문은 이스케이프 — 속성 값 탈출 없음 (예외)', () => {
  const r = makeAmt();
  r.AMT_NOTE.rent = '"><b>';
  assert.equal(r.amtVal('rent', 50), '&quot;&gt;&lt;b&gt;');
});
test('R5: setField 연결 — 이천이면 칸 이천·S 유지, 같은 값 500 재입력이면 칸 500·안내 삭제', () => {
  const S = { deposit: 500 };
  const r = makeAmt(S);
  r.set('deposit', '이천');
  assert.equal(r.amtVal('deposit', S.deposit), '이천');
  assert.equal(S.deposit, 500);
  assert.equal(r.env.saved, 0);
  r.set('deposit', '500');
  assert.equal(r.amtVal('deposit', S.deposit), '500');
  assert.ok(!('deposit' in r.AMT_NOTE));
  assert.equal(r.env.saved, 1);
});
test('R5: 세 num 줄 value 식 교체, 옛 식 0개, amtVal 호출 3곳+정의 1곳, 선언 줄 불변 (정적)', () => {
  const nums = HTML.split('\n').filter((l) => /var num = function/.test(l) && /data-num/.test(l));
  assert.equal(nums.length, 3);
  assert.equal(nums.filter((l) => l.includes("value=\"' + amtVal(k, S[k]) + '\"")).length, 2);
  assert.equal(nums.filter((l) => l.includes("value=\"' + amtVal(k, S[k] || '') + '\"")).length, 1);
  nums.forEach((l) => {
    assert.ok(!l.includes("value=\"' + S[k] + '\""), l);
    assert.ok(!l.includes('esc(S[k])'), l);
    assert.ok(!l.includes("value=\"' + (S[k] || '') + '\""), l);
  });
  assert.equal(HTML.split('amtVal(').length - 1, 4);
  assert.equal(HTML.split('\n').filter((l) => /data-num\b/.test(l)).length, 5);
  assert.equal(lineOf('  var AMT_NOTE = {};'), '  var AMT_NOTE = {};   // T-23 B6: 금액으로 읽지 못한 원문(칸별, 저장 안 함) — DECISIONS #24');
  assert.equal(lineOf('  function amtNote(k)'), "  function amtNote(k) { return AMT_NOTE[k] ? '<em class=\"s12\" style=\"color:var(--no);font-style:normal\" role=\"alert\">\\'' + esc(AMT_NOTE[k]) + '\\'은(는) 금액으로 읽지 못했어요. 숫자나 \\'1억 2천\\'처럼 넣어 주세요.</em>' : ''; }");
  assert.equal(lineOf('    if (t.hasAttribute(\'data-num\')) {'), "    if (t.hasAttribute('data-num')) { if (JS && JS.parseAmount) { var a = JS.parseAmount(v); if (!a.ok) { AMT_NOTE[k] = String(v).slice(0, 20); return; } delete AMT_NOTE[k]; v = a.value; } else { var n = parseInt(String(v).replace(/[^0-9]/g, ''), 10); v = isNaN(n) ? 0 : n; } }");
});
