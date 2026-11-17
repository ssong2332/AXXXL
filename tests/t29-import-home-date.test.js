// T-29 QR 받기 집 위치·실제 날짜·계약 기간 검사 (T-25 재작업, PR #80 리뷰, PRD F-13 ②, DECISIONS #35)
// app.html 받는 줄과 placeKey·kakao·homeRvFresh를 파일 텍스트에서 잘라 new Function으로 돌린다(t25와 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');
const JL = require('../demo/life-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function lineFrom(head) {
  const a = HTML.indexOf(head);
  assert.ok(a >= 0, head + ' 없음');
  return HTML.slice(a, HTML.indexOf('\n', a));
}
function blockFrom(head) {
  const a = HTML.indexOf(head);
  assert.ok(a >= 0, head + ' 없음');
  return HTML.slice(a, HTML.indexOf('\n  }\n', a) + 4);
}
const RECV = lineFrom('      decodePayload(dd).then(');
const MAPCODE = [lineFrom('  function placeKey(h)'), lineFrom('  function kakaoId(p)'), lineFrom('  function rvKey(p)'),
  blockFrom('  function kakao(kind, p)'), lineFrom('  var RV_KEEP'), lineFrom('  function homeRvFresh(h)')].join('\n');

const RV_OK = 'https://map.kakao.com/?panoid=1234567890&pan=120.5&tilt=0&zoom=0';
const RV_BAD = 'javascript:alert(1)';
function payload(over) {
  return Object.assign({
    gu: '관악구', deposit: 1000, rent: 50, fee: 5, term: 2, contract: '2026-01-10', move: '2026-02-01',
    bills: [], events: [], home: { lat: 37.48, lng: 126.95, label: '봉천동 자취방', src: 'pick' }, birth: '2000-05'
  }, over || {});
}
// 받는 줄 → 승인 → 복원 → 지도(loadPlaces가 placeKey) → 화면(render가 kakao('rv')·homeRvFresh)
function flow(p) {
  const calls = [];
  const S = { gu: '마포구', deposit: 500, rent: 40, contract: '2025-03-01', move: '2025-03-15', home: null, bills: [], events: [], demo: true };
  const before = JSON.stringify(S);
  const map = new Function('RVS', 'JS', MAPCODE + '\nreturn { placeKey, kakao, homeRvFresh };')({}, JS);
  const env = {
    dd: 'x', decodePayload: () => ({ then: (f) => { f(p); return { catch: () => {} }; } }),
    exportObj: () => { const o = {}; Object.keys(payload()).concat(['addr', 'term', 'done', 'remind', 'nick', 'sido', 'zip', 'sgg', 'homeless', 'dup', 'age', 'income']).forEach((k) => { o[k] = S[k]; }); return o; },
    JL, JS, clone: (x) => JSON.parse(JSON.stringify(x)), FRESH: { bills: [] },
    confirm: () => { calls.push('confirm'); return true; }, migrate: () => calls.push('migrate'), save: () => calls.push('save'), PC: {},
    loadPlaces: () => { calls.push('map:' + (S.home ? map.placeKey(S.home) : '-')); },
    render: () => { calls.push('rv:' + (S.home ? map.kakao('rv', S.home) : '-')); }, toast: (m) => calls.push('toast:' + m)
  };
  const names = Object.keys(env).concat('S');
  new Function(...names, RECV).apply(null, names.map((n) => (n === 'S' ? S : env[n])));
  return { S, calls, unchanged: JSON.stringify(S) === before, map };
}
const BAD = 'toast:QR 정보를 읽지 못했어요.';

test('정상: 집 위치가 맞으면 승인 → 복원 → 지도 → 화면까지 이어지고 허용 필드만 남는다', () => {
  const r = flow(payload({ home: { lat: 37.48, lng: 126.95, label: '봉천동 자취방', src: 'pick', rvUrl: RV_OK, rvAt: Date.now(), extra: 'x' } }));
  assert.deepEqual(r.calls.slice(0, 1), ['confirm']);
  assert.deepEqual(r.S.home, { lat: 37.48, lng: 126.95, label: '봉천동 자취방', src: 'pick' });
  assert.ok(r.calls.includes('map:37.480,126.950'));
  assert.ok(r.calls.some((c) => c.startsWith('rv:https://map.kakao.com/link/roadview/37.48000,126.95000')));
});

test('예외: 위도가 문자열이면 확인 창 전에 거부하고 기록을 바꾸지 않는다', () => {
  const r = flow(payload({ home: { lat: '37.48', lng: 126.95 } }));
  assert.deepEqual(r.calls, [BAD]);
  assert.equal(r.unchanged, true);
});

test('경계: 위도 90·경도 -180은 통과, 90.0001·180.1·NaN·Infinity는 거부', () => {
  assert.equal(JS.checkImport({ home: { lat: 90, lng: -180 } }), true);
  [[90.0001, 0], [0, 180.1], [NaN, 0], [0, Infinity]].forEach(([lat, lng]) => {
    assert.equal(JS.checkImport({ home: { lat, lng } }), false, lat + ',' + lng);
  });
  assert.equal(JS.checkImport({ home: { lng: 126.9 } }), false, 'lat 없음');
  assert.equal(JS.checkImport({ home: null }), true, 'null은 집 위치 없음');
});

test('예외: 로드뷰 주소가 카카오 로드뷰가 아니면 QR 전체를 거부한다', () => {
  const r = flow(payload({ home: { lat: 37.48, lng: 126.95, rvUrl: RV_BAD, rvAt: Date.now() } }));
  assert.deepEqual(r.calls, [BAD]);
  assert.equal(r.unchanged, true);
  assert.equal(JS.rvUrlOk(RV_OK), true);
  ['http://map.kakao.com/?panoid=1', 'https://evil.example/?panoid=1', 'https://map.kakao.com/?panoid=1"onclick=x', RV_BAD, 5].forEach((u) => {
    assert.equal(JS.rvUrlOk(u), false, String(u));
  });
});

test('그리는 쪽: 저장된 rvUrl이 안전하지 않으면 링크에 쓰지 않고 새로 찾는다', () => {
  const map = new Function('RVS', 'JS', MAPCODE + '\nreturn { kakao, homeRvFresh };')({}, JS);
  const bad = { lat: 37.48, lng: 126.95, rvUrl: RV_BAD, rvAt: Date.now() };
  assert.equal(map.kakao('rv', bad), 'https://map.kakao.com/link/roadview/37.48000,126.95000');
  assert.equal(map.homeRvFresh(bad), false);
  const ok = { lat: 37.48, lng: 126.95, rvUrl: RV_OK, rvAt: Date.now() };
  assert.equal(map.kakao('rv', ok), RV_OK);
  assert.equal(map.homeRvFresh(ok), true);
});

test('예외: 달력에 없는 날짜(2026-02-31·2026-13-01·2025-02-29)는 거부, 윤년 2028-02-29는 통과', () => {
  ['2026-02-31', '2026-13-01', '2025-02-29', '2026-00-10'].forEach((d) => {
    assert.equal(JS.checkImport({ move: d }), false, d);
    assert.equal(JS.checkImport({ contract: d }), false, d);
  });
  assert.equal(JS.checkImport({ move: '2028-02-29', contract: '2026-12-31' }), true);
  const r = flow(payload({ move: '2026-02-31' }));
  assert.deepEqual(r.calls, [BAD]);
  assert.equal(r.unchanged, true);
});

test('경계: 계약 기간은 1~10 정수만 (2.5·0·11 거부, "2"·10 통과)', () => {
  [2.5, '2.5', 0, 11].forEach((t) => assert.equal(JS.checkImport({ term: t }), false, String(t)));
  ['2', 10, 1].forEach((t) => assert.equal(JS.checkImport({ term: t }), true, String(t)));
  // 리뷰 권고 1: 숫자로 바뀌기만 하는 문자열은 거부
  ['0x2', '1e0', ' 2', '2 ', ''].forEach((t) => assert.equal(JS.checkImport({ term: t }), false, JSON.stringify(t)));
});

test('리뷰 권고 2: 앱이 실제로 만드는 카카오 로드뷰 주소 모양은 통과', () => {
  // app.html 집 로드뷰 저장 줄과 같은 모양 (panoid + pan + map_type·map_attribute·urlX·urlY·urlLevel)
  assert.equal(JS.rvUrlOk('https://map.kakao.com/?panoid=1180011234&pan=123.4&zoom=0&map_type=TYPE_MAP&map_attribute=ROADVIEW&urlX=495840&urlY=1112345&urlLevel=3'), true);
  assert.equal(JS.rvUrlOk('https://map.kakao.com/?panoid=1180011234&zoom=0&map_type=TYPE_MAP&map_attribute=ROADVIEW&urlX=495840&urlY=1112345&urlLevel=3'), true);
});

test('cleanHome: 객체가 아니면 null, 허용 6개 필드만 복사', () => {
  assert.equal(JS.cleanHome(null), null);
  assert.equal(JS.cleanHome('x'), null);
  assert.deepEqual(JS.cleanHome({ lat: 1, lng: 2, label: 'a', src: 's', kid: '12', named: 1, rvUrl: RV_OK, rvAt: 5, zz: 1 }),
    { lat: 1, lng: 2, label: 'a', src: 's', kid: '12', named: 1 });
});
