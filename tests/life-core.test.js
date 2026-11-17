// 생활 관리(주거비 관리·자취 캘린더) 계산 단위 테스트 — demo/life-core.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const JL = require('../demo/life-core.js');

// 2026년 12월에 입주, 계약은 2028년 11월까지 (y*12+m)
const START = 2026 * 12 + 11, END = 2028 * 12 + 10;
const BILLS = () => [
  { id: 'rent', name: '월세', kind: 'out', link: 'rent', day: 25, every: 1, on: true },
  { id: 'fee', name: '관리비', kind: 'out', link: 'fee', day: 25, every: 1, on: true },
  { id: 'elec', name: '전기요금', kind: 'out', amount: 25000, day: 18, every: 1, on: true, est: true },
  { id: 'net', name: '인터넷', kind: 'out', amount: 22000, day: 10, every: 1, on: true },
  { id: 'water', name: '수도요금', kind: 'out', amount: 16000, day: 20, every: 2, on: true, est: true },
  { id: 'sup', name: '청년월세 지원 입금', kind: 'in', amount: 200000, day: 25, every: 1, count: 3, on: true }
];
const LINK = { rent: 450000, fee: 70000 };
function month(bills, y, m, extra = {}) {
  return JL.monthBills(bills, Object.assign({
    y, m, endIdx: END, paid: {}, actual: {},
    amt: (b) => (b.link ? LINK[b.link] : +b.amount || 0), start: () => START, day: (b) => b.day
  }, extra));
}
const ids = (ev) => ev.map((e) => e.bid).sort();
const out = (ev) => ev.filter((e) => e.kind === 'out');

test('입주한 달: 켜 둔 항목이 전부 나온다 (2개월마다 내는 수도는 첫 달에 나온다)', () => {
  assert.deepEqual(ids(month(BILLS(), 2026, 11)), ['elec', 'fee', 'net', 'rent', 'sup', 'water']);
});

test('2개월마다 내는 항목은 다음 달에 쉬고 그다음 달에 다시 나온다', () => {
  assert.ok(!ids(month(BILLS(), 2027, 0)).includes('water'));
  assert.ok(ids(month(BILLS(), 2027, 1)).includes('water'));
});

test('계약이 끝난 다음 달부터는 반복 납부가 생기지 않는다', () => {
  assert.ok(month(BILLS(), 2028, 10).length > 0);
  assert.equal(month(BILLS(), 2028, 11).length, 0);
});

test('입주 전 달에는 아무것도 없다', () => {
  assert.equal(month(BILLS(), 2026, 10).length, 0);
});

test('횟수가 정해진 지원금은 그 횟수만큼만 들어온다', () => {
  const got = [0, 1, 2, 3].map((i) => month(BILLS(), 2026 + Math.floor((11 + i) / 12), (11 + i) % 12).some((e) => e.bid === 'sup'));
  assert.deepEqual(got, [true, true, true, false]);
  assert.equal(month(BILLS(), 2027, 1).find((e) => e.bid === 'sup').nth, '3/3');
});

test("'기본 관리비에 포함'으로 고른 항목은 따로 더하지 않는다 (중복 계산 방지)", () => {
  const b = BILLS(); b.find((x) => x.id === 'net').incl = 'incl';
  const ev = month(b, 2026, 11);
  assert.ok(!ids(ev).includes('net'));
  assert.equal(JL.summary(ev).total, 450000 + 70000 + 25000 + 16000);
});

test("'관리비 고지서에 합산'은 관리비 한 건으로 묶고 합계는 한 번만 센다", () => {
  const b = BILLS(); b.find((x) => x.id === 'elec').incl = 'bundle';
  const ev = month(b, 2026, 11), fee = ev.find((e) => e.bid === 'fee');
  assert.ok(!ids(ev).includes('elec'));
  assert.equal(fee.amount, 70000 + 25000);
  assert.equal(fee.with, '전기요금');
  assert.equal(fee.est, true, '합산된 전기요금이 예상 금액이라 관리비도 예상으로 표시');
});

test('관리비 고지서 실제 총액을 넣으면 합산 항목을 또 더하지 않는다', () => {
  const b = BILLS(); b.find((x) => x.id === 'elec').incl = 'bundle';
  const fee = month(b, 2026, 11, { actual: { 'fee@2026-12': 98000 } }).find((e) => e.bid === 'fee');
  assert.equal(fee.amount, 98000);
  assert.equal(fee.real, true);
});

test("'확인 필요'는 따로 더하되 확인 필요 표시가 붙는다", () => {
  const b = BILLS(); b.find((x) => x.id === 'net').incl = 'check';
  assert.equal(month(b, 2026, 11).find((e) => e.bid === 'net').chk, true);
});

test('월세·관리비와 들어오는 돈은 관리비 포함 설정을 무시한다', () => {
  assert.equal(JL.incl({ link: 'rent', incl: 'incl' }), 'sep');
  assert.equal(JL.incl({ kind: 'in', incl: 'incl' }), 'sep');
  assert.equal(JL.incl({ kind: 'out' }), 'sep');
});

test('고지서 실제 금액은 그 달에만 적용되고 다음 달은 다시 예상 금액이다', () => {
  const actual = { 'elec@2026-12': 31200 };
  const dec = month(BILLS(), 2026, 11, { actual }).find((e) => e.bid === 'elec');
  const jan = month(BILLS(), 2027, 0, { actual }).find((e) => e.bid === 'elec');
  assert.deepEqual([dec.amount, dec.real, dec.est], [31200, true, false]);
  assert.deepEqual([jan.amount, jan.real, jan.est], [25000, false, true]);
});

test('금액을 모르는 공과금은 0원이 아니라 금액 미확정으로 남는다', () => {
  const b = BILLS(); b.find((x) => x.id === 'elec').amount = 0;
  const ev = month(b, 2026, 11), e = ev.find((x) => x.bid === 'elec');
  assert.equal(e.unk, true);
  assert.equal(JL.summary(ev).unknown, 1);
});

test('월세가 0이면(계약 정보 없음) 월세 항목을 만들지 않는다', () => {
  const ev = month(BILLS(), 2026, 11, { amt: (b) => (b.link === 'rent' ? 0 : b.link ? 70000 : +b.amount || 0) });
  assert.ok(!ids(ev).includes('rent'));
});

test('납부 체크는 달마다 따로다 — 12월에 냈어도 1월은 다시 예정', () => {
  const paid = { 'rent@2026-12': true };
  assert.equal(month(BILLS(), 2026, 11, { paid }).find((e) => e.bid === 'rent').paid, true);
  assert.equal(month(BILLS(), 2027, 0, { paid }).find((e) => e.bid === 'rent').paid, false);
});

test('납부일이 그달 마지막 날보다 크면 말일로 맞춘다 (2월 31일 → 28일)', () => {
  const b = [{ id: 'x', name: '말일', kind: 'out', amount: 1000, day: 31, every: 1, on: true }];
  assert.equal(month(b, 2027, 1)[0].date.getDate(), 28);
});

test('꺼 둔 항목은 나오지 않는다', () => {
  const b = BILLS(); b.find((x) => x.id === 'net').on = false;
  assert.ok(!ids(month(b, 2026, 11)).includes('net'));
});

test('이번 달 합계: 나갈 돈만 더하고, 확정·예상·납부 완료를 나눈다', () => {
  const ev = month(BILLS(), 2026, 11, { paid: { 'rent@2026-12': true } });
  const s = JL.summary(ev);
  assert.equal(s.total, 450000 + 70000 + 25000 + 22000 + 16000);
  assert.equal(s.fixed, 450000 + 70000 + 22000);
  assert.equal(s.est, 25000 + 16000);
  assert.equal(s.done, 450000);
  assert.equal(s.wait, s.total - 450000);
  assert.equal(s.pct, Math.round(450000 / s.total * 100));
  assert.equal(out(ev).length, 5, '지원금 입금은 합계에 넣지 않는다');
});

test("납부 상태: 냈으면 완료, 날짜가 지났는데 안 했으면 '날짜 지남'(미납이라 단정하지 않음), 아니면 예정", () => {
  const today = new Date(2026, 11, 20);
  assert.equal(JL.payState({ paid: true, kind: 'out', date: new Date(2026, 11, 10) }, today)[0], 'ok');
  assert.deepEqual(JL.payState({ paid: false, kind: 'out', date: new Date(2026, 11, 10) }, today), ['late', '날짜 지남 · 냈나요?']);
  assert.equal(JL.payState({ paid: false, kind: 'out', date: new Date(2026, 11, 25) }, today)[0], 'wait');
  assert.equal(JL.payState({ paid: false, kind: 'in', date: new Date(2026, 11, 25) }, today)[1], '입금 예정');
});

test('실제 금액 추천값: 예상 금액 주변을 5천 원 단위로, 겹치는 값 없이', () => {
  assert.deepEqual(JL.amtPicks(25000), [20000, 25000, 30000, 40000]);
  assert.deepEqual(JL.amtPicks(0), [10000, 20000, 30000, 50000]);
  const p = JL.amtPicks(3000); assert.equal(new Set(p).size, p.length);
  assert.ok(p.every((v) => v >= 1000 && v % 1000 === 0));
});

test('app.html이 life-core.js를 불러오고, 계산을 직접 하지 않고 JachwiLife를 쓴다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
  assert.ok(html.includes('<script src="life-core.js" defer></script>'));
  assert.ok(/JL\.monthBills\(S\.bills/.test(html));
  assert.ok(!/fee\.amount \+= e\.amount/.test(html), '관리비 합산 계산이 app.html에 두 벌 있으면 안 된다');
});

// ── 청년월세 지원 공고 고르기 (캘린더 '청년월세 지원 입금' 안내) ──
const prog = (id, eligible, extra = {}) => ({ eligible, p: Object.assign({ id, name: id }, extra) });

test('청년월세 안내: 서울 밖이라 국토부만 해당 가능해도 국토부 공고를 고른다', () => {
  const got = JL.pickRentProgram([prog('rent', false), prog('molit-rent', true), prog('guar', true)]);
  assert.equal(got.p.id, 'molit-rent');
  assert.equal(got.eligible, true);
});

test('청년월세 안내: 서울 시연 공고가 빠져도 국토부 공고로 안내가 뜬다', () => {
  assert.equal(JL.pickRentProgram([prog('molit-rent', true)]).p.id, 'molit-rent');
});

test('청년월세 안내: 둘 다 해당 가능하면 실제 공고(국토부)를 먼저, 서울만 해당 가능하면 서울', () => {
  assert.equal(JL.pickRentProgram([prog('rent', true), prog('molit-rent', true)]).p.id, 'molit-rent');
  assert.equal(JL.pickRentProgram([prog('molit-rent', false), prog('rent', true)]).p.id, 'rent');
});

test('청년월세 안내: 청년월세 공고가 없으면 null (다른 지원사업은 보지 않는다)', () => {
  assert.equal(JL.pickRentProgram([prog('guar', true), prog('incheon-bok', true)]), null);
  assert.equal(JL.pickRentProgram([]), null);
  assert.equal(JL.pickRentProgram(undefined), null);
});

test('선정됐어요 · 켜기: 공고의 월 최대 금액과 기간으로 입금 항목을 맞춘다 (국토부 24개월, 서울 12개월)', () => {
  const bill = { id: 'sup-rent', name: '청년월세 지원 입금', kind: 'in', amount: 200000, count: 12, on: false };
  const molit = JL.applyRentProgram(bill, { monthly: 20, months: 24 });
  assert.deepEqual([molit.on, molit.amount, molit.count], [true, 200000, 24]);
  const seoul = JL.applyRentProgram(bill, { monthly: 20, months: 12 });
  assert.deepEqual([seoul.amount, seoul.count], [200000, 12]);
  const none = JL.applyRentProgram(bill, null);
  assert.deepEqual([none.on, none.amount, none.count], [true, 200000, 12], '공고 값이 없으면 원래 값 유지');
  assert.equal(bill.on, false, '원래 항목은 바꾸지 않고 새 값을 돌려준다');
});

// ── QR로 받은 납부 항목·내 일정 검사 (코드 점검 2번) ──
const BAD = '"><img src=x onerror=alert(1)>';

test('QR 검사: 납부 항목 id·숫자·선택값이 형식에 안 맞으면 버리거나 기본값으로', () => {
  const got = JL.cleanBills([
    { id: 'net', name: '인터넷', kind: 'out', amount: '22000', day: 10, every: 1, on: true, incl: 'incl' },
    { id: BAD, name: '나쁜 id', amount: 1 },
    { id: 'gas', name: BAD, amount: BAD, day: BAD, every: 99, kind: BAD, link: BAD, incl: BAD, start: BAD, note: 'x'.repeat(200), on: 'yes' },
    { id: 'net', name: '겹치는 id' },
    null, 'text'
  ]);
  assert.deepEqual(got.map((b) => b.id), ['net', 'gas']);
  const net = got[0], gas = got[1];
  assert.deepEqual([net.amount, net.day, net.incl, net.on], [22000, 10, 'incl', true]);
  assert.deepEqual([gas.amount, gas.day, gas.every, gas.kind, gas.on], [0, 0, 1, 'out', false]);
  assert.ok(!('link' in gas) && !('incl' in gas) && !('start' in gas));
  assert.equal(gas.name.length, 20);
  assert.equal(gas.note.length, 60);
});

test('QR 검사: 월세·관리비 연결, 시작 달, 횟수 같은 정상 값은 그대로 남긴다', () => {
  const [r, s] = JL.cleanBills([
    { id: 'rent', name: '월세', kind: 'out', link: 'rent', day: 25, every: 1, on: true },
    { id: 'sup-rent', name: '청년월세 지원 입금', kind: 'in', amount: 200000, day: 25, every: 1, count: 24, start: '2027-3', on: true, est: false }
  ]);
  assert.equal(r.link, 'rent');
  assert.deepEqual([s.kind, s.count, s.start], ['in', 24, '2027-3']);
});

test('QR 검사: 내 일정은 날짜·시간·색·알림 형식만 통과, 제목은 30자까지', () => {
  const got = JL.cleanEvents([
    { id: 'ev1', date: '2026-12-05', time: '18:30', title: '친구 집들이', color: 'purple', alarm: '1h' },
    { id: 'ev2', date: '2026-12-06', time: BAD, title: BAD + 'x'.repeat(50), color: BAD, alarm: BAD },
    { id: BAD, date: '2026-12-07', title: '나쁜 id' },
    { id: 'ev4', date: BAD, title: '나쁜 날짜' },
    { id: 'ev5', date: '2026-12-08', title: '   ' }
  ]);
  assert.deepEqual(got.map((x) => x.id), ['ev1', 'ev2']);
  assert.deepEqual([got[0].time, got[0].color, got[0].alarm], ['18:30', 'purple', '1h']);
  assert.deepEqual([got[1].time, got[1].color, got[1].alarm, got[1].title.length], ['', 'blue', '1d', 30]);
});

test('QR 검사: 목록이 아니면 null (받는 쪽에서 원래 값을 지킨다)', () => {
  assert.equal(JL.cleanBills(BAD), null);
  assert.equal(JL.cleanEvents({ a: 1 }), null);
  assert.deepEqual(JL.cleanBills([]), []);
});

test('QR 검사: 기본 납부 항목을 통과시켜도 계산 결과가 그대로다', () => {
  const before = month(BILLS(), 2026, 11).map((e) => [e.bid, e.amount]);
  const after = month(JL.cleanBills(BILLS()), 2026, 11).map((e) => [e.bid, e.amount]);
  assert.deepEqual(after, before);
});

test('app.html: QR로 받을 때 납부 항목·내 일정은 검사하고 넣는다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
  assert.ok(html.includes("if (k in o) S[k] = o[k]; }); S.bills = JL.cleanBills(S.bills) || clone(FRESH).bills; S.events = JL.cleanEvents(S.events) || [];"));
});
