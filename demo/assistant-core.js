/* 자취 계약 내비 · 자취 AI 비서 (내장 AI, 외부 API 없이 이 기기 안에서 동작, UMD)
 *
 * 봇 여섯 개가 하나의 비서 안에 있다. 질문을 보고 알맞은 봇에게 넘기고(자유 질문), 봇을 골라 물을 수도 있다.
 *   집주인톡  landlord — 집주인에게 보낼 문자 초안 (수리 요청, 보증금 반환, 계약 끝내기, 갱신, 인상 답장, 월세 늦어짐, 입주 사진, 관리비 문의)
 *   고쳐봇    repair   — 고장·하자 → 누가 고치는지 판정 + 지금 할 일 (+ 집주인톡으로 바로 이어 쓰기)
 *   절약봇    money    — 이번 달 고정비 분석 + 줄일 수 있는 방법(받을 수 있는 지원금·세액공제·관리비 확인)
 *   권리봇    rights   — 신고·보증금·퇴거 등 주거 권리 (coach-core.js, 승인된 지식 카드)
 *   동네봇    local    — 집 주변 장소 (지도 데이터)
 *   자유 질문 auto     — 알맞은 봇을 골라 답함
 * 모든 봇은 prompts/coach.md 규칙을 따른다: 승인된 안내와 내 계약 값만 근거로 쓰고, 모르면 멈춘다.
 * 답 = { bot, kind, text, blocks: [message | verdict | steps | bars | places | note], actions, cites, chips, steps, topic }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules-core.js'), require('./coach-core.js'));
  else root.JachwiAssistant = factory(root.JachwiRules, root.JachwiCoach);
})(typeof self !== 'undefined' ? self : this, function (J, C) {
  'use strict';

  var BOTS = {
    landlord: { name: '집주인톡', desc: '메시지 작성', icon: 'chat', hello: '집주인에게 하기 어려운 말, 대신 정리해 드릴게요. 어떤 상황인지 알려 주세요.', ph: '예: 보일러가 안 돼서 수리를 요청하고 싶어',
      ex: ['보일러 수리 요청 문자 써줘', '계약 끝나고 나간다고 알리고 싶어', '보증금 돌려달라고 연락하고 싶어', '집주인이 월세 올린대, 답장 써줘'] },
    repair: { name: '고쳐봇', desc: '집수리 상담', icon: 'wrench', hello: '어디가 고장 났나요? 누가 고쳐야 하는지와 지금 할 일을 알려 드릴게요.', ph: '예: 천장에서 물이 새요',
      ex: ['보일러가 안 돼요', '천장에서 물이 새요', '벽에 곰팡이가 폈어', '전구가 나갔어'] },
    money: { name: '절약봇', desc: '생활비 분석', icon: 'wallet', hello: '이번 달 나가는 돈을 정리하고, 줄일 수 있는 방법을 찾아 드릴게요.', ph: '예: 이번 달 생활비 얼마 나가?',
      ex: ['이번 달 고정비 얼마야?', '생활비 줄이는 방법 알려줘', '월세 비중이 높은 편이야?'] },
    rights: { name: '권리봇', desc: '주거 권리 안내', icon: 'shield', hello: '신고·보증금·계약·퇴거처럼 꼭 알아야 할 권리를 내 계약 날짜에 맞춰 알려 드릴게요.', ph: '예: 전입신고 언제까지 해야 해?',
      ex: ['전입신고 언제 해야 해?', '보증금 지키려면 뭘 해야 해?', '계약 끝나고 나가려면?', '확정일자 꼭 받아야 해?'] },
    local: { name: '동네봇', desc: '주변 장소 추천', icon: 'pin', hello: '집 근처에서 필요한 곳을 걸어서 몇 분인지와 함께 찾아 드릴게요.', ph: '예: 가까운 약국 어디야?',
      ex: ['가까운 약국 어디야?', '공부하기 좋은 곳', '근처 빨래방', '주민센터 어디야?'] },
    auto: { name: '자유 질문', desc: '그 외 모든 질문', icon: 'spark', hello: '무엇이든 물어보세요. 알맞은 봇이 답할게요.', ph: '예: 집주인에게 보일러 수리를 요청하고 싶어',
      ex: ['오늘 뭐 해야 돼?', '받을 수 있는 지원금 있어?', '집주인에게 보일러 수리를 요청하고 싶어'] }
  };
  var ORDER = ['landlord', 'repair', 'money', 'rights', 'local', 'auto'];
  var josa = C.josa;
  function won(n) { return Math.round(n).toLocaleString('ko-KR'); }
  function manText(n) { return n >= 10000 ? (n / 10000) + '억' + (n % 10000 ? ' ' + won(n % 10000) + '만' : '') + ' 원' : won(n) + '만 원'; }
  function cardById(cards, id) { return (cards || []).filter(function (c) { return c.id === id; })[0]; }
  function citeOf(cards, ids) { return ids.map(function (id) { var c = cardById(cards, id); return c ? { id: c.id, title: c.title, src: c.cite || [] } : null; }).filter(Boolean); }

  // ---------- 자유 질문: 알맞은 봇 고르기 ----------
  var P_WRITE = /문자|메시지|카톡|톡\s|톡$|연락\s*(하고|드리|해야|해서)|말하고\s*싶|말해야|전하고|보내고|보낼|써\s*줘|써줄|작성|요청하고\s*싶|부탁하고\s*싶|알리고\s*싶|통보|답장/;
  var P_REPAIR = /고장|수리|고쳐|고치|새요|새는|샌다|샙니다|누수|막혔|막힘|안\s*나와|안\s*켜|안\s*돼요|안\s*돼$|깨졌|부서|곰팡이|결로|보일러|변기|배수|수압|전구|전등|형광등|콘센트|차단기|누전|도어락|에어컨|세탁기|냉장고|방충망|가스\s*냄새|벽지|장판/;
  var P_MONEY = /생활비|고정비|지출|돈이|돈을|아끼|절약|얼마\s*나가|한\s*달에|가계부|예산|공과금\s*(얼마|합)|줄이|부담|비중|많이\s*나가/;
  var P_LOCAL = /근처|가까운|가까이|주변|동네|어디\s*있|약국|병원|의원|치과|편의점|마트|다이소|빨래방|세탁소|카페|맛집|식당|밥집|공원|산책|헬스|도서관|스터디|공부하기|지하철|정류장|버스|주민센터|행정복지센터|청년센터|우체국|경찰|지구대|파출소/;
  function route(q, last) {
    if (P_WRITE.test(q)) return 'landlord';
    if (/(전입|전월세|확정일자|보증금|계약|신고|지원금|세액공제)/.test(q) && !P_LOCAL.test(q.replace(/주민센터|행정복지센터/g, ''))) {
      if (P_MONEY.test(q) && !/보증금|계약|신고/.test(q)) return 'money';
      return 'rights';
    }
    if (P_REPAIR.test(q)) return 'repair';
    if (P_MONEY.test(q)) return 'money';
    if (P_LOCAL.test(q)) return 'local';
    if (last && /^(그럼|그러면|그건|그거|더|좀 더|짧게|길게|다시|하나 더)/.test(q)) return last;
    return 'rights';
  }

  // ---------- 고쳐봇 ----------
  function matchRepair(q, repairs) {
    for (var i = 0; i < (repairs || []).length; i++) if (new RegExp(repairs[i].re).test(q)) return repairs[i];
    return null;
  }
  var WHO = { landlord: ['집주인 몫', 'ok'], tenant: ['세입자 몫', 'ink'], depends: ['원인에 따라 달라요', 'due'], safety: ['안전이 먼저', 'bad'] };
  function repairBot(q, o) {
    var r = matchRepair(q, o.repairs);
    if (!r) return { kind: 'clarify', text: '어디가 고장 났는지 조금만 더 알려 주세요. 고장 난 물건과 증상을 같이 적어 주면 정확해요.', chips: BOTS.repair.ex, steps: ['고장 난 물건을 찾지 못함'] };
    var w = WHO[r.who];
    var head = r.who === 'safety' ? '**' + josa(r.label, '이가') + '** 나면 수리보다 **안전이 먼저**예요. 아래 순서대로 바로 움직이세요.'
      : '**' + josa(r.label, '은는') + '** ' + (r.who === 'landlord' ? '보통 **집주인이 고쳐야 해요.**' : r.who === 'tenant' ? '보통 **세입자가 해결해요.**' : '**원인에 따라** 누가 고칠지 달라요.');
    var blocks = [{ type: 'verdict', label: w[0], tone: w[1], text: r.why }, { type: 'steps', title: '지금 할 일', items: r.now }];
    var cites = (r.cite || [['민법 제623조 (임대인의 수선 의무)', 'https://www.law.go.kr']]).map(function (x, i) { return { id: 'repair-' + r.id + '-' + i, title: x[0], src: [x] }; });
    var actions = r.who !== 'tenant' && r.who !== 'safety' ? [{ label: '집주인에게 수리 요청 문자 만들기', bot: 'landlord', q: r.label + ' 수리 요청 문자 써줘' }] : [];
    actions.push({ label: '입주 때 찍은 사진 보기', href: '#condition' });
    if (r.who === 'safety') blocks.shift();
    return { kind: 'answer', text: head, blocks: blocks, actions: actions, cites: cites, topic: ['repair-' + r.id], chips: ['집주인이 안 고쳐 주면?', '입주할 때 사진 찍어야 해?'], steps: ['고장 난 물건 찾음: ' + r.label, '승인된 수리 안내에서 누가 고치는지 확인', '지금 할 일 정리'] };
  }

  // ---------- 집주인톡 ----------
  var LL = [
    { id: 'repair', re: /수리|고장|고쳐|고치|새요|새는|누수|곰팡이|보일러|막혔|막힘|안\s*나와|안\s*켜|깨졌|에어컨|세탁기|냉장고|도어락|전구|콘센트|변기/, title: '수리 요청' },
    { id: 'deposit', re: /보증금.*(돌려|반환|달라|받)|돌려\s*받|돌려\s*달/, title: '보증금 반환 요청' },
    { id: 'raise', re: /올려|올린|올리|인상/, title: '월세 인상 답장' },
    { id: 'renew', re: /더\s*살|연장|갱신|계약갱신요구권/, title: '계약 갱신 요청' },
    { id: 'leave', re: /나가|이사\s*(가|간|갈)|계약\s*(끝|종료|해지)|만료|안\s*살|나간다/, title: '계약 끝내기 알림' },
    { id: 'late', re: /늦|밀|못\s*내|못\s*낼|미뤄|연체/, title: '월세 늦어짐 양해' },
    { id: 'photo', re: /사진|상태|흠집|원래/, title: '입주 상태 사진 전달' },
    { id: 'fee', re: /관리비/, title: '관리비 항목 문의' }
  ];
  function since(q) { var m = /(어제|그제|그저께|오늘\s*아침|오늘|며칠\s*전|일주일\s*전|지난주|주말|이틀\s*전|사흘\s*전)/.exec(q); return m ? m[1].replace(/\s+/g, ' ') : ''; }
  function landlordBot(q, o) {
    var f = o.facts || {}, it = LL.filter(function (x) { return x.re.test(q); })[0];
    if (!it) return { kind: 'clarify', text: '어떤 내용을 전하고 싶은지 골라 주세요. 상황에 맞는 문자를 바로 써 드릴게요.', chips: ['보일러 수리 요청 문자 써줘', '계약 끝나고 나간다고 알리고 싶어', '보증금 돌려달라고 연락하고 싶어', '월세가 늦어질 것 같다고 말하고 싶어', '관리비 항목 물어보고 싶어'], steps: ['전할 내용을 찾지 못함'] };
    var house = f.house ? f.house : '', me = '안녕하세요, ' + (house ? house + ' ' : '') + '세입자' + (f.nick ? ' ' + f.nick : '') + '입니다.';
    var polite = '', short = '', tips = [], cites = [], extra = '';
    if (it.id === 'repair') {
      var r = matchRepair(q, o.repairs) || { label: '집 안 설비', symptom: '고장 난', who: 'landlord', id: 'etc' }, s = since(q);
      var word = r.re ? (new RegExp(r.re).exec(q) || [r.label])[0] : r.label, phrase = r.say || josa(word, '이가') + ' ' + r.symptom;
      polite = me + ' ' + phrase + ' 상태라 연락드려요.' + (s ? ' ' + s + '부터 이런 상태예요.' : '') + ' 사진 함께 보내드려요. 생활하기가 어려워서, 수리 가능한 날을 알려 주시면 일정 맞추겠습니다. 감사합니다.';
      short = (house ? house + ' ' : '') + '세입자입니다. ' + phrase + ' 상태라 수리 부탁드려요. 사진 보내드려요. 가능한 날 알려 주시면 맞출게요.';
      tips = ['고장 부분 사진·영상을 날짜가 보이게 찍어 함께 보내요', '전화로 말했어도 문자로 한 번 더 남겨 두세요 (나중에 기록이 돼요)', r.who === 'depends' ? '원인에 따라 비용 부담이 달라질 수 있어요. 원인을 같이 확인해 달라고 해 보세요' : '집을 쓰는 데 필요한 수리는 집주인이 고칠 의무가 있어요 (민법 제623조)'];
      cites = citeOf(o.cards, ['k-repair']);
      if (r.who === 'safety') extra = '가스 냄새는 문자보다 **도시가스사·119 신고가 먼저**예요. 안전해진 뒤에 보내세요.';
    } else if (it.id === 'deposit') {
      polite = me + ' 계약이 ' + (f.end || '[만료일]') + '에 끝나서, 그날 보증금 ' + (f.deposit ? manText(f.deposit) : '[보증금]') + '을 돌려받고 이사하려고 해요. 받을 계좌는 [은행·계좌번호]입니다. 집 상태 확인과 관리비·공과금 정산 일정도 맞춰 주시면 감사하겠습니다.';
      short = '계약 만료일(' + (f.end || '[만료일]') + ')에 보증금 ' + (f.deposit ? manText(f.deposit) : '[보증금]') + ' 돌려받고 이사하려고 해요. 계좌는 [은행·계좌번호]입니다. 정산 일정 알려 주세요.';
      tips = ['보증금을 받기 전에는 주소를 옮기지 마세요 (대항력이 사라질 수 있어요)', '못 받은 채 이사해야 하면 이사 전에 임차권등기명령부터 신청해요', '[ ] 칸은 직접 채워 넣으세요'];
      cites = citeOf(o.cards, ['k-deposit', 'k-dispute']);
    } else if (it.id === 'leave') {
      polite = me + ' 계약 만료일(' + (f.end || '[만료일]') + ')에 맞춰 이사하려고 합니다. 만료 2개월 전까지 알려 드려야 해서 미리 연락드려요. 보증금 돌려받는 날과, 다음 세입자가 집을 보러 올 일정은 편하신 때 알려 주세요.';
      short = '계약 만료일(' + (f.end || '[만료일]') + ')에 이사 나가려고 해요. 보증금 반환 일정 상의 부탁드려요.';
      tips = [f.noticeBy ? '늦어도 **' + f.noticeBy + '**까지 보내야 해요 (만료 2개월 전)' : '만료 2개월 전까지 보내야 해요', '답을 못 받아도 보낸 문자가 알린 기록이 돼요', '아무 말 없이 지나면 같은 조건으로 계약이 이어질 수 있어요 (묵시적 갱신)'];
      if (f.today && f.noticeBy && f.today > f.noticeBy) extra = '만료 2개월 전(' + f.noticeBy + ')이 이미 지났어요. 집주인이 따로 말이 없었다면 계약이 이어졌을 수 있고, 그때는 해지를 알린 날부터 3개월 뒤에 끝나요.';
      cites = citeOf(o.cards, ['k-moveout']);
    } else if (it.id === 'renew') {
      polite = me + ' 계약 만료(' + (f.end || '[만료일]') + ') 뒤에도 2년 더 살고 싶어서, 계약갱신요구권을 쓰려고 연락드려요. 조건은 지금과 같게 이어 가면 좋겠습니다. 확인 부탁드립니다.';
      short = '계약갱신요구권으로 만료(' + (f.end || '[만료일]') + ') 뒤 2년 더 살고 싶어요. 확인 부탁드려요.';
      tips = ['만료 6개월 전부터 2개월 전 사이에 알려야 해요', '갱신할 때 월세·보증금 인상은 5% 안에서만 돼요', '계약갱신요구권은 한 번만 쓸 수 있어요'];
      cites = citeOf(o.cards, ['k-moveout', 'k-raise']);
    } else if (it.id === 'raise') {
      var cap = f.rent ? won(f.rent * 10500) : '';
      polite = me + ' 말씀하신 월세 인상 건으로 연락드려요. 계약 중이나 갱신할 때 올릴 수 있는 폭은 기존 금액의 5% 안이라고 알고 있어서, 지금 월세 ' + (f.rent ? won(f.rent) + '만 원' : '[월세]') + '이면 ' + (cap ? '최대 ' + cap + '원' : '5% 안') + '까지로 알고 있어요. 이 범위 안에서 다시 상의드리고 싶습니다.';
      short = '월세 인상은 5% 안까지라 ' + (cap ? '최대 ' + cap + '원' : '5% 안') + '으로 알고 있어요. 이 범위에서 상의드리고 싶어요.';
      tips = ['올린 뒤 1년 안에는 다시 올릴 수 없어요', '계약을 완전히 새로 쓰면 5% 제한이 적용되지 않아요', '감정 섞인 말보다 숫자로 짧게 쓰는 게 좋아요'];
      cites = citeOf(o.cards, ['k-raise']);
    } else if (it.id === 'late') {
      polite = me + ' 이번 달 월세가 사정이 생겨 조금 늦어질 것 같아 미리 말씀드려요. [날짜]까지 꼭 보내드려도 괜찮을까요? 불편 드려 죄송합니다.';
      short = '이번 달 월세가 조금 늦어질 것 같아요. [날짜]까지 보내드려도 될까요? 죄송합니다.';
      tips = ['늦어지기 전에 미리, 날짜를 정해서 보내요', '밀린 월세가 두 달 치가 되면 계약 해지 사유가 될 수 있어요', '형편이 갑자기 어려워졌다면 120 다산콜센터에서 긴급 지원을 물어볼 수 있어요'];
      cites = citeOf(o.cards, ['k-late']);
    } else if (it.id === 'photo') {
      polite = me + ' 입주하면서 집 상태를 사진으로 남겨 보내드려요. 원래 있던 흠집·얼룩 기록용이니 확인 부탁드립니다. 나갈 때도 같은 기준으로 봐 주시면 감사하겠습니다.';
      short = '입주 때 집 상태 사진 보내드려요. 원래 있던 흠집 기록용이에요.';
      tips = ['짐을 넣기 전에 벽지·바닥·옵션 가전을 찍어요', '사진은 문자로 보내야 날짜가 남아요', '앱의 집 상태 기록에도 저장해 두세요'];
      cites = citeOf(o.cards, ['k-condition']);
    } else if (it.id === 'fee') {
      polite = me + ' 관리비 ' + (f.fee ? won(f.fee) + '만 원' : '') + '에 어떤 항목(수도·인터넷·청소비·공용 전기 등)이 들어가는지 알려 주실 수 있을까요? 공과금을 따로 내야 하는지 정리해 두려고 해요.';
      short = '관리비에 어떤 항목이 들어가는지 알려 주실 수 있을까요?';
      tips = ['받은 답은 캡처해 두세요', '받은 내용대로 자취 캘린더의 공과금을 켜고 끄면 매달 나갈 돈이 맞게 계산돼요'];
      cites = citeOf(o.cards, ['k-fee']);
    }
    var blocks = [{ type: 'message', title: '집주인에게 보낼 문자 · ' + it.title, text: polite, short: short }];
    if (extra) blocks.unshift({ type: 'note', tone: 'due', text: extra });
    blocks.push({ type: 'steps', title: '보내기 전에', items: tips });
    return { kind: 'answer', text: it.title + ' 문자를 써 봤어요. 복사해서 보내거나, 짧게 바꿔 보세요.', blocks: blocks, cites: cites, topic: ['landlord-' + it.id],
      actions: it.id === 'repair' ? [{ label: '누가 고쳐야 하는지 보기', bot: 'repair', q: (matchRepair(q, o.repairs) ? josa(matchRepair(q, o.repairs).label, '이가') + ' 고장 났어' : '집에 고장 난 데가 있어') }] : [],
      chips: ['더 짧게 써줘', '보증금 돌려달라고 연락하고 싶어', '계약 끝나고 나간다고 알리고 싶어'].filter(function (x) { return x.indexOf(it.title.slice(0, 2)) < 0; }).slice(0, 2),
      steps: ['전할 내용 파악: ' + it.title, '내 계약 날짜·금액 넣기', '정중한 문자와 짧은 문자 두 가지로 쓰기'] };
  }

  // ---------- 절약봇 ----------
  function moneyBot(q, o) {
    var f = o.facts || {}, m = f.money || {}, items = (m.items || []).filter(function (x) { return x.kind === 'out'; });
    if (!items.length && f.rent) items = [{ name: '월세', amount: f.rent * 10000 }].concat(f.fee ? [{ name: '관리비', amount: f.fee * 10000 }] : []);
    if (!items.length) return { kind: 'clarify', text: '내 계약 화면에 월세·관리비를 넣으면 이번 달 나가는 돈을 정리해 드릴게요.', actions: [{ label: '내 계약 입력하기', href: '#contract' }], steps: ['지출 정보가 없음'] };
    var total = items.reduce(function (a, b) { return a + b.amount; }, 0), rent = items.filter(function (x) { return /월세/.test(x.name); })[0];
    var share = rent ? Math.round(rent.amount / total * 100) : 0;
    items = items.slice().sort(function (a, b) { return b.amount - a.amount; });
    var ok = (f.programList || []).filter(function (p) { return p.verdict === '해당 가능' || p.verdict === '확인 필요'; });
    var save = ok.map(function (p) { return p.name + ' (' + p.verdict + ') — ' + (p.amountText || '') + (p.status ? ' · ' + p.status : ''); });
    save.push('월세 세액공제 — 근로소득이 있는 무주택 세대주면 연말정산 때 낸 월세 일부를 돌려받아요');
    save.push('관리비 항목 확인 — 관리비에 수도·인터넷이 들어 있는데 따로 또 내고 있지 않은지 봐요');
    var text = (m.month ? m.month + ' ' : '이번 달 ') + '나가는 고정비는 **약 ' + won(total) + '원**이에요.' + (rent ? ' 그중 월세가 **' + share + '%**예요.' : '') + (ok.length ? ' 신청해 볼 수 있는 지원이 ' + ok.length + '개 있어서, 선정되면 부담을 줄일 수 있어요.' : '');
    return { kind: 'answer', text: text,
      blocks: [{ type: 'bars', title: '이번 달 고정비', total: total, items: items.slice(0, 6).map(function (x) { return { label: x.name, amount: x.amount, pct: Math.round(x.amount / total * 100), est: x.est }; }) }, { type: 'steps', title: '줄일 수 있는 방법', items: save }],
      actions: [{ label: '지원사업 자세히 보기', href: '#support' }, { label: '자취 캘린더에서 공과금 고치기', href: '#calendar' }],
      cites: citeOf(o.cards, ['k-support', 'k-tax', 'k-fee']), topic: ['money'], chips: ['청년월세 지원 서류 뭐 필요해?', '월세 세액공제 받을 수 있어?'],
      steps: ['자취 캘린더에서 이번 달 나가는 돈 ' + items.length + '개 모음', '항목별 비중 계산', '승인된 지원·세액공제 안내에서 줄일 방법 찾기'] };
  }

  // ---------- 동네봇 ----------
  var LOCAL = [[/약국/, 'medical', /약국/, '약국'], [/병원|의원|치과|내과/, 'medical', /의원|병원|치과|내과/, '병원'], [/빨래|세탁/, 'life', /빨래|세탁/, '빨래방·세탁소'], [/편의점/, 'life', /편의점/, '편의점'], [/마트|장보|다이소|생활/, 'life', /마트|다이소|슈퍼/, '마트'], [/카페|커피/, 'cafe', null, '카페'], [/지하철|역|버스|정류장|교통/, 'transit', null, '교통'], [/공원|산책/, 'park', null, '공원'], [/헬스|운동|체육/, 'gym', null, '운동할 곳'], [/도서관|스터디|공부/, 'study', null, '공부할 곳'], [/주민센터|행정복지센터|청년센터|우체국|관공서/, 'public', null, '공공시설'], [/밥|식당|맛집|먹/, 'food', null, '식당'], [/경찰|지구대|파출소|안전/, 'safety', null, '경찰']];
  function localBot(q, o) {
    var P = (o.facts || {}).places || {};
    if (!P.hasHome) return { kind: 'clarify', text: '집 위치를 먼저 정하면 가까운 곳을 걸어서 몇 분인지 알려 드릴게요.', actions: [{ label: '집 위치 정하기', href: '#map' }], steps: ['집 위치가 없음'] };
    if (!P.list || !P.list.length) return { kind: 'clarify', text: '주변 장소를 불러오는 중이에요. 잠시 뒤 다시 물어봐 주세요.', actions: [{ label: '지도 탐색 열기', href: '#map' }], steps: ['장소 데이터를 불러오는 중'] };
    var hit = LOCAL.filter(function (x) { return x[0].test(q); })[0], list;
    if (hit) {
      list = P.list.filter(function (p) { return p.cat === hit[1] && (!hit[2] || hit[2].test(p.name) || hit[2].test(p.sub || '')); }).slice(0, 3);
      if (!list.length) return { kind: 'answer', text: '집 주변 1km 안에서 ' + josa(hit[3], '을를') + ' 찾지 못했어요.', actions: [{ label: '지도에서 직접 찾기', href: '#map' }], topic: ['local'], steps: ['‘' + hit[3] + '’ 찾기: 없음'] };
      var p0 = list[0];
      return { kind: 'answer', text: '가장 가까운 ' + hit[3] + '은 **' + p0.name + '**, 걸어서 약 **' + p0.min + '분**(' + p0.m + 'm)이에요.' + (list[1] ? ' 다음은 ' + list[1].name + '(' + list[1].min + '분)이에요.' : ''),
        blocks: [{ type: 'places', items: list }, { type: 'note', text: P.source || '' }], actions: [{ label: '지도 탐색 열기', href: '#map' }], topic: ['local'], chips: ['근처 빨래방', '공부하기 좋은 곳', '주민센터 어디야?'].filter(function (x) { return !hit[0].test(x); }).slice(0, 2),
        steps: ['찾는 곳: ' + hit[3], '집에서 가까운 순으로 ' + list.length + '곳 고름'] };
    }
    var pick = ['transit', 'life', 'medical', 'public'].map(function (c) { return P.list.filter(function (p) { return p.cat === c; })[0]; }).filter(Boolean);
    return { kind: 'answer', text: '집 근처에서 자주 쓰게 될 곳을 골라 봤어요.', blocks: [{ type: 'places', items: pick }, { type: 'note', text: P.source || '' }], actions: [{ label: '지도 탐색 열기', href: '#map' }], topic: ['local'], chips: BOTS.local.ex.slice(0, 3), steps: ['교통·생활·병원·공공시설에서 가장 가까운 곳 고름'] };
  }

  // ---------- 권리봇 (승인된 지식 카드) ----------
  function rightsBot(q, o) { var a = C.answer({ q: q, history: o.history || [], cards: o.cards, facts: o.facts }); return a; }

  var END = '[\\s?!.~ㅎㅋ^♡]*$';
  var P_HELLO = new RegExp('^(안녕(하세요|하십니까)?|하이|hi|hello|헬로|ㅎㅇ|반가워요?|반갑습니다|처음 왔어요?)' + END, 'i');
  var P_THANKS = new RegExp('^(고마워요?|고맙습니다|감사(합니다|해요)?|땡큐|thanks?( you)?|ㄱㅅ|덕분에 (해결|도움)\\S*|최고(야|예요)?|좋아요?|알겠어요?|오케이|ㅇㅋ)' + END, 'i');
  var P_WHO = new RegExp('^(너 |넌 |이 봇 |여기 )?(누구(야|세요)?|뭐 ?할 ?수 ?있어|뭘 ?할 ?수 ?있어|뭐 ?해 ?줄 ?수 ?있어|무슨 ?봇이야|어떤 걸 물어봐(야 ?돼)?|뭐 ?물어볼 ?수 ?있어)' + END, 'i');
  function smallTalk(q, id) {
    var B = BOTS[id], name = id === 'auto' ? '자취 AI 비서' : B.name, me = '**' + name + '**' + josa(name, '이에요').slice(name.length);
    if (P_HELLO.test(q)) return { kind: 'smalltalk', text: '안녕하세요! 저는 ' + me + '. ' + B.hello, chips: B.ex.slice(0, 3), steps: ['인사'] };
    if (P_THANKS.test(q)) return { kind: 'smalltalk', text: '도움이 됐다니 다행이에요. 더 궁금한 게 생기면 언제든 물어보세요.', chips: B.ex.slice(0, 2), steps: ['감사 인사'] };
    if (P_WHO.test(q)) return { kind: 'smalltalk', text: '저는 ' + me + (id === 'auto' ? '. 집주인톡·고쳐봇·절약봇·권리봇·동네봇 중 알맞은 봇에게 질문을 넘겨 답해요.' : '(' + B.desc + '). ' + B.hello + ' 다른 일은 자유 질문 방에서 물어보면 알맞은 봇이 답해요.'), chips: B.ex.slice(0, 3), steps: ['봇 소개'] };
    return null;
  }
  function answer(o) {
    var q = String(o.q || '').replace(/\s+/g, ' ').trim(), want = o.bot && o.bot !== 'auto' ? o.bot : null;
    var last = (o.history || []).length ? o.history[o.history.length - 1] : null;
    // 짧게/다시 써 달라는 요청은 바로 앞 문자에
    if (last && last.bot === 'landlord' && /짧게|간단히|줄여/.test(q) && last.q) { var re = landlordBot(last.q, o); re.preferShort = true; re.text = '짧게 줄여 봤어요.'; re.bot = 'landlord'; re.routed = !want; return re; }
    // 문자 쓰기는 어느 봇에서 물어도 집주인톡이, 위급·지시 무시는 권리봇 규칙이 먼저
    // 인사·감사·"뭐 할 수 있어?" 같은 짧은 말에는 지금 방의 봇이 직접 답한다
    var me = BOTS[want || 'auto'], small = smallTalk(q, want || 'auto');
    if (small) { small.bot = want || 'auto'; small.routed = false; small.blocks = []; small.actions = []; small.cites = []; small.topic = []; return small; }
    var bot = want || route(q, last && last.bot);
    if (want && want !== 'landlord' && P_WRITE.test(q) && !/알려|뭐|어떻게/.test(q)) bot = 'landlord';
    if (want === 'repair' && !P_REPAIR.test(q)) bot = route(q, 'repair') === 'repair' ? 'repair' : 'rights';
    if (want === 'local' && !P_LOCAL.test(q) && /전입|신고|보증금|계약/.test(q)) bot = 'rights';
    var r = bot === 'landlord' ? landlordBot(q, o) : bot === 'repair' ? repairBot(q, o) : bot === 'money' ? moneyBot(q, o) : bot === 'local' ? localBot(q, o) : rightsBot(q, o);
    // 고쳐봇이 물건을 못 찾았으면 권리봇 지식으로 한 번 더
    if (bot === 'repair' && r.kind === 'clarify' && !want) { var r2 = rightsBot(q, o); if (r2.kind === 'answer') { r = r2; bot = 'rights'; } }
    if ((r.topic || [])[0] === 'todo') bot = 'auto'; // 오늘 할 일은 비서가 직접
    r.bot = bot; r.routed = !want || want !== bot;
    r.blocks = r.blocks || []; r.actions = r.actions || []; r.cites = r.cites || []; r.chips = r.chips || []; r.steps = r.steps || []; r.topic = r.topic || [];
    if (r.routed) r.steps.unshift((want ? BOTS[want].name + ' 대신 ' : '') + BOTS[bot].name + '에게 맡김');
    return r;
  }
  return { answer: answer, route: route, BOTS: BOTS, ORDER: ORDER, matchRepair: matchRepair };
});
