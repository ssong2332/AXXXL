// POST /api/coach — AI 자취 코치
// { q: '질문', facts: { 이용자 화면에서 계산한 날짜·금액 } }
// 1) 승인된 지식 카드 + 승인된 공고에서 질문과 가까운 것만 골라
// 2) Claude가 그 카드 안에서만 답하게 하고 (쓴 카드 번호를 함께 받음)
// 3) 답에 나온 숫자가 카드·계산값에 실제로 있는지 다시 확인한다.
// 맞는 카드가 없거나 확인에 실패하면 답하지 않고, 질문을 운영자 "답 못 한 질문"에 남긴다(질문 글만, 개인 정보 없이).
'use strict';
const L = require('./_lib.js');
const R = require('../rules-core.js');

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['kind', 'answer', 'card_ids'],
  properties: {
    kind: { type: 'string', enum: ['answer', 'partial', 'clarify', 'refuse'] },
    answer: { type: 'string' },
    card_ids: { type: 'array', items: { type: 'string' } }
  }
};
// 시스템 프롬프트는 prompts/coach.md 하나로 관리한다 (내장 AI 코치 coach-core.js 와 같은 규칙)
const fs = require('fs');
const path = require('path');
const SYSTEM = R.renderPrompt(fs.readFileSync(path.join(__dirname, '..', 'prompts', 'coach.md'), 'utf8'), 'api');
function factsCard(f) { const b = R.factsBlock(f); return b ? { id: 'facts', title: '내 계약으로 계산한 값', block: b, body: b, cite: [['내 계약 화면', '#contract']] } : null; }
function esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
// 답에 나온 숫자가 근거 안에 있는지
function numbersGrounded(answer, context) {
  const ctx = context.replace(/(\d),(?=\d{3})/g, '$1'), pool = new Set(R.digits(ctx).concat(R.manwon(ctx).map(String)));
  const bad = R.digits(answer).filter((n) => !pool.has(n) && ctx.indexOf(n) < 0);
  return { ok: !bad.length, bad };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST만 돼요.' });
  const b = L.body(req), q = String(b.q || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (q.length < 2) return L.send(res, 400, { ok: false, error: '질문을 적어 주세요.' });
  if (L.limited(req, 'coach', 30, 600000)) return L.send(res, 429, { ok: false, error: '질문이 많아요. 잠시 뒤 다시 물어봐 주세요.' });
  if (!L.aiReady()) return L.send(res, 200, { ok: true, mode: 'unavailable' });

  let st;
  try { st = await L.loadAll(); } catch (e) { console.error('[coach] store', e && e.message); return L.send(res, 200, { ok: true, mode: 'unavailable' }); }
  const view = R.publicView(st.published);
  const pool = view.cards.concat(R.noticeCards(view.programs));
  const top = R.retrieve(q, pool, 6).map((x) => x.card);
  const miss = async (reason) => {
    try { R.logMiss(st.unanswered, q, top.map((c) => c.id), reason); await L.writeJson('unanswered', st.unanswered); } catch (e) { console.error('[coach] log', e && e.message); }
    L.send(res, 200, { ok: true, mode: 'refuse', reason, logged: true });
  };
  if (!top.length) return miss('no_card');

  const fc = factsCard(b.facts), cards = fc ? top.concat([fc]) : top;
  const context = R.cardsBlock(top) + (fc ? '\n' + fc.block : '');
  try {
    const out = await L.askJson({
      system: SYSTEM, effort: 'low', maxTokens: 2000, timeoutMs: 25000, schema: SCHEMA,
      content: '<cards>\n' + context + '\n</cards>\n\n<question>' + esc(q) + '</question>'
    });
    const d = out.data, known = new Set(cards.map((c) => c.id));
    const used = (d.card_ids || []).filter((id) => known.has(id));
    if (d.kind === 'refuse' || !String(d.answer || '').trim()) return miss('not_covered');
    if (d.kind !== 'clarify' && !used.length) return miss('not_covered');
    const g = numbersGrounded(d.answer, context);
    if (!g.ok) { console.warn('[coach] ungrounded numbers', g.bad); return miss('unverified_number'); }
    const cites = used.map((id) => { const c = cards.filter((x) => x.id === id)[0]; return { id, title: c.title, src: c.cite || [] }; });
    L.send(res, 200, { ok: true, mode: 'ai', kind: d.kind, answer: String(d.answer).slice(0, 1200), cites, model: out.model });
  } catch (e) {
    console.error('[coach]', e && (e.status || e.code), e && e.message);
    L.send(res, 200, { ok: true, mode: 'error', error: L.aiError(e) });
  }
};
