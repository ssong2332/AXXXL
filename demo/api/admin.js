// /api/admin — 운영자 콘솔 (x-admin-token 필요)
// GET: 승인본 전체 + 검수 대기 초안 + 답 못 한 질문
// POST { op, ... }: saveDraft · deleteDraft · reject · publish · rollback · saveCard · deleteCard · resolveQuestion
'use strict';
const L = require('./_lib.js');
const R = require('../rules-core.js');

module.exports = async (req, res) => {
  const who = L.adminState(req);
  if (who === 'unset') return L.send(res, 503, { ok: false, code: 'not_configured', error: '서버에 운영자 코드(ADMIN_TOKEN)가 설정되지 않았어요. 이 브라우저 연습 모드로 쓸 수 있어요.' });
  if (who !== 'ok') { if (L.limited(req, 'admin-bad', 10, 600000)) return L.send(res, 429, { ok: false, error: '잠시 뒤 다시 시도해 주세요.' }); return L.send(res, 401, { ok: false, code: 'bad_token', error: '운영자 코드가 맞지 않아요.' }); }
  try {
    const st = await L.loadAll();
    if (req.method === 'GET') return L.send(res, 200, { ok: true, storage: L.storage(), ai: L.aiReady(), ...st });
    if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'GET 또는 POST만 돼요.' });
    const b = L.body(req);
    const out = R.applyOp(st, b, b.reviewer || req.headers['x-admin-name'] || '운영자');
    if (!out.ok) return L.send(res, 400, out);
    await Promise.all((out.changed || []).map((name) => L.writeJson(name, st[name])));
    L.send(res, 200, { ok: true, result: out.result || null, storage: L.storage(), ...st });
  } catch (e) {
    console.error('[admin]', e && e.message);
    L.send(res, 500, { ok: false, error: '저장소 처리 중 오류가 났어요.' });
  }
};
