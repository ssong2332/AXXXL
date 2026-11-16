// T-23 팀 시뮬레이션 지적 버그 B1~B7 재현·회귀 테스트 (DECISIONS #24~#26, Architecture "T-23 재작업 테스트")
// app.html 함수는 파일 텍스트에서 잘라 new Function으로 만든다(screen-timeline.test.js taskItem과 같은 방식).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JE = require('../demo/engine.js');
const JS = require('../demo/screens-core.js');

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
const day = (y, m, d) => new Date(y, m - 1, d);

// ---------- B1 FRESH 기본 지역 ----------
test('B1: FRESH 기본값의 gu가 빈 값 (정상)', () => {
  const line = lineOf('  Object.assign(FRESH, {');
  assert.match(line, /Object\.assign\(FRESH, \{ gu: '', addr: ''/);
  assert.doesNotMatch(line, /관악구/);
});
test('B1: DEMO 예시 데이터는 서울 관악구 그대로 (경계 — 예시 불변)', () => {
  assert.match(lineOf('  var DEMO = {'), /var DEMO = \{ gu: '관악구', addr: '신림동 원룸'/);
});
test('B1: 시·도 없음 + 빈 구 → 판정 안 함(확인 필요), 서울 구 이름은 그대로 서울 (경계)', () => {
  assert.deepEqual(JE.reportArea(undefined, ''), { inArea: null, reason: '지역을 아직 고르지 않음' });
  assert.equal(JE.reportArea(undefined, '관악구').inArea, true);
});
test('B1·B2: 새 사용자 값 + 월세 50 → 신고 대상 단정 없음(required null) (예외 — 지방 사용자 오판 방지)', () => {
  const fresh = { gu: '', deposit: 500, rent: 50, term: 2, contract: '2026-11-16', move: '2026-11-30' };
  const r = JE.deadlines(fresh).report;
  assert.equal(r.required, null);
  assert.equal(r.reason, '지역을 아직 고르지 않음');
  // 같은 금액이라도 이전 기본값(관악구)이면 대상으로 단정했다 — 지적의 원인 재확인
  assert.equal(JE.deadlines(Object.assign({}, fresh, { gu: '관악구' })).report.required, true);
});
test('B2: 길잡이 2단계 안내는 required === null 갈래(확인이 필요해요)를 먼저 본다 (정적 — viewStart 0줄)', () => {
  const v = fnText('  function viewStart() {', '\n  function backupJson()');
  assert.match(v, /R\.report\.required === null \? '전월세 신고 대상 지역인지 확인이 필요해요/);
});
test('B2: 충청남도 예산군 + 월세 50 → 대상 아님(도의 군) — 2단계·결과가 같은 판정 함수 (예외)', () => {
  const r = JE.deadlines({ sido: '충청남도', gu: '예산군', deposit: 500, rent: 50, term: 2, contract: '2026-11-16', move: '2026-11-30' }).report;
  assert.equal(r.required, false);
  assert.match(r.reason, /도의 군/);
});

// ---------- B3 lateNote 과태료 문구 ----------
function makeLateNote(today) {
  const src = fnText('  function lateNote(t, c) {', '\n  function taskItem(');
  // eslint-disable-next-line no-new-func
  return new Function('today', src + '\nreturn lateNote;')(today);
}
const TODAY = day(2026, 11, 16);
const PAST = day(2026, 11, 1), FUTURE = day(2026, 11, 30);
test('B3: 신고 대상(urgent) + 기한 지남 → 과태료 문구 유지 (정상)', () => {
  const s = makeLateNote(TODAY)({ id: 'rp', urgent: true, due: PAST }, false);
  assert.match(s, /늦으면 과태료/);
  assert.match(s, /15일 지났어요/);
});
test('B3: 확정일자 받기(urgent 없음) + 입주일 지남 → 문구 없음 (예외 — 지적)', () => {
  assert.equal(makeLateNote(TODAY)({ id: 'rp', title: '확정일자 받기', due: PAST }, false), '');
});
test('B3: 신고 대상인지 확인(urgent 없음) + 기한 지남 → 문구 없음 (예외 — OQ-T23-3 같이 고침)', () => {
  assert.equal(makeLateNote(TODAY)({ id: 'rp', title: '전월세 신고 대상인지 확인', due: PAST }, false), '');
});
test('B3: 신고 대상이지만 기한 전·체크됨 → 문구 없음 (경계)', () => {
  const f = makeLateNote(TODAY);
  assert.equal(f({ id: 'rp', urgent: true, due: FUTURE }, false), '');
  assert.equal(f({ id: 'rp', urgent: true, due: TODAY }, false), '');
  assert.equal(f({ id: 'rp', urgent: true, due: PAST }, true), '');
});
test('B3: 법정 기한(legal) 갈래(전입신고)는 불변 (회귀)', () => {
  const f = makeLateNote(TODAY);
  assert.match(f({ id: 'mv', urgent: true, due: PAST, legal: day(2026, 11, 10) }, false), /6일 지났어요/);
  assert.equal(f({ id: 'mv', urgent: true, due: PAST, legal: FUTURE }, false), '');
});
test('B3: buildTimeline 세 갈래 할 일 id는 모두 rp, urgent는 신고 대상 갈래에만 (체크 기록 S.done.rp 유지)', () => {
  const bt = fnText('  function buildTimeline(R) {', '\n  function openTasks(');
  const pushes = bt.split('\n').filter((l) => /rt\.push\(\{ id: 'rp'/.test(l));
  assert.equal(pushes.length, 3);
  assert.match(pushes[0], /^\s+if \(rep\.required\) rt\.push\(\{ id: 'rp', title: '전월세 신고', urgent: true/);
  assert.doesNotMatch(pushes[1], /urgent/);
  assert.doesNotMatch(pushes[2], /urgent/);
});

// ---------- B4 QR 내보내기 키 ----------
function makeExport(S) {
  const src = lineOf('  function exportObj() {');
  // eslint-disable-next-line no-new-func
  return new Function('S', src + '\nreturn exportObj;')(S);
}
const OLD16 = ['gu', 'addr', 'deposit', 'rent', 'fee', 'term', 'age', 'income', 'contract', 'move', 'done', 'bills', 'events', 'home', 'remind', 'nick'];
const NEW6 = ['sido', 'zip', 'sgg', 'birth', 'homeless', 'dup'];
test('B4: 지역·출생연월·무주택·중복 수혜 6개 키를 담는다 (정상)', () => {
  const S = { gu: '예산군', sido: '충청남도', zip: '44810', sgg: '예산군', birth: '2001-05', homeless: 'yes', dup: 'no', rent: 50 };
  const o = JSON.parse(JSON.stringify(makeExport(S)()));
  assert.equal(o.sido, '충청남도'); assert.equal(o.zip, '44810'); assert.equal(o.sgg, '예산군');
  assert.equal(o.birth, '2001-05'); assert.equal(o.homeless, 'yes'); assert.equal(o.dup, 'no');
});
test('B4: 답 없는 6개 키는 JSON에서 null로 남는다 (경계 — 받는 쪽 옛 값 덮어쓰기)', () => {
  const o = JSON.parse(JSON.stringify(makeExport({ gu: '', rent: 0 })()));
  NEW6.forEach((k) => { assert.ok(k in o, k + ' 빠짐'); assert.equal(o[k], null); });
});
test('B4: 기존 16개 키 처리 불변 — undefined는 JSON에서 빠진다 (회귀)', () => {
  const o = makeExport({ gu: '관악구' })();
  assert.deepEqual(Object.keys(o), OLD16.concat(NEW6));
  const j = JSON.parse(JSON.stringify(o));
  assert.equal(j.gu, '관악구');
  assert.ok(!('addr' in j));
});
test('B4: 받는 쪽 루프가 휴대폰 옛 값(homeless yes)을 null로 바꾼다 (예외)', () => {
  const recv = lineOf('      decodePayload(dd).then(');
  assert.match(recv, /Object\.keys\(exportObj\(\)\)\.forEach\(function \(k\) \{ if \(k in o\) S\[k\] = o\[k\]; \}\)/);
  const pc = JSON.parse(JSON.stringify(makeExport({ gu: '', sido: '충청남도', zip: '', sgg: '' })()));
  const phone = { gu: '관악구', homeless: 'yes', dup: 'no', birth: '1999-01' };
  const exportObj = makeExport(phone);
  Object.keys(exportObj()).forEach((k) => { if (k in pc) phone[k] = pc[k]; });
  assert.equal(phone.homeless, null); assert.equal(phone.dup, null); assert.equal(phone.birth, null);
  assert.equal(phone.sido, '충청남도'); assert.equal(phone.gu, '');
});

// ---------- B5 조건 입력 날짜 순서 ----------
function orderLine() {
  const v = fnText('  function viewInput() {', '\n    var f = function');
  const lines = v.split('\n').filter((l) => /err\.move = '입주일이 계약일보다 빨라요/.test(l));
  assert.equal(lines.length, 1, 'viewInput에 날짜 순서 줄 없음');
  return lines[0];
}
function runOrder(S) {
  const pd = (s) => { const p = String(s || '').split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? new Date(2026, 10, 16) : d; };
  // eslint-disable-next-line no-new-func
  return new Function('JE', 'S', 'pd', 'var err = JE.validate(S);\n' + orderLine() + '\nreturn err;')(JE, S, pd);
}
const base = { deposit: 500, rent: 50, term: 2 };
test('B5: 입주일 < 계약일 → 입주일 칸 안내 (정상 — 지적)', () => {
  assert.equal(runOrder(Object.assign({ contract: '2026-11-20', move: '2026-11-10' }, base)).move, '입주일이 계약일보다 빨라요. 날짜를 확인해 주세요.');
});
test('B5: 같은 날·입주가 뒤 → 안내 없음 (경계)', () => {
  assert.deepEqual(runOrder(Object.assign({ contract: '2026-11-20', move: '2026-11-20' }, base)), {});
  assert.deepEqual(runOrder(Object.assign({ contract: '2026-11-20', move: '2026-12-01' }, base)), {});
});
test('B5: 계약일 비어 있음 → 순서 안내 없이 기존 계약일 오류만 (예외)', () => {
  const err = runOrder(Object.assign({ contract: '', move: '2026-11-10' }, base));
  assert.equal(err.move, undefined);
  assert.equal(err.contract, '계약일을 넣어 주세요');
});
test('B5: 입주일이 형식 오류면 기존 입주일 오류 문구 유지 (예외)', () => {
  assert.equal(runOrder(Object.assign({ contract: '2026-11-20', move: '' }, base)).move, '입주(전입) 예정일을 넣어 주세요');
});
test('B5: engine.js validate는 날짜 순서를 보지 않는다 (불변 — 금지 #7)', () => {
  assert.deepEqual(JE.validate(Object.assign({ contract: '2026-11-20', move: '2026-11-10' }, base)), {});
});

// ---------- B6 금액 해석 ----------
test('B6: parseAmount 정상 — 억·천 환산 (정상)', () => {
  assert.equal(typeof JS.parseAmount, 'function');
  assert.deepEqual(JS.parseAmount('1억'), { ok: true, value: 10000 });
  assert.deepEqual(JS.parseAmount('1억 2천'), { ok: true, value: 12000 });
  assert.deepEqual(JS.parseAmount('1억2천만'), { ok: true, value: 12000 });
  assert.deepEqual(JS.parseAmount('1억 2000'), { ok: true, value: 12000 });
  assert.deepEqual(JS.parseAmount('5천'), { ok: true, value: 5000 });
  assert.deepEqual(JS.parseAmount('3백'), { ok: true, value: 300 });
  assert.deepEqual(JS.parseAmount('45'), { ok: true, value: 45 });
  assert.deepEqual(JS.parseAmount(1000), { ok: true, value: 1000 });
});
test('B6: parseAmount 경계 — 빈 칸 0, 쉼표·만원 허용 (경계)', () => {
  assert.deepEqual(JS.parseAmount(''), { ok: true, value: 0 });
  assert.deepEqual(JS.parseAmount('  '), { ok: true, value: 0 });
  assert.deepEqual(JS.parseAmount('1,000'), { ok: true, value: 1000 });
  assert.deepEqual(JS.parseAmount('50만원'), { ok: true, value: 50 });
  assert.deepEqual(JS.parseAmount('50만'), { ok: true, value: 50 });
});
test('B6: parseAmount 예외 — 음수·소수점·한글 숫자·원·숫자 없음은 ok false (예외)', () => {
  ['-1', '1.5억', '이천', '1억원', '만', '억', 'abc', '천만원'].forEach((x) => {
    assert.deepEqual(JS.parseAmount(x), { ok: false, value: null }, x);
  });
  assert.doesNotThrow(() => JS.parseAmount(null));
  assert.doesNotThrow(() => JS.parseAmount(undefined));
});
function makeSetField(withJS) {
  const src = fnText('  function setField(t) {', '\n  document.addEventListener(\'submit\'');
  const env = { S: { deposit: 500 }, saved: 0, AMT_NOTE: {} };
  // eslint-disable-next-line no-new-func
  const f = new Function('S', 'save', 'JS', 'AMT_NOTE', src + '\nreturn setField;')(env.S, () => { env.saved++; }, withJS ? JS : null, env.AMT_NOTE);
  const t = (v) => ({ value: v, dataset: { field: 'deposit' }, hasAttribute: (a) => a === 'data-num' });
  return { env, set: (v) => f(t(v)) };
}
test('B6: setField — "1억" → 10000 저장, 안내 없음 (정상 — 지적)', () => {
  const { env, set } = makeSetField(true);
  set('1억');
  assert.equal(env.S.deposit, 10000);
  assert.equal(env.saved, 1);
  assert.ok(!('deposit' in env.AMT_NOTE));
});
test('B6: setField — "이천" → 저장 안 함·이전 값 유지·안내 원문 기록, 다시 맞게 넣으면 안내 지움 (예외)', () => {
  const { env, set } = makeSetField(true);
  set('이천');
  assert.equal(env.S.deposit, 500);
  assert.equal(env.saved, 0);
  assert.equal(env.AMT_NOTE.deposit, '이천');
  set('2천');
  assert.equal(env.S.deposit, 2000);
  assert.ok(!('deposit' in env.AMT_NOTE));
});
test('B6: setField — 안내 원문은 20자로 자름 (경계)', () => {
  const { env, set } = makeSetField(true);
  set('가'.repeat(30));
  assert.equal(env.AMT_NOTE.deposit, '가'.repeat(20));
});
test('B6: setField — screens-core가 없으면 이전 동작(숫자 외 글자 제거) (경계 — DECISIONS #24)', () => {
  const { env, set } = makeSetField(false);
  set('1억');
  assert.equal(env.S.deposit, 1);
});
test('B6: amtNote — 기록 있으면 role=alert 안내(이스케이프), 없으면 빈 문자열', () => {
  const two = lineOf('  var AMT_NOTE = {};') + '\n' + lineOf('  function amtNote(k)');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // eslint-disable-next-line no-new-func
  const r = new Function('esc', two + '\nreturn { AMT_NOTE: AMT_NOTE, amtNote: amtNote };')(esc);
  assert.equal(r.amtNote('deposit'), '');
  r.AMT_NOTE.deposit = '<b>이천';
  const h = r.amtNote('deposit');
  assert.match(h, /role="alert"/);
  assert.match(h, /&lt;b&gt;이천/);
  assert.match(h, /금액으로 읽지 못했어요/);
});
test('B6: data-num 칸은 세 num 헬퍼에만 있고 모두 amtNote(k)를 붙인다 (정적)', () => {
  const lines = HTML.split('\n').filter((l) => /data-num/.test(l) && /var num = function/.test(l));
  assert.equal(lines.length, 3);
  lines.forEach((l) => assert.match(l, /<\/em><\/div>' \+ amtNote\(k\); \};$/));
  const all = HTML.split('\n').filter((l) => /data-num\b/.test(l));
  assert.equal(all.length, 5); // num 헬퍼 3 + input 리스너 1 + setField 1
});

// ---------- B7 openTasks 입주 준비 제외 ----------
function makeOpenTasks(today, done) {
  const src = fnText('  function openTasks(R, T) {', '\n\n  // ---------- 캘린더 계산');
  // eslint-disable-next-line no-new-func
  return new Function('today', 'S', src + '\nreturn openTasks;')(today, { done: done || {} });
}
const C0 = day(2026, 9, 1), M0 = day(2026, 9, 27);
const T0 = [
  { key: 'pre', tasks: [{ id: 't1', due: day(2026, 8, 25) }] },
  { key: 'cday', tasks: [{ id: 't5', due: C0 }] },
  { key: 'prep', tasks: [{ id: 'p1', due: day(2026, 9, 13) }, { id: 'p5', due: day(2026, 9, 26) }] },
  { key: 'mday', tasks: [{ id: 'm1', due: M0 }] },
  { key: 'report', tasks: [{ id: 'rp', due: day(2026, 10, 1) }, { id: 'r1', due: day(2026, 10, 11) }] }
];
const keys = (r) => r.dueNow.concat(r.upcoming).map((x) => x.s.key);
test('B7: 입주일이 50일 지남 → 입주 준비 할 일 0개, 입주 당일·신고는 남음 (정상 — 지적)', () => {
  const r = makeOpenTasks(day(2026, 11, 16))({ C: C0, M: M0 }, T0);
  assert.equal(keys(r).filter((k) => k === 'prep').length, 0);
  assert.deepEqual(r.dueNow.map((x) => x.t.id), ['m1', 'rp', 'r1']);
});
test('B7: 입주 전날 → 입주 준비 할 일 남음 (경계)', () => {
  const r = makeOpenTasks(day(2026, 9, 26))({ C: C0, M: M0 }, T0);
  assert.deepEqual(keys(r).filter((k) => k === 'prep').length, 2);
});
test('B7: 입주 당일 → 입주 준비 할 일 0개 (경계 — DECISIONS #25 >=)', () => {
  const r = makeOpenTasks(M0)({ C: C0, M: M0 }, T0);
  assert.equal(keys(r).filter((k) => k === 'prep').length, 0);
  assert.equal(r.skip.prep, 1);
});
test('B7: 계약일 규칙(pre·cday 제외)은 불변, 계약 전이면 전부 남음 (회귀)', () => {
  const after = makeOpenTasks(day(2026, 9, 10))({ C: C0, M: M0 }, T0);
  assert.deepEqual(after.skip, { pre: 1, cday: 1 });
  const before = makeOpenTasks(day(2026, 8, 20))({ C: C0, M: M0 }, T0);
  assert.deepEqual(before.skip, {});
  assert.equal(keys(before).length, 7);
});
test('B7: flat(타임라인용 전체 목록)에는 입주 준비가 그대로 (예외 — 타임라인 화면 불변)', () => {
  const r = makeOpenTasks(day(2026, 11, 16))({ C: C0, M: M0 }, T0);
  assert.equal(r.flat.filter((x) => x.s.key === 'prep').length, 2);
});

// ---------- B8 자격 판정 머리 줄 지역 ----------
const escApp = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function makeResultPlace(S) {
  const src = lineOf('  function resultPlace() {');
  // eslint-disable-next-line no-new-func
  return new Function('S', 'esc', src + '\nreturn resultPlace;')(S, escApp);
}
test('B8: 시·군·구 있으면 그대로 (정상 — 이전과 같음)', () => {
  assert.equal(makeResultPlace({ gu: '관악구', sido: '서울특별시' })(), '관악구 · ');
});
test('B8: 시·군·구 없고 시·도만 → 시·도 (경계 — 지적)', () => {
  assert.equal(makeResultPlace({ gu: '', sido: '충청남도' })(), '충청남도 · ');
  assert.equal(makeResultPlace({ gu: '', sido: '부산광역시' })(), '부산광역시 · ');
});
test('B8: 지역 없음·공백·null → 구분점도 없음 (예외)', () => {
  assert.equal(makeResultPlace({ gu: '  ' })(), '');
  assert.equal(makeResultPlace({ gu: null, sido: null })(), '');
  assert.equal(makeResultPlace({})(), '');
});
test('B8: 지역 값은 이스케이프 (예외)', () => {
  assert.equal(makeResultPlace({ gu: '<b>' })(), '&lt;b&gt; · ');
});
test('B8: viewResult 머리 줄이 resultPlace()를 쓰고 esc(S.gu) + \' · \'는 없음 (정적)', () => {
  const v = fnText('  function viewResult() {', '\n  function moReduce()');
  assert.equal(v.split('resultPlace() + ageText()').length - 1, 1);
  assert.equal(v.split("esc(S.gu) + ' · '").length - 1, 0);
  assert.equal(HTML.split('resultPlace()').length - 1, 2); // 정의 1 + 호출 1
});

// ---------- B9 미래 출생연월 ----------
function runBirth(S, err) {
  const src = lineOf('  function birthErr(err) {');
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const realToday = () => new Date(2026, 10, 16);
  const pd = (s) => { const p = String(s || '').split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? realToday() : d; };
  err = err || {};
  // eslint-disable-next-line no-new-func
  new Function('S', 'iso', 'pd', 'realToday', src + '\nreturn birthErr;')(S, iso, pd, realToday)(err);
  return err;
}
const BIRTH_MSG = '출생연월이 계약일이나 이번 달보다 늦어요. 날짜를 확인해 주세요.';
test('B9: 미래 출생연월 2030-01 → 안내 (정상 — 지적)', () => {
  assert.equal(runBirth({ birth: '2030-01', contract: '2026-03-01' }).birth, BIRTH_MSG);
});
test('B9: 이번 달보다 늦음·계약 달보다 늦음 → 안내 (경계)', () => {
  assert.equal(runBirth({ birth: '2026-12', contract: '2027-01-01' }).birth, BIRTH_MSG);
  assert.equal(runBirth({ birth: '2026-05', contract: '2026-03-01' }).birth, BIRTH_MSG);
});
test('B9: 이번 달·계약 달과 같음, 과거, 빈 값 → 안내 없음 (경계)', () => {
  assert.deepEqual(runBirth({ birth: '2026-11', contract: '2026-12-01' }), {});
  assert.deepEqual(runBirth({ birth: '2026-03', contract: '2026-03-01' }), {});
  assert.deepEqual(runBirth({ birth: '2000-05', contract: '2026-03-01' }), {});
  assert.deepEqual(runBirth({ birth: '', contract: '2026-03-01' }), {});
});
test('B9: 형식 오류 문구는 그대로, 계약일 오류면 이번 달 기준만 (예외)', () => {
  assert.equal(runBirth({ birth: '2030-13', contract: '2026-03-01' }, { birth: '출생연월 형식이 맞지 않아요' }).birth, '출생연월 형식이 맞지 않아요');
  assert.equal(runBirth({ birth: '2030-01', contract: '' }, { contract: '계약일을 넣어 주세요' }).birth, BIRTH_MSG);
  assert.equal(runBirth({ birth: '2026-05', contract: '' }, { contract: '계약일을 넣어 주세요' }).birth, undefined);
});
test('B9: viewInput·viewResult가 각각 birthErr(err)를 1번 부르고 validate는 불변 (정적·회귀)', () => {
  const vi = fnText('  function viewInput() {', '\n    var f = function');
  const vr = fnText('  function viewResult() {', '\n    var R = evaluate()');
  assert.equal(vi.split('birthErr(err);').length - 1, 1);
  assert.equal(vr.split('birthErr(err);').length - 1, 1);
  assert.deepEqual(JE.validate({ deposit: 1, rent: 1, term: 2, contract: '2026-03-01', move: '2026-03-10', birth: '2030-01' }), {});
});

// ---------- B10 올해가 아닌 미래 날짜에 연도 ----------
const NOW = new Date(2026, 10, 16);
// eslint-disable-next-line no-new-func
const mdApp = new Function('WD', lineOf('  function md(d) {') + '\nreturn md;')(['일', '월', '화', '수', '목', '금', '토']);
test('B10: yearDate — 다른 해는 연도 붙은 md 모양, 같은 해는 null (정상·경계)', () => {
  assert.equal(typeof JS.yearDate, 'function');
  assert.equal(JS.yearDate(new Date(2028, 10, 10), NOW), '2028.11.10(금)');
  assert.equal(JS.yearDate(new Date(2025, 0, 5), NOW), '2025.' + mdApp(new Date(2025, 0, 5)));
  assert.equal(JS.yearDate(new Date(2026, 11, 31), NOW), null);
  for (let i = 0; i < 400; i += 37) { const d = new Date(2027, 0, 1 + i); assert.equal(JS.yearDate(d, NOW), d.getFullYear() + '.' + mdApp(d)); }
});
test('B10: yearDate — Date 아님·Invalid Date → null, 던지지 않음 (예외)', () => {
  assert.equal(JS.yearDate(null, NOW), null);
  assert.equal(JS.yearDate('2028-11-10', NOW), null);
  assert.equal(JS.yearDate(new Date('x'), NOW), null);
  assert.equal(JS.yearDate(new Date(2028, 0, 1), null), null);
});
test('B10: yearTasks — 다른 해 미래만 복사본 dueText, 나머지는 같은 참조, 원본 불변', () => {
  const far = { id: 'o3', due: new Date(2028, 10, 10) }, legal = { id: 'q', due: new Date(2028, 0, 3), legal: new Date(2028, 0, 9) };
  const same = { id: 'a', due: new Date(2026, 11, 1) }, past = { id: 'b', due: new Date(2025, 5, 1) }, none = { id: 'o1', due: null }, txt = { id: 'c', due: new Date(2028, 1, 1), dueText: 'x' };
  const src = [far, legal, same, past, none, txt];
  const out = JS.yearTasks(src, NOW);
  assert.equal(out[0].dueText, '2028.11.10(금) · D-725');
  assert.notEqual(out[0], far); assert.equal(far.dueText, undefined);
  assert.match(out[1].dueText, /^2028\.1\.3\(월\) 권장 · D-\d+$/);
  [2, 3, 4, 5].forEach((i) => assert.equal(out[i], src[i]));
  assert.deepEqual(JS.yearTasks(null, NOW), []);
  assert.deepEqual(JS.yearTasks('x', NOW), []);
});
test('B10: dueTag — 복사본 배지 색은 원본과 같고 글자는 연도만 붙음 (회귀 — dueTag 0줄)', () => {
  // eslint-disable-next-line no-new-func
  const dday = new Function('today', lineOf('  function dday(d) {') + '\nreturn dday;')(NOW);
  // eslint-disable-next-line no-new-func
  const dueTag = new Function('S', 'today', 'md', 'dday', fnText('  function dueTag(t) {', '\n  function openTasks(') + '\nreturn dueTag;')({ done: {} }, NOW, mdApp, dday);
  [{ id: 'o3', due: new Date(2028, 10, 10) }, { id: 'u', urgent: true, due: new Date(2027, 2, 1) }, { id: 'l', due: new Date(2027, 2, 1), legal: new Date(2027, 2, 5) }].forEach((t) => {
    const a = dueTag(t), b = dueTag(JS.yearTasks([t], NOW)[0]);
    assert.equal(b[0], a[0]);
    assert.equal(b[1], t.due.getFullYear() + '.' + a[1]);
  });
});
test('B10: md·dueTag 정의 불변, viewMoveout·tlStage·moveoutChip 연결 (정적)', () => {
  assert.equal(lineOf('  function md(d) {'), "  function md(d) { return (d.getMonth() + 1) + '.' + d.getDate() + '(' + WD[d.getDay()] + ')'; }");
  assert.equal(lineOf('  function dueTag(t) {'), '  function dueTag(t) {');
  assert.match(fnText('  function viewMoveout() {', '\n  // ---------- AI 자취 코치'), /\(JS && JS\.yearTasks \? JS\.yearTasks\(tasks, today\) : tasks\)\.map\(function \(t\) \{ return taskItem\(t\); \}\)/);
  assert.match(fnText('    function tlStage(s, cls) {', '\n      return '), /\(JS && JS\.yearTasks \? JS\.yearTasks\(s\.tasks, today\) : s\.tasks\)\.map\(/);
  const chip = fnText('  function moveoutChip(d) {', '\n  // 갱신 통지');
  assert.match(chip, /y \+ '년<\/span>'/);
  assert.match(chip, /aria-label="' \+ \(y \? y \+ '년 ' : ''\) \+ p\.label/);
});
test('B10: screens-core 요일 표가 app.html WD와 같은 값 (대조)', () => {
  for (let i = 0; i < 7; i++) { const d = new Date(2030, 0, 6 + i); assert.equal(JS.yearDate(d, NOW).slice(-2, -1), mdApp(d).slice(-2, -1)); }
});
