/* 자취 계약 내비 — 생활 관리(주거비 관리·자취 캘린더) 전용 순수 함수
 * 맡는 일: 달마다 낼 주거비 목록 만들기(반복 주기·계약 기간·관리비 포함 여부·고지서 실제 금액·달별 납부 체크),
 *          이번 달 합계, 납부 상태, 실제 금액 추천값
 * DOM·저장소·앱 상태를 읽지 않는다 — 필요한 값은 모두 인자로 받는다.
 * 브라우저: <script src="life-core.js"> → 전역 JachwiLife / Node: require('./life-core.js')
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JachwiLife = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var api = {};

  // 관리비와의 관계: sep 따로 냄 · incl 기본 관리비에 포함(더하지 않음) · bundle 관리비 고지서에 합산 · check 확인 필요
  api.INCL = Object.freeze([['sep', '별도 납부'], ['incl', '기본 관리비에 포함'], ['bundle', '관리비 고지서에 합산 청구'], ['check', '확인 필요']]);

  // 월세·관리비(계약에 연결된 항목)와 들어오는 돈은 늘 따로 낸다
  api.incl = function (b) { return b.link || b.kind === 'in' ? 'sep' : (b.incl || 'sep'); };

  // 한 달(y년 m월, m은 0부터)에 낼·받을 항목 목록
  // ctx: { y, m, endIdx(계약 끝 달 y*12+m), paid{key:true}, actual{key:금액}, amt(b), start(b)→y*12+m, day(b)→날짜 }
  api.monthBills = function (bills, ctx) {
    var y = ctx.y, m = ctx.m, idx = y * 12 + m, paid = ctx.paid || {}, actual = ctx.actual || {}, out = [], bundled = [];
    var last = new Date(y, m + 1, 0).getDate();
    (bills || []).forEach(function (b) {
      var amt = ctx.amt(b), s = ctx.start(b), every = +b.every || 1, inc = api.incl(b);
      if (!b.on) return;
      if (!amt && (b.link || b.kind === 'in')) return; // 월세·관리비가 0이면 낼 게 없다
      if (idx < s || idx > ctx.endIdx || (idx - s) % every) return; // 계약 기간 밖이거나 주기가 아닌 달
      var k = (idx - s) / every; if (+b.count && k >= +b.count) return; // 정해진 횟수를 다 채움
      if (inc === 'incl') return; // 기본 관리비에 이미 들어 있으니 따로 더하지 않는다
      var key = b.id + '@' + y + '-' + (m + 1);
      var act = actual[key], real = act != null;
      var e = { date: new Date(y, m, Math.min(ctx.day(b), last)), kind: b.kind, title: b.name, amount: real ? act : amt, base: amt, key: key,
        paid: !!paid[key], est: !real && !!b.est, unk: !real && !amt, real: real, chk: inc === 'check', bid: b.id, nth: +b.count ? (k + 1) + '/' + b.count : '' };
      if (inc === 'bundle') bundled.push(e); else out.push(e);
    });
    // 관리비 고지서에 합산되는 항목은 관리비 한 건으로 묶는다 (중복 납부·중복 합계 방지)
    var fee = out.filter(function (e) { return e.bid === 'fee'; })[0];
    if (fee && bundled.length) {
      // 관리비 고지서 실제 총액을 넣었으면 그 금액이 전부다 (합산 항목을 또 더하지 않는다)
      if (!fee.real) bundled.forEach(function (e) { fee.amount += e.amount; if (e.est) fee.est = true; });
      fee.with = bundled.map(function (e) { return e.title; }).join('·');
    } else out = out.concat(bundled);
    return out;
  };

  // 이번 달 나갈 돈 합계 (들어오는 돈은 넣지 않는다)
  api.summary = function (events) {
    var outs = (events || []).filter(function (e) { return e.kind === 'out'; });
    var sum = function (a) { return a.reduce(function (s, e) { return s + e.amount; }, 0); };
    var total = sum(outs), done = sum(outs.filter(function (e) { return e.paid; }));
    return { total: total, fixed: sum(outs.filter(function (e) { return !e.est; })), est: sum(outs.filter(function (e) { return e.est; })),
      unknown: outs.filter(function (e) { return e.unk; }).length, done: done, wait: total - done, pct: total ? Math.round(done / total * 100) : 0 };
  };

  // 납부 상태: 냈으면 완료, 날짜가 지났는데 체크 안 했으면 '날짜 지남'(미납이라 단정하지 않는다), 아니면 예정
  api.payState = function (e, today) {
    if (e.paid) return ['ok', e.kind === 'in' ? '받음' : '납부 완료'];
    if (e.date < today) return ['late', '날짜 지남 · 냈나요?'];
    return ['wait', e.kind === 'in' ? '입금 예정' : '납부 예정'];
  };

  // 청년월세 지원 공고 고르기: 국토부(실제 공고)와 서울(시연 공고) 둘 다 본다.
  // 해당 가능한 공고를 먼저, 같으면 목록 앞쪽(국토부)을 고른다. 하나도 없으면 null
  api.RENT_SUPPORT_IDS = Object.freeze(['molit-rent', 'rent']);
  api.pickRentProgram = function (programs) {
    var ids = api.RENT_SUPPORT_IDS;
    var list = (programs || []).filter(function (x) { return x && x.p && ids.indexOf(x.p.id) >= 0; });
    list.sort(function (a, b) { return (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0) || ids.indexOf(a.p.id) - ids.indexOf(b.p.id); });
    return list[0] || null;
  };
  // 선정된 공고의 금액·기간으로 '청년월세 지원 입금' 항목을 맞춘다 (공고에 값이 없으면 원래 값 유지)
  api.applyRentProgram = function (bill, p) {
    var b = Object.assign({}, bill, { on: true });
    if (p && +p.monthly) b.amount = +p.monthly * 10000;
    if (p && +p.months) b.count = +p.months;
    return b;
  };

  // 고지서 실제 금액 추천값: 예상 금액 주변(5천 원 단위), 예상이 없으면 흔한 금액
  api.amtPicks = function (base) {
    var r = function (n) { return Math.max(1000, Math.round(n / 5000) * 5000); };
    var list = base ? [r(base * 0.8), r(base), r(base * 1.2), r(base * 1.5)] : [10000, 20000, 30000, 50000];
    return list.filter(function (v, i) { return list.indexOf(v) === i; });
  };

  return api;
});
