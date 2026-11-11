// 서버 함수 공용: 저장소(Vercel Blob 또는 메모리), 운영자 확인, 요청 제한, Claude 호출
// 밑줄(_)로 시작하는 파일은 Vercel이 주소로 열지 않는다.
'use strict';

const crypto = require('crypto');
const SEED = require('../rules/seed.js');

const MODEL = 'claude-opus-5-5';
const PREFIX = 'jachwi/';
const mem = {};
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- 저장소 ----------
// BLOB_READ_WRITE_TOKEN 이 있으면 Vercel Blob(비공개)에, 없으면 이 서버 인스턴스 메모리에 (재시작하면 사라짐)
function storage() { return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'memory'; }
let blobMod = null;
function blob() { if (!blobMod) blobMod = require('@vercel/blob'); return blobMod; }

async function readJson(name, fallback) {
  if (storage() !== 'blob') return name in mem ? clone(mem[name]) : clone(fallback);
  try {
    const r = await blob().get(PREFIX + name + '.json', { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return clone(fallback);
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (e && /NotFound/.test(e.name || '')) return clone(fallback);
    throw e;
  }
}
async function writeJson(name, data) {
  if (storage() !== 'blob') { mem[name] = clone(data); return; }
  await blob().put(PREFIX + name + '.json', JSON.stringify(data), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
}
const EMPTY = { drafts: { items: [] }, unanswered: { items: [] } };
async function loadAll() {
  const [published, drafts, unanswered] = await Promise.all([readJson('published', SEED), readJson('drafts', EMPTY.drafts), readJson('unanswered', EMPTY.unanswered)]);
  return { published, drafts, unanswered };
}

// ---------- 운영자 확인 ----------
// ADMIN_TOKEN 환경변수와 x-admin-token 헤더 비교. 'unset' | 'ok' | 'bad'
function adminState(req) {
  const want = process.env.ADMIN_TOKEN;
  if (!want) return 'unset';
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(req.headers['x-admin-token'] || ''), h(want)) ? 'ok' : 'bad';
}

// ---------- 요청 제한 (인스턴스별, 대략적) ----------
const hits = new Map();
function limited(req, key, max, windowMs) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const k = key + ':' + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

// ---------- Claude ----------
function aiReady() { return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN); }
let client = null;
function claude() {
  if (!aiReady()) return null;
  if (!client) { const Anthropic = require('@anthropic-ai/sdk').default; client = new Anthropic({ maxRetries: 1 }); }
  return client;
}
// 구조화 출력(JSON 스키마)으로 한 번 묻고 결과를 돌려준다.
// 안전 분류기가 거절하면 서버 쪽 대체 모델로 다시 시도한다(server-side fallback).
async function askJson({ system, content, schema, effort, maxTokens, timeoutMs }) {
  const c = claude();
  if (!c) { const e = new Error('AI 키가 설정되지 않았어요.'); e.code = 'no_key'; throw e; }
  const resp = await c.beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens || 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: effort || 'medium', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content }]
  }, { timeout: timeoutMs || 100000 });
  if (resp.stop_reason === 'refusal') { const e = new Error('AI가 이 요청을 처리하지 않았어요.'); e.code = 'refusal'; throw e; }
  if (resp.stop_reason === 'max_tokens') { const e = new Error('AI 답이 너무 길어 잘렸어요.'); e.code = 'max_tokens'; throw e; }
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { data: JSON.parse(text), model: resp.model, usage: resp.usage };
}
function aiError(e) {
  const A = (() => { try { return require('@anthropic-ai/sdk').default; } catch (x) { return null; } })();
  if (e && e.code) return e.message;
  if (A && e instanceof A.AuthenticationError) return 'AI 키가 올바르지 않아요.';
  if (A && e instanceof A.RateLimitError) return 'AI 요청이 몰려 잠시 쉬어야 해요.';
  if (A && e instanceof A.BadRequestError) return 'AI 요청 형식에 문제가 있어요.';
  if (A && e instanceof A.APIConnectionError) return 'AI 서버에 연결하지 못했어요.';
  if (A && e instanceof A.APIError) return 'AI 서버 오류(' + e.status + ')예요.';
  if (e instanceof SyntaxError) return 'AI 답을 읽지 못했어요.';
  return 'AI 처리 중 오류가 났어요.';
}

function send(res, code, body, cache) {
  res.setHeader('Cache-Control', cache || 'no-store');
  res.status(code).json(body);
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = { MODEL, SEED, storage, readJson, writeJson, loadAll, adminState, limited, aiReady, askJson, aiError, send, body };
