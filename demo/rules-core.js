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
  // 모집 상태 (계획서 PRD F-03과 같은 이름)
  var STATUS = { open: '모집 중', closed: '마감', wait: '다음 공고 대기' };
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
    // 모집 상태 이름은 계획서(PRD F-03)와 같게: 모집 중 · 마감 · 다음 공고 대기
    if (v.period_start && t < v.period_start) return [STATUS.wait, ''];
    if (v.period_end && t > v.period_end) return [STATUS.closed, 'no'];
    if (v.period_start || v.period_end) return [STATUS.open, 'brand'];
    return [STATUS.wait, ''];
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
    if (v.exclusions && v.exclusions.length) conds.push({ type: 'dup', list: v.exclusions, label: v.exclusions.join('·') + ' 중복 수혜 없음', evidence: ev('exclusions') });
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
      // 무주택·중복 수혜: 이용자가 답한 경우에만 반영(asked). 값이 없으면(관리자 미리보기·시뮬레이션) 기존처럼 '직접 확인'
      else if (c.type === 'homeless') { if (user.homeless === undefined) { mine = '직접 확인'; } else { ok = user.homeless === 'yes' ? true : user.homeless === 'no' ? false : null; mine = { yes: '예', no: '아니오' }[user.homeless] || '모름'; } }
      else if (c.type === 'dup') { if (user.dup === undefined) { mine = '직접 확인'; } else { ok = user.dup === 'no' ? true : user.dup === 'yes' ? false : null; mine = { yes: '받고 있음', no: '받고 있지 않음' }[user.dup] || '모름'; } }
      else { ok = null; mine = '직접 확인'; }
      return { label: c.label, mine: mine, ok: ok, type: c.type, evidence: c.evidence, asked: (c.type === 'homeless' && user.homeless !== undefined) || (c.type === 'dup' && user.dup !== undefined) };
    });
    var closed = p.status === STATUS.closed;
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
  function verdict(x) { if (x.closed) return '마감'; if (!x.eligible) return '해당 안 됨'; return x.unknown.some(function (r) { return r.asked || (r.type !== 'homeless' && r.type !== 'dup'); }) ? '확인 필요' : '해당 가능'; }
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
      var qn = ql.replace(/\s+/g, '');
      kw.forEach(function (w) { if (w && (ql.indexOf(w) >= 0 || qn.indexOf(w.replace(/\s+/g, '')) >= 0)) s += 4; });
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

  // ---------- 6. 내장 AI 추출 (외부 API 없이 이 기기에서) ----------
  // prompts/extract.md(공고 추출기 시스템 프롬프트)의 규칙을 따른다:
  // 원문에 없으면 비워 두고, 근거는 원문 한 줄 그대로, 애매하면 확신을 낮추고 notes에 이유를 적는다.
  function lineOf(text, idx) {
    var s = text.lastIndexOf('\n', idx) + 1, e = text.indexOf('\n', idx); if (e < 0) e = text.length;
    return text.slice(s, e);
  }
  function hit(text, re) { var m = re.exec(text); return m ? { m: m, line: lineOf(text, m.index) } : null; }
  function put(f, key, value, line, conf) { if (value === null || value === undefined || value === '') return; f[key] = { value: String(value), evidence: line, confidence: conf || 'high' }; }
  // "지원 대상" 같은 제목 아래 글머리표 줄들
  function section(text, re) {
    var lines = text.split('\n'), out = [], on = false;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i], t = L.trim();
      if (!on) { if (re.test(t)) { on = true; var rest = t.replace(re, '').replace(/^[\s:：]+/, ''); if (rest) out.push({ t: rest, raw: L }); } continue; }
      if (!t) { if (out.length) break; continue; }
      if (/^\d+\.\s/.test(t)) break;
      out.push({ t: t.replace(/^[-•·○◦▪*※]\s*|^[가-하]\.\s*|^\d\)\s*/, ''), raw: L });
    }
    return out;
  }
  function shortText(s) { return String(s).replace(/\(https?:[^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim(); }
  function ruleExtract(text) {
    var t = String(text || '').replace(/\r\n?/g, '\n'), f = {}, h;
    // 이름: "공고 제○호" 줄이 아닌 첫 제목 줄
    var lines0 = t.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var notSentence = function (x) { return !/(?:니다|세요|해요|이에요|예요)[.!]?$|[다요]\.$|참고|클릭|확인해/.test(x); };
    var titleA = function (x) { return /공고|사업|안내/.test(x) && !/공고\s*제\s*[\d\-]+\s*호/.test(x) && !/공고\s*(?:문|확인|후|일)|확인\s*방법|^(?:상세\s*)?안내$/.test(x) && x.length < 80 && notSentence(x); };
    // 홈페이지에서 복사한 안내처럼 '공고' 제목줄이 없으면: 지원·주택·대출 등으로 끝나는 짧은 제목 줄
    var titleB = function (x) { return x.length >= 4 && x.length <= 40 && notSentence(x) && !/[:：]/.test(x) && !/^\d+[.)]/.test(x) && /(?:지원|사업|주택|대출|보증금|월세|이자|수당|바우처|펀드|모집)$/.test(x.replace(/\s+/g, '')); };
    var title = lines0.filter(function (x) { return titleA(x) || titleB(x); })[0];
    if (title) put(f, 'name', title.trim().replace(/\(.*?\)/g, '').replace(/\s*(사업\s*)?(공고|안내)\s*$/, '').replace(/\s*\d차\s*모집\s*$/, '').replace(/^\d{4}년\s*/, '').replace(/\s+및\s+/g, '·').trim(), title, 'medium');
    if ((h = hit(t, /(서울특별시|[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도))\s*(?:공고|장)|(국토교통부|한국토지주택공사|주택도시보증공사)/))) put(f, 'org', h.m[1] || h.m[2], h.line, 'high');
    if ((h = hit(t, /(서울(?:특별)?시)(?:에|로|내|에서)?\s*(?:거주|전입|이주|이사)/))) put(f, 'region', '서울특별시', h.line, 'medium');
    // 자격
    if ((h = hit(t, /만\s*(\d{2})\s*세\s*(?:이상|부터)\s*(?:~\s*)?(?:만\s*)?(\d{2})\s*세\s*(?:이하|까지)/)) || (h = hit(t, /만[ \t]*(\d{2})[ \t]*세?[ \t]*[~∼\-–][ \t]*(?:만[ \t]*)?(\d{2})[ \t]*세/))) { put(f, 'age_min', h.m[1], h.line); put(f, 'age_max', h.m[2], h.line); }
    else if ((h = hit(t, /(\d{4})\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*[~∼\-]\s*(\d{4})\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*(?:사이\s*)?출생/))) {
      var yr = +((t.match(/(20\d{2})년/) || [])[1] || new Date().getFullYear());
      put(f, 'age_min', yr - +h.m[2], h.line, 'low'); put(f, 'age_max', yr - +h.m[1], h.line, 'low');
    }
    if ((h = hit(t, /중위\s*소득\s*(\d{2,3})\s*%/))) put(f, 'income_pct', h.m[1], h.line);
    if ((h = hit(t, /보증금\s*([\d,.]+\s*(?:억|천만|만)\s*(?:\d+\s*천\s*만?)?\s*원?)\s*이하/))) put(f, 'deposit_max', manwon(h.m[1])[0], h.line, 'medium');
    if ((h = hit(t, /월\s*세\s*([\d,.]+\s*만\s*원?)\s*이하/))) put(f, 'rent_max', manwon(h.m[1])[0], h.line, 'medium');
    if ((h = hit(t, /무주택/))) put(f, 'homeless', '예', h.line);
    if ((h = hit(t, /서울(?:특별)?시로\s*전입하였거나\s*서울(?:특별)?시\s*내에서\s*이사/))) put(f, 'residency', '서울시로 전입 또는 서울시 안에서 이사', h.line, 'medium');
    else if ((h = hit(t, /서울(?:특별)?시에\s*거주하거나\s*이주\s*예정/))) put(f, 'residency', '서울시 거주 또는 이주 예정', h.line, 'medium');
    else if ((h = hit(t, /서울(?:특별)?시에\s*거주/))) put(f, 'residency', '서울시 거주', h.line, 'medium');
    // 지원 내용
    if ((h = hit(t, /월\s*최대\s*([\d,.]+\s*만\s*원)/)) || ((h = hit(t, /(?:^|[\s(])월[ \t]*([\d,.]+[ \t]*만[ \t]*원)(?![ \t]*(?:이하|초과|미만|이상))[ \t]*(?:씩|월세|지원|을|를|까지|\()/m)) && (h.line = lineOf(t, h.m.index + (/^[\s(]/.test(h.m[0]) ? 1 : 0)), h))) put(f, 'amount_monthly_max', manwon(h.m[1])[0], h.line, 'medium');
    if ((h = hit(t, /(?:최대|최장)\s*(\d{1,2})\s*개월/))) put(f, 'amount_months', h.m[1], h.line);
    if ((h = hit(t, /(?:1인당|1회|가구당)\s*최대\s*([\d,.]+\s*만\s*원)/))) put(f, 'amount_lump_max', manwon(h.m[1])[0], h.line, 'medium');
    var sup = section(t, /^(?:\d+\.\s*)?지원\s*(?:내용|금액|규모)/);
    if (sup.length) {
      var summary = f.amount_monthly_max ? '월 최대 ' + f.amount_monthly_max.value + '만 원' + (f.amount_months ? ' · 최대 ' + f.amount_months.value + '개월' : '')
        : f.amount_lump_max ? (/실비/.test(sup[0].t) ? '실비 · ' : '') + '최대 ' + f.amount_lump_max.value + '만 원'
        : sup.map(function (x) { return shortText(x.t).replace(/\s*지원$/, ''); }).slice(0, 2).join(' · ');
      put(f, 'amount_text', summary.slice(0, 70), sup[0].raw, f.amount_monthly_max || f.amount_lump_max ? 'medium' : 'low');
    }
    // 접수
    if ((h = hit(t, /(\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2})\.?\s*(?:\([월화수목금토일]\))?\s*(?:\d{1,2}:\d{2})?\s*[~∼\-–]\s*(\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2})/))) { put(f, 'period_start', toDate(h.m[1]), h.line); put(f, 'period_end', toDate(h.m[2]), h.line); }
    else if ((h = hit(t, /(\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2})\.?\s*(?:\([월화수목금토일]\))?\s*[~∼\-–]\s*예산/))) put(f, 'period_start', toDate(h.m[1]), h.line);
    if ((h = hit(t, /선착순/))) put(f, 'first_come', '예', h.line);
    if ((h = hit(t, /선정\s*(?:방법|방식|기준)\s*[:：]?\s*(.+)/)) && /선착순/.test(h.m[1])) put(f, 'select', '선착순', h.line, 'medium');
    else if (h) put(f, 'select', shortText(h.m[1]).split(/,|하며|\s및\s/)[0].replace(/으로\s*선정$/, ' 선정').replace(/이\s*낮은\s*순/, ' 낮은 순').trim(), h.line, 'medium');
    if ((h = hit(t, /(?:신청|접수)[ \t]*방법[ \t]*[:：]?[ \t]*(\S.*)/)) && !/^(?:신청|접수)\s*기간|^공고\s*확인|^문의/.test(h.m[1].trim())) put(f, 'channel', shortText(h.m[1]).replace(/(포털|홈페이지|누리집|사이트|페이지)(?:에서|으로)?\s+\S*(?:페이지|에서).*$/, '$1').replace(/\s*신청$/, '').replace(/\s*접수$/, ''), h.line, 'medium');
    else {
      var after = t.split(/(?:신청|접수)\s*방법/).slice(1).join('\n').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var via = after.filter(function (x) { return /포털|홈페이지|누리집|온라인|사이트|페이지|방문|우편|정부24|복지로|앱에서/.test(x) && !/공고/.test(x); })[0];
      // '서울주거포털 청년월세지원 페이지 페이지에서 지원 신청' → '서울주거포털 청년월세지원 페이지'
      if (via) put(f, 'channel', shortText(via).replace(/(\S+)(\s+\1)+/g, '$1').replace(/(포털|홈페이지|누리집|사이트|페이지)(?:에서|으로)?\s.*$/, '$1').replace(/\s*(?:에서|으로)?\s*(?:지원\s*)?신청$/, '').slice(0, 40), via, 'low');
    }
    if ((h = hit(t, /(https?:\/\/[^\s)]+)/))) put(f, 'url', h.m[1], h.line);
    // 서류
    var docs = section(t, /^(?:\d+\.\s*)?(?:제출|구비)\s*서류/);
    if (docs.length) put(f, 'docs', docs.map(function (x) { return x.t; }).join('\n'), docs[0].raw, 'medium');
    // 함께 받을 수 없는 지원·제외 대상
    var ex = t.split('\n').filter(function (L) { return /중복\s*(?:지원|수혜)?\s*(?:불가|제외)|대상에서\s*제외|지원\s*제외|함께\s*받을\s*수\s*없/.test(L); });
    if (ex.length) put(f, 'exclusions', ex.map(function (L) { return L.trim().replace(/^[-•·○◦▪*※]\s*|^[가-하]\.\s*/, '').replace(/\s*(?:은|는)\s*(?:중복\s*(?:지원|수혜)?\s*(?:불가|제외)|지원\s*대상에서\s*제외|대상에서\s*제외).*$/, '').replace(/\s*등\s*다른\s*공공\s*/, ' 등 다른 공공 ').replace(/\s*이용자$/, ' 이용자').trim(); }).join('\n'), ex[0], 'medium');
    return f;
  }
  // 사람이 판단해야 할 점 (시스템 프롬프트의 notes 규칙)
  function extractNotes(text, f) {
    var t = String(text || ''), n = [], h;
    f = f || ruleExtract(t);
    if ((h = hit(t, /정정\s*전\s*[:：]?\s*([^)]+)\)/))) n.push('정정 공고예요. 원문에 정정 전 값(' + h.m[1].trim() + ')이 함께 적혀 있어요. 정정 뒤 값으로 뽑았어요.');
    else if (/정정/.test(t)) n.push('정정 공고예요. 바뀐 항목을 지난 승인본과 비교해 확인하세요.');
    var chg = t.split('\n').filter(function (L) { return /(?:기준|조건|요건|소득|월세|보증금|금액|연령|나이|대상)[^\n]{0,20}(?:완화|상향|하향|변경)|(?:완화|상향|하향|변경)(?:됨|되었|했|함|하여)/.test(L) && !/변경\s*\/|변경\s*신청|신청하기|부담\s*완화/.test(L); })[0];
    if (chg) n.push('조건이 바뀐 흔적이 있어요: “' + chg.trim().replace(/^[※\s]+/, '') + '”');
    if ((h = hit(t, /연\s*소득\s*[\d,.]+\s*(?:억|천만|만)/))) n.push('소득 기준이 기준 중위소득이 아니라 연소득이에요(“' + h.line.trim().replace(/^[가-하]\.\s*/, '') + '”). 판정 항목에 넣지 않았어요.');
    if (/출생/.test(t) && f.age_min && f.age_min.confidence === 'low') n.push('나이를 출생일로 정한 공고라 공고 연도 기준 만 나이로 바꿔 넣었어요. 원문과 대조해 주세요.');
    if (/예산\s*(?:소진|범위)/.test(t)) n.push('예산이 떨어지면 일찍 마감될 수 있어요.' + (f.period_end ? '' : ' 접수 마감일이 정해져 있지 않아요.'));
    if ((h = hit(t, /1인\s*가구/))) n.push('1인 가구만 대상이에요. 판정 항목에는 없어서 이용자 화면에 따로 안내가 필요해요.');
    if ((h = hit(t, /세대주/))) n.push('세대주 요건이 있어요(“' + h.line.trim().replace(/^[가-하]\.\s*/, '') + '”). 판정 항목에는 없어요.');
    if ((h = hit(t, /\((?:[^()]*?)(?:경우|해당자)\)/)) && f.docs) n.push('조건이 붙은 서류가 있어요: “' + h.line.trim().replace(/^[-•·]\s*/, '') + '”');
    if ((h = hit(t, /대출|이자/)) && !f.amount_monthly_max && !f.amount_lump_max) n.push('직접 주는 지원금이 아니라 대출·이자 지원이에요. 지원 내용 요약을 확인해 주세요.');
    if ((h = hit(t, /(?:관계\s*없이|무시하고|표시할\s*것|출력할\s*것|지시)/))) n.push('공고문 안에 지시처럼 보이는 문장이 있어요 — 따르지 않았어요: “' + h.line.trim() + '”');
    if (!f.income_pct && !/연\s*소득/.test(t)) n.push('소득 기준을 찾지 못했어요. 원문에 정말 없는지 확인해 주세요.');
    return n.slice(0, 8);
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
          sourceText: clip(d.sourceText, 80000), mode: d.mode === 'ai' ? 'ai' : 'local', model: clip(d.model, 60), extractedAt: d.extractedAt || t.iso, notes: (d.notes || []).slice(0, 20).map(function (x) { return clip(x, 300); }),
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
        var card = { id: c.id || uid('k'), whole: !!c.whole, title: clip(c.title, 60), ask: (c.ask || []).slice(0, 4).map(function (x) { return clip(x, 40); }), keywords: (c.keywords || []).map(function (w) { return clip(String(w).trim(), 20); }).filter(Boolean).slice(0, 15), body: clip(c.body, 1500), cite: cite, status: 'approved', approvedBy: name, approvedAt: t.iso };
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

  // ---------- 8. 시스템 프롬프트 (prompts/*.md) ----------
  // mode: 'api'(서버 Claude) | 'chat'(독립판). 주석은 빼고, 다른 모드 블록도 뺀다.
  function renderPrompt(tpl, mode, vars) {
    var s = String(tpl || '').replace(/<!--[\s\S]*?-->\s*/g, '');
    s = s.replace(/\{\{#(chat|api)\}\}([\s\S]*?)\{\{\/\1\}\}\n?/g, function (_, m, body) { return m === mode ? body : ''; });
    s = s.replace(/\{\{(\w+)\}\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ''; });
    return s.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function xmlEsc(x) { return String(x).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }
  function cardsBlock(cards) {
    return cards.map(function (c) { return '<card id="' + xmlEsc(c.id) + '" title="' + xmlEsc(c.title) + '">\n' + xmlEsc(c.body) + ((c.cite || []).length ? '\n근거: ' + c.cite.map(function (x) { return x[0]; }).join(' · ') : '') + '\n</card>'; }).join('\n');
  }
  var FACT_KEYS = { today: '오늘', contract: '계약일', move: '입주일', end: '계약 만료일', noticeBy: '나간다고 알려야 하는 마지막 날(만료 2개월 전)', reportRequired: '전월세 신고 대상 여부', reportReason: '신고 대상 판단 이유', reportDue: '전월세 신고 기한', reportDone: '전월세 신고 완료 여부', reportEarly: '신고 기한이 입주보다 먼저 오는지', moveinDue: '전입신고 법정 기한', moveinDone: '전입신고 완료 여부', deposit: '보증금(만 원)', rent: '월세(만 원)', fee: '관리비(만 원)', brokerBase: '중개보수 계산용 거래 금액(원)', brokerCap: '중개보수 상한(원, 부가세 별도)', programs: '지원사업 판정', tasks: '지금 챙길 일(내 타임라인)' };
  function factsBlock(f) {
    if (!f || typeof f !== 'object') return '';
    var lines = [];
    Object.keys(FACT_KEYS).forEach(function (k) {
      var v = f[k]; if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) v = v.slice(0, 6).map(function (x) { return (x && typeof x === 'object' ? x.title + (x.due ? ' (' + x.due + '까지)' : '') : String(x)).slice(0, 80); }).join(' / ');
      else if (typeof v === 'boolean') v = v ? '예' : '아니오';
      else v = String(v).slice(0, 100);
      lines.push(FACT_KEYS[k] + ': ' + v);
    });
    return lines.length ? '<card id="facts" title="내 계약으로 계산한 값">\n' + xmlEsc(lines.join('\n')) + '\n</card>' : '';
  }

  return {
    FIELDS: FIELDS, FIELD: FIELD, FLAG_TEXT: FLAG_TEXT, PERSONAS: PERSONAS,
    normalize: normalize, show: show, values: values, blank: blank,
    inSource: inSource, valueFits: valueFits, missingItems: missingItems, toList: toList, check: check, diff: diff, readyToApprove: readyToApprove,
    toProgram: toProgram, evalProgram: evalProgram, verdict: verdict, statusOf: statusOf, STATUS: STATUS, simulate: simulate,
    retrieve: retrieve, noticeCards: noticeCards, grams: grams, ruleExtract: ruleExtract, extractNotes: extractNotes,
    safeUrl: safeUrl, manwon: manwon, digits: digits, squash: squash, toDate: toDate,
    renderPrompt: renderPrompt, cardsBlock: cardsBlock, factsBlock: factsBlock, FACT_KEYS: FACT_KEYS,
    applyOp: applyOp, logMiss: logMiss, publicView: publicView, stamp: stamp, slim: slim
  };
});
