// 공고 규칙 엔진 테스트 — 실행: node --test tests/rules.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../demo/rules-core.js');
const SEED = require('../demo/rules/seed.js');
const SAMPLES = require('../demo/rules/samples.js');
const clone = (x) => JSON.parse(JSON.stringify(x));

test('금액 표기를 만 원 단위로 바꾼다', () => {
  assert.deepEqual(R.manwon('임차보증금 8천만 원 이하'), [8000]);
  assert.deepEqual(R.manwon('2억 원 이하'), [20000]);
  assert.deepEqual(R.manwon('1억 2천만 원'), [12000]);
  assert.equal(R.normalize('rent_max', '70만 원'), 70);
  assert.equal(R.normalize('period_end', '2026. 11. 27.(금)'), '2026-11-27');
  assert.equal(R.normalize('homeless', '예'), true);
});

test('처음 승인본은 근거가 모두 원문에 있다', () => {
  for (const id of Object.keys(SEED.notices)) {
    const n = SEED.notices[id];
    assert.equal(R.check(n.fields, n.sourceText, null).count, 0, id);
  }
});

test('원문에 없는 근거와 맞지 않는 숫자를 잡아낸다', () => {
  const src = SAMPLES[0].text;
  const c = R.check({
    rent_max: { value: '60', evidence: '다. 임차보증금 8천만 원 이하 및 월세 70만 원 이하 건물에 월세로 거주하는 자', confidence: 'high' },
    deposit_max: { value: '8000', evidence: '보증금은 1억 원 이하로 한다', confidence: 'high' },
    docs: { value: '임대차계약서\n인감증명서', evidence: '6. 제출 서류', confidence: 'high' }
  }, src, null);
  assert.ok(c.byKey.rent_max.flags.includes('value_mismatch'));
  assert.ok(c.byKey.deposit_max.flags.includes('not_in_source'));
  assert.ok(c.byKey.docs.flags.includes('item_not_in_source'));
  assert.ok(c.byKey.name.flags.includes('missing'));
});

test('지난 승인본과 달라진 항목은 사람이 확인해야 승인된다', () => {
  const prev = R.values(SEED.notices.rent.fields);
  const f = clone(SEED.notices.rent.fields);
  const line = ' 다. 임차보증금 8천만 원 이하 및 월세 70만 원 이하 건물에 월세로 거주하는 자';
  f.rent_max = { value: '70', evidence: line, confidence: 'high' };
  f.deposit_max = { value: '8000', evidence: line, confidence: 'high' };
  const src = SEED.notices.rent.sourceText.replace('월세 60만 원 이하', '월세 70만 원 이하');
  let r = R.readyToApprove(f, src, prev, {});
  assert.equal(r.ok, false);
  assert.deepEqual(r.left.map((x) => x.key), ['rent_max']);
  r = R.readyToApprove(f, src, prev, { rent_max: true });
  assert.equal(r.ok, true);
});

test('자격 판정: 나이·소득·주거비·마감', () => {
  const p = R.toProgram(SEED.notices.rent, new Date('2026-11-10'));
  const ok = R.evalProgram(p, { age: 25, income: '100', deposit: 500, rent: 50, gu: '관악구' });
  assert.equal(R.verdict(ok), '해당 가능');
  assert.equal(R.verdict(R.evalProgram(p, { age: 40, income: '100', deposit: 500, rent: 50, gu: '관악구' })), '해당 안 됨');
  assert.equal(R.verdict(R.evalProgram(p, { age: 25, income: 'unknown', deposit: 500, rent: 50, gu: '관악구' })), '확인 필요');
  assert.equal(R.verdict(R.evalProgram(p, { age: 25, income: 'over', deposit: 500, rent: 50, gu: '관악구' })), '해당 안 됨');
  const closed = R.toProgram(SEED.notices.move, new Date('2027-01-05'));
  assert.equal(closed.status, '접수 마감');
  assert.equal(R.verdict(R.evalProgram(closed, { age: 25, income: '100', deposit: 500, rent: 50, gu: '관악구' })), '마감');
});

test('대상자 시뮬레이션은 판정이 바뀌는 사람을 찾는다', () => {
  const next = clone(SEED.notices.rent);
  next.fields.rent_max.value = 70;
  const rows = R.simulate(SEED.notices.rent, next, new Date('2026-11-10'));
  assert.ok(rows.some((x) => x.changed && x.persona.rent === 70));
});

test('발행·되돌리기·지식 저장은 같은 규칙으로 처리된다', () => {
  const st = { published: clone(SEED), drafts: { items: [] }, unanswered: { items: [] } };
  const s = SAMPLES[2];
  const fields = R.ruleExtract(s.text);
  let out = R.applyOp(st, { op: 'saveDraft', draft: { noticeId: 'move', sourceText: s.text, fields, source: s.source } }, '시험');
  assert.ok(out.ok);
  const id = out.result.id;
  assert.equal(R.applyOp(st, { op: 'publish', id }, '시험').ok, false); // 확인 안 함
  const acks = {};
  const c = R.check(st.drafts.items[0].fields, s.text, R.values(st.published.notices.move.fields));
  Object.keys(c.byKey).forEach((k) => { if (c.byKey[k].must) acks[k] = true; });
  st.drafts.items[0].acks = acks;
  out = R.applyOp(st, { op: 'publish', id }, '시험');
  assert.ok(out.ok, out.error);
  assert.equal(st.published.notices.move.version, 2);
  assert.equal(R.normalize('period_end', st.published.notices.move.fields.period_end.value), '2026-11-30');
  out = R.applyOp(st, { op: 'rollback', noticeId: 'move', version: 1 }, '시험');
  assert.ok(out.ok);
  assert.equal(st.published.notices.move.version, 3);
  assert.equal(R.normalize('period_end', st.published.notices.move.fields.period_end.value), '2026-12-31');
  assert.equal(R.applyOp(st, { op: 'saveCard', card: { title: '근거 없음', body: '내용' } }, '시험').ok, false);
  assert.ok(R.applyOp(st, { op: 'saveCard', card: { title: '반려동물', body: '계약서 특약으로 정한다.', cite: [['표준계약서', 'https://www.law.go.kr']] } }, '시험').ok);
});

test('코치 지식 찾기: 맞는 카드가 없으면 비어 있다', () => {
  assert.equal(R.retrieve('전입신고 언제까지 해야 돼?', SEED.cards)[0].card.id, 'k-movein');
  assert.equal(R.retrieve('복비 얼마 내야 해', SEED.cards)[0].card.id, 'k-broker');
  assert.equal(R.retrieve('집주인이 월세 올려 달래', SEED.cards)[0].card.id, 'k-raise');
  assert.equal(R.retrieve('오늘 날씨 어때', SEED.cards).length, 0);
});
