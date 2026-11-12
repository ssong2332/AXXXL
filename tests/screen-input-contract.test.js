// 조건 입력 #input · 내 계약 #contract 화면 개선 (F-11 ①③④⑥⑦, F-01, F-07) — T-13
// ②⑤(휴대폰 높이)는 브라우저 실측으로만 확인한다(Architecture "실측 절차").
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JS = require('../demo/screens-core.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');

function between(a, b) {
  const i = HTML.indexOf(a);
  const j = HTML.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, '구역 없음: ' + a);
  return HTML.slice(i, j);
}
// T-13 소유 구역 (Architecture "app.html 수정 구역" T-13 행) — 다음 구역 머리 주석까지
const CONTRACT = between('// ---------- 내 계약 ----------', '// ---------- 처음 시작하기 (온보딩) ----------');
const INPUT = between('// ---------- 조건 입력 (필수 ①) ----------', '// ---------- 자격 판정 (필수 ①) ----------');
const CSS = between('/* ===== mo:T-13 #input #contract ===== */', '/* ===== /mo:T-13 ===== */').replace(/\/\*[\s\S]*?\*\//g, ' ');

// 입력칸 이름: 직접 쓴 data-field="x"와 helper 호출 num('x' / sel('x' 둘 다 센다
const fields = (s) => [...s.matchAll(/data-field="([a-z]+)"|\b(?:num|sel)\('([a-z]+)'/g)].map((m) => m[1] || m[2]);

// ---------- 내 계약: 중복 입력칸 없음 (F-11 ③, OQ #3, "같이 없애기 (Recommended)") ----------
test('F-11 ③: 내 계약에 조건 입력과 같은 칸(보증금·월세·날짜·계약 기간·출생·소득) 입력이 없다', () => {
  const f = fields(CONTRACT);
  for (const k of ['deposit', 'rent', 'contract', 'move', 'term', 'birth', 'income']) {
    assert.ok(!f.includes(k), '내 계약에 중복 입력칸 남음: ' + k);
  }
});

test('F-11 ③: 내 계약에만 있는 칸(집 별칭·관리비·부를 이름·지역·시연용 날짜·백업)은 남는다', () => {
  const f = fields(CONTRACT);
  assert.ok(f.includes('addr'), '집 별칭');
  assert.ok(f.includes('fee'), '관리비');
  assert.ok(f.includes('nick'), '부를 이름');
  assert.match(CONTRACT, /regionFields\(\)/, '지역');
  assert.match(CONTRACT, /data-sim/, '시연용 날짜');
  assert.match(CONTRACT, /data-act="backup"/, '백업 저장');
  assert.match(CONTRACT, /data-act="restore"/, '백업 불러오기');
});

test("F-11 ③: 내 계약에 '조건 입력에서 고치기'가 조건 입력(#input)으로 가는 링크로 있다", () => {
  assert.match(CONTRACT, /<a [^>]*href="#input"[^>]*>[^<]*(<[^>]+>[^<]*)*조건 입력에서 고치기/);
});

test('F-11 ③: 내 계약은 조건 입력 값을 확인용으로 보여 준다 (contractFacts 사용)', () => {
  assert.match(CONTRACT, /JS\.contractFacts\(|contractFacts\(/);
});

// ---------- 내 계약: 구역 분리 (F-11 ④) ----------
test('F-11 ④: 계약 정보 구역과 집 위치·앱 설치·QR 구역이 제목이 있는 별도 구역이다', () => {
  const a = CONTRACT.indexOf('계약 정보</h2>');
  const b = CONTRACT.indexOf('집 위치 · 휴대폰 연결</h2>');
  const home = CONTRACT.indexOf('homeCard()');
  const dev = CONTRACT.indexOf('deviceCards()');
  assert.ok(a >= 0, '계약 정보 제목');
  assert.ok(b > a, '그 외 구역 제목이 계약 정보 뒤에');
  assert.ok(home > b && dev > b, '집 위치·앱 설치·QR은 그 외 구역 안');
  // 계약 정보 구역 안에 homeCard·deviceCards 없음
  const info = CONTRACT.slice(a, b);
  assert.ok(!/homeCard\(\)|deviceCards\(\)/.test(info), '계약 정보 구역에 섞임');
  assert.match(CONTRACT, /aria-labelledby="mo-contract-info-h"/);
  assert.match(CONTRACT, /aria-labelledby="mo-contract-other-h"/);
});

// ---------- 조건 입력: 판정 보기 고정 (F-11 ①, OQ #7) ----------
test("F-11 ①: 조건 입력의 '판정 보기'(#result)가 고정 막대 .mo-input-go 안에 있다", () => {
  const i = INPUT.indexOf('mo-input-go');
  assert.ok(i >= 0, '.mo-input-go 없음');
  assert.match(INPUT.slice(i), /href="#result"[^>]*>판정 보기/);
  // 판정 보기 링크는 한 개 (중복 링크 없음)
  assert.equal(INPUT.split('href="#result"').length - 1, 1);
});

test('F-11 ①: 휴대폰 너비에서 .mo-input-go가 화면 아래(하단 탭 위)에 붙는다', () => {
  // max-width 미디어 블록 안에서 position: sticky + bottom
  const m = CSS.match(/@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*)/);
  assert.ok(m, 'max-width 미디어 블록 없음');
  assert.ok(+m[1] >= 899, '휴대폰(하단 탭) 너비 포함');
  assert.match(m[2], /\.mo-input \.mo-input-go\s*\{[^}]*position:\s*sticky/);
  assert.match(m[2], /\.mo-input \.mo-input-go\s*\{[^}]*bottom:\s*calc\([^}]*env\(safe-area-inset-bottom/);
});

test('F-11 ①: 고칠 칸이 있으면 판정 보기를 막는 기존 동작 유지(aria-disabled)', () => {
  assert.match(INPUT, /aria-disabled="true"/);
  assert.match(INPUT, /고칠 칸이 /);
});

// ---------- F-01·F-11 ⑥: 저장값 그대로 ----------
test('F-11 ⑥/F-01: 조건 입력은 판정에 쓰는 10개 칸을 그대로 받는다', () => {
  const f = fields(INPUT);
  // T-20(2026-11-12): 지역(gu)은 data-field 대신 공용 regionFields()(시·도 + 시·군·구, 전국)로 받는다
  for (const k of ['term', 'deposit', 'rent', 'contract', 'move', 'birth', 'income', 'homeless', 'dup']) {
    assert.ok(f.includes(k), '조건 입력 칸 빠짐: ' + k);
  }
  assert.match(INPUT, /regionFields\(\)/, '지역 칸(전국)');
  assert.match(INPUT, /JE\.validate\(S\)/, '잘못된 값 안내 유지');
});

// ---------- F-11 ⑦ / F-07: 모션 연결 ----------
test('F-11 ⑦: 두 view가 moBegin으로 시작하고 moRoot로 감싼다', () => {
  assert.match(INPUT, /moBegin\('input'\)/);
  assert.match(INPUT, /return moRoot\('input',/);
  assert.match(CONTRACT, /moBegin\('contract'\)/);
  assert.match(CONTRACT, /return moRoot\('contract',/);
});

test('F-11 ⑦: 차례 등장은 moStep(0~3)만 — 전체 상한(JS.T.total) 이하', () => {
  const steps = [...(INPUT + CONTRACT).matchAll(/moStep\((\d+)\)/g)].map((m) => +m[1]);
  assert.ok(steps.length > 0, '등장 모션 없음');
  for (const s of steps) assert.ok(JS.stepDelay(s) + JS.T.base <= JS.T.total, 'moStep(' + s + ') 전체 상한(' + JS.T.total + 'ms) 초과');
});

// ---------- 순수 함수 contractFacts ----------
const BASE = { deposit: 1000, rent: 45, term: 2, contract: '2026-10-29', move: '2026-11-13', birth: '2002-03', income: '150' };

test('contractFacts 정상: 7행을 정해진 순서·형식으로 돌려준다', () => {
  const rows = JS.contractFacts(BASE);
  assert.deepEqual(rows.map((r) => r.key), ['deposit', 'rent', 'term', 'contract', 'move', 'birth', 'income']);
  assert.deepEqual(rows.map((r) => r.value), ['1,000만 원', '45만 원', '2년', '2026.10.29', '2026.11.13', '2002년 3월', '100% 초과 ~ 150% 이하']);
  assert.deepEqual(rows.map((r) => r.label), ['보증금', '월세', '계약 기간', '계약일', '입주일', '출생연월', '가구 소득']);
  assert.ok(rows.every((r) => r.missing === false));
});

test('contractFacts 경계: 금액 0, 숫자 문자열, 큰 금액', () => {
  const rows = JS.contractFacts(Object.assign({}, BASE, { deposit: 0, rent: '50', term: '1' }));
  assert.equal(rows[0].value, '0만 원');
  assert.equal(rows[0].missing, false);
  assert.equal(rows[1].value, '50만 원');
  assert.equal(rows[2].value, '1년');
  assert.equal(JS.contractFacts(Object.assign({}, BASE, { deposit: 1234567 }))[0].value, '1,234,567만 원');
});

test("contractFacts 경계: 출생연월 빈 값은 '아직 안 넣음', 소득 unknown은 '잘 모르겠어요'", () => {
  const rows = JS.contractFacts(Object.assign({}, BASE, { birth: '', income: 'unknown' }));
  assert.equal(rows[5].value, '아직 안 넣음');
  assert.equal(rows[5].missing, true);
  assert.equal(rows[6].value, '잘 모르겠어요');
  assert.equal(rows[6].missing, false);
});

test("contractFacts 예외: 잘못된 값은 '확인 필요'(missing)로 — 예외를 던지지 않는다", () => {
  const rows = JS.contractFacts({ deposit: 'abc', rent: -5, term: 3, contract: '2026-13-40', move: 'x', birth: '2002', income: 'zzz' });
  assert.deepEqual(rows.map((r) => r.value), ['확인 필요', '확인 필요', '확인 필요', '확인 필요', '확인 필요', '확인 필요', '확인 필요']);
  assert.ok(rows.every((r) => r.missing === true));
});

test("contractFacts 예외: 입력이 없거나 null이어도 7행, 모두 '아직 안 넣음'", () => {
  for (const v of [undefined, null, {}]) {
    const rows = JS.contractFacts(v);
    assert.equal(rows.length, 7);
    assert.ok(rows.every((r) => r.value === '아직 안 넣음' && r.missing === true));
  }
});

// ---------- T-20: 조건 입력 지역 전국 선택 (F-01 ②, 사용자 답 "내 작업이면 하고 아니면 하지마") ----------
test('T-20: 조건 입력은 서울 25개 구 목록 대신 공용 regionFields()로 전국 시·도·시·군·구를 고른다', () => {
  assert.match(INPUT, /regionFields\(\)/);
  assert.doesNotMatch(INPUT, /JE\.LAW\.seoulGu/, '서울 구만 고르는 목록이 남아 있음');
  assert.doesNotMatch(INPUT, /시·군·구 \(서울\)/);
});
