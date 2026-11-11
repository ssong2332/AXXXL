/* 자취 계약 내비 — 계약·신고 계산 엔진 (브라우저·Node 공용, 순수 함수)
 * 브라우저: <script src="engine.js"> → window.JachwiEngine
 * Node:    require('./engine.js')
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JachwiEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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

  // ---------- 판정 ----------
  var INCOME_LABEL = { '100': '중위 100% 이하', '150': '중위 150% 이하', over: '중위 150% 초과', unknown: '모름' };
  var YN = { yes: '예', no: '아니오', unknown: '모름' };
  var STATUS = { open: '모집 중', closed: '마감', waiting: '다음 공고 대기' };
  function won(n) { return Math.round(+n).toLocaleString('ko-KR'); }

  function checkCond(c, S, on) {
    switch (c.type) {
      case 'age': { var a = age(S.birth, on); return { ok: a === null ? null : a >= c.min && a <= c.max, mine: a === null ? (S.birth ? '생일 달이라 확인 필요' : '모름') : '만 ' + a + '세' }; }
      case 'income': { var i = S.income; return { ok: i === 'unknown' || !i ? null : i === 'over' ? false : +i <= c.max, mine: INCOME_LABEL[i] || '모름' }; }
      case 'deposit': return { ok: +S.deposit <= c.max, mine: won(S.deposit) + '만 원' };
      case 'rent': return { ok: +S.rent <= c.max, mine: S.rent + '만 원' };
      case 'homeless': return { ok: S.homeless === 'yes' ? true : S.homeless === 'no' ? false : null, mine: YN[S.homeless] || '모름' };
      case 'dup': return { ok: S.dup === 'no' ? true : S.dup === 'yes' ? false : null, mine: S.dup === 'yes' ? '받고 있음' : S.dup === 'no' ? '받고 있지 않음' : '모름' };
      default: return { ok: null, mine: '규칙 형식 확인 필요' };
    }
  }

  function evaluate(S, rules) {
    var C = parseDate(S.contract), M = parseDate(S.move);
    var end = contractEnd(M, S.term);
    var rp = rules.report, inSeoul = rules.seoulGu.indexOf(S.gu) >= 0;
    var over = +S.deposit > rp.depositOver || +S.rent > rp.rentOver;
    var required = inSeoul ? over : null;
    var reason = !inSeoul ? '서울 밖 지역은 따로 확인이 필요해요' : +S.rent > rp.rentOver ? '월세 30만 원 초과' : +S.deposit > rp.depositOver ? '보증금 6천만 원 초과' : '보증금 6천만 원 이하, 월세 30만 원 이하';
    var due = addDays(C, rp.days);
    var report = { required: required, reason: reason, due: due, early: required === true && due < M, merge: required === true && !(due < M), src: rp.src, url: rp.url, basis: rp.basis };
    var programs = rules.programs.map(function (p) {
      var res = p.conds.map(function (c) { var r = checkCond(c, S, C); return { label: c.label, mine: r.mine, ok: r.ok }; });
      var verdict = res.some(function (r) { return r.ok === false; }) ? 'ineligible' : res.some(function (r) { return r.ok === null; }) ? 'check' : 'eligible';
      return { p: p, res: res, verdict: verdict, statusLabel: STATUS[p.status] || '확인 필요' };
    });
    return {
      C: C, M: M, end: end, report: report,
      movein: { due: addDays(M, rules.movein.days), src: rules.movein.src, url: rules.movein.url, basis: rules.movein.basis },
      renewDue: addMonths(end, -rules.renew.monthsBefore),
      programs: programs,
      eligible: programs.filter(function (x) { return x.verdict === 'eligible'; }),
      maybe: programs.filter(function (x) { return x.verdict !== 'ineligible'; })
    };
  }

  return { parseDate: parseDate, addDays: addDays, addMonths: addMonths, iso: iso, contractEnd: contractEnd, age: age, validate: validate, evaluate: evaluate, STATUS: STATUS, INCOME_LABEL: INCOME_LABEL };
});
