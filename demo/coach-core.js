/* 자취 계약 내비 · 내장 AI 자취 코치 (외부 API 없이 이 기기 안에서 동작, UMD)
 *
 * prompts/coach.md(시스템 프롬프트)의 규칙을 그대로 따르는 엔진이다.
 *   1. 지키기   — 지시 무시 요청·개인 정보·법률 판단·범위 밖 질문을 먼저 거른다
 *   2. 이해하기 — 질문을 낱말로 나누고 앞 대화의 주제를 이어 받는다 (그럼 어디서 해? 같은 되묻기)
 *   3. 찾기     — 운영자가 승인한 지식 카드·승인 공고에서 질문과 맞는 것만 고른다
 *   4. 맞추기   — 카드 문장 중 질문에 맞는 문장을 고르고, 내 계약 날짜·금액을 넣는다
 *   5. 답하기   — 결론 먼저, 내 날짜, 할 일, 근거 순서. 카드에 없으면 답하지 않는다
 * 카드에 없는 사실·숫자는 만들지 않는다. 숫자는 카드 문장이나 내 계약 계산값에서만 나온다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules-core.js'));
  else root.JachwiCoach = factory(root.JachwiRules);
})(typeof self !== 'undefined' ? self : this, function (J) {
  'use strict';

  var REFUSE = '승인된 안내에서 답을 찾지 못했어요. 틀린 답을 드리지 않으려고 여기서 멈출게요.';
  var SCOPE = '저는 자취 계약 뒤에 챙길 일(신고·보증금·지원금·생활비·집 문제·퇴거)을 도와드려요. 이 범위 안에서 물어봐 주세요.';
  var GUARD = '그 요청은 도와드릴 수 없어요. 저는 운영자가 승인한 자취 안내 안에서만 답해요. 계약·신고·지원금에 대해 물어봐 주세요.';
  var POPULAR = ['전입신고는 언제 해야 해?', '전월세 신고는 언제, 어디서 해?', '보증금 지키려면 뭘 해야 해?', '받을 수 있는 지원금 있어?'];

  // ---------- 1. 지키기 ----------
  var P_INJECT = /(이전|위의?|앞의?)\s*(지시|규칙|명령).*(무시|잊어)|무시하고|시스템\s*프롬프트|system\s*prompt|ignore (all|previous)|너는 이제|역할을 바꿔|개발자 모드|jailbreak|프롬프트를? (보여|알려|출력)/i;
  var P_PII = /\d{6}\s*-\s*[1-4]\d{6}|01[016789][\s-]?\d{3,4}[\s-]?\d{4}|\d{3,6}-\d{2,6}-\d{3,8}/;
  var P_LEGAL = /고소|소송|이길 수|승소|처벌|법적으로 (가능|문제)|불법이야|위법/;
  var P_CRISIS = /사기|안\s*돌려|못\s*돌려|안\s*줘|안\s*준대|경매|쫓겨|나가래|연락(이|도)?\s*안|잠수|압류/;
  var P_HOUSING = /룸메|같이\s*살|동거|기숙사|하숙|해지|중도|계약서|체크리스트|준비물|방|월세|전세|보증금|계약|임대|임차|집주인|세입자|이사|입주|퇴거|신고|전입|확정일자|등기|관리비|공과금|가스|전기|수도|인터넷|지원|청년|주거|중개|부동산|복비|수리|곰팡이|누수|보일러|대출|이자|세액공제|연말정산|자취|원룸|오피스텔|고시원|셰어/;
  var P_VAGUE = /^(어떻게|뭐|무엇|도와|알려|궁금|질문|이거|저기|음+|안녕)[\s?!.]*(해|해요|줘|줘요|돼|있어|하지)?[\s?!.]*$/;
  var P_FOLLOW = /^(그럼|그러면|그건|그거|그때|거기|그|근데|아 그럼|그리고|또)\b|^(언제|어디|얼마|왜|어떻게|뭐|무슨)|(그건|그거|그럼)\s/;

  // 질문 의도별로 카드 문장 중 무엇을 고를지 (언제·어디서·얼마·무엇이 필요한지)
  var INTENT = [
    [/언제|기한|며칠|까지|마감|날짜/, /\d+\s*일|기한|까지|전에|당일|0시|개월/],
    [/어디|어떻게|방법|온라인|신청/, /정부24|행정복지센터|온라인|센터|시스템|앱|포털|등기소|신청|방문/],
    [/얼마|금액|비용|돈|요율|퍼센트|%/, /원|%|만\s?원|요율|한도/],
    [/서류|준비물|뭐 가져|필요해|챙겨/, /서류|신분증|계약서|등본|내역|영수증/],
    [/왜|이유|꼭/, /힘|순서|효력|과태료|안전|근거|해지/],
    [/안\s*하면|안하면|안\s*해도|어기면|늦으면|넘기면|놓치면|못\s*하면/, /과태료|불이익|해지|효력|사라|늦게|넘기면/, 6]
  ];

  // ---------- 2·3. 이해하기·찾기 ----------
  // 문장 나누기 (0.5% 같은 소수점에서는 나누지 않음)
  function sentences(body) { return String(body).split(/(?<=[.!?。])\s+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function score(text, qg) { var g = J.grams(text), s = 0; Object.keys(qg).forEach(function (k) { if (g[k]) s += k.charAt(0) === 'w' ? 1.5 : 0.5; }); return s; }
  function pickSentences(card, q, max, intentQ) {
    if (card.whole) return sentences(card.body); // 문장이 서로 이어지는 안내는 통째로
    var ss = sentences(card.body), qg = J.grams(q), want = INTENT.filter(function (it) { return it[0].test(intentQ || q); });
    var scored = ss.map(function (s, i) {
      var v = score(s, qg) + (i === 0 ? 2.5 : 0);
      want.forEach(function (it) { if (it[1].test(s)) v += it[2] || 4; });
      return { s: s, i: i, v: v };
    });
    if (want.length > 1) max = Math.min(3, (max || 2) + want.length - 1);
    var top = scored.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, max || 2);
    if (!top.some(function (x) { return x.i === 0; }) && !want.length) top[top.length - 1] = scored[0]; // 의도가 없으면 핵심(첫) 문장은 꼭
    top.sort(function (a, b) { return a.i - b.i; });
    // "세 가지를 챙기세요"처럼 목록을 여는 문장이면 뒤따르는 문장을 함께
    var opener = top.filter(function (x) { return /(두|세|네) 가지|다음과 같/.test(x.s); })[0];
    if (opener) {
      var n = /두 가지/.test(opener.s) ? 2 : /세 가지/.test(opener.s) ? 3 : /네 가지/.test(opener.s) ? 4 : 3, best = scored.slice().sort(function (a, b) { return b.v - a.v; })[0];
      top = scored.slice(opener.i, opener.i + n + 1);
      if (best && top.indexOf(best) < 0 && best.v >= 4) top.push(best); // 질문이 콕 집은 문장이 목록 밖이면 덧붙임
    }
    return top.map(function (x) { return x.s; });
  }

  // ---------- 4. 맞추기: 내 계약 값으로 한 줄 ----------
  // 받침에 맞는 조사: josa('지원', '은는') → '지원은'
  function josa(w, pair) {
    var t = String(w).replace(/[\s)\]*.·]+$/, ''), ch = t.charCodeAt(t.length - 1), has;
    if (ch >= 0xAC00 && ch <= 0xD7A3) has = (ch - 0xAC00) % 28 !== 0; else has = /[013678LMNR]$/i.test(t);
    if (pair === '으로') return w + (has && (ch - 0xAC00) % 28 !== 8 ? '으로' : '로');
    if (pair === '이에요') return w + (has ? '이에요' : '예요');
    return w + (has ? pair.charAt(0) : pair.charAt(1));
  }
  function won(n) { return Math.round(n).toLocaleString('ko-KR'); }
  var PERSONAL = {
    'k-movein': function (f) {
      if (!f.moveinDue) return '';
      if (f.moveinDone) return '내 할 일 목록에는 전입신고를 이미 했다고 표시돼 있어요.';
      if (f.today > f.moveinDue) return '내 계약 기준 법정 기한(' + f.moveinDue + ')이 지났어요. **오늘 바로** 신고하세요.' + (f.reportRequired && !f.reportDone ? ' 전월세 신고도 아직이면 전입신고할 때 계약서를 같이 내서 한 번에 하세요.' : '');
      return '내 입주일이 ' + f.move + '이라 법정 기한은 **' + f.moveinDue + '**까지예요. 가장 안전한 날은 입주 당일(' + f.move + ')이에요.' + (f.reportRequired && !f.reportDone && !f.reportEarly ? ' 전월세 신고 대상이라, 전입신고할 때 계약서를 같이 내면 두 신고가 한 번에 끝나요.' : '');
    },
    'k-report': function (f) {
      if (f.reportRequired === undefined) return '';
      if (!f.reportRequired) return '내 계약은 ' + f.reportReason + '라 전월세 신고 대상이 아니에요. 확정일자는 따로 받아 두세요.';
      if (f.reportDone) return '내 할 일 목록에는 전월세 신고를 이미 했다고 표시돼 있어요.';
      if (f.today > f.reportDue) return '내 계약의 신고 기한(' + f.reportDue + ')이 지났어요. **지금 바로** 신고하세요.';
      if (f.reportEarly) return '내 계약은 신고 대상이고 기한이 **' + f.reportDue + '**로 입주보다 먼저 와요. 전입신고와 합치지 말고 따로 신고하세요.';
      return '내 계약은 ' + f.reportReason + '라 신고 대상이고, 기한은 **' + f.reportDue + '**까지예요. 입주 날 전입신고하면서 계약서를 같이 내면 한 번에 끝나요.';
    },
    'k-fixed': function (f) { return f.reportRequired === undefined ? '' : f.reportRequired ? '내 계약은 전월세 신고 대상이라, 신고가 접수되면 확정일자도 같이 받아요.' : '내 계약은 전월세 신고 대상이 아니라서 확정일자를 따로 받아야 해요.'; },
    'k-broker': function (f) { return f.brokerCap ? '지금 조건(보증금 ' + won(f.deposit) + '만·월세 ' + won(f.rent) + '만)이면 거래 금액은 약 ' + won(f.brokerBase / 10000) + '만 원, 중개보수 **상한은 약 ' + won(f.brokerCap) + '원**(부가세 별도)이에요.' : ''; },
    'k-moveout': function (f) { return f.end ? '내 계약은 ' + f.end + '에 끝나요. 나갈 거라면 **' + f.noticeBy + '**까지 집주인에게 알리세요.' : ''; },
    'k-raise': function (f, q) {
      if (/보증금/.test(q || '') && f.deposit) return '지금 보증금이 ' + won(f.deposit) + '만 원이라 한 번에 올릴 수 있는 건 최대 약 **' + won(f.deposit * 500) + '원**(' + won(f.deposit * 0.05) + '만 원)이에요.';
      return f.rent ? '지금 월세가 ' + won(f.rent) + '만 원이라 한 번에 올릴 수 있는 건 최대 약 **' + won(f.rent * 500) + '원**이에요.' : '';
    },
    'k-late': function (f) { return f.rent ? '지금 월세 기준으로 두 달 치는 약 ' + won(f.rent * 2) + '만 원이에요.' : ''; },
    'k-fee': function (f) { return f.fee ? '내 계약에는 관리비가 ' + won(f.fee) + '만 원으로 적혀 있어요.' : ''; },
    'k-support': function (f) { return progLine(f); }
  };
  function progLine(f) {
    var ps = f.programList || [];
    if (!ps.length) return '';
    var ok = ps.filter(function (p) { return p.verdict === '해당 가능' || p.verdict === '확인 필요'; });
    var why = function (p) { return p.fails && p.fails.length ? ' — ' + p.fails[0] + ' 조건에 맞지 않아요' : ''; };
    if (!ok.length) return '지금 입력한 조건으로는 해당되는 지원이 없어요.\n' + ps.map(function (p) { return '· ' + p.name + ': ' + p.verdict + why(p); }).join('\n');
    var no = ps.filter(function (p) { return ok.indexOf(p) < 0; });
    return '지금 조건으로는 ' + ok.map(function (p) { return '**' + p.name + '**(' + p.verdict + (p.amountText ? ' · ' + p.amountText : '') + (p.status ? ' · ' + p.status : '') + ')'; }).join(', ') + josa(ok[ok.length - 1].name, '을를').slice(-1) + ' 신청해 볼 수 있어요. 금액은 공고마다 따로 보고, 합쳐서 받는다고 생각하지 마세요.' + (no.length ? '\n' + no.map(function (p) { return '· ' + p.name + ': ' + p.verdict + why(p); }).join('\n') : '');
  }
  function noticePersonal(card, f) {
    var p = (f.programList || []).filter(function (x) { return 'notice-' + x.id === card.id; })[0];
    if (!p) return '';
    var bad = p.verdict === '해당 안 됨' || p.verdict === '마감';
    return '내 조건으로는 **' + p.verdict + '**' + josa(p.verdict, '이에요').slice(p.verdict.length) + (p.status ? '(' + p.status + (p.period ? ' · ' + p.period : '') + ')' : '') + '.' +
      (bad && p.fails && p.fails.length ? ' ' + p.fails.join(', ') + ' 조건에 맞지 않아요.' : '') + (!bad && p.unknown && p.unknown.length ? ' ' + josa(p.unknown.join(', '), '은는') + ' 서류로 확인해야 해요.' : '');
  }
  // 공고 카드는 질문에 맞춰 필요한 부분만
  function noticeAnswer(card, q, f) {
    var p = (f.programList || []).filter(function (x) { return 'notice-' + x.id === card.id; })[0] || {};
    var parts = [];
    var T = josa(card.title, '은는');
    if (/서류|준비|필요/.test(q) && p.docs) parts.push(card.title + ' 제출 서류는 ' + josa(p.docs.join(', '), '이에요') + '.');
    else if (/얼마|금액|받을 수 있는 돈/.test(q) && p.amountText) parts.push(T + ' ' + josa(p.amountText, '이에요') + '.');
    else if (/언제|기간|마감|접수/.test(q)) parts.push(T + ' ' + (p.period ? p.period + ' 접수예요' : '지금 ' + josa(p.status || '다음 공고 대기', '이에요')) + (p.firstCome ? '. 선착순이라 일찍 마감될 수 있어요' : '') + '.');
    else if (/어디|어떻게|신청/.test(q) && p.channel) parts.push(T + ' ' + josa(p.channel, '으로') + ' 신청해요.');
    else parts.push(T + ' ' + josa((p.amountText || '') + (p.select ? ', ' + p.select : ''), '이에요') + '.');
    if (p.exclusions && p.exclusions.length && /같이|함께|중복|둘 다/.test(q)) parts.push('함께 받을 수 없는 지원: ' + p.exclusions.join(', ') + '.');
    var me = noticePersonal(card, f), bad = p.verdict === '해당 안 됨' || p.verdict === '마감';
    // "받을 수 있어?"처럼 내 자격을 물으면 판정을 맨 앞에
    if (me && /받을\s*수|돼\?|되나|되냐|가능|해당/.test(q)) { parts[0] = parts[0].replace(T, '지원 내용은'); parts.unshift(me.replace('내 조건으로는', josa(card.title, '은는') + ' 내 조건으로')); } else if (me) parts.push(me);
    if (!bad) parts.push('최종 선정은 기관 심사로 정해져요.');
    return parts;
  }

  // ---------- 모르는 주제 거르기 ----------
  // 질문의 핵심 낱말이 어느 승인 안내에도 없고, 카드와는 흔한 낱말('신고' 등)로만 이어지면 엉뚱한 카드로 답하지 않는다.
  var GENERIC = ['신고', '지원', '신청', '집', '계약', '월세', '보증금', '전세', '주소', '등록', '수수료', '서류'];
  var FUNC = /^(계약|집|방|집주인|세입자|임대인|임차인|어제|그제|아직|이미|계속|처음|며칠|일주일|한달|그냥|일단|혹시나|문제|걱정|불안|잠|생각|경우|상황|방법|부분|내용|정도|때문|이유|사람|아이|애|딸|아들|부모|부모님|엄마|아빠|자녀|자식|학생|대학생|직장인|저희|우리|제|저는|자취방|원룸|이사|자취|이번달|다음달|이달|요즘|진짜|너무|혹시|정말|제가|저|우리|언제|어디|어디서|얼마|얼마나|뭐|뭘|무엇|왜|어떻게|해|돼|되나|해야|해야돼|하나|할|할때|때|같이|있어|있나|없어|알려줘|알려|꼭|좀|나|내|이번|오늘|지금|그럼|그거|그건|해요|돼요|되요|하면|해도|되는|되면|뭐야|뭐임|있을까|가능해|가능)$/;
  // 명사로 보이는 낱말만: 조사를 떼고, 동사·형용사 꼴(해야돼, 밀리면, 싶어…)은 뺀다
  var JOSA = /(에서|으로|이랑|하고|까지|부터|에게|한테|은|는|이|가|을|를|에|의|도|로|랑|와|과|만)$/;
  var VERBY = /(요|야|해|돼|됨|함|임|지|까|면|게|어|아|래|니|나|냐|든|데|거|건|던|을|려|러|며|죠|네|군|다|란|싶|같|된|한|할|될|봐|줘|워|켜|쳐|져|겨|셔|켰|했|됐|낼|갈|올|살|줄|볼)$/;
  var VERB2 = /(아서|어서|해서|와서|워서|여서|돼서|되서|가서|봐서|려고|면서|는데|니까|다고|라고|대요|래요|나고|되고|지고|있고|없고|않고|받고|살고|내고|오고|가고)$|^(걱정|불안|무서|막막|답답)/;
  function contentWords(q) {
    return String(q).replace(/[^0-9a-zA-Z가-힣\s]/g, ' ').split(/\s+/).map(function (w) { return w.replace(JOSA, ''); })
      .filter(function (w) { return w.length >= 2 && !FUNC.test(w) && !/^\d+$/.test(w) && !VERBY.test(w) && !VERB2.test(w); });
  }
  function unknownTopic(q, card, corpus) {
    var kws = []; (card.keywords || []).forEach(function (k) { kws.push(k.replace(/\s+/g, '')); });
    var inflected = function (w) { return kws.some(function (k) { return k.length >= 2 && w.indexOf(k) === 0 && w.length - k.length <= 2 && /^[대래데요야어다냐니네지까서고면]+$/.test(w.slice(k.length)); }); };
    var flat = corpus.replace(/\s+/g, ''), words = contentWords(q), unknown = words.filter(function (w) { return corpus.indexOf(w) < 0 && flat.indexOf(w) < 0 && !inflected(w); });
    if (!unknown.length) return null;
    var ql = q.toLowerCase().replace(/\s+/g, ''), matched = (card.keywords || []).filter(function (w) { return w && ql.indexOf(w.toLowerCase().replace(/\s+/g, '')) >= 0; });
    var weak = matched.every(function (w) { return GENERIC.indexOf(w) >= 0 || unknown.some(function (u) { return u.indexOf(w) >= 0 && u !== w; }); });
    var mostly = unknown.length >= 2 && unknown.length / words.length >= 0.5;
    return weak || mostly ? unknown : null;
  }
  // ---------- 오늘·이번 주 할 일 (내 타임라인) ----------
  var P_TODO = /(오늘|이번\s*주|지금|당장|요즘|내일|이번\s*달).{0,8}(뭐|할\s*일|해야|챙겨)|할\s*일\s*(알려|뭐|있)|뭐부터/;
  function todoAnswer(f) {
    var ts = (f.tasks || []).slice(0, 4);
    if (!ts.length && f.move) {
      // 할 일 목록이 비었으면 내 날짜로 큰 순서를 알려 줌 (처음 자취하는 사람)
      var L = [];
      if (f.today <= f.move) L.push('입주 전: 잔금 보내기 직전에 등기부등본을 다시 떼어 새 근저당·압류가 없는지 봐요');
      L.push('입주 당일(' + f.move + '): 전입신고와 확정일자 — 법정 기한은 ' + f.moveinDue + '까지예요');
      if (f.reportRequired) L.push(f.reportEarly ? '전월세 신고: 기한 **' + f.reportDue + '**가 입주보다 먼저라 따로 신고해요' : '전월세 신고: ' + f.reportDue + '까지 (전입신고 때 계약서를 같이 내면 한 번에 끝나요)');
      L.push('입주 후: 짐 넣기 전에 집 상태 사진을 찍어 집주인에게 보내고, 공과금·관리비 항목을 정리해요');
      return { kind: 'answer', text: '처음이라면 이 순서로 챙기면 돼요.\n' + L.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'), topic: ['todo'], cites: [{ id: 'todo', title: '내 타임라인', src: [['타임라인', '#timeline']] }], chips: ['전입신고는 어디서 해?', '보증금 지키려면 뭘 해야 해?'], steps: ['할 일 목록이 비어 내 날짜로 큰 순서를 정리'] };
    }
    if (!ts.length) return { kind: 'answer', text: '지금 기한이 다가온 할 일은 없어요. 타임라인에서 다음 단계를 확인해 보세요.', topic: ['todo'], cites: [{ id: 'todo', title: '내 타임라인', src: [['타임라인', '#timeline']] }], chips: ['전입신고는 언제 해?', '받을 수 있는 지원금 있어?'], steps: ['내 타임라인에서 기한이 다가온 할 일 확인'] };
    var first = ts[0];
    var lines = ts.map(function (t) { return '· ' + (t.urgent ? '**' + t.title + '**' : t.title) + ' — ' + (t.due === f.today ? '오늘' : t.due + '까지') + (t.stage ? ' (' + t.stage + ')' : ''); });
    return { kind: 'answer', text: '지금 챙길 일은 ' + ts.length + '가지예요. 가장 먼저 할 일은 ‘' + first.title + '’' + josa(first.title, '이에요').slice(first.title.length) + '.\n' + lines.join('\n') + '\n\n다 하면 타임라인에서 체크해 두세요. 다음 할 일을 알려드릴게요.', topic: ['todo'], cites: [{ id: 'todo', title: '내 타임라인', src: [['타임라인', '#timeline']] }], chips: ['전입신고는 어디서 해?', '잔금 보내기 전에 뭘 확인해?'], steps: ['질문 이해: 지금 할 일', '내 타임라인에서 기한이 가까운 할 일 ' + ts.length + '개 찾음', '급한 일 먼저 정리'] };
  }

  // ---------- 단계별 체크리스트 (내 타임라인) ----------
  var STAGE_Q = [[/계약\s*전|집\s*보러|계약하기\s*전/, 'pre'], [/계약\s*(당일|날)|계약할\s*때/, 'cday'], [/전날|입주\s*전|이사\s*전|준비물|입주\s*준비|이사\s*준비/, 'prep'], [/입주\s*(당일|날)|이사\s*(당일|날)|이삿날/, 'mday'], [/신고|정리/, 'report'], [/퇴거|나가기\s*전|이사\s*나가|만료/, 'out']];
  var P_LIST = /체크\s*리스트|할\s*일|해야\s*할\s*(것|거|일)|챙길\s*(것|거)|준비물|뭐\s*챙겨|목록/;
  function stageAnswer(q, f) {
    if (!f.stages || !P_LIST.test(q)) return null;
    var hit = STAGE_Q.filter(function (x) { return x[0].test(q); })[0]; if (!hit) return null;
    var st = f.stages.filter(function (x) { return x.key === hit[1]; })[0]; if (!st || !st.tasks.length) return null;
    var left = st.tasks.filter(function (t) { return !t.done; });
    return { kind: 'answer', text: '**' + st.name + '**(' + st.when + ')에 할 일은 ' + st.tasks.length + '가지예요' + (left.length < st.tasks.length ? '. 그중 ' + (st.tasks.length - left.length) + '개는 이미 했어요' : '') + '.\n' + st.tasks.map(function (t) { return (t.done ? '✓ ' : '· ') + (t.urgent && !t.done ? '**' + t.title + '**' : t.title); }).join('\n') + '\n\n하나씩 끝내면 타임라인에서 체크해 두세요.',
      topic: ['todo'], cites: [{ id: 'todo', title: '내 타임라인', src: [['타임라인', '#timeline']] }], chips: ['오늘 뭐 해야 돼?', '전입신고 언제 해야 해?'], steps: ['질문 이해: ' + st.name + ' 체크리스트', '내 타임라인에서 ' + st.name + ' 단계 할 일 ' + st.tasks.length + '개 가져옴'] };
  }

  // ---------- 5. 답하기 ----------
  /* opts: { q, history: [{ q, topic: [cardId] }], cards, facts, programs } → 답 */
  function answer(opts) {
    var q = String(opts.q || '').replace(/\s+/g, ' ').trim(), f = opts.facts || {}, cards = opts.cards || [], hist = opts.history || [];
    var steps = [], pre = [];
    if (!q) return { kind: 'clarify', text: '궁금한 걸 적어 주세요.', chips: POPULAR, cites: [], topic: [], steps: steps };
    var sa = stageAnswer(q, f); if (sa) return sa;
    if (P_TODO.test(q) || /처음인데|처음이라|뭐부터/.test(q)) return todoAnswer(f);
    if (P_INJECT.test(q)) return { kind: 'guard', text: GUARD, chips: POPULAR, cites: [], topic: [], steps: ['요청 확인: 규칙을 바꾸려는 요청이라 따르지 않음'] };
    if (P_PII.test(q)) pre.push('주민등록번호·전화번호·계좌번호 같은 개인 정보는 적지 않아도 돼요. 아래는 그 부분을 빼고 답할게요.');

    // 앞 대화에 이어지는 짧은 질문이면 주제를 이어 받는다
    var last = hist.length ? hist[hist.length - 1] : null, ctxQ = q, followed = false;
    var hits = J.retrieve(q, cards, 6);
    if (last && last.topic && last.topic.length && (P_FOLLOW.test(q) || (q.length <= 12 && P_HOUSING.test(q))) && (!hits.length || hits[0].score < 6)) {
      ctxQ = (last.q || '') + ' ' + q; followed = true;
      var prev = cards.filter(function (c) { return last.topic.indexOf(c.id) >= 0; });
      hits = J.retrieve(ctxQ, cards, 6);
      prev.forEach(function (c) { if (!hits.some(function (h) { return h.card.id === c.id; })) hits.unshift({ card: c, score: 6 }); else hits.forEach(function (h) { if (h.card.id === c.id) h.score += 4; }); });
      hits.sort(function (a, b) { return b.score - a.score; });
    }
    steps.push('질문 이해' + (followed ? ' (앞 대화 “' + last.q + '”에 이어서)' : ''));
    if (P_LEGAL.test(q)) {
      pre.push('개별 다툼이 어떻게 될지는 판단해 드릴 수 없어요. 대신 도움받을 수 있는 곳을 알려드릴게요.');
      var d = cards.filter(function (c) { return c.id === 'k-dispute'; })[0];
      if (d && !hits.some(function (h) { return h.card.id === d.id; })) hits.unshift({ card: d, score: 99 });
    }
    if (!hits.length) {
      if (P_VAGUE.test(q) && !pre.length) return { kind: 'clarify', text: '어떤 게 궁금한지 조금만 더 알려 주세요. 예를 들면 이런 걸 물어볼 수 있어요.', chips: POPULAR, cites: [], topic: [], steps: steps };
      if (!P_HOUSING.test(q) && !pre.length) return { kind: 'scope', text: SCOPE, chips: POPULAR, cites: [], topic: [], steps: steps.concat(['승인된 안내와 관련 없는 질문']) };
      if (q.length <= 6) return { kind: 'clarify', text: '어떤 게 궁금한지 조금만 더 알려 주세요. 예를 들면 이런 걸 물어볼 수 있어요.', chips: POPULAR, cites: [], topic: [], steps: steps };
      return { kind: 'refuse', text: (pre.length ? pre.join(' ') + '\n\n' : '') + REFUSE, chips: POPULAR, cites: [], topic: [], steps: steps.concat(['승인된 안내에서 맞는 내용을 찾지 못함']) };
    }
    // 사업 이름을 콕 집으면 그 공고를 먼저
    var named = hits.filter(function (h) { return h.card.kind === 'notice' && h.card.title.split(/[\s·]+/).some(function (w) { return w.length >= 3 && !/^(서울시|지원|청년)$/.test(w) && q.indexOf(w.replace(/지원$/, '')) >= 0; }); })[0];
    if (named && named !== hits[0]) { hits.splice(hits.indexOf(named), 1); hits.unshift(named); }
    // 승인 안내에 없는 주제를 흔한 낱말로 엮어 답하지 않기
    var corpus = cards.map(function (c) { return c.title + ' ' + (c.keywords || []).join(' ') + ' ' + c.body; }).join(' ');
    var unk = !followed && !P_LEGAL.test(q) ? unknownTopic(q, hits[0].card, corpus) : null;
    if (unk) return { kind: 'refuse', text: (pre.length ? pre.join(' ') + '\n\n' : '') + REFUSE, chips: POPULAR, cites: [], topic: [], steps: steps.concat(['‘' + unk.join(', ') + '’에 대한 승인된 안내가 없어 답하지 않음']) };
    var crisis = P_CRISIS.test(q), worry = /걱정|불안|무서|잠이\s*안|어떡해|어떻게\s*해요|큰일|막막/.test(q);
    if (crisis) pre.unshift('많이 불안하시겠어요. 지금 할 수 있는 것부터 알려드릴게요.');
    else if (worry) pre.unshift('걱정되셨겠어요. 지금 할 수 있는 것부터 알려드릴게요.');

    // 가장 맞는 카드 하나 + 점수가 비슷한 카드 하나까지. 지원 원칙 카드와 공고 카드는 섞지 않음(판정이 겹침)
    var top = hits[0], use = [top.card];
    var isSup = function (c) { return c.id === 'k-support' || c.kind === 'notice'; };
    var kwHit = function (c) { return (c.keywords || []).some(function (w) { return w && ctxQ.indexOf(w) >= 0; }); };
    // 위급한 상황이면 가장 맞는 안내 하나를 더 자세히
    // "A랑 B 둘 다"처럼 두 가지를 같이 물으면, 각각 이름이 불린 카드를 함께
    var compound = /(랑|이랑|하고|와|과|및|그리고|,)\s|둘\s*다|각각/.test(q);
    if (!crisis) hits.slice(1).forEach(function (h) { if (use.length < 2 && (h.score >= Math.max(4, top.score * 0.75) || (compound && h.score >= 4)) && kwHit(h.card) && !(isSup(top.card) && isSup(h.card))) use.push(h.card); });
    steps.push('승인된 안내 ' + hits.length + '개 중 ' + use.map(function (c) { return '‘' + c.title + '’'; }).join(', ') + ' 사용');

    var paras = [], mine = [];
    use.forEach(function (c, i) {
      if (c.kind === 'notice') { paras.push(noticeAnswer(c, q, f).join(' ')); return; }
      if (c.id === 'k-support' && (f.programList || []).length) { paras.push(sentences(c.body)[0]); mine.push(progLine(f)); return; }
      var ss = pickSentences(c, ctxQ, crisis ? 3 : i === 0 ? 2 : 1, q);
      paras.push(ss.join(' '));
      var pf = PERSONAL[c.id]; var me = pf ? pf(f, q) : '';
      if (me) mine.push(me);
    });
    if (mine.length) steps.push('내 계약 날짜·금액 반영');
    // 고른 안내에 없는 낱말이 질문에 있으면: 2개 이상은 멈추고, 1개는 그 부분이 안내에 없다고 밝힘
    if (!followed && !crisis && !P_LEGAL.test(q) && top.card.kind !== 'notice') {
      var useText = use.map(function (c) { return c.title + ' ' + (c.keywords || []).join(' ') + ' ' + c.body; }).join(' '), useFlat = useText.replace(/\s+/g, '');
      var ukw = []; use.forEach(function (c) { (c.keywords || []).forEach(function (k) { ukw.push(k.replace(/\s+/g, '')); }); });
      var missing = contentWords(q).filter(function (w) { return useText.indexOf(w) < 0 && useFlat.indexOf(w) < 0 && !ukw.some(function (k) { return k.length >= 2 && w.indexOf(k) === 0 && w.length - k.length <= 2; }); });
      if (missing.length >= 2) return { kind: 'refuse', text: (pre.length ? pre.join(' ') + '\n\n' : '') + REFUSE, chips: POPULAR, cites: [], topic: [], steps: steps.concat(['‘' + missing.join(', ') + '’에 대한 승인된 안내가 없어 답하지 않음']) };
      if (missing.length === 1) { mine.push('물어보신 ‘' + missing[0] + '’ 부분은 승인된 안내에 없어서 확실히 답하기 어려워요.'); steps.push('‘' + missing[0] + '’ 부분은 안내에 없음을 밝힘'); }
    }
    var said = paras.join(' ') + ' ' + mine.join(' '), gap = [];
    var askedFee = /(과태료|벌금|비용|수수료|요금)/.exec(q);
    if (askedFee && !new RegExp(askedFee[1] + '[^.]{0,20}\\d').test(said)) gap.push(askedFee[1] === '과태료' || askedFee[1] === '벌금' ? askedFee[1] + ' 금액' : '비용');
    else if (!askedFee && /얼마|돈\s*들/.test(q) && !/\d\s*(원|%|만)/.test(said)) gap.push('비용');
    if (/언제|기한|며칠|몇\s*일/.test(q) && !/\d|당일|전에|뒤에|바로/.test(said)) gap.push('날짜');
    if (gap.length) { mine.push('물어보신 ' + josa(gap.join('·'), '은는') + ' 승인된 안내에 없어서, 해당 기관에 확인해 주세요.'); steps.push(gap.join('·') + ' 정보는 안내에 없음을 밝힘'); }
    // 내 상황을 묻는 질문(해야 돼? 언제까지야? 받을 수 있어?)이면 내 경우가 곧 결론이라 앞에 둔다
    var personalQ = /(해야\s*(돼|되|하나|함|할까)|언제(까지)?|돼\?|되나|되냐|받을\s*수|대상이야|대상인가|제가|나\s|내\s|마감)/.test(q);
    var body = personalQ && mine.length ? mine.join(' ') + '\n\n' + paras.join('\n\n') : paras.join('\n\n') + (mine.length ? '\n\n' + mine.join(' ') : '');
    var text = (pre.length ? pre.join(' ') + '\n\n' : '') + body;
    // 숫자 점검: 답에 나온 숫자는 카드 문장이나 내 계약 값에 있어야 한다
    var pool = use.map(function (c) { return c.body + ' ' + c.title; }).join(' ') + ' ' + JSON.stringify(f);
    var bad = J.digits(text).filter(function (n) { return pool.replace(/,/g, '').indexOf(n) < 0 && String(pool).indexOf(n) < 0; });
    if (bad.length && !mine.length) return { kind: 'refuse', text: REFUSE, chips: POPULAR, cites: [], topic: [], steps: steps.concat(['근거에 없는 숫자가 있어 답하지 않음']) };
    steps.push('답 정리 · 근거 ' + use.length + '개');
    var chips = [];
    use.forEach(function (c) { (c.ask || []).forEach(function (x) { if (chips.indexOf(x) < 0 && x !== q) chips.push(x); }); });
    return {
      kind: 'answer', text: text, steps: steps, topic: use.map(function (c) { return c.id; }),
      cites: use.map(function (c) { return { id: c.id, title: c.title, src: c.cite || [] }; }), chips: chips.slice(0, 3), crisis: crisis
    };
  }
  return { answer: answer, josa: josa, REFUSE: REFUSE, SCOPE: SCOPE, GUARD: GUARD, POPULAR: POPULAR, sentences: sentences };
});
