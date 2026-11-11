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

test('운영 지역: 다른 지자체가 전국 대상으로 등록한 사업은 보여 주지 않는다', () => {
  const size = {}; REGIONS.forEach((r) => r[1].forEach((x) => { size[x[0].slice(0, 2)] = (size[x[0].slice(0, 2)] || 0) + 1; }));
  const everywhere = [].concat(...REGIONS.map((r) => r[1].map((x) => x[0]))).join(',');
  const gb = REGIONS.filter((r) => r[0] === '경상북도')[0][1].map((x) => x[0]).join(',');
  const mk = (o) => S.normalize(raw(Object.assign({ zipCd: everywhere }, o)), size, REGIONS);
  const show = (it, sido, sgg) => S.forRegion(it, sido, sgg);
  // 2026-11-11 실제 사례: 경북 의성군 '청년 지역정착 활성화 사업'이 전국 254개 코드로 등록돼 광주 북구에 나왔다
  const us = mk({ rgtrHghrkInstCdNm: '경상북도', rgtrUpInstCdNm: '경상북도 의성군', sprvsnInstCdNm: '경상북도 의성군 관광복지국' });
  assert.deepEqual([us.scope, us.osido, us.osgg], ['all', '경상북도', '의성군']);
  assert.equal(show(us, '전남광주통합특별시', '북구'), false);
  assert.equal(show(us, '경상북도', '포항시 남구'), false); // 같은 도 안의 다른 시·군
  assert.equal(show(us, '경상북도', '의성군'), true);
  // 도 전체 코드로 등록한 군 사업도 그 군에만
  const usDo = mk({ zipCd: gb, rgtrHghrkInstCdNm: '경상북도', rgtrUpInstCdNm: '경상북도 의성군' });
  assert.equal(usDo.scope, 'sido'); assert.equal(show(usDo, '경상북도', '포항시 남구'), false); assert.equal(show(usDo, '경상북도', '의성군'), true);
  // 도가 운영하는 사업은 도민 모두에게, 다른 시·도에는 안 보인다
  const prov = mk({ rgtrHghrkInstCdNm: '경상북도', rgtrUpInstCdNm: '경상북도 지방시대정책국', sprvsnInstCdNm: '경상북도 지방시대정책국 청년정책과' });
  assert.equal(prov.osgg, ''); assert.equal(show(prov, '경상북도', '포항시 남구'), true); assert.equal(show(prov, '서울특별시', '관악구'), false);
  // 시 이름이 '포항시 남구'처럼 두 낱말이어도 시 사업은 그 시에 보인다
  const ph = mk({ zipCd: gb, rgtrHghrkInstCdNm: '경상북도', rgtrUpInstCdNm: '경상북도 포항시' });
  assert.equal(show(ph, '경상북도', '포항시 남구'), true); assert.equal(show(ph, '경상북도', '의성군'), false);
  // 중앙부처 사업은 그대로
  assert.equal(show(mk({ pvsnInstGroupCd: '0054001', rgtrHghrkInstCdNm: '국토교통부' }), '전남광주통합특별시', '북구'), true);
  // 누가 운영하는지 모르는 전국 등록은 보여 주지 않는다 (정부 산하기관은 예외)
  assert.equal(show(mk({ rgtrHghrkInstCdNm: '', sprvsnInstCdNm: '미래교육돌봄국' }), '서울특별시', '관악구'), false);
  assert.equal(show(mk({ rgtrHghrkInstCdNm: '정부산하기관및위원회', sprvsnInstCdNm: '문화체육관광부' }), '서울특별시', '관악구'), true);
  // 대상 코드가 내 시·군·구로 좁게 등록된 사업은 코드를 믿는다
  assert.equal(show(S.normalize(raw({ zipCd: '11620', rgtrHghrkInstCdNm: '', sprvsnInstCdNm: '서울특별시 주택실' }), size, REGIONS), '서울특별시', '관악구'), true);
  // 통합 전 이름으로 등록된 사업: 옛 전남 사업은 광주 자치구에, 옛 광주 사업은 전남 시·군에 보이지 않는다
  const jn = mk({ rgtrHghrkInstCdNm: '전라남도', rgtrUpInstCdNm: '전라남도', sprvsnInstCdNm: '전남광주통합특별시' });
  assert.equal(jn.osido, '전남광주통합특별시'); assert.equal(show(jn, '전남광주통합특별시', '북구'), false); assert.equal(show(jn, '전남광주통합특별시', '목포시'), true);
  const gj = mk({ rgtrHghrkInstCdNm: '광주시청', rgtrUpInstCdNm: '광주시청', sprvsnInstCdNm: '전남광주통합특별시' });
  assert.equal(show(gj, '전남광주통합특별시', '북구'), true); assert.equal(show(gj, '전남광주통합특별시', '목포시'), false);
  // 시가 대신 등록한 구 사업은 정책 이름에서 구를 읽는다
  const seogu = mk({ plcyNm: '[광주 서구] 마음회복×진로설계 특강', rgtrHghrkInstCdNm: '전남광주통합특별시', sprvsnInstCdNm: '전남광주통합특별시' });
  assert.deepEqual([seogu.osgg, seogu.opart], ['서구', '광주']);
  assert.equal(show(seogu, '전남광주통합특별시', '북구'), false); assert.equal(show(seogu, '전남광주통합특별시', '서구'), true);
  const namgu = S.normalize(raw({ zipCd: '12300,12270', plcyNm: '2026년 남구 「청년활동 포인트제」 참여자 모집', rgtrHghrkInstCdNm: '광주시청' }), size, REGIONS);
  assert.equal(show(namgu, '전남광주통합특별시', '북구'), false); // 대상 코드에 북구가 들어 있어도 남구 사업이다
  assert.equal(show(mk({ plcyNm: '전남형 청년창업 사관학교', rgtrHghrkInstCdNm: '전남광주통합특별시' }), '전남광주통합특별시', '북구'), false);
  // 글에 섞인 HTML 표기는 글자로
  assert.equal(S.normalize(raw({ plcyNm: '&quot;노벨 문학도시&quot; 청년 &amp; 축제' })).name, '"노벨 문학도시" 청년 & 축제');
});

// 공고 원문에서 읽은 기간을 붙인다 (서버가 하는 일을 테스트에서 흉내 낸다)
const withNotice = (it, ranges) => Object.assign(it, { notice: { state: 'found', ranges: ranges.map(([from, to]) => ({ from, to })) } });

test('접수 상태: 공고 원문으로 확인한 기간만 마감으로 말하고, 보는 날짜 기준으로 바뀐다', () => {
  const it = withNotice(S.normalize(raw()), [['20261101', '20261122']]);
  assert.equal(S.statusAt(it, day('20261025')).k, 'soon');
  const open = S.statusAt(it, day('20261110'));
  assert.equal(open.k, 'open'); assert.equal(open.left, 12); assert.equal(open.sure, true); assert.equal(open.src, 'notice');
  assert.equal(S.statusAt(it, day('20261122')).left, 0);
  assert.equal(S.statusAt(it, day('20261123')).k, 'ended');
  assert.equal(S.statusAt(S.normalize(raw({ aplyPrdSeCd: '0057003', aplyYmd: '' })), day('20261110')).k, 'ended');
});

test('접수 상태: 공고로 확인 못 하면 마감일을 말하지 않는다. 끝났다는 근거는 받아들인다', () => {
  const on = day('20261111');
  // 2026-11-11 실제 사례: '기상기후분야 국제기구 청년진출 지원'이 1.1~12.31(사업 기간 복사)로 등록, 실제 공고는 4.20~5.22
  const kmi = S.normalize(raw({ aplyYmd: '20260101 ~ 20261231', bizPrdBgngYmd: '20260101', bizPrdEndYmd: '20261231' }));
  assert.equal(S.regLoose(kmi), true);
  const st = S.statusAt(kmi, on);
  assert.equal(st.k, 'check'); assert.equal(st.sure, false); assert.equal(S.leftText(st), '');
  assert.equal(S.statusAt(withNotice(kmi, [['20260420', '20260522']]), on).k, 'ended'); // 공고를 읽으면 끝남
  // 등록 기간이 이미 지났으면 끝남 (공고를 못 읽어도)
  assert.equal(S.statusAt(S.normalize(raw({ aplyYmd: '20260301 ~ 20260331' })), on).k, 'ended');
  // 등록 글에 적힌 마감이 지났으면 끝남
  const txt = S.normalize(raw({ aplyYmd: '20260101 ~ 20261231', plcyAplyMthdCn: '접수기간 2026. 6. 1. ~ 6. 30. 이메일 접수' }));
  assert.equal(S.statusAt(txt, on).k, 'ended'); assert.equal(S.statusAt(txt, on).src, 'text');
  // 상시로 등록된 것도 공고로 확인하기 전에는 '미확인'
  const al = S.statusAt(S.normalize(raw({ aplyPrdSeCd: '0057002', aplyYmd: '' })), on);
  assert.equal(al.k, 'always'); assert.equal(al.sure, false);
  assert.equal(S.statusAt(Object.assign(S.normalize(raw({ aplyPrdSeCd: '0057002', aplyYmd: '' })), { notice: { state: 'always' } }), on).sure, true);
  // 읽는 중
  assert.equal(S.statusAt(Object.assign(S.normalize(raw()), { notice: { state: 'pending' } }), on).text, '접수 기간 확인 중');
});

test('나이 경계: 하한·상한 당일은 맞고 하루 차이는 안 맞는다', () => {
  const it = S.normalize(raw());
  const v = (age) => S.verdict(S.check(it, me({ age }), '수원시 거주'));
  assert.equal(v(19), 'ok'); assert.equal(v(34), 'ok'); assert.equal(v(18), 'no'); assert.equal(v(35), 'no');
  assert.equal(v(0), 'q');
});

test('연소득 경계: 월 소득을 넣으면 12를 곱해 견준다. 상한과 같으면 맞고 넘으면 안 맞는다. 입력 전에는 묻는다', () => {
  const it = S.normalize(raw({ earnCndSeCd: '0043002', earnMaxAmt: '4800' }));
  const c = (minc) => S.check(it, me(minc === undefined ? {} : { minc }), '');
  assert.equal(S.verdict(c(400)), 'ok'); assert.equal(S.verdict(c(401)), 'no');
  assert.equal(S.verdict(c(0)), 'ok'); // 버는 돈이 없다고 답한 경우
  const ask = c().filter((x) => x.key === 'earn')[0];
  assert.equal(ask.ok, null); assert.equal(ask.ask, 'minc');
  assert.match(ask.note, /한 달에 약 400만 원 이하/); // 기준 금액을 먼저 알려 준다
});

test('취업·혼인 조건: 답하기 전에는 확인 필요, 답하면 판정', () => {
  const it = S.normalize(raw({ jobCd: '0013003', mrgSttsCd: '0055002' }));
  assert.equal(S.verdict(S.check(it, me(), '')), 'q');
  assert.equal(S.verdict(S.check(it, me({ job: '미취업자', mrg: '미혼' }), '')), 'ok');
  assert.equal(S.verdict(S.check(it, me({ job: '재직자', mrg: '미혼' }), '')), 'no');
  assert.equal(S.verdict(S.check(it, me({ job: '미취업자', mrg: '기혼' }), '')), 'no');
});

test('글로 적힌 중위소득 조건: 가구원 수를 알면 금액으로 바꿔 견준다', () => {
  const it = S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '청년독립가구 소득 기준 중위소득 60% 이하' }));
  const c = (u) => S.check(it, me(u), '').filter((x) => x.key === 'earn:pct')[0];
  assert.equal(S.medianMan(1, 60), 153); assert.equal(S.medianMan(3, 60), 321); assert.equal(S.medianMan(3, 100), 535);
  const first = c();
  assert.equal(first.ok, null); assert.equal(first.ask, 'hinc'); assert.deepEqual([first.pct.lo, first.pct.hi], [60, 60]);
  assert.equal(c({ hh: 1, minc: 153 }).ok, true); assert.equal(c({ hh: 1, minc: 154 }).ok, false);
  assert.match(c({ hh: 1, minc: 153 }).label, /1명 가구 월 153만 원/);
  // 가족과 같이 등본에 올라 있으면 내 소득이 아니라 가족 소득 합계로 본다
  assert.equal(c({ hh: 3, minc: 100 }).ask, 'hinc');
  assert.equal(c({ hh: 3, minc: 100, hinc: 321 }).ok, true); assert.equal(c({ hh: 3, minc: 100, hinc: 322 }).ok, false);
});

test('글 소득 조건 읽기: 무관·중위소득·연소득·수급·판정 못 함을 가른다', () => {
  assert.equal(S.incomeRule('무관').t, 'none'); assert.equal(S.incomeRule('소득 제한 없음').t, 'none');
  assert.deepEqual(S.incomeRule('중위소득 150% 이하'), { t: 'pct', lo: 150, hi: 150, soft: false });
  const two = S.incomeRule('기준 중위소득 60% 이하 또는 기준 중위소득 100% 이하');
  assert.deepEqual([two.lo, two.hi], [60, 100]);
  const span = S.incomeRule('청년, 신혼부부 중위소득 100~150% 이하');
  assert.deepEqual([span.t, span.lo, span.hi], ['pct', 100, 150]);
  assert.equal(S.incomeRule('중위소득 60% 이하 우선 선발').soft, true);
  assert.deepEqual(S.incomeRule('연소득 5천만원 이하'), { t: 'year', lo: 5000, hi: 5000, soft: false });
  assert.equal(S.incomeRule('기초생활수급자 및 차상위계층').t, 'low'); assert.equal(S.incomeRule('기초생활수급자 및 차상위계층').strict, true);
  assert.match(S.incomeRule('학자금 지원구간 8구간 이하').url, /kosaf/);
  assert.match(S.incomeRule('건강보험료 본인부담금 기준').url, /nhis/);
  assert.equal(S.incomeRule('공고문 참조').t, 'info');
  // 소득 무관 정책은 조건이 맞은 것으로 본다
  const free = S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '무관' }));
  assert.equal(S.verdict(S.check(free, me(), '')), 'ok');
  // 글 연소득도 월 소득으로 견준다
  const yr = S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '연소득 6천만원 이하' }));
  const y = (minc) => S.check(yr, me({ minc }), '').filter((x) => x.key === 'earn:year')[0].ok;
  assert.equal(y(500), true); assert.equal(y(501), false);
});

test('금액 읽기: 억·천만·백만·만 원을 만 원 단위로', () => {
  assert.deepEqual(S.amounts('5천만원, 7.5천만원, 7,000만원, 3억원, 5백만원, 70만 원'), [5000, 7500, 7000, 30000, 500, 70]);
  assert.deepEqual(S.amounts('금액 없음'), []);
  assert.equal(S.won(5000), '5,000만 원'); assert.equal(S.won(12500), '1억 2,500만 원');
});

test('대상 조건: 한 번 답하면 기억하고, 해당 없으면 안 맞는다', () => {
  const it = S.normalize(raw({ sbizCd: '0014005,0014004' }));
  const c = (traits) => S.check(it, me({ traits }), '').filter((x) => x.key === 'traits')[0];
  assert.equal(c().ok, null); assert.equal(c().ask, 'traits'); assert.deepEqual(c().traits.slice().sort(), ['장애인', '한부모가정']);
  assert.equal(c({ '장애인': true }).ok, true);
  assert.equal(c({ '장애인': false }).ask, 'traits'); assert.deepEqual(c({ '장애인': false }).traits, ['한부모가정']); // 안 물어본 것만 다시 묻는다
  assert.equal(c({ '장애인': false, '한부모가정': false }).ok, false);
});

test('공고 글의 주거 조건: 무주택은 묻고, 보증금·월세 상한은 계약 정보와 견준다', () => {
  const it = S.normalize(raw({ addAplyQlfcCndCn: '무주택 청년으로 임차보증금 5천만원 이하 및 월세 70만원 이하 주택에 거주하는 사람' }));
  assert.deepEqual(S.textRules(it), { homeless: true, deposit: 5000, rent: 70 });
  const v = (u) => S.verdict(S.check(it, me(u), ''));
  assert.equal(v({ deposit: 1000, rent: 45 }), 'q'); // 무주택 여부를 아직 모른다
  assert.equal(v({ deposit: 1000, rent: 45, self: { homeless: 'y' } }), 'ok');
  // 글에서 읽은 상한은 넘어도 '안 맞음'으로 끊지 않고 확인 필요로 둔다 (공고마다 전세·월세, 지역별 기준이 따로 적힌 경우가 있다)
  assert.equal(v({ deposit: 1000, rent: 71, self: { homeless: 'y' } }), 'q');
  assert.equal(v({ deposit: 5001, rent: 45, self: { homeless: 'y' } }), 'q');
  assert.match(S.check(it, me({ deposit: 5001, rent: 45 }), '').filter((x) => x.key === 'cap:deposit')[0].note, /공고에서 확인/);
  assert.equal(v({ deposit: 1000, rent: 45, self: { homeless: 'n' } }), 'no');
  // 실제 공고에서 잘못 읽던 글 (2026-11-11 전국 점검)
  const tr = (cond) => S.textRules(S.normalize(raw({ addAplyQlfcCndCn: cond })));
  assert.deepEqual(tr('전입신고 필수 ※ 기존 월세 임차보증금 5천만원 및 월세 70만원 이하 요건 폐지(2024.4.12.~)'), {}); // 폐지된 요건
  assert.deepEqual(tr('입주자격(무주택자 우선) 등'), {}); // 우대일 뿐 필수가 아니다
  assert.deepEqual(tr('(전세) 보증금 3억원 이하 (월세) 보증금 1억원 이하 및 월세 70만원 이하'), { rent: 70 }); // 보증금 상한이 두 가지면 읽지 않는다
  assert.deepEqual(tr('보증금 8,000만원 이하, 월세 60만원 이하'), { deposit: 8000, rent: 60 });
});

test('실제 공고 글 읽기 보완: 합쳐 쓴 금액, 청년 금액, 건강보험료, 빈칸, 나이 제한 없음', () => {
  assert.deepEqual(S.amounts('8천5백만 원, 1억 3천만원, 1.5억원'), [8500, 13000, 15000]);
  assert.deepEqual(S.amounts('과세급여 3,077,090원 이하, 월 200천원'), []); // 만 원 단위가 아닌 표기는 읽지 않는다
  const yr = (t) => { const r = S.incomeRule(t); return [r.t, r.lo, r.hi]; };
  assert.deepEqual(yr('신혼부부(부부합산) 연소득 8천5백만 원 이하, 다자녀가정(부부합산) 연소득 1억 원 이하'), ['year', 8500, 10000]);
  assert.deepEqual(yr('임차보증금 3억원 이하, 연소득 기준 이하(청년 5천만원, 신혼부부 7.5천만원, 청년 외 6천만원)인 무주택 임차인'), ['year', 5000, 5000]);
  assert.deepEqual(yr('연소득 (청년)5천만원, (청년 외)6천만원, (신혼부부)7.5천만원 이하'), ['year', 5000, 5000]);
  assert.deepEqual(yr('(신혼부부)부부합산 연소득 1.3억 원 이하, (청년)연소득 4천만원(부부합산 5천만원) 이하'), ['year', 4000, 4000]);
  assert.deepEqual(yr('부부합산 1.3억 원 이하'), ['year', 13000, 13000]);
  // 건강보험료로 따지는 사업은 '중위소득 140%'라고 적혀 있어도 소득 금액으로 판정하지 않는다
  assert.equal(S.incomeRule('건강보험료 중위소득 140% 미만').t, 'info');
  assert.equal(S.incomeRule('기초생활수급자, 차상위계층, 한국장학재단 학자금 지원 4구간 이하').strict, false);
  // 내용 없이 '-'만 등록된 칸은 조건으로 보여 주지 않는다
  assert.equal(S.incomeRule('-').t, 'skip');
  const blank = S.check(S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '-' })), me(), '');
  assert.equal(blank.filter((x) => /^earn/.test(x.key)).length, 0);
  // 부모님 가구 소득도 보는 사업은 내 소득만으로 맞다고 하지 않는다
  const par = S.normalize(raw({ earnCndSeCd: '0043003', earnEtcCn: '원가구 기준 중위소득 100% 이하, 청년가구 기준 중위소득 60% 이하' }));
  const pc = S.check(par, me({ hh: 1, minc: 100 }), '').filter((x) => x.key === 'earn:pct')[0];
  assert.equal(pc.ok, null); assert.match(pc.note, /부모님 가구/);
  // 나이: 0·99 이상은 제한 없음으로 등록한 값
  const age = (lo, hi) => S.check(S.normalize(raw({ sprtTrgtMinAge: lo, sprtTrgtMaxAge: hi })), me(), '').filter((x) => x.key === 'age').map((x) => x.label)[0];
  assert.equal(age('19', '120'), '만 19세 이상'); assert.equal(age('0', '39'), '만 39세 이하'); assert.equal(age('0', '99'), undefined); assert.equal(age('19', '34'), '만 19~34세');
  // 서류 칸에 적힌 안내 문장은 서류로 세지 않는다
  assert.deepEqual(S.docLines('별도 문의'), []);
  assert.deepEqual(S.docLines('- 주민등록등본\n- ☞ 자세한 내용은 붙임파일을 확인해주시기 바랍니다\n- 시군 홈페이지 참고\n- 차상위계층 확인서').map((x) => x.name), ['주민등록등본', '차상위계층 확인서']);
});

test('마감 표시: 올해가 아니면 연도를 붙이고, 1년 넘게 남거나 반년 넘게 받는 접수는 남은 날을 세지 않는다', () => {
  const at = (from, to, on) => S.statusAt(withNotice(S.normalize(raw()), [[from, to]]), day(on));
  const near = at('20261101', '20261122', '20261111');
  assert.equal(near.text, '접수 중 · 11월 22일 마감'); assert.equal(S.leftText(near), '11일 남음'); assert.ok(!near.far);
  assert.equal(S.leftText(at('20261101', '20261111', '20261111')), '오늘 마감');
  const far = at('20250101', '20300422', '20261111');
  assert.equal(far.left, 1258); assert.equal(far.far, true);
  assert.equal(far.text, '접수 중 · 2030년 4월 22일 마감'); assert.equal(S.leftText(far), '');
  const next = at('20261201', '20270131', '20261211'); // 해를 넘기는 마감
  assert.equal(next.text, '접수 중 · 2027년 1월 31일 마감'); assert.equal(S.leftText(next), '51일 남음');
  assert.equal(at('20270105', '20270131', '20261111').text, '2027년 1월 5일부터 접수');
  assert.equal(at('20250301', '20250331', '20261111').text, '접수 끝남 · 2025년 3월 31일 마감');
  assert.equal(S.leftText(at('20260101', '20261231', '20261111')), ''); // 1년 내내 받는 접수
  // 1차·2차: 지금 열린 차수를 쓴다
  const two = S.statusAt(withNotice(S.normalize(raw()), [['20260301', '20260315'], ['20261101', '20261120']]), day('20261111'));
  assert.equal(two.k, 'open'); assert.equal(two.left, 9);
});

test('마감 빠른 순: 공고로 확인한 접수 중 → 접수 전 → 상시 → 기간 확인 필요 → 끝남', () => {
  const on = day('20261111'), n = (from, to) => S.statusAt(withNotice(S.normalize(raw()), [[from, to]]), on);
  const list = [['상시(확인)', S.statusAt(Object.assign(S.normalize(raw({ aplyPrdSeCd: '0057002', aplyYmd: '' })), { notice: { state: 'always' } }), on)],
    ['상시(미확인)', S.statusAt(S.normalize(raw({ aplyPrdSeCd: '0057002', aplyYmd: '' })), on)], ['확인 필요', S.statusAt(S.normalize(raw({ aplyYmd: '20260101 ~ 20261231' })), on)],
    ['접수 전', n('20261201', '20261231')], ['12일', n('20261101', '20261123')], ['끝남', n('20261001', '20261031')], ['3일', n('20261101', '20261114')]];
  assert.deepEqual(list.sort((a, b) => S.dueRank(a[1]) - S.dueRank(b[1])).map((x) => x[0]), ['3일', '12일', '접수 전', '상시(확인)', '상시(미확인)', '확인 필요', '끝남']);
});

test('공고 원문 읽기: 접수 기간을 찾고, 다른 공고·지난 공고·여러 공고가 섞인 페이지는 믿지 않는다', () => {
  const it = S.normalize(raw({ plcyNm: '기상기후분야 국제기구 청년진출 지원', bizPrdBgngYmd: '20260101' }));
  const page = (body) => S.readNotice('2026년 국제 기상기후전문인력 양성과정 교육생 모집 안내\n국제기구 인턴십\n' + body, it);
  // 실제 공고 문장 (한국기상산업기술원, 2026-11-11 확인). '지원기간'이 접수 기간이고 '교육기간'은 따로 있다
  assert.deepEqual(page('4. 지원기간: 2026. 4. 20.(월) 09:00 ~ 5. 22.(금) 17:00까지\n10. 교육기간: 2026. 7. 6.(월)~7. 24.(금)').ranges, [{ from: '20260420', to: '20260522', month: false }]);
  assert.equal(page('접수기간 : 상시').state, 'always');
  assert.deepEqual(page('신 청 기 간 : 2026.12.20.~1.10.').ranges, [{ from: '20261220', to: '20270110', month: false }]);
  assert.deepEqual(page('신청\n기 간 : 2026. 4월 ~ 11월').ranges, [{ from: '20260401', to: '20261130', month: true }]);
  assert.equal(page('접수마감 : ~ 2026.4.15.(수)').ranges[0].to, '20260415');
  // '지원기간'이 길면(사업 지원 기간) 접수 기간으로 보지 않는다
  assert.equal(page('지원기간: 2026. 1. 1. ~ 2026. 11. 30. (11개월 내외)').why, 'notstated');
  // 사업 이름이 없는 페이지(첫 화면·다른 공고)는 읽지 않는다
  assert.equal(S.readNotice('한국문화예술위원회 공지사항\n접수기간 2026.5.1~5.10', it).why, 'unrelated');
  // 사업 연도보다 앞선 해의 공고만 있으면 지난 공고
  assert.equal(page('신청기간 2022.1월 ~ 2022.12월').why, 'stale');
  // 서로 다른 기간이 셋 이상이면 게시판 목록으로 보고 믿지 않는다
  assert.equal(page('접수기간 2026-11-06 ~ 2026-11-20\n접수기간 2026-11-04 ~ 2026-11-19\n접수기간 2026-11-02 ~ 2026-11-25').why, 'ambiguous');
  // 1차·2차라고 적힌 두 기간은 받는다
  assert.equal(page('1차 접수기간 2026.3.1~3.15\n2차 접수기간 2026.11.1~11.20').ranges.length, 2);
  // HTML에서 글만 뽑는다
  assert.equal(S.htmlText('<p>신청기간</p><table><tr><th>접수</th><td>2026.5.1</td></tr></table><script>x</script>'), '신청기간\n접수 2026.5.1');
});

test('주소: 공고까지 들어가는 주소를 먼저 쓰고, 첫 화면 주소는 표시해 둔다', () => {
  const it = S.normalize(raw({ refUrlAddr1: 'https://www.kmiti.or.kr/', refUrlAddr2: 'https://www.kmiti.or.kr/kr/board/kmi_notice/boardView.do?bbsIdx=45288', aplyUrlAddr: 'www.work.go.kr' }));
  assert.equal(it.ref, 'https://www.kmiti.or.kr/kr/board/kmi_notice/boardView.do?bbsIdx=45288'); assert.equal(it.refHome, false);
  assert.equal(it.urlHome, true); // 신청 주소가 첫 화면
  assert.deepEqual(it.notices, ['https://www.kmiti.or.kr/kr/board/kmi_notice/boardView.do?bbsIdx=45288']);
  const home = S.normalize(raw({ refUrlAddr1: 'https://jeonnam-gwangju.go.kr/index.do', refUrlAddr2: '' }));
  assert.equal(home.refHome, true); assert.deepEqual(home.notices, []);
  assert.equal(S.isDeep('https://youth.gwangju.go.kr/www/50?siteId=www&policyId=1455'), true);
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
