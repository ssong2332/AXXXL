// GET /api/rules — 이용자 화면이 쓰는 승인본 (지원사업 + 코치 지식)
// 승인된 것만 내보낸다. 초안·검수 메모·답 못 한 질문은 내보내지 않는다.
'use strict';
const L = require('./_lib.js');
const R = require('../rules-core.js');

module.exports = async (req, res) => {
  try {
    const P = await L.readJson('published', L.SEED);
    const notices = {};
    Object.keys(P.notices || {}).forEach((id) => {
      const n = P.notices[id];
      notices[id] = { id: n.id, version: n.version, basis: n.basis, approvedAt: n.approvedAt, approvedBy: n.approvedBy, source: n.source, fields: n.fields, changes: n.changes || [], demo: !!n.demo };
    });
    L.send(res, 200, { ok: true, storage: L.storage(), ai: L.aiReady(), updatedAt: (P.meta && P.meta.updatedAt) || '', notices, cards: (P.cards || []).filter((c) => c.status === 'approved'), repairs: P.repairs || L.SEED.repairs || [] }, 'public, s-maxage=20, stale-while-revalidate=60');
  } catch (e) {
    console.error('[rules]', e && e.message);
    L.send(res, 503, { ok: false, error: '승인본을 불러오지 못했어요.' });
  }
};
