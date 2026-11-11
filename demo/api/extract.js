// POST /api/extract — 공고 원문에서 판정 항목을 뽑아 근거 문장과 함께 돌려준다.
//  { sample: 'rent-2026-2' }                → 시연 공고 (누구나, 결과는 저장소에 캐시)
//  { text, sourceName, sourceUrl }          → 붙여넣은·올린 공고 (운영자 코드 필요)
// AI(Claude) 결과도 그대로 쓰지 않는다. 운영자 콘솔이 근거가 원문에 있는지 다시 확인하고, 사람이 승인해야 반영된다.
// AI 키가 없거나 실패하면 내장 AI(rules-core.js의 규칙 엔진)로 대신한다.
'use strict';
const L = require('./_lib.js');
const R = require('../rules-core.js');
const SAMPLES = require('../rules/samples.js');

const FIELD_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['value', 'evidence', 'confidence'],
  properties: {
    value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    evidence: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
  }
};
const KEYS = R.FIELDS.map((f) => f.key);
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['is_housing_notice', 'fields', 'notes'],
  properties: {
    is_housing_notice: { type: 'boolean' },
    fields: { type: 'object', additionalProperties: false, required: KEYS, properties: Object.fromEntries(KEYS.map((k) => [k, FIELD_SCHEMA])) },
    notes: { type: 'array', items: { type: 'string' } }
  }
};
// 시스템 프롬프트는 prompts/extract.md 하나로 관리한다 (내장 AI 추출 규칙과 같은 문서)
const fs = require('fs');
const path = require('path');
const SYSTEM = R.renderPrompt(fs.readFileSync(path.join(__dirname, '..', 'prompts', 'extract.md'), 'utf8'), 'api');

function cleanAi(data) {
  const fields = {};
  KEYS.forEach((k) => {
    const it = (data.fields && data.fields[k]) || {};
    if (it.value === null || it.value === undefined || String(it.value).trim() === '') return;
    fields[k] = { value: String(it.value).trim().slice(0, 2000), evidence: it.evidence ? String(it.evidence).slice(0, 500) : null, confidence: ['high', 'medium', 'low'].indexOf(it.confidence) >= 0 ? it.confidence : 'medium' };
  });
  return { fields, notes: (data.notes || []).slice(0, 12).map((n) => String(n).slice(0, 300)), housing: data.is_housing_notice !== false };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST만 돼요.' });
  const b = L.body(req), started = Date.now();
  const sample = b.sample ? SAMPLES.filter((s) => s.id === b.sample)[0] : null;
  if (b.sample && !sample) return L.send(res, 404, { ok: false, error: '시연 공고를 찾지 못했어요.' });
  const text = sample ? sample.text : String(b.text || '').replace(/\r\n?/g, '\n').trim();
  if (text.length < 40) return L.send(res, 400, { ok: false, error: '공고 원문이 너무 짧아요.' });
  if (text.length > 60000) return L.send(res, 413, { ok: false, error: '원문이 너무 길어요(6만 자까지). 지원 대상·내용·서류 부분만 붙여 주세요.' });

  const rules = (note) => { const fields = R.ruleExtract(text); L.send(res, 200, { ok: true, mode: 'rules', fields, notes: [note].concat(R.extractNotes(text, fields)), ms: Date.now() - started, ai: L.aiReady() }); };
  if (!L.aiReady()) return rules('내장 AI로 추출했어요. 원문과 대조해 확인해 주세요.');
  if (!sample) {
    const who = L.adminState(req);
    if (who !== 'ok') return rules(who === 'unset' ? '직접 올린 공고는 운영자 코드로 들어와야 Claude로 추출해요. 내장 AI로 추출했어요.' : '운영자 코드가 맞지 않아 내장 AI로 추출했어요.');
  }
  if (L.limited(req, sample ? 'extract-sample' : 'extract', sample ? 20 : 60, 3600000)) return L.send(res, 429, { ok: false, error: '추출 요청이 많아요. 잠시 뒤 다시 시도해 주세요.' });

  const cacheKey = sample ? 'extract-' + sample.id : null;
  if (cacheKey && !b.fresh) {
    try { const hit = await L.readJson(cacheKey, null); if (hit) return L.send(res, 200, Object.assign({}, hit, { cached: true, ms: Date.now() - started })); } catch (e) { /* 캐시가 없으면 새로 */ }
  }
  try {
    const src = sample ? sample.source : { name: String(b.sourceName || '').slice(0, 120), url: String(b.sourceUrl || '').slice(0, 300) };
    const out = await L.askJson({
      system: SYSTEM, effort: 'medium', maxTokens: 16000,
      content: '<notice source="' + (src.name || '직접 입력').replace(/"/g, '') + '">\n' + text + '\n</notice>\n\n위 공고문에서 항목을 추출해 줘.',
      schema: SCHEMA
    });
    const c = cleanAi(out.data);
    if (!c.housing) return L.send(res, 200, { ok: true, mode: 'ai', model: out.model, fields: {}, notes: ['청년 주거 지원 공고가 아닌 것 같아요. 원문을 확인해 주세요.'].concat(c.notes), ms: Date.now() - started });
    const payload = { ok: true, mode: 'ai', model: out.model, fields: c.fields, notes: c.notes, usage: { input: out.usage && out.usage.input_tokens, output: out.usage && out.usage.output_tokens }, extractedAt: new Date().toISOString() };
    if (cacheKey) { try { await L.writeJson(cacheKey, payload); } catch (e) { console.error('[extract] cache', e && e.message); } }
    L.send(res, 200, Object.assign({}, payload, { ms: Date.now() - started }));
  } catch (e) {
    console.error('[extract]', e && (e.status || e.code), e && e.message);
    rules(L.aiError(e) + ' 내장 AI로 대신 추출했어요.');
  }
};
