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
        return { id: p.id, name: p.name, verdict: J.verdict(x), status: p.status, period: p.period, amountText: p.amountText, docs: p.docs, channel: p.channel, select: p.select, firstCome: p.firstCome, exclusions: p.exclusions, unknown: x.unknown.map(function (r) { return r.label; }), fails: x.res.filter(function (r) { return r.ok === false; }).map(function (r) { return r.label + '(내 값: ' + r.mine + ')'; }) };
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
    facts.stages = [{ key: 'prep', name: '입주 준비', when: '10.29 ~ 11.10', tasks: [{ title: '이사 수단 예약하기', done: true }, { title: '인터넷 설치 예약' }, { title: '도시가스 개통 예약' }, { title: '잔금 계좌와 이체 한도 확인' }] }, { key: 'mday', name: '입주 당일', when: '11.11', tasks: [{ title: '잔금 보내기 전 등기부등본 다시 떼기' }, { title: '전입신고 + 임대차계약서 제출', urgent: true }] }];
    facts.money = { month: '11월', items: [{ name: '월세', amount: 450000, kind: 'out' }, { name: '관리비', amount: 70000, kind: 'out' }, { name: '통신비', amount: 33000, kind: 'out' }] };
    facts.places = { hasHome: true, source: '시연용 예시 데이터', list: [{ id: 'pharm', name: '약국', cat: 'medical', sub: '약국', min: 3, m: 160 }, { id: 'laundry', name: '셀프 빨래방', cat: 'life', sub: '빨래방', min: 2, m: 108 }, { id: 'bus', name: '봉천역 버스정류장', cat: 'transit', min: 2, m: 108 }, { id: 'sub', name: '서울대입구역', cat: 'transit', sub: '지하철역', min: 9, m: 600 }, { id: 'police', name: '봉천지구대', cat: 'safety', min: 6, m: 380 }, { id: 'center', name: '청룡동 행정복지센터', cat: 'public', min: 4, m: 262 }] };
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
  // 페르소나 계약 조건 → 앱과 같은 방식으로 계산한 값 (app.html coachFacts 와 같은 규칙)
  function pd(sx) { var a = sx.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function addD(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function ymd(d) { return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); }
  function personaFacts(P, programs) {
    var C0 = pd(P.contract), M = pd(P.move), T = pd(P.today), end = addD(new Date(M.getFullYear() + (+P.term || 2), M.getMonth(), M.getDate()), -1);
    var required = P.deposit > 6000 || P.rent > 30, reason = P.rent > 30 ? '월세 30만 원 초과' : P.deposit > 6000 ? '보증금 6천만 원 초과' : '보증금 6천만 원 이하, 월세 30만 원 이하';
    var dep = P.deposit * 10000, rent = P.rent * 10000, base = dep + rent * 100; if (base < 5e7) base = dep + rent * 70;
    var band = base < 5e7 ? [0.005, 200000] : base < 1e8 ? [0.004, 300000] : base < 6e8 ? [0.003, 0] : [0.004, 0], cap = Math.floor(base * band[0]); if (band[1]) cap = Math.min(cap, band[1]);
    var u = { age: P.age, income: P.income, deposit: P.deposit, rent: P.rent, gu: '관악구' };
    return { today: ymd(T), contract: ymd(C0), move: ymd(M), end: ymd(end), noticeBy: ymd(addD(end, -60)), reportRequired: required, reportReason: reason, reportDue: ymd(addD(C0, 30)), reportDone: false, reportEarly: required && addD(C0, 30) < M,
      moveinDue: ymd(addD(M, 14)), moveinDone: false, deposit: P.deposit, rent: P.rent, fee: P.fee, brokerBase: base, brokerCap: cap,
      money: { month: (T.getMonth() + 1) + '월', items: [{ name: '월세', amount: rent, kind: 'out' }, { name: '관리비', amount: P.fee * 10000, kind: 'out' }] },
      places: { hasHome: false, list: [] },
      programList: programs.map(function (p) { var x = J.evalProgram(p, u); return { id: p.id, name: p.name, verdict: J.verdict(x), status: p.status, period: p.period, amountText: p.amountText, docs: p.docs, channel: p.channel, select: p.select, firstCome: p.firstCome, exclusions: p.exclusions, unknown: x.unknown.map(function (r) { return r.label; }), fails: x.res.filter(function (r) { return r.ok === false; }).map(function (r) { return r.label + '(내 값: ' + r.mine + ')'; }) }; }) };
  }
  function runPersonas(published, personas, A, repairs) {
    var rows = [], byP = [];
    personas.forEach(function (ps) {
      var view = J.publicView(published, pd(ps.p.today)), cards = view.cards.concat(J.noticeCards(view.programs)), f = personaFacts(ps.p, view.programs), pass = 0;
      ps.qs.forEach(function (e) {
        var a = A.answer({ q: e.q, bot: e.bot || 'rights', cards: cards, facts: f, repairs: repairs || published.repairs || [] }), why = [];
        var all = a.text + ' ' + (a.blocks || []).map(function (b) { return (b.text || '') + ' ' + (b.label || '') + ' ' + (b.items || []).map(function (x) { return typeof x === 'string' ? x : (x.name || x.label || ''); }).join(' '); }).join(' ');
        (e.has || []).forEach(function (w) { if (all.indexOf(w) < 0) why.push('“' + w + '” 빠짐'); });
        (e.not || []).forEach(function (w) { if (all.indexOf(w) >= 0) why.push('“' + w + '”가 들어감 (내 조건과 다름)'); });
        if (a.kind !== 'answer') why.push('답 종류 ' + a.kind);
        if (!why.length) pass++;
        rows.push({ persona: ps.name, q: e.q, pass: !why.length, why: why, bot: a.bot, kind: a.kind, text: a.text, wrong: (e.not || []).some(function (w) { return all.indexOf(w) >= 0; }) });
      });
      byP.push({ id: ps.id, name: ps.name, who: ps.who, total: ps.qs.length, pass: pass });
    });
    var pass = rows.filter(function (r) { return r.pass; }).length;
    return { total: rows.length, pass: pass, rate: rows.length ? pass / rows.length : 0, wrong: rows.filter(function (r) { return r.wrong; }).length, safe: 0, rows: rows, personas: byP };
  }
  // 말투 페르소나: 하나의 계약 조건으로 말투만 바꿔 묻기
  function runStyles(published, styles, A, repairs) {
    var r = runPersonas(published, [{ id: 'style', name: '말투', who: '', p: styles.p, qs: styles.qs.map(function (x) { return { q: x.q, bot: x.bot || 'auto', has: x.has, not: x.not }; }) }], A, repairs);
    r.rows.forEach(function (row, i) { row.persona = styles.qs[i].style; });
    var by = {}; styles.qs.forEach(function (x, i) { by[x.style] = by[x.style] || { name: x.style, total: 0, pass: 0 }; by[x.style].total++; if (r.rows[i].pass) by[x.style].pass++; });
    r.styles = Object.keys(by).map(function (k) { return by[k]; });
    return r;
  }
  return { runStyles: runStyles, runPersonas: runPersonas, personaFacts: personaFacts, runAssistant: runAssistant, runCoach: runCoach, runExtract: runExtract, demoFacts: demoFacts, PERSON: PERSON };
});
