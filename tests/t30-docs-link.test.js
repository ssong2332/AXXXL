// T-30: 서류함 '지원 신청에 낼 서류'의 '발급 받기' 배지가 눌러도 반응 없음
// 서류함 칸이 없는 서류 → docSource() 발급처 링크 → 없으면 그 지원 공고('공고에서 확인') → 공고도 없으면 상태만
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SP = require('../demo/support-core.js');
const JR = require('../demo/rules-core.js');
const JE = require('../demo/engine.js');
const SEED = require('../demo/rules/seed.js');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');
function fnText(sig) {
  const a = HTML.indexOf('  function ' + sig);
  assert.ok(a >= 0, sig + ' 없음');
  const b = HTML.indexOf('\n  }\n', a);
  assert.ok(b > a, sig + ' 끝 없음');
  return HTML.slice(a, b + 4);
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
// app.html의 docsState를 그대로 꺼내 실제 docSource·safeUrl과 함께 돌린다
function load(sp) { return new Function('SP', 'JachwiRules', 'esc', fnText('docsState(') + '\nreturn docsState;')(sp || SP, JR, esc); }
const docsState = load();
const SLOT = { contract: '임대차계약서', bank: '본인 명의 통장 사본', resident: '주민등록등본', rentpay: '월세 이체 내역' };
const prog = (id) => JR.toProgram(SEED.notices[id]);
const stateOf = (p, name) => docsState(JE.docReadiness([name], {}).items[0], SLOT, p);

test('정상 — 국토부 청년월세 가족관계증명서: 전자가족관계등록시스템 링크', () => {
  const st = stateOf(prog('molit-rent'), '청년 및 부·모의 가족관계증명서');
  assert.equal(st.href, 'https://efamily.scourt.go.kr');
  assert.equal(st.label, '전자가족관계등록시스템에서 받기 ↗');
});

test('정상 — 보증료 지원 등기사항·소득금액: 인터넷등기소·홈택스 링크', () => {
  const p = prog('molit-guar');
  assert.equal(stateOf(p, '부동산 등기사항 전부증명서').href, 'https://www.iros.go.kr');
  assert.equal(stateOf(p, '부동산 등기사항 전부증명서').label, '인터넷등기소에서 받기 ↗');
  assert.equal(stateOf(p, '소득금액증빙자료').href, 'https://www.hometax.go.kr');
});

test('경계 — 발급처 없는 신청 양식(docSource null): 그 지원 공고로 "공고에서 확인"', () => {
  const p = prog('molit-rent');
  assert.equal(SP.docSource('월세지원 신청(변경)서'), null);
  const st = stateOf(p, '월세지원 신청(변경)서');
  assert.equal(st.href, 'https://www.jeju.go.kr/city/welfare/monthlyrent.htm');
  assert.match(st.label, /^공고에서 확인/);
});

test('경계 — "공고문 (제출 서류는 공고문에 있음)" 안내 줄도 공고 링크', () => {
  const p = prog('move');
  assert.equal(stateOf(p, '공고문 (제출 서류는 공고문에 있음)').href, p.source.url);
});

test('경계 — 칸 있는 서류는 그대로: 있음 / 올리기 전, 링크 없음', () => {
  const p = prog('molit-rent');
  assert.deepEqual(docsState({ name: '입금통장 사본', slot: 'bank', ready: true }, SLOT, p), { cls: 'brand', icon: 'check', label: '있음', hint: '' });
  const st = docsState({ name: '입금통장 사본', slot: 'bank', ready: false }, SLOT, p);
  assert.equal(st.label, '올리기 전');
  assert.equal(st.href, undefined);
});

test('경계 — 공고 원문 주소가 없으면 신청 누리집(p.url)으로', () => {
  const st = stateOf({ name: 'x', url: 'https://www.bokjiro.go.kr', source: {} }, '서약서');
  assert.equal(st.href, 'https://www.bokjiro.go.kr');
});

test('예외 — 공고 주소도 없거나 안전하지 않으면 행동 문구 없이 상태만', () => {
  for (const p of [{ name: 'x' }, null, { url: '#support', source: { url: 'javascript:alert(1)' } }, { url: 'https://a.kr/"onmouseover=x' }]) {
    const st = stateOf(p, '서약서');
    assert.equal(st.href, undefined, JSON.stringify(p));
    assert.doesNotMatch(st.label + st.hint, /받기|발급|확인/, JSON.stringify(p));
  }
});

test('예외 — docSource가 link가 아니거나 url이 비면 발급처 링크로 쓰지 않음', () => {
  const p = prog('molit-rent');
  for (const src of [{ t: 'bankP', label: '받는 방법 보기', url: '' }, { t: 'link', label: '어딘가에서 받기', url: '' }, { t: 'docs', label: '서류함에서 꺼내기', url: '#docs' }, { t: 'link', label: '나쁜', url: 'javascript:alert(1)' }]) {
    const ds = load(Object.assign({}, SP, { docSource: () => src }));
    const st = ds({ name: '무엇', slot: null, ready: false }, SLOT, p);
    assert.equal(st.href, p.source.url, JSON.stringify(src));
  }
});

test('예외 — 실제 공고 전체에 "발급 받기" 0건, 링크는 모두 http(s)', () => {
  for (const id of Object.keys(SEED.notices)) {
    const p = prog(id);
    for (const it of JE.docReadiness(p.docs || [], {}).items) {
      const st = docsState(it, SLOT, p);
      assert.notEqual(st.label, '발급 받기', id + ' ' + it.name);
      if (st.href) assert.match(st.href, /^https?:\/\//, id + ' ' + it.name);
    }
  }
});

test('화면 — viewDocs가 지원(x.p)을 넘기고 링크를 새 탭·noopener·esc로 그림', () => {
  const v = fnText('viewDocs(');
  assert.match(v, /docsState\(it, slotName, x\.p\)/);
  assert.match(v, /st\.href \? '<a [^']*href="' \+ esc\(st\.href\) \+ '" target="_blank" rel="noopener"/);
  assert.match(v, /esc\(st\.label\)/);
  assert.doesNotMatch(HTML, /'발급 받기'/);
});
