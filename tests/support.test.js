// 지원사업 공용 로직 테스트 — 실행: node --test tests/support.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../demo/support-core.js');
const REGIONS = require('../demo/data/regions.js');

const day = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
// 온통청년 응답 한 건의 모양 (값은 테스트용)
const raw = (o) => Object.assign({ plcyNo: 'T1', plcyNm: '테스트 정책', lclsfNm: '주거', mclsfNm: '주택 및 거주지', pvsnInstGroupCd: '0054002', plcyPvsnMthdCd: '0042006', plcyAprvSttsCd: '0044002',
  zipCd: '41111,41113', sprtTrgtMinAge: '19', sprtTrgtMaxAge: '34', mrgSttsCd: '0055003', jobCd: '0013010', schoolCd: '0049010', sbizCd: '0014010', earnCndSeCd: '0043001', earnMinAmt: '0', earnMaxAmt: '0',
  aplyPrdSeCd: '0057001', aplyYmd: '20261101 ~ 20261122', bizPrdBgngYmd: '20260101', bizPrdEndYmd: '20261231', sprtArvlSeqYn: 'N' }, o || {});
const me = (o) => Object.assign({ age: 24, zip: '41111', region: '경기 수원시 장안구', self: {} }, o || {});

test('지역 표: 시도 16개 이상, 코드는 5자리이고 겹치지 않는다', () => {
  const codes = [].concat(...REGIONS.map((r) => r[1].map((x) => x[0])));
  assert.ok(REGIONS.length >= 16 && codes.length > 240);
  assert.ok(codes.every((c) => /^\d{5}$/.test(c)));
  assert.equal(new Set(codes).size, codes.length);
});

test('대상 지역 범위: 코드 수로 전국·시도·시군구를 가른다', () => {
  const size = { 41: 48 }, gg = Array.from({ length: 47 }, (_, i) => '41' + String(100 + i));
  assert.equal(S.scopeOf(Array.from({ length: 251 }, (_, i) => String(10000 + i)), size), 'all');
  assert.equal(S.scopeOf(gg, size), 'sido');
  assert.equal(S.scopeOf(['41111', '41113', '41115', '41117'], size), 'sgg');
  assert.equal(S.scopeOf(['41111', '11620'], size), 'multi');
});

test('접수 상태는 보는 날짜 기준으로 바뀐다', () => {
  const it = S.normalize(raw());
  assert.equal(S.statusAt(it, day('20261025')).k, 'soon');
  const open = S.statusAt(it, day('20261110'));
  assert.equal(open.k, 'open'); assert.equal(open.left, 12);
  assert.equal(S.statusAt(it, day('20261122')).left, 0);
  assert.equal(S.statusAt(it, day('20261123')).k, 'ended');
  assert.equal(S.statusAt(S.normalize(raw({ aplyPrdSeCd: '0057002', aplyYmd: '' })), day('20261110')).k, 'always');
  assert.equal(S.statusAt(S.normalize(raw({ aplyPrdSeCd: '0057003', aplyYmd: '' })), day('20261110')).k, 'ended');
});

test('나이 경계: 하한·상한 당일은 맞고 하루 차이는 안 맞는다', () => {
  const it = S.normalize(raw());
  const v = (age) => S.verdict(S.check(it, me({ age }), '수원시 거주'));
  assert.equal(v(19), 'ok'); assert.equal(v(34), 'ok'); assert.equal(v(18), 'no'); assert.equal(v(35), 'no');
  assert.equal(v(0), 'q');
});

test('연소득 경계: 상한과 같으면 맞고 1만 원 넘으면 안 맞는다. 입력 전에는 묻는다', () => {
  const it = S.normalize(raw({ earnCndSeCd: '0043002', earnMaxAmt: '5000' }));
  const c = (earn) => S.check(it, me({ earn }), '');
  assert.equal(S.verdict(c(5000)), 'ok'); assert.equal(S.verdict(c(5001)), 'no');
  const ask = c(0).filter((x) => x.key === 'earn')[0];
  assert.equal(ask.ok, null); assert.equal(ask.ask, 'earn');
});

test('취업·혼인 조건: 답하기 전에는 확인 필요, 답하면 판정', () => {
  const it = S.normalize(raw({ jobCd: '0013003', mrgSttsCd: '0055002' }));
  assert.equal(S.verdict(S.check(it, me(), '')), 'q');
  assert.equal(S.verdict(S.check(it, me({ job: '미취업자', mrg: '미혼' }), '')), 'ok');
  assert.equal(S.verdict(S.check(it, me({ job: '재직자', mrg: '미혼' }), '')), 'no');
  assert.equal(S.verdict(S.check(it, me({ job: '미취업자', mrg: '기혼' }), '')), 'no');
});

test('글로만 적힌 소득 조건은 판정하지 않고, 중위소득 비율이 있으면 금액으로 바꿔 준다', () => {
  const it = S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '청년독립가구 소득 기준 중위소득 60% 이하' }));
  const c = S.check(it, me(), '').filter((x) => /^earn:/.test(x.key))[0];
  assert.equal(c.ok, null); assert.equal(c.pct, 60);
  assert.equal(S.medianMan(1, 60), 153);
  assert.equal(S.medianMan(3, 100), 535);
});

test('조심할 것: 지역·미취업·연소득 조건에서 만든다', () => {
  const it = S.normalize(raw({ jobCd: '0013003', earnCndSeCd: '0043002', earnMaxAmt: '5000' }), { 41: 48 });
  const w = S.watch(it, me({ age: 34 }), '수원시 장안구 거주').map((x) => x[0]).join(' / ');
  assert.match(w, /주소를 옮기면/); assert.match(w, /취업하면/); assert.match(w, /연소득이 5,000만 원을 넘으면/); assert.match(w, /만 35세가 되면/);
});

test('서류: 괄호 안 쉼표로는 나누지 않고, 발급처를 찾는다', () => {
  const d = S.docLines('<제출 서류>\n○ 신청인 제출 서류\n- 주민등록등본(전체공개, 1개월 이내), 지급받을 계좌의 통장 사본\n- 임대차계약서, 월세 이체확인증');
  assert.deepEqual(d.map((x) => x.name), ['주민등록등본(전체공개, 1개월 이내)', '지급받을 계좌의 통장 사본', '임대차계약서', '월세 이체확인증']);
  assert.equal(d[0].src.url, 'https://www.gov.kr'); assert.equal(d[1].src.t, 'bankP'); assert.equal(d[2].src.t, 'docs'); assert.equal(d[3].src.t, 'bankT');
  assert.deepEqual(S.docLines('공고문 참조'), []);
});

test('주소·글 정리: 위험한 주소는 버리고 긴 글은 자른다', () => {
  const it = S.normalize(raw({ aplyUrlAddr: 'javascript:alert(1)', refUrlAddr1: 'www.gov.kr', plcyExplnCn: '가'.repeat(500) }));
  assert.equal(it.url, ''); assert.equal(it.ref, 'https://www.gov.kr'); assert.ok(it.sum.length <= 220);
});

test('지원 형태: 이름을 먼저 보고, 없으면 제공 방법으로 가른다', () => {
  const k = (name, method) => S.kindOf({ name, method: method || '' });
  assert.equal(k('청년월세 지원'), 'cash');
  assert.equal(k('전세보증금반환보증 보증료 지원', '대출보증'), 'cash');
  assert.equal(k('청년 전월세 임차보증금 대출이자 지원'), 'cash');
  assert.equal(k('청년전용 보증부 월세대출'), 'loan'); // 빌려주는 돈은 현금 지원이 아니다
  assert.equal(k('청년 전월세 대출보증'), 'loan');
  assert.equal(k('청년 생애 첫 국민연금 보험료 지원', '공적보험'), 'cash');
  assert.equal(k('청년 주택드림 디딤돌 대출'), 'loan');
  assert.equal(k('청년 매입임대주택 공급'), 'home');
  assert.equal(k('찾아가는 청년주거 상담소'), 'info');
  assert.equal(k('전세사기 피해 예방 아카데미', '프로그램'), 'edu');
  assert.equal(k('이름만으로는 모르는 사업', '보조금'), 'cash');
  assert.equal(k('이름만으로는 모르는 사업'), 'etc');
});

test('나에게 맞는 순서: 월세 세입자에게는 월세 현금 지원이 상담·다른 대상 사업보다 앞선다', () => {
  const ctx = { age: 24, rent: 45, deposit: 1000, daysIn: 40, self: {}, sido: '경기도' };
  const mk = (o) => S.normalize(raw(o), { 41: 48 });
  const sc = (it, away) => S.relevance(it, ctx, S.kindOf(it), !!away).score;
  const rent = mk({ plcyNm: '청년월세 지원' }), info = mk({ plcyNm: '찾아가는 청년주거 상담소', plcyPvsnMthdCd: '0042011' });
  const other = mk({ plcyNm: '자립준비청년 주거비 지원사업' }), wed = mk({ plcyNm: '신혼부부 전세자금 대출이자 지원' }), move = mk({ plcyNm: '청년 이사비 지원' });
  assert.ok(sc(rent) > sc(info)); assert.ok(sc(rent) > sc(other)); assert.ok(sc(rent) > sc(wed)); assert.ok(sc(move) > sc(info));
  assert.ok(sc(rent) > sc(rent, true)); // 다른 시·도가 운영하면 뒤로
  assert.equal(S.relevance(rent, ctx, 'cash', false).why, '월세를 내고 있어서');
  assert.equal(S.relevance(move, ctx, 'cash', false).why, '최근에 이사해서');
  assert.equal(S.relevance(other, ctx, 'cash', false).why, ''); // 다른 대상 사업에는 '월세를 내고 있어서'를 붙이지 않는다
  // 기혼이라고 답하면 신혼부부 지원을 뒤로 보내지 않는다
  assert.ok(S.relevance(wed, Object.assign({}, ctx, { mrg: '기혼' }), 'cash', false).score > sc(wed));
});
