/* 내장 AI 품질 평가 (브라우저 운영자 콘솔 + node 테스트 공용, UMD)
 * 평가 세트(rules/evals.js)를 지금 승인본으로 돌려 점수를 낸다.
 * 운영자가 지식 카드를 고치거나 공고를 승인하면 바로 다시 돌려, 전에 맞던 질문이 깨졌는지 본다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules-core.js'), require('./coach-core.js'));
  else root.JachwiEval = factory(root.JachwiRules, root.JachwiCoach);
})(typeof self !== 'undefined' ? self : this, function (J, C) {
  'use strict';
  // 평가용 예시 이용자: 만 25세 · 중위 100~150% · 보증금 1,000만/월세 45만 · 계약 10.27 · 입주 11.11 · 오늘 11.10
  var PERSON = { age: 25, income: '150', deposit: 1000, rent: 45, gu: '관악구' };
  function demoFacts(programs) {
    return {
      today: '2026.11.10', contract: '2026.10.27', move: '2026.11.11', end: '2028.11.10', noticeBy: '2028.09.11',
      reportRequired: true, reportReason: '월세 30만 원 초과', reportDue: '2026.11.26', reportDone: false, reportEarly: false,
      moveinDue: '2026.11.25', moveinDone: false, deposit: 1000, rent: 45, fee: 7, brokerBase: 55000000, brokerCap: 220000,
      tasks: [
        { title: '잔금 계좌와 이체 한도 확인', due: '2026.11.10', stage: '입주 준비' },
        { title: '전 세입자 퇴거·공과금 정산 시간 맞추기', due: '2026.11.10', stage: '입주 준비' },
        { title: '전입신고 + 임대차계약서 제출', due: '2026.11.11', stage: '입주 당일', urgent: true },
        { title: '잔금 보내기 전 등기부등본 다시 떼기', due: '2026.11.11', stage: '입주 당일' }
      ],
      programList: programs.map(function (p) {
        var x = J.evalProgram(p, PERSON);
        return { id: p.id, name: p.name, verdict: J.verdict(x), status: p.status, period: p.period, amountText: p.amountText, docs: p.docs, channel: p.channel, select: p.select, firstCome: p.firstCome, exclusions: p.exclusions, unknown: x.unknown.map(function (r) { return r.label; }) };
      })
    };
  }
  function runCoach(published, evals, today) {
    var view = J.publicView(published, today || new Date('2026-11-10T09:00:00+09:00'));
    var cards = view.cards.concat(J.noticeCards(view.programs)), facts = demoFacts(view.programs);
    var rows = evals.map(function (e) {
      var hist = [];
      if (e.follow) { var f0 = C.answer({ q: e.follow, cards: cards, facts: facts }); hist.push({ q: e.follow, topic: f0.topic }); }
      var a = C.answer({ q: e.q, cards: cards, facts: facts, history: hist }), why = [];
      var kinds = e.kind ? [].concat(e.kind) : ['answer'];
      if (kinds.indexOf(a.kind) < 0) why.push('답 종류 ' + a.kind + ' (기대 ' + kinds.join('/') + ')');
      if (a.kind === 'answer' && e.cards) {
        var used = a.topic || [];
        var ok = e.all ? e.cards.every(function (c) { return used.indexOf(c) >= 0; }) : e.cards.some(function (c) { return used.indexOf(c) >= 0; });
        if (!ok) why.push('근거 ' + (used.join(', ') || '없음') + ' (기대 ' + e.cards.join(e.all ? ' + ' : ' / ') + ')');
      }
      (e.has || []).forEach(function (w) { if (a.text.indexOf(w) < 0) why.push('“' + w + '” 빠짐'); });
      return { q: e.q, follow: e.follow, pass: !why.length, why: why, kind: a.kind, used: a.topic || [], text: a.text };
    });
    rows.forEach(function (r, i) { var e = evals[i], kinds = e.kind ? [].concat(e.kind) : ['answer']; r.wrong = !r.pass && r.kind === 'answer'; r.safe = !r.pass && !r.wrong; r.expect = kinds.join('/') + (e.cards ? ' · ' + e.cards.join(e.all ? ' + ' : ' / ') : ''); });
    var pass = rows.filter(function (r) { return r.pass; }).length;
    // wrong: 틀린 카드로 답했거나 답하면 안 되는 질문에 답함 / safe: 답할 수 있었는데 멈춤(안전한 실패)
    return { total: rows.length, pass: pass, rate: rows.length ? pass / rows.length : 0, wrong: rows.filter(function (r) { return r.wrong; }).length, safe: rows.filter(function (r) { return r.safe; }).length, rows: rows };
  }
  function same(key, got, want) {
    var f = J.FIELD[key];
    if (want === null) return J.blank(got);
    if (f.type === 'list') return J.toList(got).length === want;
    if (f.type === 'num') return got === want;
    if (f.type === 'bool') return got === want;
    return J.squash(got) === J.squash(want);
  }
  function runExtract(samples, expect) {
    var rows = [], fields = 0, right = 0;
    samples.forEach(function (s) {
      var want = expect[s.id]; if (!want) return;
      var got = J.values(J.ruleExtract(s.text)), miss = [];
      Object.keys(want).forEach(function (k) { fields++; if (same(k, got[k], want[k])) right++; else miss.push({ key: k, label: J.FIELD[k].label, want: want[k], got: J.FIELD[k].type === 'list' ? J.toList(got[k]).length + '개' : got[k] }); });
      rows.push({ id: s.id, title: s.title, total: Object.keys(want).length, right: Object.keys(want).length - miss.length, miss: miss });
    });
    return { total: fields, pass: right, rate: fields ? right / fields : 0, rows: rows };
  }
  // 자취 AI 비서: 알맞은 봇에게 갔는지 + 꼭 있어야 할 말
  function runAssistant(published, evals, A, repairs, today) {
    var view = J.publicView(published, today || new Date('2026-11-10T09:00:00+09:00'));
    var cards = view.cards.concat(J.noticeCards(view.programs)), facts = demoFacts(view.programs);
    facts.house = '봉천동 원룸';
    facts.money = { month: '11월', items: [{ name: '월세', amount: 450000, kind: 'out' }, { name: '관리비', amount: 70000, kind: 'out' }, { name: '통신비', amount: 33000, kind: 'out' }] };
    facts.places = { hasHome: true, source: '시연용 예시 데이터', list: [{ id: 'pharm', name: '약국', cat: 'medical', sub: '약국', min: 3, m: 160 }, { id: 'laundry', name: '셀프 빨래방', cat: 'life', sub: '빨래방', min: 2, m: 108 }, { id: 'bus', name: '버스정류장', cat: 'transit', min: 2, m: 108 }] };
    var rows = evals.map(function (e) {
      var a = A.answer({ q: e.q, bot: e.want || 'auto', cards: cards, facts: facts, repairs: repairs || published.repairs || [] }), why = [];
      var all = a.text + ' ' + (a.blocks || []).map(function (b) { return (b.text || '') + ' ' + (b.label || '') + ' ' + (b.items || []).map(function (x) { return typeof x === 'string' ? x : (x.name || x.label || ''); }).join(' '); }).join(' ');
      if (a.bot !== e.bot) why.push('봇 ' + a.bot + ' (기대 ' + e.bot + ')');
      if ((e.kind || 'answer') !== a.kind) why.push('답 종류 ' + a.kind + ' (기대 ' + (e.kind || 'answer') + ')');
      (e.has || []).forEach(function (w) { if (all.indexOf(w) < 0) why.push('“' + w + '” 빠짐'); });
      return { q: e.q, pass: !why.length, why: why, bot: a.bot, kind: a.kind, text: a.text, wrong: !!why.length && a.kind === 'answer' && a.bot !== e.bot };
    });
    var pass = rows.filter(function (r) { return r.pass; }).length;
    return { total: rows.length, pass: pass, rate: rows.length ? pass / rows.length : 0, wrong: rows.filter(function (r) { return r.wrong; }).length, safe: 0, rows: rows };
  }
  return { runAssistant: runAssistant, runCoach: runCoach, runExtract: runExtract, demoFacts: demoFacts, PERSON: PERSON };
});
