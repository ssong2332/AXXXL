/* 자취 계약 내비 · 공고 규칙 엔진 (브라우저 + 서버 공용, UMD)
 *
 * 하는 일
 *  1. 공고 항목 정의(FIELDS)와 값 정리(normalize)
 *  2. 추출 결과 점검: 근거 문장이 원문에 실제로 있는지, 값이 근거와 맞는지, 지난 승인본과 무엇이 달라졌는지
 *  3. 승인된 공고 → 이용자 화면용 지원사업(toProgram) → 자격 판정(evalProgram)
 *  4. 대상자 시뮬레이션: 지난 승인본과 새 초안으로 같은 사람을 판정해 결과가 바뀌는 사람을 찾음
 *  5. 코치 지식 찾기(retrieve): 질문과 가장 가까운 승인 카드
 *  6. AI 없이 돌아가는 규칙 기반 추출(ruleExtract) — 키가 없거나 AI가 실패했을 때
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JachwiRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 1. 공고 항목 ----------
  // type: text | num(만 원·세·개월) | date(YYYY-MM-DD) | bool | list(줄바꿈)
  var FIELDS = [
    { key: 'name', label: '사업 이름', group: '기본', type: 'text', required: true },
    { key: 'org', label: '시행 기관', group: '기본', type: 'text', required: true },
    { key: 'region', label: '대상 지역', group: '기본', type: 'text' },
    { key: 'amount_text', label: '지원 내용', group: '지원', type: 'text', required: true },
    { key: 'amount_monthly_max', label: '월 최대 지원액', group: '지원', type: 'num', unit: '만 원' },
    { key: 'amount_months', label: '최대 지원 기간', group: '지원', type: 'num', unit: '개월' },
    { key: 'amount_lump_max', label: '1회 최대 지원액', group: '지원', type: 'num', unit: '만 원' },
    { key: 'period_start', label: '접수 시작일', group: '접수', type: 'date' },
    { key: 'period_end', label: '접수 마감일', group: '접수', type: 'date' },
    { key: 'first_come', label: '선착순', group: '접수', type: 'bool' },
    { key: 'select', label: '선정 방식', group: '접수', type: 'text' },
    { key: 'channel', label: '신청 방법', group: '접수', type: 'text' },
    { key: 'url', label: '신청·공고 주소', group: '접수', type: 'text' },
    { key: 'age_min', label: '나이 하한', group: '자격', type: 'num', unit: '세', required: true },
    { key: 'age_max', label: '나이 상한', group: '자격', type: 'num', unit: '세', required: true },
    { key: 'income_pct', label: '소득 기준 (기준 중위소득)', group: '자격', type: 'num', unit: '% 이하' },
    { key: 'deposit_max', label: '보증금 상한', group: '자격', type: 'num', unit: '만 원' },
    { key: 'rent_max', label: '월세 상한', group: '자격', type: 'num', unit: '만 원' },
    { key: 'homeless', label: '무주택 요건', group: '자격', type: 'bool' },
    { key: 'residency', label: '거주·주소 요건', group: '자격', type: 'text' },
    { key: 'docs', label: '제출 서류', group: '서류', type: 'list', required: true },
    { key: 'exclusions', label: '함께 받을 수 없는 지원', group: '서류', type: 'list' }
  ];
  var FIELD = {};
  FIELDS.forEach(function (f) { FIELD[f.key] = f; });

  // ---------- 문자열·숫자 도우미 ----------
  function squash(s) { return String(s == null ? '' : s).replace(/[\s ·•ㆍ\-–—~∼,.:;'"“”‘’()（）\[\]「」『』<>〈〉]/g, '').toLowerCase(); }
  function digits(s) { return (String(s == null ? '' : s).replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) || []); }
  // "8천만 원" → 8000, "2억 원" → 20000, "40만 원" → 40, "1억 2천만" → 12000 (만 원 단위)
  function manwon(s) {
    var out = [], t = String(s == null ? '' : s).replace(/(\d),(?=\d{3})/g, '$1'), m;
    var re = /(\d+(?:\.\d+)?)\s*억(?:\s*(\d+(?:\.\d+)?)\s*천)?(?:\s*(\d+(?:\.\d+)?)\s*백)?\s*만?|(\d+(?:\.\d+)?)\s*천\s*만|(\d+(?:\.\d+)?)\s*백\s*만|(\d+(?:\.\d+)?)\s*만/g;
    while ((m = re.exec(t))) {
      if (m[1]) out.push(+m[1] * 10000 + (m[2] ? +m[2] * 1000 : 0) + (m[3] ? +m[3] * 100 : 0));
      else if (m[4]) out.push(+m[4] * 1000);
      else if (m[5]) out.push(+m[5] * 100);
      else if (m[6]) out.push(+m[6]);
    }
    // "원" 단위 큰 숫자 (예: 200,000원 → 20)
    (t.match(/\d{5,}\s*원/g) || []).forEach(function (x) { out.push(parseInt(x, 10) / 10000); });
    return out;
  }
  function toBool(v) {
    if (v === true || v === false) return v;
    var s = String(v == null ? '' : v).trim();
    if (/^(예|네|yes|true|필요|해당|있음|o|y|선착순)$/i.test(s)) return true;
    if (/^(아니오|아니요|no|false|불필요|없음|해당\s?없음|x|n)$/i.test(s)) return false;
    return null;
  }
  function toList(v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(v == null ? '' : v).split(/\n|\s\/\s|;/).map(function (x) { return x.replace(/^[\s\-•·○◦▪*0-9.)]+/, '').trim(); }).filter(Boolean);
  }
  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var mw = manwon(v); if (mw.length) return mw[0];
    var d = digits(v); return d.length ? +d[0] : null;
  }
  function toDate(v) {
    var s = String(v == null ? '' : v).trim(), m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
    if (!m) return null;
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  function normalize(key, v) {
    var f = FIELD[key]; if (!f) return v;
    if (v === undefined || v === null || v === '') return f.type === 'list' ? [] : null;
    if (f.type === 'num') return toNum(v);
    if (f.type === 'bool') return toBool(v);
    if (f.type === 'list') return toList(v);
    if (f.type === 'date') return toDate(v);
    return String(v).trim();
  }
  function show(key, v) {
    var f = FIELD[key] || {};
    if (v === null || v === undefined || (Array.isArray(v) && !v.length) || v === '') return '';
    if (f.type === 'list') return toList(v).join('\n');
    if (f.type === 'bool') return v === true ? '예' : v === false ? '아니오' : String(v);
    return String(v);
  }
  // 주소는 http(s)와 앱 안 링크(#…)만 통과 (javascript: 등 차단)
  function safeUrl(u) { u = String(u == null ? '' : u).trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) || /^#[\w-]*$/.test(u) ? u : ''; }
  function blank(v) { return v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length); }

  // ---------- 2. 추출 결과 점검 ----------
  function inSource(evidence, source) {
    var e = squash(evidence); if (e.length < 2) return false;
    return squash(source).indexOf(e) >= 0;
  }
  // 값에 들어간 숫자가 근거 문장에도 있는지 (만 원 환산 포함)
  function valueFits(key, value, evidence) {
    var f = FIELD[key]; if (!f || blank(value) || !evidence) return true;
    if (f.type === 'num') {
      var n = toNum(value); if (n === null) return false;
      var pool = manwon(evidence).concat(digits(evidence).map(Number));
      return pool.some(function (x) { return Math.abs(x - n) < 1e-6; });
    }
    if (f.type === 'date') {
      var d = toDate(value); if (!d) return false;
      var p = d.split('-'), ev = digits(evidence).map(Number);
      return ev.indexOf(+p[1]) >= 0 && ev.indexOf(+p[2]) >= 0;
    }
    return true;
  }
  // 목록 항목(제출 서류 등)은 항목마다 원문에 있는지 본다
  function missingItems(list, source) {
    var src = squash(source);
    return toList(list).filter(function (x) { var k = squash(x.replace(/\(.*?\)/g, '')); return k.length >= 2 && src.indexOf(k) < 0; });
  }
  function same(key, a, b) {
    var f = FIELD[key] || {};
    if (blank(a) && blank(b)) return true;
    if (f.type === 'bool') return (normalize(key, a) === true) === (normalize(key, b) === true);
    if (f.type === 'list') return toList(a).map(squash).sort().join('|') === toList(b).map(squash).sort().join('|');
    return squash(show(key, a)) === squash(show(key, b));
  }
  /* fields: { key: { value, evidence, confidence } }
     반환: { key: { flags: [...], must: bool } }, 요약
     flags: missing(필수 비어 있음) · no_evidence(근거 없음) · not_in_source(근거가 원문에 없음)
            value_mismatch(값과 근거 숫자 불일치) · low_conf(확신 낮음) · changed(지난 승인본과 다름) */
  var FLAG_TEXT = { missing: '필수 항목이 비어 있어요', item_not_in_source: '목록 중 원문에서 안 보이는 항목이 있어요', no_evidence: '근거 문장이 없어요', not_in_source: '근거가 원문에서 안 보여요', value_mismatch: '값이 근거 숫자와 달라요', low_conf: 'AI 확신이 낮아요', changed: '지난 승인본과 달라요', new_notice: '처음 등록하는 공고예요' };
  function check(fields, source, prev) {
    var out = {}, total = 0;
    FIELDS.forEach(function (f) {
      var it = fields[f.key] || {}, flags = [], v = normalize(f.key, it.value);
      if (f.required && blank(v)) flags.push('missing');
      if (!blank(v)) {
        if (!it.evidence) flags.push('no_evidence');
        else if (source && !inSource(it.evidence, source)) flags.push('not_in_source');
        else if (!valueFits(f.key, v, it.evidence)) flags.push('value_mismatch');
        if (f.type === 'list' && source && missingItems(v, source).length) flags.push('item_not_in_source');
        if (it.confidence === 'low') flags.push('low_conf');
      }
      if (prev && !same(f.key, v, prev[f.key])) flags.push('changed');
      out[f.key] = { flags: flags, must: flags.length > 0 };
      if (flags.length) total++;
    });
    return { byKey: out, count: total };
  }
  function diff(prev, next) {
    var rows = [];
    FIELDS.forEach(function (f) { if (!same(f.key, prev && prev[f.key], next && next[f.key])) rows.push({ key: f.key, label: f.label, before: show(f.key, prev && prev[f.key]), after: show(f.key, next && next[f.key]) }); });
    return rows;
  }
  function values(fields) { var o = {}; FIELDS.forEach(function (f) { o[f.key] = normalize(f.key, fields[f.key] && fields[f.key].value); }); return o; }
  // 승인 가능 여부: 필수 항목이 채워져 있고, 표시된 항목을 검수자가 모두 확인했는지
  function readyToApprove(fields, source, prev, acks) {
    var c = check(fields, source, prev), left = [];
    FIELDS.forEach(function (f) {
      var k = c.byKey[f.key];
      if (k.flags.indexOf('missing') >= 0) left.push({ key: f.key, why: 'missing' });
      else if (k.must && !(acks && acks[f.key])) left.push({ key: f.key, why: 'ack' });
    });
    return { ok: !left.length, left: left, check: c };
  }

  // ---------- 3. 이용자 화면용 지원사업 ----------
  function ymdDash(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function statusOf(v, today) {
    var t = ymdDash(today || new Date());
    if (v.period_start && t < v.period_start) return ['모집 예정', ''];
    if (v.period_end && t > v.period_end) return ['접수 마감', 'no'];
    if (v.period_start || v.period_end) return ['접수 중', 'brand'];
    return ['모집 예정', ''];
  }
  function wonText(n) { if (n === null || n === undefined) return ''; return n >= 10000 ? (n / 10000) + '억' + (n % 10000 ? ' ' + (n % 10000).toLocaleString('ko-KR') + '만' : '') + ' 원' : n.toLocaleString('ko-KR') + '만 원'; }
  function md(s) { if (!s) return ''; var p = s.split('-'); return +p[1] + '.' + +p[2]; }
  // record: { id, version, approvedAt, approvedBy, basis, source:{name,url}, fields:{key:{value,evidence}} }
  function toProgram(rec, today) {
    var v = values(rec.fields || {}), st = statusOf(v, today), ev = function (k) { return rec.fields && rec.fields[k] && rec.fields[k].evidence || ''; };
    var conds = [];
    if (v.age_min !== null || v.age_max !== null) conds.push({ type: 'age', min: v.age_min, max: v.age_max, label: '만 ' + (v.age_min !== null ? v.age_min : '') + '~' + (v.age_max !== null ? v.age_max : '') + '세', evidence: [ev('age_min'), ev('age_max')].filter(Boolean)[0] || '' });
    if (v.income_pct !== null) conds.push({ type: 'income', pct: v.income_pct, label: '기준 중위소득 ' + v.income_pct + '% 이하', evidence: ev('income_pct') });
    if (v.deposit_max !== null || v.rent_max !== null) conds.push({ type: 'house', deposit: v.deposit_max, rent: v.rent_max, label: [v.deposit_max !== null ? '보증금 ' + wonText(v.deposit_max) : '', v.rent_max !== null ? '월세 ' + wonText(v.rent_max) : ''].filter(Boolean).join('·') + ' 이하', evidence: [ev('deposit_max'), ev('rent_max')].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' / ') });
    if (v.residency) conds.push({ type: 'residency', text: v.residency, label: v.residency, evidence: ev('residency') });
    if (v.homeless !== false) conds.push({ type: 'homeless', label: '무주택', evidence: ev('homeless') });
    var amount = v.amount_text || [v.amount_monthly_max ? '월 최대 ' + wonText(v.amount_monthly_max) : '', v.amount_months ? '최대 ' + v.amount_months + '개월' : '', v.amount_lump_max ? '최대 ' + wonText(v.amount_lump_max) : ''].filter(Boolean).join(' · ');
    return {
      id: rec.id, name: v.name || '이름 없는 공고', org: v.org || '', amountText: amount,
      status: st[0], statusCls: st[1], firstCome: v.first_come === true,
      select: v.select || (v.first_come ? '선착순' : '공고 확인'), channel: v.channel || '공고 확인', url: safeUrl(v.url) || safeUrl(rec.source && rec.source.url),
      period: (v.period_start || v.period_end) ? (md(v.period_start) + ' ~ ' + md(v.period_end)) : '',
      periodEnd: v.period_end, docs: v.docs || [], exclusions: v.exclusions || [], conds: conds, values: v,
      monthly: v.amount_monthly_max, months: v.amount_months, lump: v.amount_lump_max,
      version: rec.version || 1, basis: rec.basis || '', approvedAt: rec.approvedAt || '', approvedBy: rec.approvedBy || '', source: rec.source || {}, demo: !!rec.demo
    };
  }
  // user: { age, income: '100'|'150'|'over'|'unknown', deposit, rent, gu }
  function incomeOk(user, pct) {
    var u = user.income; if (u === 'unknown' || u === undefined || u === null || u === '') return null;
    if (u === 'over') return pct <= 150 ? false : null;     // 150% 초과: 150 이하 기준이면 탈락, 그보다 넓으면 모름
    if (u === '150') return pct >= 150 ? true : pct < 100 ? false : null; // 100~150%
    if (u === '100') return pct >= 100 ? true : null;
    return null;
  }
  function wonShort(n) { return n >= 10000 ? (n / 10000) + '억' : n.toLocaleString('ko-KR') + '만'; }
  function evalProgram(p, user) {
    var res = p.conds.map(function (c) {
      var ok = null, mine = '';
      if (c.type === 'age') { ok = user.age ? (c.min === null || user.age >= c.min) && (c.max === null || user.age <= c.max) : null; mine = user.age ? '만 ' + user.age + '세' : '입력 안 함'; }
      else if (c.type === 'income') { ok = incomeOk(user, c.pct); mine = { '100': '중위 100% 이하', '150': '중위 150% 이하', over: '중위 150% 초과', unknown: '모름' }[user.income] || '입력 안 함'; }
      else if (c.type === 'house') { ok = (c.deposit === null || user.deposit <= c.deposit) && (c.rent === null || user.rent <= c.rent); mine = wonShort(user.deposit || 0) + ' / ' + (user.rent || 0) + '만'; }
      else if (c.type === 'residency') { ok = /서울/.test(c.text) && user.gu ? true : null; mine = user.gu ? '서울 ' + user.gu : '직접 확인'; }
      else { ok = null; mine = '직접 확인'; }
      return { label: c.label, mine: mine, ok: ok, type: c.type, evidence: c.evidence };
    });
    var closed = p.status === '접수 마감';
    return { p: p, res: res, eligible: !closed && !res.some(function (r) { return r.ok === false; }), closed: closed, unknown: res.filter(function (r) { return r.ok === null; }) };
  }

  // ---------- 4. 대상자 시뮬레이션 ----------
  var PERSONAS = [
    { id: 'a', name: '대학생 · 만 22세', age: 22, income: '100', deposit: 500, rent: 45, gu: '관악구' },
    { id: 'b', name: '사회초년생 · 만 27세', age: 27, income: '150', deposit: 1000, rent: 65, gu: '마포구' },
    { id: 'c', name: '취준생 · 만 29세 · 반전세', age: 29, income: '100', deposit: 9000, rent: 30, gu: '동작구' },
    { id: 'd', name: '직장인 · 만 34세 · 소득 높음', age: 34, income: 'over', deposit: 2000, rent: 55, gu: '성동구' },
    { id: 'e', name: '만 39세 · 월세 70만', age: 39, income: '150', deposit: 1000, rent: 70, gu: '강서구' },
    { id: 'f', name: '만 40세', age: 40, income: '100', deposit: 500, rent: 40, gu: '은평구' }
  ];
  function verdict(x) { if (x.closed) return '마감'; if (!x.eligible) return '해당 안 됨'; return x.unknown.some(function (r) { return r.type !== 'homeless'; }) ? '확인 필요' : '해당 가능'; }
  function simulate(prevRec, nextRec, today) {
    var pp = prevRec ? toProgram(prevRec, today) : null, np = toProgram(nextRec, today);
    return PERSONAS.map(function (u) {
      var b = pp ? verdict(evalProgram(pp, u)) : '—', a = verdict(evalProgram(np, u));
      return { persona: u, before: b, after: a, changed: !!pp && a !== b };
    });
  }

  // ---------- 5. 코치 지식 찾기 ----------
  var STOP = /^(은|는|이|가|을|를|에|의|도|로|으로|요|어|해|돼|나|좀|뭐|어떻게|언제|어디|얼마|있어|해야|하나|할까|하면|되나|되요|돼요|알려줘|궁금해)$/;
  function grams(s) {
    var t = String(s || '').toLowerCase().replace(/[^0-9a-z가-힣\s]/g, ' '), out = {};
    t.split(/\s+/).forEach(function (w) {
      if (!w || STOP.test(w)) return;
      out['w:' + w] = 1;
      var h = w.replace(/(은|는|이|가|을|를|에서|에게|에|의|도|으로|로|요|야|이야|해|해요|할까|하면|해야|인가|인지|나요)$/, '');
      if (h && h !== w) out['w:' + h] = 1;
      for (var i = 0; i < h.length - 1; i++) out['g:' + h.slice(i, i + 2)] = 1;
    });
    return out;
  }
  function cardText(c) { return [c.title, (c.keywords || []).join(' '), c.body].join(' '); }
  function retrieve(q, cards, k) {
    var qg = grams(q), keys = Object.keys(qg);
    if (!keys.length) return [];
    return cards.map(function (c) {
      var kw = (c.keywords || []).map(function (x) { return x.toLowerCase(); }), cg = grams(cardText(c)), s = 0, ql = String(q).toLowerCase();
      kw.forEach(function (w) { if (w && ql.indexOf(w) >= 0) s += 4; });
      keys.forEach(function (g) { if (cg[g]) s += g.charAt(0) === 'w' ? 1.5 : 0.5; });
      if (c.title && ql.indexOf(c.title.toLowerCase()) >= 0) s += 3;
      return { card: c, score: s };
    }).filter(function (x) { return x.score >= 2; }).sort(function (a, b) { return b.score - a.score; }).slice(0, k || 6);
  }
  // 승인된 공고를 코치가 읽을 카드로
  function noticeCards(programs) {
    return programs.map(function (p) {
      return {
        id: 'notice-' + p.id, kind: 'notice', title: p.name, keywords: ['지원', '지원금', p.name, p.org].concat(p.name.split(/[\s·]+/)),
        body: p.name + '(' + p.org + '). 지원 내용: ' + p.amountText + '. 모집 상태: ' + p.status + (p.period ? ' (' + p.period + ')' : '') + '. 선정: ' + p.select + '. 신청: ' + p.channel + '. 자격: ' + p.conds.map(function (c) { return c.label; }).join(', ') + '. 제출 서류: ' + p.docs.join(', ') + '.' + (p.exclusions.length ? ' 함께 받을 수 없음: ' + p.exclusions.join(', ') + '.' : '') + ' 최종 선정은 기관 심사로 정해짐.',
        cite: [[p.name + ' 공고 v' + p.version + (p.basis ? ' · ' + p.basis + ' 기준' : ''), p.url || (p.source && p.source.url) || '']]
      };
    });
  }

  // ---------- 6. 규칙 기반 추출 (AI 없이) ----------
  function lineOf(text, idx) {
    var s = text.lastIndexOf('\n', idx) + 1, e = text.indexOf('\n', idx); if (e < 0) e = text.length;
    return text.slice(s, e).trim();
  }
  function grab(text, re, key, conf) {
    var m = re.exec(text); if (!m) return null;
    var v = m[1] !== undefined ? m[1] : m[0];
    return { value: v, evidence: lineOf(text, m.index), confidence: conf || 'medium' };
  }
  function ruleExtract(text) {
    var t = String(text || ''), f = {}, m;
    var title = t.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return /공고|사업|안내/.test(x) && !/공고\s*제\s*[\d\-]+\s*호/.test(x) && x.length < 80; })[0];
    if (title) f.name = { value: title.replace(/\(.*?\)/g, '').replace(/\s*(사업\s*)?(공고|안내)\s*$/, '').replace(/\s*\d차\s*모집\s*$/, '').replace(/^\d{4}년\s*/, '').trim(), evidence: title, confidence: 'low' };
    f.org = grab(t, /(서울특별시|[가-힣]+(?:특별시|광역시|도|시|군|구)청?|국토교통부|한국토지주택공사)/, 'org', 'low');
    f.region = grab(t, /(서울(?:특별)?시)\s*(?:에|내|거주)/, 'region', 'low');
    if ((m = /만\s*(\d{2})\s*세\s*(?:이상|~|부터)\s*(?:만\s*)?(\d{2})\s*세/.exec(t))) { var ev = lineOf(t, m.index); f.age_min = { value: m[1], evidence: ev, confidence: 'medium' }; f.age_max = { value: m[2], evidence: ev, confidence: 'medium' }; }
    f.income_pct = grab(t, /중위\s*소득\s*(\d{2,3})\s*%/, 'income_pct');
    f.deposit_max = grab(t, /보증금\s*([\d,.]+\s*(?:억|천만|만)\s*(?:\d+\s*천\s*만?)?\s*원?)\s*이하/, 'deposit_max');
    f.rent_max = grab(t, /월\s*세\s*([\d,.]+\s*만\s*원?)\s*이하/, 'rent_max');
    f.amount_monthly_max = grab(t, /월\s*(?:최대\s*)?([\d,.]+\s*만\s*원)\s*(?:한도|까지|이내|씩)?/, 'amount_monthly_max', 'low');
    f.amount_months = grab(t, /(?:최대|최장)\s*(\d{1,2})\s*개월/, 'amount_months');
    f.amount_lump_max = grab(t, /(?:1인당|1회)?\s*최대\s*([\d,.]+\s*만\s*원)\s*(?:한도|까지|이내)?/, 'amount_lump_max', 'low');
    if (f.amount_monthly_max && f.amount_lump_max && f.amount_monthly_max.value === f.amount_lump_max.value) delete f.amount_lump_max;
    if ((m = /(\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2})\.?\s*\(?[월화수목금토일]?\)?\s*(?:\d{1,2}:\d{2})?\s*[~∼\-–]\s*(\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2})/.exec(t))) { var pe = lineOf(t, m.index); f.period_start = { value: toDate(m[1]), evidence: pe, confidence: 'medium' }; f.period_end = { value: toDate(m[2]), evidence: pe, confidence: 'medium' }; }
    var amtLine = /지원\s*(?:내용|금액|규모)\s*[:：]?\s*(.+)/.exec(t);
    if (amtLine) f.amount_text = { value: amtLine[1].trim().slice(0, 60), evidence: lineOf(t, amtLine.index), confidence: 'low' };
    if ((m = /선착순/.exec(t))) f.first_come = { value: '예', evidence: lineOf(t, m.index), confidence: 'medium' };
    f.select = grab(t, /선정\s*(?:방법|방식|기준)\s*[:：]?\s*(.+)/, 'select', 'low');
    f.channel = grab(t, /(?:신청|접수)\s*방법\s*[:：]?\s*(.+)/, 'channel', 'low');
    f.url = grab(t, /(https?:\/\/[^\s)]+)/, 'url', 'medium');
    if ((m = /무주택/.exec(t))) f.homeless = { value: '예', evidence: lineOf(t, m.index), confidence: 'medium' };
    // 서류: "제출 서류" 다음 줄들 중 글머리표로 시작하는 줄
    var di = t.search(/제출\s*서류|구비\s*서류/);
    if (di >= 0) {
      var rest = t.slice(di).split('\n').slice(1), docs = [], evl = [];
      for (var i = 0; i < rest.length && docs.length < 12; i++) {
        var L = rest[i].trim(); if (!L) { if (docs.length) break; continue; }
        if (/^\d+\.\s/.test(L) && docs.length) break;
        if (/^[-•·○◦▪*]|^[가-하]\.|^\d\)/.test(L)) { docs.push(L.replace(/^[-•·○◦▪*]\s*|^[가-하]\.\s*|^\d\)\s*/, '')); evl.push(L); }
      }
      if (docs.length) f.docs = { value: docs.join('\n'), evidence: evl[0], confidence: 'low' };
    }
    if ((m = /(?:중복\s*(?:지원|수혜)\s*(?:불가|제외)|함께\s*받을\s*수\s*없)[^\n]*/.exec(t))) f.exclusions = { value: m[0].replace(/^.*?(?:불가|제외|없(?:음|습니다)?)\s*[:：]?\s*/, '').trim() || m[0].trim(), evidence: lineOf(t, m.index), confidence: 'low' };
    Object.keys(f).forEach(function (k) { if (!f[k]) delete f[k]; });
    return f;
  }

  // ---------- 7. 운영 작업 (서버와 브라우저 연습 모드가 같은 규칙으로 처리) ----------
  // st = { published, drafts: { items }, unanswered: { items } }
  function stamp(now) {
    var d = now || new Date(), k = new Date(d.getTime() + 9 * 3600 * 1000);
    var iso = k.toISOString().replace('Z', '+09:00').replace(/\.\d{3}/, '');
    return { iso: iso, basis: iso.slice(0, 10).replace(/-/g, '.') };
  }
  function slim(fields) {
    var o = {}; FIELDS.forEach(function (f) { var it = fields && fields[f.key]; if (it && !blank(normalize(f.key, it.value))) o[f.key] = { value: it.value, evidence: it.evidence || null, confidence: it.confidence || 'medium' }; });
    return o;
  }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }
  function applyOp(st, op, who, now) {
    var t = stamp(now), P = st.published, D = st.drafts, U = st.unanswered, name = clip(who, 20) || '운영자';
    P.history = P.history || {}; P.log = P.log || []; P.cards = P.cards || []; P.notices = P.notices || {};
    function log(what) { P.log.unshift({ at: t.iso, who: name, what: what }); P.log = P.log.slice(0, 300); P.meta = P.meta || {}; P.meta.updatedAt = t.iso; }
    function findDraft(id) { for (var i = 0; i < D.items.length; i++) if (D.items[i].id === id) return i; return -1; }
    switch (op && op.op) {
      case 'saveDraft': {
        var d = op.draft || {}; if (!d.sourceText && !d.fields) return { ok: false, error: '내용이 없는 초안이에요.' };
        var keep = { id: d.id || uid('d'), noticeId: clip(d.noticeId, 40), title: clip(d.title, 120), source: { name: clip(d.source && d.source.name, 120), url: safeUrl(clip(d.source && d.source.url, 300)) },
          sourceText: clip(d.sourceText, 80000), mode: d.mode === 'ai' ? 'ai' : 'rules', model: clip(d.model, 60), extractedAt: d.extractedAt || t.iso, notes: (d.notes || []).slice(0, 20).map(function (x) { return clip(x, 300); }),
          fields: slim(d.fields), acks: d.acks || {}, status: d.status === 'rejected' ? 'rejected' : 'review', memo: clip(d.memo, 500), rejectReason: clip(d.rejectReason, 300), updatedAt: t.iso, updatedBy: name };
        var i = findDraft(keep.id); if (i >= 0) D.items[i] = keep; else D.items.unshift(keep);
        D.items = D.items.slice(0, 100);
        return { ok: true, changed: ['drafts'], result: keep };
      }
      case 'deleteDraft': { var j = findDraft(op.id); if (j >= 0) D.items.splice(j, 1); return { ok: true, changed: ['drafts'] }; }
      case 'reject': {
        var k = findDraft(op.id); if (k < 0) return { ok: false, error: '초안을 찾지 못했어요.' };
        if (!op.reason) return { ok: false, error: '반려 사유를 적어 주세요.' };
        D.items[k].status = 'rejected'; D.items[k].rejectReason = clip(op.reason, 300); D.items[k].updatedAt = t.iso; D.items[k].updatedBy = name;
        log((D.items[k].fields.name ? normalize('name', D.items[k].fields.name.value) : D.items[k].title) + ' 초안 반려 · ' + clip(op.reason, 80));
        return { ok: true, changed: ['drafts', 'published'] };
      }
      case 'publish': {
        var x = findDraft(op.id); if (x < 0) return { ok: false, error: '초안을 찾지 못했어요.' };
        var dr = D.items[x], nid = dr.noticeId || uid('n'), prev = P.notices[nid];
        var ready = readyToApprove(dr.fields, dr.sourceText, prev ? values(prev.fields) : null, dr.acks);
        if (!ready.ok) return { ok: false, error: '확인하지 않은 항목이 ' + ready.left.length + '개 있어요.', left: ready.left };
        var changes = prev ? diff(values(prev.fields), values(dr.fields)) : [];
        if (prev) { P.history[nid] = [{ version: prev.version, basis: prev.basis, approvedAt: prev.approvedAt, approvedBy: prev.approvedBy, source: prev.source, fields: prev.fields, changes: prev.changes || [] }].concat(P.history[nid] || []).slice(0, 10); }
        var rec = { id: nid, version: prev ? prev.version + 1 : 1, basis: t.basis, approvedAt: t.iso, approvedBy: name, source: dr.source, sourceText: dr.sourceText, fields: slim(dr.fields), notes: dr.notes, memo: clip(op.memo || dr.memo, 500), mode: dr.mode, changes: changes.map(function (c) { return { key: c.key, label: c.label, before: c.before, after: c.after }; }) };
        P.notices[nid] = rec; D.items.splice(x, 1);
        log(normalize('name', rec.fields.name && rec.fields.name.value) + ' v' + rec.version + ' 승인' + (prev ? ' · 바뀐 항목 ' + changes.length + '개' : ' · 새 공고'));
        return { ok: true, changed: ['drafts', 'published'], result: rec };
      }
      case 'rollback': {
        var cur = P.notices[op.noticeId], h = (P.history[op.noticeId] || []).filter(function (v) { return v.version === op.version; })[0];
        if (!cur || !h) return { ok: false, error: '되돌릴 버전을 찾지 못했어요.' };
        P.history[op.noticeId] = [{ version: cur.version, basis: cur.basis, approvedAt: cur.approvedAt, approvedBy: cur.approvedBy, source: cur.source, fields: cur.fields, changes: cur.changes || [] }].concat(P.history[op.noticeId]).slice(0, 10);
        var back = { id: op.noticeId, version: cur.version + 1, basis: t.basis, approvedAt: t.iso, approvedBy: name, source: h.source, sourceText: cur.sourceText, fields: h.fields, notes: [], memo: 'v' + h.version + ' 내용으로 되돌림', changes: diff(values(cur.fields), values(h.fields)) };
        P.notices[op.noticeId] = back;
        log(normalize('name', back.fields.name && back.fields.name.value) + ' v' + back.version + ' (v' + h.version + '로 되돌림)');
        return { ok: true, changed: ['published'], result: back };
      }
      case 'saveCard': {
        var c = op.card || {}, cite = (c.cite || []).filter(function (x) { return x && x[0]; }).slice(0, 5).map(function (x) { return [clip(x[0], 80), safeUrl(clip(x[1], 300))]; });
        if (!c.title || !c.body) return { ok: false, error: '제목과 내용을 적어 주세요.' };
        if (!cite.length) return { ok: false, error: '근거(법령·공식 안내)를 하나 이상 적어 주세요.' };
        var card = { id: c.id || uid('k'), title: clip(c.title, 60), keywords: (c.keywords || []).map(function (w) { return clip(String(w).trim(), 20); }).filter(Boolean).slice(0, 15), body: clip(c.body, 1500), cite: cite, status: 'approved', approvedBy: name, approvedAt: t.iso };
        var ci = -1; P.cards.forEach(function (y, n) { if (y.id === card.id) ci = n; });
        if (ci >= 0) P.cards[ci] = card; else P.cards.push(card);
        if (op.fromQuestion) U.items = U.items.filter(function (q) { return q.id !== op.fromQuestion; });
        log('코치 지식 ' + (ci >= 0 ? '수정' : '추가') + ' · ' + card.title);
        return { ok: true, changed: op.fromQuestion ? ['published', 'unanswered'] : ['published'], result: card };
      }
      case 'deleteCard': {
        var before = P.cards.length, gone = P.cards.filter(function (y) { return y.id === op.id; })[0];
        P.cards = P.cards.filter(function (y) { return y.id !== op.id; });
        if (P.cards.length !== before) log('코치 지식 삭제 · ' + (gone && gone.title));
        return { ok: true, changed: ['published'] };
      }
      case 'resolveQuestion': { U.items = U.items.filter(function (q) { return q.id !== op.id; }); return { ok: true, changed: ['unanswered'] }; }
      default: return { ok: false, error: '알 수 없는 작업이에요.' };
    }
  }
  function logMiss(U, q, top, reason, now) {
    var t = stamp(now), key = squash(q);
    var hit = U.items.filter(function (x) { return squash(x.q) === key; })[0];
    if (hit) { hit.count = (hit.count || 1) + 1; hit.at = t.iso; }
    else U.items.unshift({ id: uid('q'), at: t.iso, q: clip(q, 200), top: (top || []).slice(0, 3), reason: reason || 'no_card', count: 1 });
    U.items = U.items.slice(0, 200);
  }
  // 승인본 → 이용자 화면용 묶음
  function publicView(P, today) {
    var programs = Object.keys(P.notices || {}).map(function (id) { return toProgram(P.notices[id], today); });
    return { programs: programs, cards: (P.cards || []).filter(function (c) { return c.status === 'approved'; }), updatedAt: P.meta && P.meta.updatedAt };
  }

  return {
    FIELDS: FIELDS, FIELD: FIELD, FLAG_TEXT: FLAG_TEXT, PERSONAS: PERSONAS,
    normalize: normalize, show: show, values: values, blank: blank,
    inSource: inSource, valueFits: valueFits, missingItems: missingItems, toList: toList, check: check, diff: diff, readyToApprove: readyToApprove,
    toProgram: toProgram, evalProgram: evalProgram, verdict: verdict, statusOf: statusOf, simulate: simulate,
    retrieve: retrieve, noticeCards: noticeCards, grams: grams, ruleExtract: ruleExtract,
    safeUrl: safeUrl, manwon: manwon, digits: digits, squash: squash, toDate: toDate,
    applyOp: applyOp, logMiss: logMiss, publicView: publicView, stamp: stamp, slim: slim
  };
});
