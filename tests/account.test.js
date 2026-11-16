// 계정(선택) 동기화: 무엇을 올리고(pick), 어떻게 합치고(apply·decide), 토큰을 어떻게 다루는지(client)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../demo/account-core.js');
const config = require('../demo/api/config.js');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(claims) + '.sig';

test('pick: 위치·대화·사진 기록·서류·화면 상태는 올리지 않는다', () => {
  const S = { deposit: 1000, rent: 45, contract: '2026-11-02', done: { t1: true }, bills: [{ id: 'rent' }], nick: '성준',
    home: { lat: 37.1, lng: 126.9 }, commute: { lat: 1, lng: 2 }, rgc: { lat: 1 }, saved: { a: 1 }, savedP: { b: 1 },
    chat: [{ q: 'x' }], rooms: { auto: [] }, cond: { in: {} }, files: [{ id: 'f' }], demo: false, sim: 3, mapSel: 'p1' };
  const o = A.pick(S);
  assert.deepEqual(Object.keys(o).sort(), ['bills', 'contract', 'deposit', 'done', 'nick', 'rent']);
  for (const k of ['home', 'commute', 'rgc', 'saved', 'savedP', 'chat', 'rooms', 'cond', 'files']) assert.ok(A.PRIVATE.includes(k), k);
  o.done.t1 = false; assert.equal(S.done.t1, true, '복사본이어야 한다');
});

test('pick: 너무 큰 기록은 올리지 않는다', () => {
  assert.equal(A.pick({ events: Array.from({ length: 5000 }, (_, i) => ({ id: 'e' + i, title: 'x'.repeat(40) })) }), null);
});

test('apply: 서버 기록을 덮되 이 기기의 위치·대화는 그대로, 예시 모드는 끈다', () => {
  const S = { deposit: 1, home: { lat: 1 }, chat: [1], demo: true };
  A.apply(S, { deposit: 500, home: { lat: 9 }, chat: [], onboarded: true, __proto__: { bad: 1 } });
  assert.equal(S.deposit, 500); assert.deepEqual(S.home, { lat: 1 }); assert.deepEqual(S.chat, [1]);
  assert.equal(S.onboarded, true); assert.equal(S.demo, false); assert.equal(({}).bad, undefined);
});

test('decide: 최근 것을 남기고, 빈 기기는 서버 것을 가져온다', () => {
  assert.equal(A.decide(null, 0, 100, false), 'push');
  assert.equal(A.decide({ a: 1 }, 200, 100, false), 'pull');
  assert.equal(A.decide({ a: 1 }, 100, 200, false), 'push');
  assert.equal(A.decide({ a: 1 }, 100, 100, false), 'same');
  assert.equal(A.decide({ a: 1 }, 100, 200, true), 'pull', '온보딩 전·예시 모드면 서버 것');
  assert.equal(A.decide({ a: 1 }, 100, 0, false), 'pull', '고친 시각 기록이 없으면 서버 것');
});

test('parseAuthHash: OAuth에서 돌아온 토큰·오류를 읽고, 화면 주소는 무시한다', () => {
  assert.equal(A.parseAuthHash('#home'), null);
  assert.equal(A.parseAuthHash('#demo'), null);
  const at = jwt({ sub: 'u1', email: 'a@b.kr', exp: 2000000000, app_metadata: { provider: 'kakao' } });
  const r = A.parseAuthHash('#access_token=' + at + '&expires_in=3600&refresh_token=r1&token_type=bearer&type=signup');
  assert.equal(r.session.user.id, 'u1'); assert.equal(r.session.user.provider, 'kakao'); assert.equal(r.session.expires_at, 2000000000); assert.equal(r.session.type, 'signup');
  assert.match(A.parseAuthHash('#error=access_denied&error_description=User+cancelled').error, /User cancelled/);
});

// 가짜 Supabase
function fake() {
  const rows = {}; const calls = []; let n = 0;
  const tok = (sub, exp) => ({ access_token: jwt({ sub, email: sub + '@x.kr', exp }), refresh_token: 'r' + (++n), expires_in: 3600, expires_at: exp, user: { id: sub, email: sub + '@x.kr', app_metadata: { provider: 'email' }, user_metadata: {} } });
  const res = (status, body) => Promise.resolve({ ok: status < 300, status, text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)) });
  const io = {
    now: () => 1_700_000_000_000,
    store: (() => { const m = {}; return { get: (k) => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; }, del: (k) => { delete m[k]; }, m }; })(),
    fetch: (url, opt) => {
      const u = new URL(url); const body = opt.body ? JSON.parse(opt.body) : null; calls.push({ path: u.pathname + u.search, opt, body });
      assert.equal(opt.headers.apikey, 'sb_publishable_test');
      if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') return body.password === 'pw1234' ? res(200, tok('u1', 1_700_003_600)) : res(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') return body.refresh_token === 'dead' ? res(400, { error_code: 'refresh_token_not_found' }) : res(200, tok('u1', 1_700_007_200));
      if (u.pathname === '/rest/v1/user_state' && opt.method === 'GET') { const id = u.searchParams.get('user_id').replace('eq.', ''); return res(200, rows[id] ? [rows[id]] : []); }
      if (u.pathname === '/rest/v1/user_state' && opt.method === 'POST') { rows[body.user_id] = { state: body.state, updated_at: body.updated_at }; return res(201); }
      if (u.pathname === '/rest/v1/rpc/delete_me') return res(204);
      if (u.pathname === '/auth/v1/logout') return res(204);
      return res(404, { msg: 'nope' });
    }
  };
  return { io, rows, calls };
}

test('client: 이메일 로그인 → 올리기 → 받기, 본인 토큰과 본인 줄만 쓴다', async () => {
  const f = fake(); const c = A.client({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_test' }, f.io);
  await assert.rejects(c.signIn('u1@x.kr', 'nope'), /이메일이나 비밀번호가 맞지 않아요/);
  const s = await c.signIn('u1@x.kr', 'pw1234');
  assert.equal(s.user.id, 'u1'); assert.ok(f.io.store.m['jachwi-auth'], '세션을 기억한다');
  assert.equal(await c.pull(), null);
  const at = await c.push({ deposit: 500 });
  assert.equal(at, 1_700_000_000_000);
  const post = f.calls.find((x) => x.opt.method === 'POST' && x.path.startsWith('/rest/v1/user_state'));
  assert.match(post.opt.headers.Authorization, /^Bearer /); assert.equal(post.body.user_id, 'u1'); assert.match(post.opt.headers.Prefer, /merge-duplicates/);
  const got = await c.pull(); assert.deepEqual(got.state, { deposit: 500 }); assert.equal(got.at, at);
  const get = f.calls.filter((x) => x.opt.method === 'GET').pop(); assert.match(get.path, /user_id=eq\.u1/);
});

test('client: 만료가 가까우면 새 토큰으로 바꾸고, 바꿀 수 없으면 로그아웃 상태가 된다', async () => {
  const f = fake();
  f.io.store.set('jachwi-auth', JSON.stringify({ access_token: 'old', refresh_token: 'r0', expires_at: 1_700_000_030, user: { id: 'u1' } }));
  const c = A.client({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_test' }, f.io);
  await c.pull();
  assert.ok(f.calls.some((x) => /grant_type=refresh_token/.test(x.path)));
  assert.equal(c.session().expires_at, 1_700_007_200);
  f.io.store.set('jachwi-auth', JSON.stringify({ access_token: 'old', refresh_token: 'dead', expires_at: 1, user: { id: 'u1' } }));
  const c2 = A.client({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_test' }, f.io);
  await assert.rejects(c2.pull());
  assert.equal(c2.session(), null);
});

test('client: 카카오는 이메일 동의 없이 닉네임·프로필만 요청하고, 탈퇴는 delete_me를 부른다', async () => {
  const f = fake(); const c = A.client({ url: 'https://abcdefghijklmnopqrst.supabase.co/', key: 'sb_publishable_test' }, f.io);
  const k = new URL(c.oauthUrl('kakao', 'https://jachwi-navi.vercel.app/app.html'));
  assert.equal(k.pathname, '/auth/v1/authorize'); assert.equal(k.searchParams.get('scopes'), 'profile_nickname profile_image');
  assert.equal(k.searchParams.get('redirect_to'), 'https://jachwi-navi.vercel.app/app.html');
  assert.equal(new URL(c.oauthUrl('google', 'x')).searchParams.get('scopes'), null);
  await c.signIn('u1@x.kr', 'pw1234'); await c.deleteMe();
  assert.ok(f.calls.some((x) => x.path === '/rest/v1/rpc/delete_me')); assert.equal(c.session(), null);
});

test('/api/config: 공개 키만 내보낸다 (service_role JWT·잘못된 주소는 거절)', () => {
  assert.equal(config.supabase({}), null);
  assert.deepEqual(config.supabase({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuv' }), { url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'sb_publishable_abcdefghijklmnopqrstuv' });
  assert.equal(config.supabase({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abcdefghijklmnopqrstuv' }), null);
  assert.equal(config.supabase({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }) }), null);
  assert.ok(config.supabase({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon' }) }));
  assert.equal(config.supabase({ SUPABASE_URL: 'https://evil.example.com', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuv' }), null);
});

test('client: 켜진 로그인 방식만 알려 준다 (가입 막힘이면 이메일 끔)', async () => {
  const mk = (body) => A.client({ url: 'https://abcdefghijklmnopqrst.supabase.co', key: 'k' }, { store: { get: () => null, set() {}, del() {} }, fetch: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) }) });
  assert.deepEqual(await mk({ external: { email: true, kakao: false, google: true }, disable_signup: false }).providers(), { email: true, kakao: false, google: true });
  assert.deepEqual(await mk({ external: { email: true }, disable_signup: true }).providers(), { email: false, kakao: false, google: false });
});
