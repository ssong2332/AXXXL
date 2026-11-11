/* 자취 계약 내비 · 지원사업 공용 로직 (브라우저 + 서버 + 테스트)
 *  1. 온통청년 정책 한 건을 화면용으로 정리 (normalize)
 *  2. 이용 시점 기준 접수 상태 (statusAt)
 *  3. 등록된 조건과 내 정보 대조 (check) — 구조화된 항목 + 글에서 금액으로 바꿀 수 있는 조건(소득 기준, 무주택, 보증금·월세 상한). 나머지 글 조건은 판정하지 않는다
 *  4. 받는 동안 조심할 것 (watch), 서류 줄 나누기와 발급처 찾기 (docLines)
 * AI를 부르지 않는다. 전부 정해 둔 규칙으로 계산한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JachwiSupport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 온통청년 코드정의서(API코드정보.xlsx, 2026-11-10 확인)
  var CODE = {
    job: { '0013001': '재직자', '0013002': '자영업자', '0013003': '미취업자', '0013004': '프리랜서', '0013005': '일용근로자', '0013006': '(예비)창업자', '0013007': '단기근로자', '0013008': '영농종사자', '0013009': '기타' },
    school: { '0049001': '고졸 미만', '0049002': '고교 재학', '0049003': '고졸 예정', '0049004': '고교 졸업', '0049005': '대학 재학', '0049006': '대졸 예정', '0049007': '대학 졸업', '0049008': '석·박사', '0049009': '기타' },
    sbiz: { '0014001': '중소기업', '0014002': '여성', '0014003': '기초생활수급자', '0014004': '한부모가정', '0014005': '장애인', '0014006': '농업인', '0014007': '군인', '0014008': '지역인재', '0014009': '기타' },
    method: { '0042001': '인프라 구축', '0042002': '프로그램', '0042003': '직접대출', '0042004': '공공기관', '0042005': '계약(위탁운영)', '0042006': '보조금', '0042007': '대출보증', '0042008': '공적보험', '0042009': '조세지출', '0042010': '바우처', '0042011': '정보제공', '0042012': '경제적 규제', '0042013': '기타' }
  };
  var FREE = { '0013010': 1, '0049010': 1, '0014010': 1, '0011009': 1 };
  var CATS = [['주거', '주거'], ['금융･복지･문화', '생활·금융'], ['일자리', '일자리'], ['교육･직업훈련', '교육'], ['참여･기반', '참여']];

  // 2026년 기준 중위소득 100% (월, 원). 보건복지부 고시 인용 자료 기준 — 고시 원문 대조 필요
  var MEDIAN_2026 = { 1: 2564238, 2: 4199292, 3: 5359036, 4: 6494738, 5: 7556719, 6: 8555952 };

  // 등록 글에 섞여 오는 HTML 표기(&quot; 등)는 글자로 되돌린다. 화면에 낼 때는 esc()로 다시 감싼다
  function clip(s, n) { s = String(s || '').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function codes(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function labels(s, table) { var c = codes(s).filter(function (x) { return !FREE[x]; }); return c.length ? c.map(function (x) { return table[x] || x; }) : null; }
  function ymd8(s) { s = String(s || '').replace(/[^0-9]/g, ''); return s.length === 8 ? s : ''; }
  function url(s) { s = String(s || '').trim(); if (!s) return ''; if (!/^https?:\/\//i.test(s)) { if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return ''; s = 'https://' + s; } return /^https?:\/\/[^\s<>"']+$/i.test(s) ? s : ''; }

  // 대상 지역 범위: 코드가 200개 이상이면 전국, 한 시도 코드를 거의 다 가지면 시도, 아니면 시군구
  function scopeOf(zipList, sidoSize) {
    var n = zipList.length; if (!n || n >= 200) return 'all';
    var pre = {}; zipList.forEach(function (z) { pre[z.slice(0, 2)] = (pre[z.slice(0, 2)] || 0) + 1; });
    var ks = Object.keys(pre); if (ks.length > 1) return 'multi';
    var size = (sidoSize && sidoSize[ks[0]]) || 0;
    return size > 1 && n >= size * 0.8 ? 'sido' : 'sgg';
  }

  // ---------- 운영 지역 ----------
  // 다른 지자체가 자기 사업을 '전국 대상'으로 등록해 둔 경우가 많다(2026-11-11 확인: 경북 의성군 사업이 전국 254개 시·군·구 코드로 등록).
  // 대상 지역 코드만 믿지 않고, 등록·주관 기관 이름에서 어느 시·도, 어느 시·군·구의 사업인지 읽는다.
  var SIDO_OLD = { '광주광역시': '전남광주통합특별시', '광주시청': '전남광주통합특별시', '전라남도': '전남광주통합특별시', '강원도': '강원특별자치도', '전라북도': '전북특별자치도', '제주도': '제주특별자치도' };
  // regions: data/regions.js 의 [[시도, [[코드, 시군구], ...]], ...]. 반환: { sido, sgg } (못 읽으면 빈 글자)
  function ownerOf(p, regions) {
    var fields = [p.rgtrHghrkInstCdNm, p.rgtrUpInstCdNm, p.sprvsnInstCdNm, p.rgtrInstCdNm, p.operInstCdNm].map(function (s) { return String(s || ''); });
    var names = (regions || []).map(function (r) { return r[0]; }), sido = '', sgg = '', part = '';
    for (var i = 0; i < fields.length && !sido; i++) {
      var f = fields[i];
      names.forEach(function (n) { if (!sido && f.indexOf(n) >= 0) sido = n; });
      Object.keys(SIDO_OLD).forEach(function (o) { if (!sido && f.indexOf(o) >= 0 && names.indexOf(SIDO_OLD[o]) >= 0) { sido = SIDO_OLD[o]; part = /^광주/.test(o) ? '광주' : /^전라남도/.test(o) ? '전남' : ''; } });
    }
    if (!sido) return { sido: '', sgg: '', part: '' };
    // 그 시·도의 시·군·구 이름(첫 낱말: '포항시 남구' → '포항시')이 낱말로 들어 있으면 그 시·군·구의 사업이다.
    // 기관 이름을 먼저 보고, 없으면 정책 이름을 본다 ('[광주 서구] …', '(광양시) …', '남구 백운광장 청년축제'처럼 시가 대신 등록한 구 사업)
    var firsts = {}; ((regions.filter(function (r) { return r[0] === sido; })[0] || ['', []])[1]).forEach(function (x) { var w = String(x[1]).split(' ')[0]; if (w && w !== sido) firsts[w] = 1; });
    function words(s) { return String(s || '').split(/[^0-9A-Za-z가-힣]+/); }
    words(fields.join(' ')).concat(words(p.plcyNm)).forEach(function (w) { if (!sgg && firsts[w]) sgg = w; else if (!sgg && firsts[w.replace(/청$/, '')] && /(시|군|구)청$/.test(w)) sgg = w.replace(/청$/, ''); });
    // part: 광주·전남이 합쳐진 시·도에서, 이 사업이 옛 광주 것인지 옛 전남 것인지 (기관·정책 이름에 한쪽만 적혀 있을 때)
    if (sido === '전남광주통합특별시') {
      var rest = (fields.join(' ') + ' ' + String(p.plcyNm || '')).split('전남광주통합특별시').join(' '), gj = /광주/.test(rest), jn = /전남|전라남도/.test(rest);
      part = gj && !jn ? '광주' : jn && !gj ? '전남' : gj && jn ? '' : part;
    }
    return { sido: sido, sgg: sgg, part: part };
  }
  // 이 정책을 mySido·mySgg에 사는 사람에게 보여 줘도 되는가. 확인할 수 없으면 보여 주지 않는다.
  function forRegion(it, mySido, mySgg) {
    if (it.central) return true;
    var wide = it.scope === 'all' || it.scope === 'multi', mine = String(mySgg || '').split(' ')[0];
    if (!it.osido) return !wide || it.top === '정부산하기관및위원회'; // 어느 지자체 사업인지 모르는 '전국' 등록은 뺀다
    if (wide && it.osido !== mySido) return false;                   // 다른 시·도가 전국으로 등록한 사업
    if (it.osgg && it.osgg !== mine) return false;                   // 다른 시·군·구의 사업
    if (it.opart && it.osido === mySido && it.opart !== (/구$/.test(mine) ? '광주' : '전남')) return false; // 합쳐지기 전 광주·전남 중 다른 쪽 사업
    return true;
  }

  function normalize(p, sidoSize, regions) {
    var zips = codes(p.zipCd), ap = String(p.aplyYmd || '').split('~').map(ymd8);
    var cat = String(p.lclsfNm || '').split(',')[0].trim(), own = regions ? ownerOf(p, regions) : { sido: '', sgg: '', part: '' };
    var links = linksOf(p), year = +(ymd8(p.bizPrdBgngYmd).slice(0, 4) || String(p.frstRegDt || '').slice(0, 4) || 0) || new Date().getFullYear();
    var raw = [p.plcyAplyMthdCn, p.plcySprtCn, p.etcMttrCn, p.srngMthdCn, p.addAplyQlfcCndCn, p.plcyExplnCn, p.bizPrdEtcCn].map(function (s) { return String(s || ''); }).join('\n');
    return {
      osido: own.sido, osgg: own.sgg, opart: own.part,
      id: String(p.plcyNo || ''), name: clip(p.plcyNm, 80), sum: clip(p.plcyExplnCn, 220), cat: cat, sub: String(p.mclsfNm || '').split(',')[0].trim(),
      org: clip(p.sprvsnInstCdNm || p.rgtrInstCdNm || p.operInstCdNm, 60), top: clip(p.rgtrHghrkInstCdNm || p.rgtrUpInstCdNm, 30), central: p.pvsnInstGroupCd === '0054001',
      scope: scopeOf(zips, sidoSize), nzip: zips.length, method: CODE.method[p.plcyPvsnMthdCd] || '',
      age: (+p.sprtTrgtMinAge || +p.sprtTrgtMaxAge) ? [+p.sprtTrgtMinAge || 0, +p.sprtTrgtMaxAge || 0] : null,
      mrg: p.mrgSttsCd === '0055001' ? '기혼' : p.mrgSttsCd === '0055002' ? '미혼' : '',
      job: labels(p.jobCd, CODE.job), school: labels(p.schoolCd, CODE.school), sbiz: labels(p.sbizCd, CODE.sbiz),
      earn: p.earnCndSeCd === '0043002' ? { t: 'year', min: +p.earnMinAmt || 0, max: +p.earnMaxAmt || 0 } : p.earnCndSeCd === '0043003' ? { t: 'etc', text: clip(p.earnEtcCn, 200) } : null,
      apply: { t: p.aplyPrdSeCd === '0057001' ? 'period' : p.aplyPrdSeCd === '0057003' ? 'closed' : 'always', from: ap[0] || '', to: ap[1] || '' },
      biz: { from: ymd8(p.bizPrdBgngYmd), to: ymd8(p.bizPrdEndYmd) },
      support: clip(p.plcySprtCn, 700), how: clip(p.plcyAplyMthdCn, 300), select: clip(p.srngMthdCn, 300), docs: clip(p.sbmsnDcmntCn, 600),
      cond: clip(p.addAplyQlfcCndCn, 500), excl: clip(p.ptcpPrpTrgtCn, 400), etc: clip(p.etcMttrCn, 300),
      url: url(p.aplyUrlAddr), urlHome: !!url(p.aplyUrlAddr) && !isDeep(url(p.aplyUrlAddr)), ref: links.ref, refHome: links.refHome, notices: links.notices,
      first: p.sprtArvlSeqYn === 'Y', upd: String(p.lastMdfcnDt || '').slice(0, 10), reg: ymd8(String(p.frstRegDt || '').slice(0, 10)), year: year,
      // 등록 글(신청 방법·지원 내용·기타)에 적힌 접수 기간. 공고 원문을 못 읽었을 때 '이미 끝났는지'를 가리는 데만 쓴다
      tper: pickNotice(periodsIn(raw, year), { year: year })
    };
  }

  // ---------- 주소 ----------
  // 첫 화면 주소(https://기관.go.kr/, /index.do)인지, 공고까지 들어가는 주소인지
  function isDeep(s) {
    var m = /^https?:\/\/[^/?#]+([^?#]*)(\?[^#]*)?/i.exec(String(s || '')); if (!m) return false;
    var path = (m[1] || '').replace(/\/(index|main|home)\.(do|html?|jsp|php|asp|aspx|es|nm)$/i, '/').replace(/\/+$/, '');
    return path !== '' || (m[2] || '').length > 1;
  }
  // 참고 주소 두 칸 중 공고까지 들어가는 주소를 먼저 쓴다 (11/11 확인: 참고1은 첫 화면, 참고2가 공고인 정책이 많다)
  function linksOf(p) {
    var a = url(p.aplyUrlAddr), r1 = url(p.refUrlAddr1), r2 = url(p.refUrlAddr2);
    var ref = [r1, r2].filter(isDeep)[0] || r1 || r2, seen = {};
    var notices = [a, r1, r2].filter(function (u) { if (!u || !isDeep(u) || seen[u] || /youthcenter\.go\.kr/i.test(u)) return false; seen[u] = 1; return true; });
    return { ref: ref, refHome: !!ref && !isDeep(ref), notices: notices };
  }

  // ---------- 공고 글에서 접수 기간 읽기 ----------
  // 규칙으로만 읽는다(AI 없음). 못 읽으면 못 읽었다고 돌려준다. 2026-11-11 실제 공고 790곳으로 맞춰 봄.
  function htmlText(html) {
    return String(html || '')
      .replace(/<(script|style|noscript|svg|head|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|dd|dt|table|section|article|ul|ol)>/gi, '\n').replace(/<\/t[dh]>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&middot;/g, '·').replace(/&amp;/g, '&')
      .replace(/&#(\d+);/g, function (m, n) { return n < 65536 ? String.fromCharCode(+n) : ' '; })
      .replace(/[ \t\r\f\v\u00a0\u200b]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();
  }
  function normText(t) {
    return String(t || '').replace(/[∼～〜~]/g, '~').replace(/[–—−]/g, '-').replace(/[’‘´`]/g, "'").replace(/．/g, '.').replace(/：/g, ':').replace(/（/g, '(').replace(/）/g, ')')
      // '신 청 기 간', '기 간', '신청⏎기간'처럼 띄어 쓰거나 줄을 나눈 라벨을 붙인다
      .replace(/(접|신|모)[ \t]*(수|청|집)[ \t]*\n?[ \t]*기[ \t]*간/g, '$1$2기간').replace(/기[ \t]+간(?=\s*[:\n])/g, '기간')
      .replace(/(접수|신청|모집)\s*\n\s*(?=(기간|기한|일정|마감)\s*[:\n])/g, '$1');
  }
  var DATE = /(?:(20\d{2}|'\d{2})\s*(?:[.\-/]|년)\s*)?(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})(?!\d)\s*(?:일|\.)?(?:\s*\([^)]{1,4}\))?(?:\s*\d{1,2}\s*(?::\s*\d{2}|시))?/g;
  var HIGH = /(접수|신청|모집|원서\s*접수|서류\s*접수|참가\s*신청|응모|지원서\s*접수|신청서\s*접수)\s*(기간|기한|일정|일시|마감일?|시한)|(접수|신청|모집)\s*:/;
  var MID = /(지원|공모|참여|참가)\s*기간/;
  var OTHER = /(교육|사업|활동|운영|근무|행사|파견|연수|인턴십|협약|계약|보조|시행|대회|심사|면접|발표|입주|거주|임대|지급|이용|사용|유효|수행)\s*(기간|일정|일시)|(합격자|선정|결과)\s*(발표|통보)/;
  var ALWAYS = /^[\s:\-·]*(상시|연중|수시|예산\s*소진\s*시\s*까지)/;
  function yr(s) { return s ? (s[0] === "'" ? 2000 + +s.slice(1) : +s) : 0; }
  function ymd(y, m, d) { return String(y) + (m < 10 ? '0' : '') + m + (d < 10 ? '0' : '') + d; }
  function dateTokens(s) {
    var out = [], m; DATE.lastIndex = 0;
    while ((m = DATE.exec(s))) {
      var y = yr(m[1]), mo = +m[2], d = +m[3];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      if (!y && !/[월일.]/.test(m[0].slice(String(m[2]).length))) continue; // '3.5' 같은 소수
      out.push({ y: y, m: mo, d: d, i: m.index, j: m.index + m[0].length });
    }
    return out;
  }
  function rangesIn(win, refYear) {
    var toks = dateTokens(win), out = [];
    for (var k = 0; k < toks.length; k++) {
      var a = toks[k], b = toks[k + 1], gap = b ? win.slice(a.j, b.i) : '';
      if (b && /^\s*(\([^)]*\))?\s*(\d{1,2}\s*(:\s*\d{2}|시))?\s*(부터)?\s*[~\-]\s*$|^\s*부터\s*$/.test(gap)) {
        var ya = a.y || (b.y && (b.m > a.m || (b.m === a.m && b.d >= a.d)) ? b.y : 0) || refYear, yb = b.y || ya;
        if (!b.y && (b.m < a.m || (b.m === a.m && b.d < a.d))) yb = ya + 1;
        out.push({ from: ymd(ya, a.m, a.d), to: ymd(yb, b.m, b.d) }); k++;
      } else if (/~\s*$/.test(win.slice(Math.max(0, a.i - 4), a.i)) || /^\s*(까지|마감|한)/.test(win.slice(a.j, a.j + 6))) out.push({ from: '', to: ymd(a.y || refYear, a.m, a.d) });
    }
    return out;
  }
  // 날짜 없이 달만 적힌 기간: '2026. 4월 ~ 11월' → 그 달 첫날 ~ 마지막 날
  function monthRanges(win, refYear) {
    var out = [], re = /(?:(20\d{2}|'\d{2})\s*[.년]\s*)?(\d{1,2})\s*(?:월|\.)(?!\s*\d)\s*~\s*(?:(20\d{2}|'\d{2})\s*[.년]\s*)?(\d{1,2})\s*(?:월|\.)(?!\s*\d)/g, m;
    while ((m = re.exec(win))) {
      var y1 = yr(m[1]) || refYear, y2 = yr(m[3]) || y1, a = +m[2], b = +m[4];
      if (a < 1 || a > 12 || b < 1 || b > 12) continue;
      if (!m[3] && b < a) y2 = y1 + 1;
      out.push({ from: ymd(y1, a, 1), to: ymd(y2, b, new Date(y2, b, 0).getDate()), month: true });
    }
    return out;
  }
  // 글에서 접수 기간 후보를 모은다. lv 2: 접수·신청·모집 기간, lv 1: 지원·공모 기간(뜻이 둘이라 짧은 것만 쓴다)
  function periodsIn(text, refYear) {
    var lines = normText(text).split('\n'), out = [], all = new RegExp(HIGH.source + '|' + MID.source, 'g'), stop = new RegExp(OTHER.source + '|' + HIGH.source + '|' + MID.source);
    refYear = refYear || new Date().getFullYear();
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i], m; all.lastIndex = 0;
      while ((m = all.exec(line))) {
        var lv = HIGH.test(m[0]) ? 2 : 1, rest = line.slice(m.index + m[0].length), cut = rest.search(stop);
        if (cut > 0) rest = rest.slice(0, cut);
        var win = rest; if (!/\d/.test(win) && !ALWAYS.test(win) && i + 1 < lines.length) win = lines[i + 1].slice(0, 140);
        win = win.slice(0, 160);
        var found = rangesIn(win, refYear).concat(monthRanges(win, refYear));
        if (!found.length && lv === 2 && ALWAYS.test(win.slice(0, 40))) found = [{ from: '', to: '', always: true }];
        // 라벨 앞 몇 글자('1차', '○')도 함께 남긴다. 화면에 원문 그대로 보여 주고, 차수를 가리는 데 쓴다
        var label = m[0].replace(/\s+/g, ''), said = (line.slice(Math.max(0, m.index - 8), m.index).replace(/^.*[.:]\s/, '') + m[0] + ' ' + win).replace(/\s+/g, ' ').trim().slice(0, 130);
        found.forEach(function (r) { r.label = label; r.lv = lv; r.line = said; out.push(r); });
      }
    }
    return out;
  }
  // 후보 가운데 믿을 수 있는 접수 기간을 고른다.
  // 반환: { state: 'found', ranges, line } | { state: 'always', line } | { state: 'stale'|'ambiguous' } | null(기간 표현 없음)
  function pickNotice(cands, o) {
    o = o || {};
    var hi = cands.filter(function (c) { return c.lv === 2; }), mid = cands.filter(function (c) { return c.lv === 1 && c.from && c.to && !c.month && days(d8(c.to), d8(c.from)) <= 120; });
    var use = hi.length ? hi : mid, seen = {}, ranges = use.filter(function (c) { var k = c.from + c.to; if (c.always || !c.to || seen[k]) return false; seen[k] = 1; return true; });
    // 사업 연도보다 앞선 해의 기간만 있으면 지난 공고다 (11/11 확인: 2026년 사업에 2022년 공고가 연결된 경우)
    var fresh = o.year ? ranges.filter(function (r) { return +r.to.slice(0, 4) >= o.year; }) : ranges;
    if (ranges.length && !fresh.length) return { state: 'stale', line: ranges[0].line };
    // 한 페이지에 서로 다른 기간이 여럿이면 게시판 목록이거나 다른 공고가 섞인 것이다. '1차·2차'라고 적힌 경우만 받는다
    if (fresh.length >= 3 || (fresh.length === 2 && !fresh.some(function (r) { return /\d\s*차|회차/.test(r.line); }))) return { state: 'ambiguous' };
    if (fresh.length) return { state: 'found', ranges: fresh.map(function (r) { return { from: r.from, to: r.to, month: !!r.month }; }), line: fresh[0].line };
    var al = use.filter(function (c) { return c.always; })[0];
    return al ? { state: 'always', line: al.line } : null;
  }
  // 이 페이지가 이 사업 이야기인지: 사업 이름의 낱말이 페이지에 있어야 한다 (첫 화면·다른 공고를 거른다)
  var GENERIC = { 청년: 1, 지원: 1, 사업: 1, 운영: 1, 모집: 1, 신청: 1, 안내: 1, 공고: 1, 대상: 1, 육성: 1, 활성화: 1, 추진: 1, 프로그램: 1, 참여자: 1, 지원사업: 1, 하반기: 1, 상반기: 1, 센터: 1, 지원금: 1, 위한: 1 };
  function nameWords(name) {
    return String(name || '').replace(/\d{2,4}\s*년?/g, ' ').split(/[^가-힣A-Za-z0-9]+/).map(function (w) { return w.replace(/(사업|지원|운영|모집|육성|과정|프로그램|분야)$/, ''); })
      .filter(function (w) { return w.length >= 2 && !GENERIC[w]; });
  }
  function aboutPolicy(text, name) {
    // 긴 낱말은 앞 네 글자만 맞아도 같은 말로 본다 ('기상기후분야' ↔ '기상기후전문인력')
    var w = nameWords(name), t = String(text || ''), hit = w.filter(function (x) { return t.indexOf(x) >= 0 || (x.length >= 5 && t.indexOf(x.slice(0, 4)) >= 0); });
    return w.length > 0 && (hit.length >= Math.min(2, w.length) || hit.some(function (x) { return x.length >= 4; }));
  }
  // 공고 페이지 한 곳을 읽은 결과. 사유(why)는 화면에 그대로 보여 준다
  function readNotice(text, it) {
    if (!aboutPolicy(text, it.name)) return { state: 'none', why: 'unrelated' };
    var r = pickNotice(periodsIn(text, it.year), { year: it.year });
    if (!r) return { state: 'none', why: 'notstated' };
    if (r.state === 'stale' || r.state === 'ambiguous') return { state: 'none', why: r.state, line: r.line };
    return r;
  }

  // ---------- 접수 상태 (이용 시점 기준) ----------
  function d8(s) { return s ? new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) : null; }
  function md(d) { return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; }
  function days(a, b) { return Math.round((a - b) / 86400000); }
  // 올해가 아닌 날짜에는 연도를 붙인다 ('4월 22일'만 보이면 올해로 읽힌다)
  function dl(d, today) { return (d.getFullYear() !== today.getFullYear() ? d.getFullYear() + '년 ' : '') + md(d); }
  function endText(d, today, month) { return month ? (d.getFullYear() !== today.getFullYear() ? d.getFullYear() + '년 ' : '') + (d.getMonth() + 1) + '월 말' : dl(d, today); }
  // 확인된 기간(여러 차수일 수 있음)으로 상태를 낸다
  function fromRanges(ranges, today, src) {
    var rs = ranges.map(function (r) { return { from: r.from ? d8(r.from) : null, to: d8(r.to), month: r.month }; }).sort(function (x, y) { return (x.from || x.to) - (y.from || y.to); });
    var now = rs.filter(function (r) { return (!r.from || r.from <= today) && today <= r.to; })[0];
    if (now) { var l = days(now.to, today); return { k: 'open', text: '접수 중 · ' + endText(now.to, today, now.month) + (now.month ? '까지' : ' 마감'), left: l, to: now.to, far: l > 365, long: !!now.from && days(now.to, now.from) > 180, sure: true, src: src }; }
    var next = rs.filter(function (r) { return r.from && r.from > today; })[0];
    if (next) return { k: 'soon', text: dl(next.from, today) + '부터 접수', left: days(next.from, today), to: next.to, sure: true, src: src };
    var last = rs[rs.length - 1];
    return { k: 'ended', text: '접수 끝남 · ' + endText(last.to, today, last.month) + (last.month ? '까지였어요' : ' 마감'), sure: true, src: src };
  }
  // 온통청년 등록 값만으로 낸 상태 (공고 원문과 맞춰 보지 않은 것)
  function regStatus(it, today) {
    var a = it.apply || {}, from = d8(a.from), to = d8(a.to);
    if (a.t === 'period' && from && to) return today < from ? 'soon' : today > to ? 'ended' : 'open';
    return a.t === 'always' ? 'always' : 'none';
  }
  // 등록된 접수 기간이 '자리만 채운 값'으로 보이는지 (11/11 점검: 접수 중으로 계산되던 194건 중 177건)
  function regLoose(it) {
    var a = it.apply || {}, b = it.biz || {};
    if (a.t !== 'period' || !a.from || !a.to) return false;
    return (a.from === b.from && a.to === b.to) || (/0101$/.test(a.from) && /1231$/.test(a.to)) || days(d8(a.to), d8(a.from)) > 180 || (!!it.reg && days(d8(it.reg), d8(a.from)) > 60);
  }
  function regText(it) { var a = it.apply || {}; return a.t === 'period' && a.from && a.to ? a.from.slice(0, 4) + '.' + +a.from.slice(4, 6) + '.' + +a.from.slice(6) + ' ~ ' + a.to.slice(0, 4) + '.' + +a.to.slice(4, 6) + '.' + +a.to.slice(6) : a.t === 'always' ? '상시' : ''; }
  // 접수 상태. 마감일은 공고 원문에서 확인한 것만 말한다(sure: true).
  // it.notice: 서버가 공고 원문을 읽은 결과 { state: 'found'|'always'|'none'|'pending', ranges, line, url, why }
  // 반환: { k: 'open'|'soon'|'always'|'check'|'ended', text, left, to, sure, src: 'notice'|'text'|'reg', pending }
  function statusAt(it, today) {
    var a = it.apply || {}, n = it.notice || {}, bizEnd = d8((it.biz || {}).to), rk = regStatus(it, today);
    if (a.t === 'closed') return { k: 'ended', text: '접수 끝남', sure: true, src: 'reg' };
    if (n.state === 'found') return fromRanges(n.ranges, today, 'notice');
    if (n.state === 'always') return bizEnd && today > bizEnd ? { k: 'ended', text: '사업 기간 끝남', sure: true, src: 'reg' } : { k: 'always', text: '상시 접수', sure: true, src: 'notice' };
    // 여기부터는 공고 원문으로 확인하지 못한 경우. '끝났다'는 근거는 받아들이고, '접수 중'이라고는 말하지 않는다
    if (it.tper && it.tper.state === 'found') { var t = fromRanges(it.tper.ranges, today, 'text'); if (t.k === 'ended') return t; }
    if (rk === 'ended') return { k: 'ended', text: '접수 끝남 · ' + dl(d8(a.to), today) + ' 마감(등록 기준)', sure: true, src: 'reg' };
    if (bizEnd && today > bizEnd) return { k: 'ended', text: '사업 기간 끝남', sure: true, src: 'reg' };
    var pend = n.state === 'pending';
    if (a.t === 'period') return { k: 'check', text: pend ? '접수 기간 확인 중' : '접수 기간 확인 필요', sure: false, src: 'reg', pending: pend };
    return { k: 'always', text: pend ? '접수 기간 확인 중' : '상시 접수로 등록(공고 미확인)', sure: false, src: 'reg', pending: pend };
  }

  // 남은 날 표시. 공고로 확인한 마감만 센다. 1년 넘게 남았거나 반년 넘는 긴 접수면 날짜만 보여 준다.
  function leftText(st) { return !st || !st.sure || st.k !== 'open' || st.far || st.long || !(st.left >= 0) ? '' : st.left ? st.left + '일 남음' : '오늘 마감'; }
  // '마감 빠른 순': 공고로 확인한 접수 중(마감 가까운 순) → 확인한 접수 전 → 상시(확인 → 미확인) → 기간 확인 필요 → 끝남
  function dueRank(st) {
    if (st.k === 'open' && st.sure) return Math.min(Math.max(st.left, 0), 99999);
    if (st.k === 'soon' && st.sure) return 1e6 + Math.min(st.left || 0, 99999);
    return st.k === 'always' ? (st.sure ? 2e6 : 2.5e6) : st.k === 'check' || st.k === 'open' || st.k === 'soon' ? 3e6 : 4e6;
  }

  // ---------- 조건 대조 ----------
  var ASK = {
    mrg: { q: '결혼하셨나요?', o: [['미혼', '미혼이에요'], ['기혼', '기혼이에요']] },
    job: { q: '지금 어떤 일을 하고 있나요?', o: [['미취업자', '일을 쉬고 있어요 (미취업)'], ['재직자', '회사에 다녀요'], ['단기근로자', '알바를 해요 (단기근로)'], ['프리랜서', '프리랜서'], ['자영업자', '자영업'], ['(예비)창업자', '창업 준비·운영'], ['일용근로자', '일용직'], ['영농종사자', '농업']] },
    school: { q: '학력은 어디에 해당하나요?', o: [['대학 재학', '대학 재학 중'], ['대졸 예정', '졸업 예정'], ['대학 졸업', '대학 졸업'], ['고교 졸업', '고교 졸업'], ['석·박사', '대학원'], ['고교 재학', '고교 재학 중'], ['고졸 미만', '고졸 미만']] }
  };
  function inList(list, v) { return list.indexOf(v) >= 0; }
  // '5천만원', '7.5천만원', '7,000만원', '3억원', '8천5백만 원', '1억 3천만원' → 만 원 단위 숫자. 글 안의 위치(i)도 함께 돌려준다
  function amountList(text) {
    var out = [], t = String(text || ''), m, re = /(?:(\d+(?:[.,]\d+)?)\s*억)?\s*(?:(\d+(?:[.,]\d+)?)\s*천)?\s*(?:(\d+(?:[.,]\d+)?)\s*백)?\s*(?:(\d+(?:[.,]\d+)?)\s*(?=만))?(만)?\s*원/g;
    function num(s) { return s ? parseFloat(s.replace(/,/g, '')) : 0; }
    while ((m = re.exec(t))) {
      if (!m[0]) { re.lastIndex++; continue; }
      var small = num(m[2]) * 1000 + num(m[3]) * 100 + num(m[4]);
      // '억'이나 '만'이 없으면(3,077,090원, 200천원) 만 원 단위로 바꾸지 않는다
      if (!(m[1] || (m[5] && small))) continue;
      out.push({ v: Math.round(num(m[1]) * 10000 + small), i: m.index + (m[0].length - m[0].replace(/^\s+/, '').length) });
    }
    return out;
  }
  function amounts(text) { return amountList(text).map(function (a) { return a.v; }); }
  // 글로 적힌 소득 조건을 읽는다. 금액으로 바꿀 수 있는 것만 판정에 쓰고, 나머지는 어디서 확인하는지 알려 준다.
  //  skip: 내용 없이 등록된 칸 / none: 소득과 관계없음 / pct: 기준 중위소득 비율 / year: 연소득 금액 / low: 수급·차상위 / info: 판정 못 함
  function incomeRule(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim(), plain = t.replace(/기준\s*/g, ''), pcts = [], m, re = /중위\s*(?:소득)?\s*(?:의\s*)?(?:(\d{2,3})\s*%?\s*[~∼\-]\s*)?(\d{2,3})\s*%/g;
    if (!t || /^[-–—.·~]+$/.test(t) || /^(미정|없음)$/.test(t)) return { t: 'skip' };
    if (/^(소득\s*)?(무관|제한\s*없|해당\s*없)/.test(t)) return { t: 'none' };
    // 건강보험료로 판정하는 사업은 '중위소득 140%'라고 적혀 있어도 소득 금액이 아니라 보험료 기준표로 따진다
    if (/건강보험료|건보료|건강보험\s*\d분기|과세급여/.test(t)) return { t: 'info', how: '건강보험료로 따지는 사업이에요. 내 보험료는 건강보험공단 누리집·앱 [보험료 조회]에서 보고, 공고에 실린 보험료 기준표와 견줘 보세요.', url: 'https://www.nhis.or.kr', link: '건강보험공단에서 보기' };
    // '100~150%'처럼 범위로 적힌 것도 읽는다
    while ((m = re.exec(plain))) [m[1], m[2]].forEach(function (n) { if (n && pcts.indexOf(+n) < 0) pcts.push(+n); });
    var free = /무관|제한\s*없/.test(t);
    if (pcts.length) {
      pcts.sort(function (a, b) { return a - b; });
      var o = { t: 'pct', lo: pcts[0], hi: pcts[pcts.length - 1], soft: free || /순위|우선/.test(t) };
      if (/원가구|부모/.test(t)) o.parent = true; // 부모님 가구 소득도 함께 보는 사업
      return o;
    }
    if (free && !/\d\s*%/.test(t)) return { t: 'none' };
    if (/연\s*소득|연간\s*소득|총급여|종합소득|부부\s*합산/.test(t)) {
      // 보증금·재산 같은 다른 금액은 소득 기준으로 읽지 않는다
      var list = amountList(t).filter(function (a) { return !/(보증금|재산|자산|거래금액|대출|한도|주택\s*가격|매출액?)[^,.;)]{0,10}$/.test(t.slice(Math.max(0, a.i - 16), a.i)); });
      // 청년·청년 외·신혼부부 금액이 함께 적혀 있으면 청년 금액을 쓴다
      var mine = list.filter(function (a) { return /청년\)?\s*[:：]?\s*(본인\s*)?(연\s*소득\s*)?$/.test(t.slice(Math.max(0, a.i - 14), a.i)); });
      var a = (mine.length ? mine : list).map(function (x) { return x.v; });
      if (a.length) return { t: 'year', lo: Math.min.apply(null, a), hi: Math.max.apply(null, a), soft: /순위|우선/.test(t) };
    }
    if (/수급|차상위/.test(t)) return { t: 'low', strict: t.length <= 40 && !/순위|우선|없으나|등\s*저소득|구간|초과|차등|차별|월\s*평균/.test(t) };
    if (/학자금\s*지원\s*구간|학자금지원|소득\s*분위|\d\s*구간/.test(t)) return { t: 'info', how: '학자금 지원구간은 한국장학재단 누리집·앱의 [학자금 지원구간 조회]에서 볼 수 있어요.', url: 'https://www.kosaf.go.kr', link: '한국장학재단에서 보기' };
    if (/월\s*평균\s*소득/.test(t)) return { t: 'info', how: '도시근로자 가구 월평균소득을 기준으로 하는 사업이에요. 금액은 공고에 실린 소득 기준표에서 확인해요.' };
    return { t: 'info', how: '이 화면에서 따질 수 없는 조건이에요. 공고에서 확인해 주세요.' };
  }
  // 공고 글에서 읽어 낸 주거 조건 (무주택, 보증금·월세 상한). 계약 정보와 견준다.
  function textRules(it) {
    var t = (it.cond || '') + ' ' + (it.support || '') + ' ' + ((it.earn && it.earn.text) || ''), out = {}, m, hre = /무주택[^,.\n]{0,12}/g;
    // '무주택자 우선'처럼 우대로 적힌 것은 필수 조건으로 보지 않는다
    while ((m = hre.exec(t))) if (!/우선|우대|가점/.test(m[0])) out.homeless = true;
    // 상한이 한 가지로 적혀 있을 때만 읽는다. 값이 여럿이거나(전세·월세, 수도권·지방) '폐지'된 요건이면 읽지 않는다
    function cap(re) {
      var vals = [], x;
      while ((x = re.exec(t))) { if (/폐지|삭제|완화/.test(t.slice(x.index, x.index + x[0].length + 14))) continue; var v = amounts(x[1])[0]; if (v && vals.indexOf(v) < 0) vals.push(v); }
      return vals.length === 1 ? vals[0] : 0;
    }
    var d = cap(/보증금\s*([\d.,억천백만 ]{1,16}원)\s*이하/g), r = cap(/월\s*(?:세|임대료|임차료)\s*([\d.,백만 ]{1,10}원)\s*이하/g);
    if (d) out.deposit = d;
    if (r) out.rent = r;
    return out;
  }
  // 대상 조건을 풀어 쓴 말
  var TRAIT = { '중소기업': '중소기업에 다녀요', '여성': '여성이에요', '기초생활수급자': '기초생활수급자예요', '한부모가정': '한부모 가정이에요', '장애인': '장애인 등록이 돼 있어요', '농업인': '농사를 지어요', '군인': '군인이에요 (복무 중·전역 예정)', '지역인재': '이 지역 학교를 다니거나 졸업했어요', '수급·차상위': '기초생활수급자나 차상위계층이에요' };
  // user: { age, region, mrg, job, school, minc(내 월 소득 만원), hh(가구원 수), hinc(가구 월 소득 만원), traits:{이름:true|false}, self:{}, deposit, rent }
  // 반환 조건: { key, label, mine, ok(true|false|null), ask?: 질문 종류, ... }
  function check(it, user, scopeLabel) {
    var out = [], self = user.self || {}, traits = user.traits || {};
    var year = user.minc === undefined || user.minc === null ? null : user.minc * 12;
    var house = !user.hh ? null : user.hh === 1 ? (user.minc === undefined || user.minc === null ? null : user.minc) : (user.hinc === undefined || user.hinc === null ? null : user.hinc);
    function range(v, lo, hi, soft) { return v <= lo ? true : v > hi ? (soft ? null : false) : null; }
    out.push({ key: 'region', label: scopeLabel || '대상 지역', mine: user.region || '', ok: true });
    // 나이: 하한 0, 상한 99 이상은 '제한 없음'으로 등록한 값이다
    var a0 = it.age ? it.age[0] || 0 : 0, a1 = it.age && it.age[1] < 99 ? it.age[1] || 0 : 0;
    if (a0 || a1) {
      var lab = a0 && a1 ? '만 ' + a0 + '~' + a1 + '세' : a0 ? '만 ' + a0 + '세 이상' : '만 ' + a1 + '세 이하';
      out.push({ key: 'age', label: lab, mine: user.age ? '만 ' + user.age + '세' : '', ok: user.age ? (!a0 || user.age >= a0) && (!a1 || user.age <= a1) : null, ask: user.age ? '' : 'age' });
    }
    if (it.mrg) out.push({ key: 'mrg', label: it.mrg, mine: user.mrg || '', ok: user.mrg ? user.mrg === it.mrg : null, ask: user.mrg ? '' : 'mrg' });
    ['job', 'school'].forEach(function (k) {
      var need = it[k]; if (!need) return;
      var only = need.filter(function (x) { return x !== '기타'; }), v = user[k];
      if (!only.length) { out.push({ key: k + ':etc', label: (k === 'job' ? '취업 상태' : '학력') + ' 조건이 따로 있어요', mine: '공고에서 확인', ok: null }); return; }
      out.push({ key: k, label: only.join('·'), mine: v || '', ok: v ? (inList(only, v) ? true : inList(need, '기타') ? null : false) : null, ask: v ? '' : k });
    });
    if (it.sbiz) {
      var only2 = it.sbiz.filter(function (x) { return x !== '기타'; });
      if (only2.length) {
        var yes = only2.filter(function (x) { return traits[x] === true; }), unknown = only2.filter(function (x) { return traits[x] === undefined; });
        out.push({ key: 'traits', label: '대상: ' + only2.join('·'), mine: yes.length ? yes.join('·') : unknown.length ? '' : '해당 없음', ok: yes.length ? true : unknown.length ? null : (inList(it.sbiz, '기타') ? null : false), ask: !yes.length && unknown.length ? 'traits' : '', traits: unknown, all: only2 });
      } else out.push({ key: 'sbiz:etc', label: '특정 대상 조건이 따로 있어요', mine: '공고에서 확인', ok: null });
    }
    if (it.earn && it.earn.t === 'year' && (it.earn.max || it.earn.min)) {
      var e = it.earn, el = '연소득 ' + (e.min ? won(e.min) + ' 초과 ' : '') + (e.max ? won(e.max) + ' 이하' : '');
      out.push({ key: 'earn', label: el.trim(), mine: year === null ? '' : '연 ' + won(year) + ' (월 ' + won(user.minc) + ')', ok: year === null ? null : (!e.max || year <= e.max) && (!e.min || year > e.min), ask: year === null ? 'minc' : '', note: e.max ? '한 달에 약 ' + won(Math.floor(e.max / 12)) + ' 이하로 벌면 돼요.' : '' });
    } else if (it.earn && it.earn.t === 'etc') {
      var ru = incomeRule(it.earn.text), txt = it.earn.text;
      if (ru.t === 'skip') { /* 내용 없이 '-'만 등록된 칸은 조건으로 보여 주지 않는다 */ }
      else if (ru.t === 'none') out.push({ key: 'earn:none', label: '소득 조건 없음', mine: '누구나', ok: true, text: txt });
      else if (ru.t === 'pct') {
        var same = ru.lo === ru.hi, pl = '기준 중위소득 ' + (same ? ru.hi : ru.lo + '~' + ru.hi) + '% 이하';
        var lo = user.hh ? medianMan(user.hh, ru.lo) : 0, hi = user.hh ? medianMan(user.hh, ru.hi) : 0;
        var okp = house === null ? null : range(house, lo, hi, ru.soft), pnote = '';
        if (house !== null && okp === null) pnote = house > hi ? '기준을 넘지만, 소득을 따지지 않는 유형도 있어요. 공고를 확인해 주세요.' : house > lo ? (ru.parent ? '내 가구와 부모님 가구(원가구)에 기준이 따로 있어요(' + ru.lo + '%·' + ru.hi + '%). 어느 쪽이 내 가구 기준인지 공고에서 확인해 주세요.' : '유형에 따라 기준이 달라요(' + ru.lo + '% 또는 ' + ru.hi + '%). 어느 쪽인지 공고에서 확인해 주세요.') : '';
        // 부모님 가구 소득도 보는 사업은 내 소득만으로 '맞음'이라고 하지 않는다
        if (ru.parent && okp === true) { okp = null; pnote = '내 소득은 기준 안이에요. 부모님 가구(원가구) 소득도 함께 보는 사업이라, 그 기준은 공고에서 확인해 주세요.'; }
        out.push({ key: 'earn:pct', label: user.hh ? pl + ' · ' + user.hh + '명 가구 월 ' + (same ? won(hi) : won(lo) + '~' + won(hi)) : pl, mine: house === null ? '' : '월 ' + won(house), ok: okp, ask: house === null ? 'hinc' : '', text: txt, pct: ru, note: pnote });
      } else if (ru.t === 'year') {
        var oky = year === null ? null : range(year, ru.lo, ru.hi, ru.soft), sm = ru.lo === ru.hi;
        out.push({ key: 'earn:year', label: '연소득 ' + (sm ? won(ru.hi) : won(ru.lo) + '~' + won(ru.hi)) + ' 이하', mine: year === null ? '' : '연 ' + won(year) + ' (월 ' + won(user.minc) + ')', ok: oky, ask: year === null ? 'minc' : '', text: txt,
          note: year !== null && oky === null ? '대상에 따라 기준이 달라요. 어느 쪽인지 공고에서 확인해 주세요.' : '한 달에 약 ' + won(Math.floor(ru.lo / 12)) + ' 이하로 벌면 돼요.' });
      } else if (ru.t === 'low') {
        var tv = traits['수급·차상위'];
        out.push({ key: 'earn:low', label: '기초생활수급자·차상위계층 대상', mine: tv === true ? '해당' : tv === false ? '해당 없음' : '', ok: tv === true ? true : tv === false ? (ru.strict ? false : null) : null, ask: tv === undefined ? 'traits' : '', traits: ['수급·차상위'], all: ['수급·차상위'], text: txt,
          note: tv === false && !ru.strict ? '수급·차상위가 아니어도 되는 경우가 있어요. 공고의 대상 순위를 확인해 주세요.' : '' });
      } else out.push({ key: 'earn:info', label: '소득 조건', mine: '공고에서 확인', ok: null, text: txt, note: ru.how, url: ru.url, link: ru.link });
    }
    // 공고 글에서 읽어 낸 조건
    var tr = textRules(it);
    if (tr.homeless) { var hm = self.homeless; out.push({ key: 'homeless', label: '무주택', mine: hm === 'y' ? '집 없음' : hm === 'n' ? '집 있음' : '', ok: hm === 'y' ? true : hm === 'n' ? false : null, ask: hm ? '' : 'homeless', from: 'text' }); }
    // 글에서 읽은 상한은 넘어도 '안 맞음'으로 끊지 않는다. 전세·월세나 지역에 따라 기준이 다르게 적힌 공고가 있다
    var over = '공고 글에서 읽은 상한보다 커요. 전세·월세나 지역에 따라 기준이 다를 수 있으니 공고에서 확인해 주세요.';
    if (tr.deposit && user.deposit !== undefined) out.push({ key: 'cap:deposit', label: '보증금 ' + won(tr.deposit) + ' 이하', mine: won(user.deposit), ok: user.deposit <= tr.deposit ? true : null, note: user.deposit <= tr.deposit ? '' : over, from: 'text' });
    if (tr.rent && user.rent !== undefined) out.push({ key: 'cap:rent', label: '월세 ' + won(tr.rent) + ' 이하', mine: won(user.rent), ok: user.rent <= tr.rent ? true : null, note: user.rent <= tr.rent ? '' : over, from: 'text' });
    return out;
  }
  function verdict(conds) {
    if (conds.some(function (c) { return c.ok === false; })) return 'no';
    return conds.some(function (c) { return c.ok === null; }) ? 'q' : 'ok';
  }
  function won(man) { var e = Math.floor(man / 10000), r = man % 10000; return (e ? e + '억' : '') + (e && r ? ' ' : '') + (r || !e ? r.toLocaleString('ko-KR') + '만' : '') + ' 원'; }
  function medianPct(text) { var m = /중위\s*소득\s*(?:의\s*)?(\d{2,3})\s*%/.exec(String(text || '').replace(/기준\s*/g, '')); return m ? +m[1] : 0; }
  function medianMan(size, pct) { return Math.floor(MEDIAN_2026[size] * (pct || 100) / 100 / 10000); }

  // ---------- 받는 동안 조심할 것 (등록된 조건에서 계산) ----------
  function watch(it, user, scopeLabel) {
    var w = [];
    if (it.scope === 'sgg' || it.scope === 'sido') w.push(['다른 지역으로 주소를 옮기면', '대상 지역(' + scopeLabel.replace(/ 거주$/, '') + ')에서 벗어나요. 신청하고 받는 동안은 주소를 유지하세요.']);
    if (it.age && it.age[1] && it.age[1] < 99 && user.age && it.age[1] - user.age <= 1 && user.age <= it.age[1]) w.push(['만 ' + (it.age[1] + 1) + '세가 되면', '나이 기준을 넘어요. 지금 만 ' + user.age + '세라 신청을 미루지 않는 게 좋아요.']);
    if (it.job && inList(it.job, '미취업자') && !inList(it.job, '재직자')) w.push(['받는 중에 취업하면', '미취업 조건에서 벗어날 수 있어요. 공고의 중도 취업 규정을 확인하세요.']);
    if (it.job && inList(it.job, '재직자') && !inList(it.job, '미취업자')) w.push(['받는 중에 퇴사하면', '재직 조건에서 벗어날 수 있어요. 공고의 중도 퇴사 규정을 확인하세요.']);
    if (it.school && it.school.every(function (s) { return /재학|예정/.test(s); })) w.push(['휴학하거나 졸업하면', '재학 조건에서 벗어날 수 있어요.']);
    if (it.mrg === '미혼') w.push(['혼인신고를 하면', '미혼 조건에서 벗어나요.']);
    if (it.earn && it.earn.t === 'year' && it.earn.max) w.push(['연소득이 ' + won(it.earn.max) + '을 넘으면', '소득 기준에서 벗어나요. 알바·이직으로 소득이 늘 때 확인하세요.']);
    if (it.first) w.push(['선착순이에요', '예산이 떨어지면 접수 기간 안에도 마감될 수 있어요.']);
    return w;
  }

  // ---------- 서류 ----------
  var SRC = [
    [/임대차\s*계약서|전월세\s*계약서|월세\s*계약서/, 'docs', '서류함에서 꺼내기', '#docs'],
    [/주민등록\s*(표\s*)?(등본|초본)|등본|초본/, 'link', '정부24에서 받기', 'https://www.gov.kr'],
    [/가족관계|혼인관계|기본증명/, 'link', '전자가족관계등록시스템에서 받기', 'https://efamily.scourt.go.kr'],
    [/소득금액|소득\s*증명|원천징수|납세|사업자등록/, 'link', '홈택스에서 받기', 'https://www.hometax.go.kr'],
    [/건강보험|자격득실|보험료\s*납부/, 'link', '건강보험공단에서 받기', 'https://www.nhis.or.kr'],
    [/학자금/, 'link', '한국장학재단에서 받기', 'https://www.kosaf.go.kr'],
    [/고용보험|피보험자격/, 'link', '고용24에서 받기', 'https://www.work24.go.kr'],
    [/확정일자|등기사항|등기부/, 'link', '인터넷등기소에서 받기', 'https://www.iros.go.kr'],
    [/이체\s*(확인|내역|증빙)|송금\s*확인|월세\s*납부/, 'bankT', '받는 방법 보기', ''],
    [/통장\s*사본|계좌\s*사본/, 'bankP', '받는 방법 보기', '']
  ];
  var HOW = { 'https://www.gov.kr': '정부24 검색창에 서류 이름(예: 주민등록표 등본)을 넣고 [발급하기]를 눌러요. 본인인증이 필요하고 무료예요.', 'https://efamily.scourt.go.kr': '본인인증 뒤 [증명서 발급]에서 서류를 골라요. 무료예요.', 'https://www.iros.go.kr': '집 주소로 검색해서 열람·발급해요. 수수료가 있어요.' };
  function docSource(name) { for (var i = 0; i < SRC.length; i++) if (SRC[i][0].test(name)) return { t: SRC[i][1], label: SRC[i][2], url: SRC[i][3], how: HOW[SRC[i][3]] || (SRC[i][1] === 'link' ? '로그인 뒤 증명서 발급 메뉴에서 서류 이름을 찾아요.' : '') }; return null; }
  // 괄호 밖의 쉼표에서만 나눈다: '등본(전체공개, 1개월 이내), 통장 사본' → 2개
  function splitTop(line) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (/[(\[（「]/.test(ch)) depth++; else if (/[)\]）」]/.test(ch)) depth = Math.max(0, depth - 1);
      if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }
  // 글로 적힌 제출 서류를 줄 단위로 나눈다. 나눌 수 없으면 한 줄로 둔다.
  function docLines(text) {
    var t = String(text || '').trim(); if (!t || /^(공고문?\s*(참조|참고|확인)|공고\s*확인|해당\s*없음|없음|-|별도\s*문의|개별\s*문의|미정)\.?$/.test(t)) return [];
    var parts = [];
    t.split(/\n+|(?:^|\s)(?:\d{1,2}[.)]|[①-⑳])\s+/).forEach(function (line) {
      line = line.replace(/^[\s○●◦ㆍ·•▪■□◇◆▶▷※*\-–,;:]+|[\s,;]+$/g, '');
      // 머리말 줄(＜…＞, '…하는 경우', '… 서류')은 서류가 아니다
      if (line.length < 2 || /^[<＜\[(].*[>＞\])]$/.test(line) || /(경우|서류|다음과 같음|아래와 같음)\s*:?$/.test(line)) return;
      splitTop(line).forEach(function (x) {
        x = x.replace(/^[\s\-–☞]+|\s+$/g, '');
        // '별도 문의', '누리집 참고', '온라인 접수'처럼 서류가 아닌 안내 문장은 뺀다
        if (x.length > 1 && !(/(참고|참조|문의|바랍니다|바람|접수|확인)\s*[.)]?$/.test(x) && !docSource(x))) parts.push(x);
      });
    });
    return parts.slice(0, 12).map(function (x) { return { name: x.length > 90 ? x.slice(0, 89) + '…' : x, src: docSource(x) }; });
  }

  // 은행별 받는 방법: [이름, 앱, 이체확인증 메뉴, 저장 방법]. 메뉴 이름은 앱 버전에 따라 다를 수 있다 (2026-11-10 정리)
  var BANK = {
    kakao: ['카카오뱅크', '카카오뱅크 앱', '아래 메뉴 [전체] → [이체내역조회]를 눌러요', '상세 화면을 캡처하거나 공유로 저장해요'],
    toss: ['토스뱅크', '토스 앱', '아래 메뉴 [전체] → [고객센터] → [송금확인증]을 눌러요', '[발급하기]를 눌러 PDF로 저장해요'],
    kb: ['KB국민', 'KB스타뱅킹', '[전체메뉴] → [이체/출금] → [이체결과조회(이체확인증)]을 눌러요', '[이체확인증]을 저장해요'],
    sh: ['신한', '신한 SOL뱅크', '[전체메뉴] → [이체] → [이체결과조회]를 눌러요', '[이체확인증]을 저장해요'],
    wr: ['우리', '우리WON뱅킹', '[전체메뉴] → [이체] → [이체결과조회]를 눌러요', '[이체확인증]을 저장해요'],
    hn: ['하나', '하나원큐', '[전체메뉴] → [이체] → [이체결과조회]를 눌러요', '[이체확인서]를 저장해요'],
    nh: ['NH농협', 'NH올원뱅크', '[전체메뉴] → [이체] → [이체결과조회]를 눌러요', '[이체확인증]을 저장해요'],
    etc: ['다른 은행', '은행 앱', '메뉴 검색에 ‘이체결과조회’나 ‘이체확인증’을 입력해요', '확인증을 저장해요. 앱에 없으면 인터넷뱅킹이나 창구에서 받을 수 있어요']
  };
  function bankSteps(type, bank) {
    var k = BANK[bank] || BANK.etc;
    return type === 'bankT' ? [k[1] + '에서 ' + k[2], '월세가 나가는 통장과 기간을 골라요', '집주인에게 보낸 내역을 열어 ' + k[3]]
      : [k[1] + '에서 지원금을 받을 통장을 눌러요', '통장 화면의 [관리]나 [설정]에서 [통장사본]을 눌러요. 안 보이면 메뉴 검색에 ‘통장사본’을 입력해요', '이미지나 PDF로 저장해요'];
  }

  // ---------- 지원 형태 (상세 탭) ----------
  // 이름에 적힌 말을 먼저 보고, 없으면 등록된 '정책 제공 방법'으로 가른다.
  var KINDS = [['cash', '현금·바우처'], ['loan', '대출·보증'], ['home', '집·공간'], ['edu', '교육·프로그램'], ['info', '상담·정보'], ['etc', '기타']];
  function kindOf(it) {
    var n = String(it.name || ''), m = String(it.method || '');
    // 이자·보증료·보험료를 대신 내 주는 사업은 현금성, 돈을 빌려주거나 보증을 서 주는 사업은 대출·보증
    if (/보증료|보험료|이자\s*지원|이차보전/.test(n)) return 'cash';
    if (/대출|융자|모기지|신용보증|보증부/.test(n)) return 'loan';
    if (/월세|임차료|주거비|이사비|중개보수|지원금|수당|장려금|축하금|정착금|바우처|포인트|환급|감면|장학|기본소득|통장|저축|적금/.test(n)) return 'cash';
    if (/보증/.test(n) || /직접대출|대출보증|공적보험/.test(m)) return 'loan';
    if (/임대|행복주택|기숙사|셰어하우스|쉐어하우스|공유주택|사택|보금자리|주택\s*공급|입주|공간|센터|시설|청년마을/.test(n)) return 'home';
    if (/보조금|바우처|조세지출/.test(m)) return 'cash';
    if (/상담|정보|플랫폼|포털|모니터링|홍보|시스템|서포터즈|위원회|협의체|네트워크/.test(n) || /정보제공|인프라 구축|경제적 규제/.test(m)) return 'info';
    if (/교육|아카데미|강좌|캠프|멘토|컨설팅|훈련|인턴|체험|양성|과정|프로그램|클래스|스쿨/.test(n) || /프로그램/.test(m)) return 'edu';
    return 'etc';
  }

  // ---------- 나에게 맞는 순서 ----------
  // 이용자가 넣은 계약·내 정보에서 상황을 짐작해 점수를 매긴다. 판정이 아니라 보여 주는 순서에만 쓴다.
  // ctx: { age, rent, deposit, daysIn(입주 후 일수, 입주 전이면 음수), mrg, job, school, self, lowIncome, sido }
  var FIT = [
    [function (c) { return c.rent > 0; }, /월세|임차료|주거비/, 30, '월세를 내고 있어서'],
    [function (c) { return c.daysIn !== null && c.daysIn <= 90; }, /이사|중개보수|전입|정착|이주/, 25, '최근에 이사해서'],
    [function (c) { return c.deposit > 0; }, /보증금|보증료|전세/, 15, '보증금이 있어서'],
    [function () { return true; }, /1인\s*가구|자취|독립|혼자/, 15, '혼자 사는 청년 대상이라'],
    [function (c) { return /대학 재학|대졸 예정/.test(c.school || ''); }, /대학생|학자금|기숙사|재학생|등록금/, 20, '대학생이라'],
    [function (c) { return c.job === '미취업자'; }, /구직|취업\s*준비|미취업|면접|취업\s*지원/, 20, '구직 중이라'],
    [function (c) { return /재직자|단기근로자|일용근로자/.test(c.job || ''); }, /재직|근로자|직장인|중소기업|노동자/, 15, '일하고 있어서'],
    [function (c) { return c.lowIncome; }, /저소득|중위소득|차상위/, 8, '소득 조건이 맞을 수 있어서']
  ];
  var NOT_ME = /자립준비|보호종료|보호연장|가정위탁|장애|한부모|수급자|북한이탈|다문화|군인|장병|전역|농업|농촌|귀농|귀촌|어업|어촌|창업|소상공인|예술인|전세사기\s*피해|귀환/;
  var FAMILY = /신혼|부부|출산|임신|다자녀|자녀|육아|양육|결혼/;
  function relevance(it, ctx, kind, away) {
    var text = (it.name || '') + ' ' + (it.sum || '') + ' ' + String(it.cond || '').slice(0, 200), head = (it.name || '') + ' ' + (it.sum || '');
    var score = { cash: 40, loan: 18, home: 15, edu: 6, info: 0, etc: 3 }[kind] || 0, why = '';
    // 특정 대상(자립준비청년·신혼부부 등) 사업은 내 상황 키워드가 겹쳐도 올리지 않는다
    var mine = it.sbiz && it.sbiz.some(function (x) { return (ctx.traits || {})[x] === true; });
    var notMe = (!mine && NOT_ME.test(head)) || (ctx.mrg !== '기혼' && FAMILY.test(head));
    if (!notMe) FIT.forEach(function (f) { if (f[0](ctx) && f[1].test(text)) { score += f[2]; if (!why) why = f[3]; } });
    if (it.age && ctx.age && (!it.age[0] || ctx.age >= it.age[0]) && (!it.age[1] || ctx.age <= it.age[1])) score += 10;
    score += away ? -30 : it.scope === 'sgg' ? 20 : it.scope === 'sido' ? 14 : it.central ? 6 : 4;
    if (notMe) score -= 70;
    if (!mine && it.sbiz) score -= 15;
    return { score: score, why: why };
  }

  // 목록 순서: 맞는 것 → 확인 필요 → 안 맞는 것, 그 안에서 마감 임박 → 상시 → 접수 전 → 끝남, 범위가 좁은 것 먼저
  var VR = { ok: 0, q: 1, no: 2 }, SR = { open: 0, always: 1, soon: 2, check: 2, ended: 3 }, CR = { sgg: 0, sido: 1, multi: 2, all: 3 };
  function rank(v, st, it) { return VR[v] * 1e6 + SR[st.k] * 1e5 + (st.k === 'open' && st.sure ? Math.min(st.left, 999) * 10 : 0) + CR[it.scope]; }

  return { CATS: CATS, CODE: CODE, ASK: ASK, BANK: BANK, MEDIAN_2026: MEDIAN_2026, normalize: normalize, scopeOf: scopeOf, ownerOf: ownerOf, forRegion: forRegion, statusAt: statusAt, regLoose: regLoose, regStatus: regStatus, regText: regText, isDeep: isDeep, htmlText: htmlText, periodsIn: periodsIn, pickNotice: pickNotice, aboutPolicy: aboutPolicy, readNotice: readNotice, leftText: leftText, dueRank: dueRank, check: check, verdict: verdict, watch: watch,
    docLines: docLines, docSource: docSource, bankSteps: bankSteps, rank: rank, KINDS: KINDS, kindOf: kindOf, relevance: relevance, amounts: amounts, amountList: amountList, incomeRule: incomeRule, textRules: textRules, TRAIT: TRAIT, won: won, medianPct: medianPct, medianMan: medianMan, clip: clip };
});
