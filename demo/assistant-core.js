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
  var P_WRITE = /뭐라고\s*(보내|말|써|해)|뭐라고\s*\S*\s*(보내|말)|어떻게\s*(말|보내|전해)|문자|메시지|카톡|톡\s|톡$|연락\s*(하고|드리|해야|해서)|말하고\s*싶|말해야|전하고|보내고|보낼|써\s*줘|써줄|작성|요청하고\s*싶|부탁하고\s*싶|알리고\s*싶|통보|답장/;
  var P_REPAIR = /냄새|하수구|습기|배터리|건전지|흘러|물이\s*안\s*빠|찢어|들떴|금\s*갔|고장|수리|고쳐|고치|새요|새는|샌다|샙니다|누수|막혔|막힘|안\s*나와|안\s*켜|안\s*돼요|안\s*돼$|깨졌|부서|곰팡이|결로|보일러|변기|배수|수압|전구|전등|형광등|콘센트|차단기|누전|도어락|에어컨|세탁기|냉장고|방충망|가스\s*냄새|벽지|장판/;
  var P_MONEY = /예산|수입|월급|소득|남는\s*돈|지원금\s*받으면|얼마나\s*줄|공과금|전기세|가스비|난방비|관리비\s*아끼|생활비|고정비|지출|돈이|돈을|아끼|절약|얼마\s*나가|한\s*달에|가계부|예산|공과금\s*(얼마|합)|줄이|부담|비중|많이\s*나가/;
  var P_LOCAL = /근처|가까운|가까이|주변|동네|어디\s*있|약국|병원|의원|치과|편의점|마트|다이소|빨래방|세탁소|카페|맛집|식당|밥집|공원|산책|헬스|도서관|스터디|공부하기|지하철|정류장|버스|주민센터|행정복지센터|청년센터|우체국|경찰|지구대|파출소/;
  function route(q, last) {
    if (P_WRITE.test(q)) return 'landlord';
    if (/수리비|고친\s*비용|내가\s*(먼저\s*)?(고쳤|냈)/.test(q) || (/집주인|임대인/.test(q) && /연락|답(이|장)|읽씹|전화/.test(q) && !/보증금.*(안|못)\s*돌려/.test(q))) return 'landlord';
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
  // 질문에 맞는 수리 안내 (세부 사례가 있으면 그 사례로 덮어씀)
  function matchRepair(q, repairs) {
    for (var i = 0; i < (repairs || []).length; i++) {
      var r = repairs[i], m = new RegExp(r.re).exec(q);
      if (!m) continue;
      var out = {}; Object.keys(r).forEach(function (k) { out[k] = r[k]; });
      (r.cases || []).forEach(function (c) { if (!out.caseHit && new RegExp(c.re).test(q)) { out.caseHit = true; Object.keys(c).forEach(function (k) { if (k !== 're') out[k] = c[k]; }); } });
      // 질문에 쓴 낱말(결로·에어컨·냉장고…)로 부르기
      var w = m[0].replace(/\s+/g, ' ').trim();
      out.word = out.caseHit ? out.label : (/^[가-힣]{2,6}$/.test(w) && !/(냄새|새|흘|안)/.test(w) ? w : out.label);
      return out;
    }
    return null;
  }
  var WHO = { landlord: ['집주인 몫', 'ok'], tenant: ['세입자 몫', 'ink'], depends: ['원인에 따라 달라요', 'due'], safety: ['안전이 먼저', 'bad'] };
  function repairBot(q, o) {
    var r = matchRepair(q, o.repairs);
    if (!r) return { kind: 'clarify', text: '어디가 고장 났는지 조금만 더 알려 주세요. 고장 난 물건과 증상을 같이 적어 주면 정확해요.', chips: BOTS.repair.ex, steps: ['고장 난 물건을 찾지 못함'] };
    var w = WHO[r.who];
    var head = r.who === 'safety' ? '**' + josa(r.label, '이가') + '** 나면 수리보다 **안전이 먼저**예요. 아래 순서대로 바로 움직이세요.'
      : '**' + josa(r.word || r.label, '은는') + '** ' + (r.who === 'landlord' ? '보통 **집주인이 고쳐야 해요.**' : r.who === 'tenant' ? '보통 **세입자가 해결해요.**' : '**원인에 따라** 누가 고칠지 달라요.');
    var now = r.now.slice();
    if (r.who === 'landlord' || r.who === 'depends') now.push('고칠 일이 생기면 바로 집주인에게 알려야 해요. 늦게 알려 피해가 커지면 세입자 책임이 될 수 있어요 (민법 제634조)');
    var blocks = [{ type: 'verdict', label: w[0], tone: w[1], text: r.why }, { type: 'steps', title: '지금 할 일', items: now }];
    if (r.who === 'landlord' || r.who === 'depends') blocks.push({ type: 'note', text: '집주인이 고쳐 주지 않아 내가 먼저 고쳤다면, 영수증으로 집주인에게 수리비를 청구할 수 있어요 (민법 제626조, 필요비).' });
    var cites = (r.cite || [['민법 제623조 (임대인의 수선 의무)', 'https://www.law.go.kr'], ['민법 제634조·제626조', 'https://www.law.go.kr']]).map(function (x, i) { return { id: 'repair-' + r.id + '-' + i, title: x[0], src: [x] }; });
    var actions = r.who !== 'tenant' && r.who !== 'safety' ? [{ label: '집주인에게 수리 요청 문자 만들기', bot: 'landlord', q: (r.word || r.label) + ' 수리 요청 문자 써줘' }] : [];
    actions.push({ label: '입주 때 찍은 사진 보기', href: '#condition' });
    if (r.who === 'safety') blocks.shift();
    return { kind: 'answer', text: head, blocks: blocks, actions: actions, cites: cites, topic: ['repair-' + r.id], chips: ['집주인이 안 고쳐 주면?', '입주할 때 사진 찍어야 해?'], steps: ['고장 난 곳 찾음: ' + (r.word || r.label) + (r.caseHit ? ' (세부 상황: ' + r.label + ')' : ''), '승인된 수리 안내에서 누가 고치는지 확인', '지금 할 일 정리'] };
  }

  // ---------- 집주인톡 ----------
  var LL = [
    { id: 'nocontact', re: /연락(을|이)?\s*(안|없)|답(이|장)?\s*(이\s*)?(없|안)|읽씹|안\s*읽|전화(를|도)?\s*안\s*받|감감/, title: '다시 연락 요청' },
    { id: 'refund', re: /수리비|고친\s*비용|내가\s*(먼저\s*)?(고쳤|냈|고치)|내\s*돈으로|영수증.*(돌려|청구|보내)/, title: '수리비 청구' },
    { id: 'noise', re: /층간\s*소음|소음|시끄러|쿵쿵/, title: '소음 문제 전달' },
    { id: 'visit', re: /집\s*(을\s*)?(보러|보여)|방\s*보러|다음\s*세입자|보러\s*온/, title: '집 보여 주기 일정' },
    { id: 'payday', re: /이체\s*(날|일)|입금\s*(날|일)|월세\s*(날짜|날|일).*(바꾸|변경|옮기)|납부\s*일|보내는\s*날/, title: '월세 날짜 바꾸기' },
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
    // 정해진 상황이 아니어도, 문자를 써 달라는 말이면 내 말을 넣어 기본 틀로 써 줌
    var topic = q.replace(/(집주인|임대인|주인)\s*(한테|에게|께|님께|님한테)?/g, '').replace(/(문자|메시지|카톡|톡)\s*(로|를|좀)?/g, '').replace(/(말하고|전하고|보내고|알리고|요청하고|부탁하고|물어보고)\s*싶어(요)?|써\s*줘|써줄래|보내\s*줘|작성해\s*줘|어떻게\s*(말|보내)\S*|뭐라고\s*\S*/g, '').replace(/[?!.]/g, '').replace(/\s+/g, ' ').trim();
    if (!it && topic.length >= 2 && P_WRITE.test(q)) it = { id: 'free', title: '직접 쓰기' };
    if (!it) return { kind: 'clarify', text: '어떤 내용을 전하고 싶은지 골라 주세요. 상황에 맞는 문자를 바로 써 드릴게요.', chips: ['보일러 수리 요청 문자 써줘', '계약 끝나고 나간다고 알리고 싶어', '보증금 돌려달라고 연락하고 싶어', '월세가 늦어질 것 같다고 말하고 싶어', '관리비 항목 물어보고 싶어'], steps: ['전할 내용을 찾지 못함'] };
    var house = f.house ? f.house : '', me = '안녕하세요, ' + (house ? house + ' ' : '') + '세입자' + (f.nick ? ' ' + f.nick : '') + '입니다.';
    var polite = '', short = '', tips = [], cites = [], extra = '';
    if (it.id === 'nocontact') {
      var about = /보증금/.test(q) ? '보증금 반환' : /수리|고장|보일러|누수/.test(q) ? '수리 요청' : /계약|만료|이사/.test(q) ? '계약 만료와 이사' : '[보낸 내용]';
      polite = me + ' 지난 [날짜]에 ' + about + ' 건으로 연락드렸는데 답을 못 받아 다시 연락드려요. 확인하시면 [언제까지] 답 주시면 감사하겠습니다.';
      short = (house ? house + ' ' : '') + '세입자입니다. ' + about + ' 건 답 기다리고 있어요. [언제까지] 확인 부탁드려요.';
      tips = ['처음 보낸 날짜와 내용을 함께 적으면 기록이 분명해져요', '언제까지 답을 달라고 날짜를 정해 두세요', '계속 연락이 안 되고 보증금이나 수리처럼 중요한 일이면 주택임대차분쟁조정위원회 조정이나 대한법률구조공단(132) 상담을 받을 수 있어요'];
      cites = citeOf(o.cards, ['k-dispute']);
    } else if (it.id === 'refund') {
      var rr = matchRepair(q, o.repairs);
      polite = me + ' [날짜]에 ' + (rr ? josa(rr.word || rr.label, '이가') + ' 고장 나서' : '[고장 내용]이 생겨') + ' 급하게 먼저 수리를 맡겼고, 비용이 [금액]원 들었어요. 집을 쓰는 데 꼭 필요한 수리라 영수증과 사진 보내드리니 확인 후 [은행·계좌번호]로 보내 주실 수 있을까요?';
      short = '[날짜]에 ' + (rr ? (rr.word || rr.label) : '[고장 내용]') + ' 수리비 [금액]원을 먼저 냈어요. 영수증 보내드리니 [은행·계좌번호]로 보내 주세요.';
      tips = ['영수증, 고장 사진, 수리 전후 사진을 같이 보내요', '집을 쓰는 데 필요한 수리비(필요비)는 집주인에게 돌려 달라고 할 수 있어요 (민법 제626조)', '다음에는 고치기 전에 먼저 집주인에게 알리고 답을 문자로 받아 두세요'];
      cites = citeOf(o.cards, ['k-repair']).concat([{ id: 'law-626', title: '민법 제626조 (필요비 상환청구)', src: [['민법 제626조', 'https://www.law.go.kr']] }]);
    } else if (it.id === 'noise') {
      polite = me + ' 요즘 [시간대]마다 [윗집·옆집]에서 나는 소음이 계속돼서 연락드려요. 직접 찾아가기보다 관리하시는 쪽에서 한번 전달해 주시면 좋겠습니다. 날짜와 시간은 기록해 두었어요.';
      short = '요즘 [시간대]에 [윗집·옆집] 소음이 계속돼요. 한번 전달해 주실 수 있을까요?';
      tips = ['소음이 난 날짜·시간·어떤 소리였는지 적어 두세요', '직접 찾아가 따지기보다 집주인·관리인을 통해 전달하는 게 안전해요', '소음은 승인된 법률 안내가 없어 문자 틀만 드려요'];
      cites = [];
    } else if (it.id === 'visit') {
      polite = me + ' 다음 세입자분이 집을 보러 오시는 건 괜찮습니다. 다만 [요일·시간]이 편하고, 오시기 하루 전에는 미리 연락 주시면 감사하겠습니다.';
      short = '집 보러 오시는 건 괜찮아요. [요일·시간]이 편하고, 하루 전에 미리 알려 주세요.';
      tips = ['가능한 요일·시간을 먼저 정해 두면 서로 편해요', '내가 없을 때 들어오는 건 미리 허락한 경우에만 하도록 말해 두세요'];
      cites = citeOf(o.cards, ['k-moveout']);
    } else if (it.id === 'payday') {
      polite = me + ' 월급날이 [날짜]라서, 월세 보내는 날을 매달 [날짜]로 바꿔도 될지 여쭤봐요. 괜찮으시면 이번 달부터 그 날짜에 보내겠습니다.';
      short = '월세 보내는 날을 매달 [날짜]로 바꿔도 될까요?';
      tips = ['계약서에 적힌 날짜와 달라지니, 집주인이 괜찮다고 한 답을 문자로 남겨 두세요', '바꾼 날짜로 자취 캘린더의 월세 날짜도 고쳐 두세요', '바꾸기 전까지는 원래 날짜에 보내야 밀린 것으로 보지 않아요'];
      cites = citeOf(o.cards, ['k-late']);
    } else if (it.id === 'free') {
      polite = me + ' ' + topic + ' 건으로 연락드려요. [상황을 한두 문장으로 적어 주세요]. 편하실 때 확인 부탁드립니다. 감사합니다.';
      short = (house ? house + ' ' : '') + '세입자입니다. ' + topic + ' 건으로 연락드려요. [상황]. 확인 부탁드려요.';
      tips = ['언제, 무엇이, 어떻게 됐는지 한두 문장으로 채워 보내요', '사진이나 날짜가 있으면 같이 보내요', '정해진 상황(수리·보증금·계약 끝내기 등)이라면 그 말을 넣어 다시 물어보면 더 알맞게 써 드려요'];
      cites = [];
    } else if (it.id === 'repair') {
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
  // 질문 의도: 지원금 효과 · 월세 비중 · 공과금 · 관리비 · 예산 · 전체 보기
  var UTIL = /전기|가스|수도|인터넷|통신|난방|휴대폰|핸드폰/;
  function incomeOf(q) { var m = /(월급|소득|수입|용돈|알바비?|버는\s*돈)[^\d]{0,6}(\d+(?:\.\d+)?)\s*(만|백만)?/.exec(q) || /(\d+(?:\.\d+)?)\s*(만|백만)\s*원?\s*(벌|받|들어)/.exec(q); if (!m) return 0; var n = +(m[2] && !isNaN(+m[2]) ? m[2] : m[1]), u = m[3] || m[2]; return u === '백만' ? n * 100 : n; }
  function moneyBot(q, o) {
    var f = o.facts || {}, m = f.money || {}, all = m.items || [], items = all.filter(function (x) { return x.kind === 'out'; }), ins = all.filter(function (x) { return x.kind === 'in'; });
    if (!items.length && f.rent) items = [{ name: '월세', amount: f.rent * 10000 }].concat(f.fee ? [{ name: '관리비', amount: f.fee * 10000 }] : []);
    if (!items.length) return { kind: 'clarify', text: '내 계약 화면에 월세·관리비를 넣으면 이번 달 나가는 돈을 정리해 드릴게요.', actions: [{ label: '내 계약 입력하기', href: '#contract' }], steps: ['지출 정보가 없음'] };
    var total = items.reduce(function (a, b) { return a + b.amount; }, 0), inSum = ins.reduce(function (a, b) { return a + b.amount; }, 0);
    var rent = items.filter(function (x) { return /월세/.test(x.name); })[0], rentAmt = rent ? rent.amount : 0, share = rentAmt ? Math.round(rentAmt / total * 100) : 0;
    items = items.slice().sort(function (a, b) { return b.amount - a.amount; });
    var bars = function (list, title, sum) { return { type: 'bars', title: title, total: sum, items: list.slice(0, 6).map(function (x) { return { label: x.name, amount: x.amount, pct: Math.round(x.amount / sum * 100), est: x.est }; }) }; };
    var ok = (f.programList || []).filter(function (p) { return p.verdict === '해당 가능' || p.verdict === '확인 필요' || p.verdict === '답하면 판정'; });
    var monthly = ok.filter(function (p) { return /월\s*최대/.test(p.amountText || ''); }), month = m.month || '이번 달';
    var progMonthly = function (p) { var mm = /월\s*최대\s*([\d,.]+)\s*만/.exec(p.amountText || ''), mo = /최대\s*(\d+)\s*개월/.exec(p.amountText || ''); return { per: mm ? +mm[1].replace(/,/g, '') * 10000 : 0, months: mo ? +mo[1] : 0 }; };
    var base = { topic: ['money'], cites: citeOf(o.cards, ['k-support']), actions: [{ label: '지원사업 자세히 보기', href: '#support' }, { label: '자취 캘린더에서 금액 고치기', href: '#calendar' }] };
    var done = function (r) { Object.keys(base).forEach(function (k) { if (!r[k]) r[k] = base[k]; }); r.kind = r.kind || 'answer'; return r; };
    var income = incomeOf(q);
    // 1) 지원금 받으면 얼마나 줄어?
    if (/지원.*(받으면|되면|선정)|얼마나\s*줄|줄어/.test(q) && monthly.length) {
      var p0 = monthly[0], pm = progMonthly(p0), after = Math.max(0, total - pm.per), already = ins.some(function (x) { return /지원/.test(x.name); });
      if (already) return done({ text: '자취 캘린더에 이미 지원금 입금(' + won(inSum) + '원)이 켜져 있어요. 그래서 ' + month + ' 실제 부담은 고정비 ' + won(total) + '원에서 뺀 **약 ' + won(total - inSum) + '원**이에요.', blocks: [{ type: 'bars', title: month + ' 돈 흐름', total: total, items: [{ label: '고정비', amount: total, pct: 100 }, { label: '실제 부담', amount: total - inSum, pct: Math.round((total - inSum) / total * 100) }] }], chips: ['월세 비중 높은 편이야?', '공과금 줄이는 방법'], steps: ['캘린더에 켜진 지원금 입금 확인', '고정비에서 빼서 계산'] });
      return done({ text: '**' + p0.name + '**에 선정되면 매달 최대 **' + won(pm.per) + '원**' + (pm.months ? '(최대 ' + pm.months + '개월, 모두 ' + won(pm.per * pm.months) + '원)' : '') + '을 받을 수 있어요. 그러면 ' + month + ' 고정비 ' + won(total) + '원이 실제로는 **약 ' + won(after) + '원** 부담이 돼요.',
        blocks: [{ type: 'bars', title: '지원금을 받으면', total: total, items: [{ label: '지금', amount: total, pct: 100 }, { label: '선정되면', amount: after, pct: Math.round(after / total * 100) }] }, { type: 'steps', title: '알아 둘 점', items: [p0.name + '은 지금 ' + p0.verdict + (p0.status ? ' · ' + p0.status : '') + '이에요. 최종 선정은 기관 심사로 정해져요', '금액은 공고마다 따로 보고 합치지 않아요', '선정되면 자취 캘린더의 ‘청년월세 지원 입금’을 켜 두면 매달 들어오는 날을 챙겨 드려요'] }],
        chips: ['청년월세 지원 서류 뭐 필요해?', '월세 세액공제 받을 수 있어?'], steps: ['신청해 볼 수 있는 지원 중 매달 주는 지원 찾음', '이번 달 고정비에서 빼서 계산'] });
    }
    // 5) 예산
    if (/예산|짜\s*줘|계획|남는\s*돈|저축/.test(q)) {
      if (!income) return done({ kind: 'clarify', text: '고정비는 ' + month + ' **약 ' + won(total) + '원**이에요. 한 달 수입(월급·용돈·알바비)을 알려 주면 고정비를 빼고 쓸 수 있는 돈을 계산해 드릴게요.', blocks: [bars(items, month + ' 고정비', total)], chips: ['한 달 수입 200만 원이야 예산 짜줘', '한 달 수입 120만 원이야 예산 짜줘'], steps: ['고정비 계산', '수입을 몰라서 물어봄'] });
      var left = income * 10000 + inSum - total;
      return done({ text: '한 달 수입 ' + won(income) + '만 원' + (inSum ? '과 들어오는 돈 ' + won(inSum) + '원' : '') + '에서 고정비 ' + won(total) + '원을 빼면 **' + won(left) + '원**이 남아요. 이 안에서 식비·교통비·저축을 나눠 보세요.',
        blocks: [{ type: 'bars', title: '한 달 돈 흐름', total: income * 10000 + inSum, items: [{ label: '고정비', amount: total, pct: Math.round(total / (income * 10000 + inSum) * 100) }, { label: '남는 돈', amount: Math.max(0, left), pct: Math.max(0, Math.round(left / (income * 10000 + inSum) * 100)) }] }, { type: 'steps', title: '이렇게 써 보세요', items: ['남는 돈을 주 단위로 나누면 한 주에 약 ' + won(Math.max(0, left) / 4.3) + '원이에요', '저축할 돈은 월급날 바로 따로 옮겨 두면 덜 쓰게 돼요', '자주 나가는 돈(통신비·구독)은 자취 캘린더에 넣어 고정비로 관리해요'] }],
        chips: ['지원금 받으면 얼마나 줄어?', '공과금 줄이는 방법'], steps: ['수입 ' + won(income) + '만 원 확인', '고정비를 빼고 남는 돈 계산'] });
    }
    // 2) 월세 비중
    if (/비중|비율|높은\s*편|많은\s*편|적당|과한/.test(q) || income) {
      var lines = [month + ' 고정비 ' + won(total) + '원 중 월세가 ' + won(rentAmt) + '원(' + share + '%)이에요'];
      if (income) lines.push('말해 준 소득 ' + won(income) + '만 원 기준으로 월세는 소득의 **' + Math.round(rentAmt / (income * 10000) * 100) + '%**, 고정비 전체는 **' + Math.round(total / (income * 10000) * 100) + '%**예요');
      else lines.push('월 소득을 같이 적어 주면(예: “월급 200만 원인데 월세 비중 어때?”) 소득 대비 비율도 계산해 드릴게요');
      if (monthly.length) lines.push(monthly[0].name + '에 선정되면 월세 부담이 매달 최대 ' + won(progMonthly(monthly[0]).per) + '원 줄어요');
      return done({ text: '고정비 가운데 월세가 **' + share + '%**로 가장 커요.' + (income ? ' 소득 대비로는 **' + Math.round(rentAmt / (income * 10000) * 100) + '%**예요.' : ''), blocks: [bars(items, month + ' 고정비', total), { type: 'steps', title: '정리', items: lines }],
        chips: income ? ['지원금 받으면 얼마나 줄어?', '생활비 줄이는 방법 알려줘'] : ['월급 200만 원인데 월세 비중 어때?', '지원금 받으면 얼마나 줄어?'], steps: ['고정비에서 월세 비중 계산'].concat(income ? ['말해 준 소득으로 비율 계산'] : []) });
    }
    // 3) 공과금
    if (/공과금|전기|가스|수도|난방|통신|인터넷/.test(q) && !/관리비/.test(q)) {
      var ut = items.filter(function (x) { return UTIL.test(x.name); }), us = ut.reduce(function (a, b) { return a + b.amount; }, 0);
      var card = cardById(o.cards, 'k-save-utility'), tips = card ? C.sentences(card.body) : [];
      return done({ text: ut.length ? month + ' 공과금·통신비는 **약 ' + won(us) + '원**이에요(고정비의 ' + Math.round(us / total * 100) + '%).' + (ut.some(function (x) { return x.est; }) ? ' 예상 금액이 섞여 있어요.' : '') : '자취 캘린더에 공과금이 아직 없어요. 전기·가스·통신비를 켜 두면 매달 얼마인지 정리해 드릴게요.',
        blocks: (ut.length ? [bars(ut, '공과금·통신비', us)] : []).concat(tips.length ? [{ type: 'steps', title: '줄이는 방법', items: tips }] : []), cites: citeOf(o.cards, ['k-save-utility', 'k-utility']),
        chips: ['관리비에는 뭐가 들어가?', '이번 달 고정비 얼마야?'], steps: ['자취 캘린더에서 공과금 ' + ut.length + '개 모음', '승인된 공과금 줄이기 안내 사용'] });
    }
    // 4) 관리비
    if (/관리비/.test(q)) {
      var fee = items.filter(function (x) { return /관리비/.test(x.name); })[0];
      return done({ text: fee ? '관리비는 매달 **' + won(fee.amount) + '원**이에요(고정비의 ' + Math.round(fee.amount / total * 100) + '%). 관리비는 집주인과 정한 금액이라, 줄이려면 먼저 어떤 항목이 들어가는지 확인해 겹치는 공과금을 정리하는 게 시작이에요.' : '관리비 금액이 없어요. 내 계약 화면에 관리비를 넣어 주세요.',
        blocks: [{ type: 'steps', title: '해 볼 일', items: ['관리비에 수도·인터넷·청소비·공용 전기 중 무엇이 들어가는지 집주인에게 문자로 물어봐요', '들어 있는 항목은 자취 캘린더에서 꺼서 두 번 계산되지 않게 해요', '인터넷이 관리비에 있는데 따로 또 가입했다면 하나를 정리해요'] }], cites: citeOf(o.cards, ['k-fee']),
        actions: [{ label: '관리비 항목 묻는 문자 만들기', bot: 'landlord', q: '관리비 항목 물어보고 싶어' }], chips: ['공과금 줄이는 방법', '이번 달 고정비 얼마야?'], steps: ['관리비 금액과 비중 확인', '승인된 관리비 안내 사용'] });
    }
    // 6) 줄일 수 있는 거
    if (/줄일|아낄|절약|아끼|줄이/.test(q)) {
      var tips = [];
      if (monthly.length) { var pmx = progMonthly(monthly[0]); tips.push('**' + monthly[0].name + '**(' + monthly[0].verdict + ') — 선정되면 매달 최대 ' + won(pmx.per) + '원 줄어요'); }
      ok.filter(function (p) { return monthly.indexOf(p) < 0; }).forEach(function (p) { tips.push(p.name + '(' + p.verdict + ') — ' + (p.amountText || '') + ' 한 번'); });
      var ut2 = items.filter(function (x) { return UTIL.test(x.name); }), us2 = ut2.reduce(function (a, b) { return a + b.amount; }, 0);
      if (ut2.length) tips.push('공과금 ' + won(us2) + '원 — 보일러 외출 모드, 멀티탭으로 대기 전력 끄기');
      tips.push('관리비 ' + (items.filter(function (x) { return /관리비/.test(x.name); })[0] ? won(items.filter(function (x) { return /관리비/.test(x.name); })[0].amount) + '원 ' : '') + '— 들어 있는 항목을 확인해 따로 내는 공과금과 겹치지 않게');
      tips.push('월세 세액공제 — 직장인 무주택 세대주면 연말정산 때 일부 돌려받기');
      return done({ text: '줄일 수 있는 건 ' + tips.length + '가지예요. 가장 큰 건 ' + (monthly.length ? '월세 지원이에요.' : '고정비에서 가장 큰 월세라, 지원·세액공제부터 보세요.'), blocks: [{ type: 'steps', title: '큰 것부터', items: tips }], cites: citeOf(o.cards, ['k-support', 'k-save-utility', 'k-fee', 'k-tax']), chips: ['지원금 받으면 얼마나 줄어?', '공과금 줄이는 방법'], steps: ['고정비에서 줄일 수 있는 항목 찾기', '큰 것부터 정렬'] });
    }
    // 7) 전체 보기
    var save = ok.map(function (p) { return p.name + ' (' + p.verdict + ') — ' + (p.amountText || '') + (p.status ? ' · ' + p.status : ''); });
    save.push('월세 세액공제 — 근로소득이 있는 무주택 세대주면 연말정산 때 낸 월세 일부를 돌려받아요');
    save.push('관리비 항목 확인 — 관리비에 수도·인터넷이 들어 있는데 따로 또 내고 있지 않은지 봐요');
    var text = month + ' 나가는 고정비는 **약 ' + won(total) + '원**이에요.' + (rent ? ' 그중 월세가 **' + share + '%**예요.' : '') + (inSum ? ' 들어오는 돈 ' + won(inSum) + '원을 빼면 실제 부담은 **' + won(total - inSum) + '원**이에요.' : '') + (ok.length ? ' 신청해 볼 수 있는 지원이 ' + ok.length + '개 있어요.' : '');
    return done({ text: text, blocks: [bars(items, month + ' 고정비', total), { type: 'steps', title: '줄일 수 있는 방법', items: save }], cites: citeOf(o.cards, ['k-support', 'k-tax', 'k-fee']),
      chips: ['지원금 받으면 얼마나 줄어?', '공과금 줄이는 방법', '한 달 수입 200만 원이야 예산 짜줘'], steps: ['자취 캘린더에서 이번 달 나가는 돈 ' + items.length + '개 모음', '항목별 비중 계산', '승인된 지원·세액공제 안내에서 줄일 방법 찾기'] });
  }

  // ---------- 동네봇 ----------
  var LOCAL = [[/지하철|전철|역\b|역\s|역$/, 'transit', /역$|지하철|전철/, '지하철역'], [/버스|정류장/, 'transit', /버스|정류/, '버스정류장'], [/위험|무서|밤길|치안|경찰|지구대|파출소|112/, 'safety', null, '경찰서·지구대'], [/약국/, 'medical', /약국/, '약국'], [/병원|의원|치과|내과/, 'medical', /의원|병원|치과|내과/, '병원'], [/빨래|세탁/, 'life', /빨래|세탁/, '빨래방·세탁소'], [/편의점/, 'life', /편의점/, '편의점'], [/마트|장보|다이소|생활/, 'life', /마트|다이소|슈퍼/, '마트'], [/카페|커피/, 'cafe', null, '카페'], [/지하철|역|버스|정류장|교통/, 'transit', null, '교통'], [/공원|산책/, 'park', null, '공원'], [/헬스|운동|체육/, 'gym', null, '운동할 곳'], [/도서관|스터디|공부/, 'study', null, '공부할 곳'], [/주민센터|행정복지센터|청년센터|우체국|관공서/, 'public', null, '공공시설'], [/밥|식당|맛집|먹/, 'food', null, '식당'], [/안전/, 'safety', null, '경찰서·지구대']];
  function localBot(q, o) {
    var P = (o.facts || {}).places || {};
    if (!P.hasHome) return { kind: 'clarify', text: '집 위치를 먼저 정하면 가까운 곳을 걸어서 몇 분인지 알려 드릴게요.', actions: [{ label: '집 위치 정하기', href: '#map' }], steps: ['집 위치가 없음'] };
    if (!P.list || !P.list.length) return { kind: 'clarify', text: '주변 장소를 불러오는 중이에요. 잠시 뒤 다시 물어봐 주세요.', actions: [{ label: '지도 탐색 열기', href: '#map' }], steps: ['장소 데이터를 불러오는 중'] };
    var hit = LOCAL.filter(function (x) { return x[0].test(q); })[0], list;
    if (hit) {
      list = P.list.filter(function (p) { return p.cat === hit[1] && (!hit[2] || hit[2].test(p.name) || hit[2].test(p.sub || '')); }).slice(0, 3);
      if (!list.length) return { kind: 'answer', text: '집 주변 1km 안에서 ' + josa(hit[3], '을를') + ' 찾지 못했어요.', actions: [{ label: '지도에서 직접 찾기', href: '#map' }], topic: ['local'], steps: ['‘' + hit[3] + '’ 찾기: 없음'] };
      var p0 = list[0], extra = hit[1] === 'safety' ? ' 급할 때는 112에 바로 전화하세요.' : '';
      return { kind: 'answer', text: '가장 가까운 ' + josa(hit[3], '은는') + ' **' + p0.name + '**, 걸어서 약 **' + p0.min + '분**(' + p0.m + 'm)이에요.' + (list[1] ? ' 다음은 ' + list[1].name + '(' + list[1].min + '분)이에요.' : '') + extra,
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
  // 말투 다듬기: 초성 줄임말 · 영어 섞인 말 · 흔한 오타를 알아듣게 바꿈 (뜻은 그대로)
  var NORM = [[/ㅈㅇㅅㄱ/g, '전입신고'], [/ㅈㅇㅅ\s*ㅅㄱ|ㅈㅇㅅㅅㄱ/g, '전월세 신고'], [/ㅎㅈㅇㅈ/g, '확정일자'], [/ㅂㅈㄱ/g, '보증금'], [/ㅈㄱㅂㅅ/g, '중개보수'], [/ㄱㄹㅂ/g, '관리비'],
    [/\bdeadline\b/gi, '기한'], [/\brent\b/gi, '월세'], [/\bdeposit\b/gi, '보증금'], [/\bbroken\b/gi, '고장'], [/\blandlord\b/gi, '집주인'], [/\bsupport\b/gi, '지원'], [/\bcontract\b/gi, '계약'],
    [/임대인/g, '집주인'], [/건물주/g, '집주인'], [/임차인/g, '세입자'], [/머라고/g, '뭐라고'], [/어케|어캐/g, '어떻게'], [/머임|뭐임/g, '뭐야'], [/언제임/g, '언제야'], [/얼마임/g, '얼마야'], [/업나|없나여/g, '없나'], [/넘\s/g, '너무 '], [/ㅠ+|ㅜ+|ㅋ+|ㅎ+/g, ' ']];
  function normalize(q) { var t = String(q || ''); NORM.forEach(function (n) { t = t.replace(n[0], n[1]); }); return t.replace(/\s+/g, ' ').trim(); }
  function answer(o) {
    var q = normalize(o.q), want = o.bot && o.bot !== 'auto' ? o.bot : null;
    var last = (o.history || []).length ? o.history[o.history.length - 1] : null;
    // 짧게/다시 써 달라는 요청은 바로 앞 문자에
    if (last && last.bot === 'landlord' && /짧게|간단히|줄여/.test(q) && last.q) { var re = landlordBot(last.q, o); re.preferShort = true; re.text = '짧게 줄여 봤어요.'; re.bot = 'landlord'; re.routed = !want; return re; }
    // 문자 쓰기는 어느 봇에서 물어도 집주인톡이, 위급·지시 무시는 권리봇 규칙이 먼저
    // 인사·감사·"뭐 할 수 있어?" 같은 짧은 말에는 지금 방의 봇이 직접 답한다
    var me = BOTS[want || 'auto'], small = smallTalk(q, want || 'auto');
    if (small) { small.bot = want || 'auto'; small.routed = false; small.blocks = []; small.actions = []; small.cites = []; small.topic = []; return small; }
    // ---------- 같은 방에서 이어 묻기 ----------
    var lastTopic = (last && last.topic && last.topic[0]) || '', fin = function (r, b) { r.bot = b; r.routed = !!want && want !== b; ['blocks', 'actions', 'cites', 'chips', 'steps', 'topic'].forEach(function (k) { r[k] = r[k] || []; }); return r; };
    // 고쳐봇 다음: 안 고쳐 주면 / 내가 고치면 / 문자 써줘
    if (/^repair-/.test(lastTopic) && !matchRepair(q, o.repairs)) {
      var rp = (o.repairs || []).filter(function (x) { return 'repair-' + x.id === lastTopic; })[0];
      if (rp && /안\s*고쳐|안\s*해\s*(줘|준|주)|무시|거절|미뤄|답이\s*없|연락이\s*없/.test(q)) return fin({ kind: 'answer', text: '집주인이 ' + rp.label + ' 수리를 미루면 이렇게 하세요.', blocks: [{ type: 'steps', title: '순서', items: ['문자로 다시 한 번 수리를 요청하고 언제까지 고쳐 달라고 날짜를 적어요 (말로 한 건 기록이 남지 않아요)', '그래도 안 고쳐 주면 먼저 고치고 영수증을 받아 두세요. 집을 쓰는 데 필요한 수리비는 집주인에게 돌려 달라고 할 수 있어요 (민법 제626조)', '다툼이 커지면 주택임대차분쟁조정위원회 조정이나 대한법률구조공단(132) 상담을 받을 수 있어요'] }], actions: [{ label: '다시 요청하는 문자 만들기', bot: 'landlord', q: rp.label + ' 수리 요청했는데 연락이 없어요 다시 보내는 문자 써줘' }], cites: [{ id: 'law-626', title: '민법 제626조 (필요비 상환청구)', src: [['민법 제626조', 'https://www.law.go.kr']] }].concat(citeOf(o.cards, ['k-dispute'])), topic: [lastTopic], chips: ['내가 고치면 돈 돌려받을 수 있어?'], steps: ['앞 대화 이어 받기: ' + rp.label, '수리를 미룰 때 할 일 정리'] }, 'repair');
      if (rp && /내가\s*(고치|고쳐|먼저)|돈\s*돌려|수리비|비용.*(돌려|청구|받)|돌려\s*받/.test(q)) return fin({ kind: 'answer', text: rp.who === 'tenant' ? '**' + josa(rp.label, '은는') + '** 보통 세입자 몫이라 수리비를 돌려받기는 어려워요.' : '**네, 돌려받을 수 있어요.** 집을 쓰는 데 꼭 필요한 수리비(필요비)는 세입자가 먼저 냈어도 집주인에게 돌려 달라고 할 수 있어요 (민법 제626조).', blocks: rp.who === 'tenant' ? [] : [{ type: 'steps', title: '돌려받으려면', items: ['고치기 전에 문자로 집주인에게 먼저 알려요', '수리 전·후 사진과 영수증을 남겨요', '영수증을 보내며 돌려 달라고 문자로 요청해요'] }], actions: rp.who === 'tenant' ? [] : [{ label: '수리비 청구 문자 만들기', bot: 'landlord', q: rp.label + ' 수리비 내가 냈는데 돌려받고 싶어' }], cites: [{ id: 'law-626', title: '민법 제626조 (필요비 상환청구)', src: [['민법 제626조', 'https://www.law.go.kr']] }], topic: [lastTopic], chips: ['집주인이 안 고쳐 주면?'], steps: ['앞 대화 이어 받기: ' + rp.label, '수리비 돌려받기 안내'] }, 'repair');
      if (rp && /문자|써\s*줘|말해|보내|연락/.test(q)) { var rl = landlordBot(rp.label + ' 수리 요청 문자 써줘', o); return fin(rl, 'landlord'); }
    }
    // 집주인톡 다음: 그거 언제 보내?
    if (/^landlord-/.test(lastTopic) && /언제|타이밍|며칠|미리|몇\s*일/.test(q) && !LL.some(function (x) { return x.re.test(q); })) {
      var lid = lastTopic.slice(9), F = o.facts || {}, six = '';
      if (F.end) { var e = F.end.split('.'), m6 = +e[1] - 7, y6 = +e[0] + Math.floor(m6 / 12); m6 = ((m6 % 12) + 12) % 12; var d6 = new Date(y6, m6, Math.min(+e[2], new Date(y6, m6 + 1, 0).getDate())); six = d6.getFullYear() + '.' + String(d6.getMonth() + 1).padStart(2, '0') + '.' + String(d6.getDate()).padStart(2, '0'); }
      var WHEN = { repair: '고장을 알게 된 **그날 바로** 보내세요. 늦게 알려 피해가 커지면 세입자 책임이 될 수 있어요 (민법 제634조).',
        deposit: F.noticeBy ? '계약 만료 2개월 전인 **' + F.noticeBy + '**까지는 보내세요(만료일 ' + F.end + '). 더 일찍 보내도 괜찮아요.' : '계약 만료 2개월 전까지는 보내세요.',
        leave: F.noticeBy ? '늦어도 **' + F.noticeBy + '**(만료 2개월 전)까지 보내야 해요. 그때까지 말이 없으면 같은 조건으로 계약이 이어질 수 있어요.' : '만료 2개월 전까지 보내야 해요.',
        renew: F.noticeBy && six ? '만료 6개월 전부터 2개월 전 사이, **' + six + ' ~ ' + F.noticeBy + '**에 보내야 해요.' : '만료 6개월 전부터 2개월 전 사이에 보내야 해요.',
        late: '월세 내는 날 **전에** 미리 보내세요. 밀린 뒤에 알리는 것보다 먼저 알리는 게 좋아요.', photo: F.move ? '입주 당일(' + F.move + '), **짐을 넣기 전에** 찍어서 바로 보내세요.' : '입주 당일, 짐을 넣기 전에 보내세요.',
        fee: '첫 관리비가 나오기 전에 물어보세요.', payday: '다음 월세 날 **전에** 보내고, 집주인이 괜찮다고 한 뒤부터 바꾼 날짜에 보내세요.', visit: '집 보러 온다는 연락을 받았을 때 바로 답하세요.',
        nocontact: '처음 보낸 뒤 며칠이 지나도 답이 없을 때 보내세요.', refund: '수리를 마치고 영수증을 받은 뒤 바로 보내세요.' };
      return fin({ kind: 'answer', text: WHEN[lid] || '상황이 생긴 뒤 되도록 빨리 보내세요. 문자로 보내야 날짜가 기록으로 남아요.', topic: [lastTopic], cites: citeOf(o.cards, lid === 'repair' ? ['k-repair'] : ['k-moveout']), chips: ['더 짧게 써줘'], steps: ['앞 대화 이어 받기', '보낼 때를 승인된 안내로 계산'] }, 'landlord');
    }
    // 동네봇 다음: 영업시간
    if ((want === 'local' || lastTopic === 'local') && /새벽|24\s*시|영업\s*시간|몇\s*시|여는|문\s*열|닫|밤에\s*(여|열|하는)/.test(q) && !/위험|무서|경찰|치안/.test(q)) return fin({ kind: 'answer', text: '영업시간은 지도 데이터에 없어서 확실히 알려 드리기 어려워요. 지도에서 장소를 누르면 운영 정보가 있는 곳은 함께 보여요. 급한 약은 가까운 편의점의 상비약을, 급한 진료는 119에 물어볼 수 있어요.', actions: [{ label: '지도 탐색 열기', href: '#map' }], topic: ['local'], steps: ['영업시간 정보가 없음을 밝힘'] }, 'local');
    var bot = want || route(q, last && last.bot);
    if (want && want !== 'landlord' && P_WRITE.test(q) && !/알려|뭐|어떻게/.test(q)) bot = 'landlord';
    if (want === 'repair' && !P_REPAIR.test(q)) bot = route(q, 'repair');
    if (want === 'local' && !P_LOCAL.test(q) && /전입|신고|보증금|계약/.test(q)) bot = 'rights';
    var r = bot === 'landlord' ? landlordBot(q, o) : bot === 'repair' ? repairBot(q, o) : bot === 'money' ? moneyBot(q, o) : bot === 'local' ? localBot(q, o) : rightsBot(q, o);
    // 고쳐봇이 물건을 못 찾았으면 권리봇 지식으로 한 번 더
    if (bot === 'repair' && r.kind === 'clarify' && !want) { var r2 = rightsBot(q, o); if (r2.kind === 'answer') { r = r2; bot = 'rights'; } }
    if ((r.topic || [])[0] === 'todo') bot = 'auto'; // 오늘 할 일은 비서가 직접
    // 전입신고·확정일자를 하러 갈 곳을 물으면 가장 가까운 행정복지센터를 함께
    var PL = (o.facts || {}).places;
    if (bot === 'rights' && r.kind === 'answer' && /어디|하러|받으러|가야|가면/.test(q) && /전입|확정일자|주민센터|행정복지센터/.test(q) && PL && PL.hasHome && PL.list) {
      var off = PL.list.filter(function (p) { return p.cat === 'public' && /행정복지센터|주민센터|동사무소/.test(p.name + ' ' + (p.sub || '')); }).slice(0, 2);
      if (off.length) { r.blocks = (r.blocks || []).concat([{ type: 'places', items: off }]); r.steps = (r.steps || []).concat(['집에서 가까운 행정복지센터 찾음']); }
    }
    r.bot = bot; r.routed = !want || want !== bot;
    r.blocks = r.blocks || []; r.actions = r.actions || []; r.cites = r.cites || []; r.chips = r.chips || []; r.steps = r.steps || []; r.topic = r.topic || [];
    if (r.routed) r.steps.unshift((want ? BOTS[want].name + ' 대신 ' : '') + BOTS[bot].name + '에게 맡김');
    return r;
  }
  return { answer: answer, normalize: normalize, route: route, BOTS: BOTS, ORDER: ORDER, matchRepair: matchRepair };
});
