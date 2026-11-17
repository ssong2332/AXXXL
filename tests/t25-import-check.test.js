// T-25 QR 받기(#import=) 계약 값 형식 검사 (PRD F-13, DECISIONS #32, Architecture 데이터 모델 JS.checkImport 행)
// app.html 받는 줄은 파일 텍스트에서 잘라 new Function으로 돌린다(t23-bugfix.test.js와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JE = require('../demo/engine.js');
const JS = require('../demo/screens-core.js');
const JL = require('../demo/life-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
const RECV_HEAD = '      decodePayload(dd).then(';
function recvLine() {
  const a = HTML.indexOf(RECV_HEAD);
  assert.ok(a >= 0, '받는 줄 없음');
  return HTML.slice(a, HTML.indexOf('\n', a));
}

const KEYS = ['gu', 'addr', 'deposit', 'rent', 'fee', 'term', 'age', 'income', 'contract', 'move', 'done', 'bills', 'events', 'home', 'remind', 'nick', 'sido', 'zip', 'sgg', 'birth', 'homeless', 'dup'];
// PC '휴대폰으로 이어서 보기'가 만든 값 모양(exportObj 22개 키)
function pcPayload(over) {
  return Object.assign({
    gu: '관악구', addr: '서울 관악구 봉천동', deposit: 1000, rent: 50, fee: 5, term: 2, age: 25, income: '100',
    contract: '2026-01-10', move: '2026-02-01', done: { movein: true }, bills: [], events: [],
    home: { lat: 37.48, lng: 126.95 }, remind: '3', nick: '민수', sido: '서울특별시', zip: '08700', sgg: '관악구',
    birth: '2000-05', homeless: 'yes', dup: 'no'
  }, over || {});
}
function phoneState() {
  return {
    gu: '마포구', addr: '', deposit: 500, rent: 40, fee: 0, term: 2, age: 24, income: '150',
    contract: '2025-03-01', move: '2025-03-15', done: {}, bills: [], events: [], home: null, remind: '',
    nick: '', sido: null, zip: null, sgg: null, birth: null, homeless: null, dup: null, onboarded: false, demo: true
  };
}

// 받는 줄을 가짜 환경에서 실행. decodePayload는 payload로 바로 콜백을 부른다.
function runRecv(payload, opt) {
  opt = opt || {};
  const calls = [];
  const S = phoneState();
  const before = JSON.stringify(S);
  const env = {
    dd: 'x',
    decodePayload: () => ({ then: (f) => { f(payload); return { catch: () => {} }; } }),
    exportObj: () => { const o = {}; KEYS.forEach((k) => { o[k] = S[k]; }); return o; },
    JL, clone: (x) => JSON.parse(JSON.stringify(x)), FRESH: { bills: [] },
    JS: 'JS' in opt ? opt.JS : JS,
    confirm: () => { calls.push('confirm'); return opt.no ? false : true; },
    migrate: (s) => { calls.push('migrate:' + (s === S) + ':demo=' + s.demo); },
    save: () => calls.push('save'), PC: {}, loadPlaces: () => calls.push('loadPlaces'),
    render: () => calls.push('render'), toast: (m) => calls.push('toast:' + m)
  };
  const names = Object.keys(env).concat('S');
  new Function(...names, recvLine()).apply(null, names.map((n) => (n === 'S' ? S : env[n])));
  return { S, calls, unchanged: JSON.stringify(S) === before };
}
const BAD = 'toast:QR 정보를 읽지 못했어요.';
const NOW = new Date(2026, 10, 17);

// ---------- ⓐ 재현: 받은 move 'x'로 판정 계산이 오류 (빈 화면 원인) ----------
test('재현: move "x" QR을 받은 뒤에도 기한 계산(deadlines)이 오류를 내지 않는다 (예외)', () => {
  const r = runRecv(pcPayload({ move: 'x' }));
  assert.doesNotThrow(() => JE.deadlines(r.S, NOW));
  assert.equal(r.S.move, '2025-03-15');
});

// ---------- 받는 줄 동작 ----------
test('받는 줄: 정상 QR → 확인 창 뒤 덮어쓰고 demo=false 다음 migrate, 그 다음 save (정상)', () => {
  const r = runRecv(pcPayload());
  assert.deepEqual(r.calls, ['confirm', 'migrate:true:demo=false', 'save', 'loadPlaces', 'render', 'toast:PC에서 보낸 정보로 바꿨어요.']);
  assert.equal(r.S.gu, '관악구'); assert.equal(r.S.move, '2026-02-01'); assert.equal(r.S.onboarded, true);
});
test('받는 줄: 틀린 값 → 확인 창 없이 토스트, S 불변, save·render 0회 (예외)', () => {
  const r = runRecv(pcPayload({ contract: '2026/01/01' }));
  assert.deepEqual(r.calls, [BAD]);
  assert.ok(r.unchanged);
});
test('받는 줄: 객체 아님(null·문자열·배열) → 같은 토스트 (예외)', () => {
  [null, 'abc', 3, [1]].forEach((p) => assert.deepEqual(runRecv(p).calls, [BAD], JSON.stringify(p)));
});
test('받는 줄: screens-core 못 불러옴(JS null) → 받지 않음 (경계)', () => {
  const r = runRecv(pcPayload(), { JS: null });
  assert.deepEqual(r.calls, [BAD]);
  assert.ok(r.unchanged);
});
test('받는 줄: 확인 창 취소 → 바꾸지 않음 (경계)', () => {
  const r = runRecv(pcPayload(), { no: true });
  assert.deepEqual(r.calls, ['confirm']);
  assert.ok(r.unchanged);
});

// ---------- checkImport 판정표 ----------
test('checkImport: PC 내보내기 모양 전체 키 통과 (정상)', () => {
  assert.equal(JS.checkImport(pcPayload()), true);
});
test('checkImport: null 허용 키·term 1/10/문자열 2·금액 0·키 일부 없음 통과 (경계)', () => {
  assert.equal(JS.checkImport(pcPayload({ sido: null, sgg: null, zip: null, birth: null, homeless: null, dup: null, home: null })), true);
  assert.equal(JS.checkImport(pcPayload({ birth: '', homeless: '', dup: 'unknown' })), true);
  [1, 10, '2'].forEach((t) => assert.equal(JS.checkImport(pcPayload({ term: t })), true, 'term ' + t));
  assert.equal(JS.checkImport(pcPayload({ deposit: 0, rent: 0, fee: 0, age: 0 })), true);
  assert.equal(JS.checkImport({ gu: '종로구' }), true);
  assert.equal(JS.checkImport({}), true);
});
test('checkImport: term 0·11·"x" 거부 (경계)', () => {
  [0, 11, 'x', null, true].forEach((t) => assert.equal(JS.checkImport(pcPayload({ term: t })), false, 'term ' + t));
});
test('checkImport: 날짜·금액·선택 값 형식 틀림 거부 (예외)', () => {
  const bad = [
    { move: 'x' }, { contract: '2026/01/01' }, { move: null }, { deposit: -1 }, { deposit: 'abc' }, { rent: Infinity },
    { fee: '5' }, { age: NaN }, { income: 'zzz' }, { birth: '2000-13' }, { birth: '2000-05-01' },
    { homeless: 'maybe' }, { dup: true }, { gu: null }, { nick: 3 }, { sido: 1 }
  ];
  bad.forEach((b) => assert.equal(JS.checkImport(pcPayload(b)), false, JSON.stringify(b)));
});
test('checkImport: done 배열·null, home 배열·문자열 거부 (예외)', () => {
  [{ done: [] }, { done: null }, { done: 'x' }, { home: [] }, { home: 'x' }].forEach((b) =>
    assert.equal(JS.checkImport(pcPayload(b)), false, JSON.stringify(b)));
});
test('checkImport: 객체 아님 거부, 던지지 않음 (예외)', () => {
  [null, undefined, 'abc', 1, [], [pcPayload()]].forEach((o) => assert.equal(JS.checkImport(o), false, String(o)));
});
test('checkImport: bills·events·표에 없는 키는 보지 않고 입력을 바꾸지 않음 (경계)', () => {
  const o = pcPayload({ bills: 'x', events: 5, extra: { a: 1 } });
  const snap = JSON.stringify(o);
  assert.equal(JS.checkImport(o), true);
  assert.equal(JSON.stringify(o), snap);
});
