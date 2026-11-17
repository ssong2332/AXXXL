// 기한 알림(웹 푸시) — api/_push.js 의 '오늘 보낼 알림' 고르기와 크론 인증, 계정 client 의 푸시 주소 저장
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const P = require('../demo/api/_push.js');
const JA = require('../demo/account-core.js');

// 2026-11-17 00:00 UTC = 한국 09:00
const NOW = Date.UTC(2026, 10, 17, 0, 0);
const enc = (o) => 'z' + zlib.deflateRawSync(Buffer.from(JSON.stringify(o))).toString('base64url');

test('kstYmd: 한국 날짜로 센다 (UTC 자정 직전도 한국은 다음 날)', () => {
  assert.equal(P.kstYmd(NOW), '20261117');
  assert.equal(P.kstYmd(Date.UTC(2026, 10, 16, 16, 0)), '20261117');
  assert.equal(P.kstYmd(NOW, 3), '20261120');
});

test('dueMessage: 오늘 기한·내 일정과 미리 알림(3일 전)을 한 알림으로 묶는다', () => {
  const m = P.dueMessage({ r: '3d', e: [['20261117', '전입신고'], ['20261120', '전월세 신고'], ['20261125', '먼 일정']], t: [['202611171400', '보일러 점검', 60]] }, NOW);
  assert.match(m.title, /오늘 챙길 일 2개/);
  assert.match(m.body, /오늘 · 14:00 보일러 점검/);
  assert.match(m.body, /오늘 · 전입신고/);
  assert.match(m.body, /3일 뒤 · 전월세 신고/);
  assert.doesNotMatch(m.body, /먼 일정/);
  assert.equal(m.tag, 'jachwi-20261117');
});

test('dueMessage: 미리 알림이 당일(0d)이면 다가오는 기한은 보내지 않고, 보낼 게 없으면 null', () => {
  assert.equal(P.dueMessage({ r: '0d', e: [['20261120', '전월세 신고']] }, NOW), null);
  const m = P.dueMessage({ r: '1d', e: [['20261118', '잔금']] }, NOW);
  assert.match(m.title, /내일 기한 1개/);
});

test('billOn: 매달 반복 돈은 ics.js RRULE과 같은 날에만 (말일·주기·횟수·끝나는 날)', () => {
  const rent = ['월세', 450000, 17, 1, 0, '202611', 'o', '20281111'];
  assert.equal(P.billOn(rent, '20261117'), true);
  assert.equal(P.billOn(rent, '20261017'), false);           // 시작 전
  assert.equal(P.billOn(rent, '20281217'), false);           // 계약 끝난 뒤
  assert.equal(P.billOn(['관리비', 70000, 31, 1, 0, '202602', 'o', ''], '20260228'), true);   // 말일
  assert.equal(P.billOn(['가스', 30000, 5, 2, 0, '202611', 'o', ''], '20261205'), false);     // 2개월마다
  assert.equal(P.billOn(['가스', 30000, 5, 2, 0, '202611', 'o', ''], '20270105'), true);
  assert.equal(P.billOn(['지원금', 200000, 25, 1, 2, '202611', 'i', ''], '20270125'), false); // 2회 끝
  const m = P.dueMessage({ b: [rent, ['청년월세', 200000, 17, 1, 0, '202611', 'i', '']] }, NOW);
  assert.match(m.body, /월세 450,000원 내는 날/);
  assert.match(m.body, /청년월세 200,000원 들어오는 날/);
});

test('handler: CRON_SECRET 없이 부르면 401, 설정이 없으면 503', async () => {
  const mk = () => { const r = { statusCode: 0, headers: {}, body: '' }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (b) => { r.body = b; return r; }; return r; };
  const env = { CRON_SECRET: 'x'.repeat(40) };
  let res = mk(); await P.handler({ headers: {} }, res, { env }); assert.equal(res.statusCode, 401);
  res = mk(); await P.handler({ headers: { authorization: 'Bearer wrong' } }, res, { env }); assert.equal(res.statusCode, 401);
  res = mk(); await P.handler({ headers: { authorization: 'Bearer ' + env.CRON_SECRET } }, res, { env }); assert.equal(res.statusCode, 503);
});

test('handler: 보낼 것만 보내고, 사라진 주소(410)는 push_drop 으로 지운다', async () => {
  const env = { CRON_SECRET: 's'.repeat(40), SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(30), VAPID_PUBLIC_KEY: 'B'.repeat(87), VAPID_PRIVATE_KEY: 'p'.repeat(43) };
  const calls = [];
  const fetch = async (url, opt) => { calls.push([url.split('/rpc/')[1], JSON.parse(opt.body)]); const rows = url.endsWith('push_targets') ? [
    { ep: 'https://push.example/a', key_p256dh: 'k', key_auth: 'a', feed: enc({ r: '1d', e: [['20261117', '전입신고']] }) },
    { ep: 'https://push.example/b', key_p256dh: 'k', key_auth: 'a', feed: enc({ r: '1d', e: [['20270101', '먼 일']] }) },
    { ep: 'https://push.example/gone', key_p256dh: 'k', key_auth: 'a', feed: enc({ e: [['20261117', '잔금']] }) }] : null;
    return { ok: true, text: async () => rows ? JSON.stringify(rows) : '' }; };
  const sent = [];
  const webpush = { setVapidDetails() {}, async sendNotification(sub, body) { if (sub.endpoint.endsWith('gone')) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push([sub.endpoint, JSON.parse(body)]); } };
  const res = { statusCode: 0, setHeader() {}, end(b) { this.body = b; } };
  await P.handler({ headers: { authorization: 'Bearer ' + env.CRON_SECRET } }, res, { env, fetch, webpush, now: NOW });
  const out = JSON.parse(res.body);
  assert.deepEqual([out.devices, out.sent, out.skipped, out.dropped], [3, 1, 1, 1]);
  assert.equal(sent[0][0], 'https://push.example/a');
  assert.match(sent[0][1].body, /전입신고/);
  assert.deepEqual(calls.map((c) => c[0]), ['push_targets', 'push_drop']);
  assert.equal(calls[1][1].p_endpoint, 'https://push.example/gone');
});

test('account client: pushSave 는 https 주소와 키가 있어야 하고 push_save RPC로 보낸다', async () => {
  const seen = [];
  const F = async (url, opt) => { seen.push([url, opt]); return { ok: true, text: async () => '' }; };
  const store = { get: () => JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: 9e9, user: { id: 'u1' } }), set() {}, del() {} };
  const c = JA.client({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_x' }, { fetch: F, store, now: () => 0 });
  await assert.rejects(c.pushSave({ endpoint: 'http://x', keys: { p256dh: 'a', auth: 'b' } }));
  await c.pushSave({ endpoint: 'https://push.example/a', keys: { p256dh: 'pk', auth: 'ak' } });
  assert.match(seen[0][0], /\/rest\/v1\/rpc\/push_save$/);
  assert.deepEqual(JSON.parse(seen[0][1].body), { p_endpoint: 'https://push.example/a', p_p256dh: 'pk', p_auth: 'ak' });
  await c.pushRemove('https://push.example/a');
  assert.match(seen[1][0], /push_subs\?endpoint=eq\.https%3A%2F%2Fpush\.example%2Fa/);
  assert.equal(seen[1][1].method, 'DELETE');
});
