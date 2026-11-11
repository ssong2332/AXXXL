/* 자취 계약 내비 — 계약·신고 계산 엔진 (브라우저·Node 공용, 순수 함수)
 * 맡는 일: 전월세 신고 의무·기한, 전입신고 기한, 계약 만료일, 갱신 통지 마감, 만 나이, 입력 검사
 * 지원 자격 판정은 rules-core.js(운영자 승인 공고 → evalProgram)가 맡는다. 여기서는 toUser()로 입력만 넘긴다.
 * 브라우저: <script src="engine.js"> → window.JachwiEngine / Node: require('./engine.js')
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JachwiEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 법령 기준 (공고가 아니라 법이라 운영자 승인 대상이 아님) ----------
  var LAW_URL = 'https://www.law.go.kr/법령/';
  var LAW = {
    basis: '2026.10.28',
    seoulGu: ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
    // 주택임대차(전월세) 신고: 보증금 6천만 원 초과 또는 월세 30만 원 초과, 계약일부터 30일 이내
    report: { depositOver: 6000, rentOver: 30, days: 30, src: '부동산 거래신고 등에 관한 법률 제6조의2', url: LAW_URL + '부동산거래신고등에관한법률' },
    // 전입신고: 새 거주지로 옮긴 날부터 14일 이내
    movein: { days: 14, src: '주민등록법 제16조', url: LAW_URL + '주민등록법' },
    // 갱신 거절·조건 변경 통지: 임차인은 만료 2개월 전까지
    renew: { monthsBefore: 2, src: '주택임대차보호법 제6조', url: LAW_URL + '주택임대차보호법' }
  };

  // ---------- 날짜 ----------
  function parseDate(s) {
    var p = String(s || '').split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d) ? null : d;
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); }
  // n개월 뒤(음수면 앞) 같은 날. 그 달에 같은 날이 없으면 그 달 말일 (민법 제160조 제3항)
  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n;
    var ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12;
    return new Date(ty, tm, Math.min(d.getDate(), lastDay(ty, tm)));
  }
  // 계약 만료 = 시작일(입주일)부터 term년, 첫날을 빼고 셈 → 시작일의 term년 뒤 같은 날의 전날 (민법 제157·160조)
  function contractEnd(move, term) {
    var t = +term > 0 ? +term : 2;
    var y = move.getFullYear() + t, m = move.getMonth(), day = move.getDate();
    var corr = day > lastDay(y, m) ? new Date(y, m + 1, 1) : new Date(y, m, day); // 대응일 없으면 다음 달 1일의 전날 = 말일
    return addDays(corr, -1);
  }

  // ---------- 만 나이 (출생연월만 받음) ----------
  // 생일 달이 기준 달과 같으면 생일이 지났는지 알 수 없어 null
  function age(birth, on) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(birth || ''));
    if (!m || !on) return null;
    var by = +m[1], bm = +m[2];
    if (bm < 1 || bm > 12) return null;
    var oy = on.getFullYear(), om = on.getMonth() + 1;
    if (om === bm) return null;
    return oy - by - (om < bm ? 1 : 0);
  }

  // ---------- 입력 검사 ----------
  function validate(S) {
    var err = {};
    function num(k, label) { if (S[k] === '' || S[k] == null || isNaN(+S[k]) || +S[k] < 0) err[k] = label + '을(를) 0 이상 숫자로 넣어 주세요'; }
    num('deposit', '보증금'); num('rent', '월세');
    if (!parseDate(S.contract)) err.contract = '계약일을 넣어 주세요';
    if (!parseDate(S.move)) err.move = '입주(전입) 예정일을 넣어 주세요';
    if (!(+S.term >= 1 && +S.term <= 10)) err.term = '계약 기간을 1~10년으로 넣어 주세요';
    if (S.birth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(S.birth)) err.birth = '출생연월 형식이 맞지 않아요';
    return err;
  }

  // ---------- 신고 의무·기한 (필수 ① 신고, 필수 ② 기한) ----------
  function deadlines(S) {
    var C = parseDate(S.contract), M = parseDate(S.move), end = contractEnd(M, S.term);
    var rp = LAW.report, inSeoul = LAW.seoulGu.indexOf(S.gu) >= 0;
    var required = inSeoul ? (+S.deposit > rp.depositOver || +S.rent > rp.rentOver) : null;
    var reason = !inSeoul ? '서울 밖 지역은 따로 확인이 필요해요' : +S.rent > rp.rentOver ? '월세 30만 원 초과' : +S.deposit > rp.depositOver ? '보증금 6천만 원 초과' : '보증금 6천만 원 이하, 월세 30만 원 이하';
    var due = addDays(C, rp.days);
    return {
      C: C, M: M, end: end,
      report: { required: required, reason: reason, due: due, early: required === true && due < M, merge: required === true && !(due < M), src: rp.src, url: rp.url, basis: LAW.basis },
      movein: { due: addDays(M, LAW.movein.days), src: LAW.movein.src, url: LAW.movein.url, basis: LAW.basis },
      renewDue: addMonths(end, -LAW.renew.monthsBefore)
    };
  }

  // ---------- 지원 자격 판정(rules-core.evalProgram)에 넘길 이용자 값 ----------
  // 나이는 계약일 기준 만 나이, 모르면 null
  // 무주택·중복 수혜는 답하지 않았으면(값 없음) 그대로 undefined로 넘긴다. 'unknown'은 '모른다고 답함'일 때만.
  // rules-core.evalProgram은 undefined면 판정에서 빼고, 'unknown'이면 '확인 필요'로 본다.
  function toUser(S) {
    return { age: age(S.birth, parseDate(S.contract)), income: S.income, deposit: +S.deposit || 0, rent: +S.rent || 0, gu: S.gu, homeless: S.homeless || undefined, dup: S.dup || undefined };
  }

  return { LAW: LAW, parseDate: parseDate, addDays: addDays, addMonths: addMonths, iso: iso, contractEnd: contractEnd, age: age, validate: validate, deadlines: deadlines, toUser: toUser };
});
