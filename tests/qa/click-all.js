// 전체 기능 점검: 로그인한 사용자로 모든 화면의 버튼을 눌러 보고 오류를 모은다
//   cd demo && PORT=8000 node dev-server.js   (다른 창)
//   node tests/qa/click-all.js m   # 휴대폰 (d = PC)
// 로그인 서버는 가짜(Supabase 흉내)이고, 공공 API는 운영 서버로 프록시한다. 되돌릴 수 없는 버튼(계정 삭제·기록 지우기 등)은 누르지 않는다.
const { chromium } = require('playwright');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (c) => b64({ alg: 'HS256' }) + '.' + b64(c) + '.s';
const SB = 'https://abcdefghijklmnopqrst.supabase.co', BASE = process.env.BASE || 'http://localhost:8000';
const SKIP = new Set(['acclogout', 'accdel', 'acclogin', 'reset', 'resethome', 'fdel', 'evdel', 'billdel', 'conddel', 'chatclear', 'install', 'gps', 'restore', 'addfile', 'backup', 'ics', 'evics', 'reload', 'accmode', 'condfold', 'pushon', 'pushoff']);
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const SEED = { onboarded: true, demo: false, deposit: 3000, rent: 45, fee: 7, term: 2, contract: iso(-20), move: iso(-5), birth: '2001-04', homeless: 'yes', dup: 'no', income: '150', nick: '점검', addr: '신림동 원룸', sido: '서울특별시', sgg: '관악구', gu: '관악구', zip: '11620',
  home: { lat: 37.4812, lng: 126.9275, label: '서울 관악구 신림동', src: 'pick' }, events: [{ id: 'ev1', date: iso(3), title: '보일러 점검' }], done: { t1: true } };
(async () => {
  const b = await chromium.launch(); const out = { mode: process.argv[2] || 'm', clicks: 0, skipped: 0, errors: [], bad: [], stuck: [] };
  const mobile = out.mode === 'm';
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' } : { viewport: { width: 1280, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(({ s, jwtTok }) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('jachwi-after-v3', JSON.stringify(s)); localStorage.setItem('jachwi-auth', JSON.stringify({ access_token: jwtTok, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'qa', email: 'qa@x.kr', provider: 'email', name: '' } })); localStorage.setItem('jachwi-owner', 'qa'); } }, { s: SEED, jwtTok: jwt({ sub: 'qa', email: 'qa@x.kr', exp: Math.floor(Date.now() / 1000) + 36000 }) });
  let row = null;
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === SB) { const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      if (u.pathname === '/auth/v1/settings') return route.fulfill({ headers: cors, json: { external: { email: true, kakao: true, google: true } } });
      if (u.pathname === '/rest/v1/user_state' && req.method() === 'GET') return route.fulfill({ headers: cors, json: row ? [row] : [] });
      if (u.pathname === '/rest/v1/user_state') { const bd = JSON.parse(req.postData()); row = { state: bd.state, updated_at: bd.updated_at }; return route.fulfill({ status: 201, headers: cors, body: '' }); }
      return route.fulfill({ status: 204, headers: cors }); }
    if (u.hostname === 'localhost' && u.pathname === '/api/config') { const r = await fetch('https://jachwi-navi.vercel.app/api/config'); const j = await r.json(); j.supabase = { url: SB, key: 'sb_publishable_test' }; return route.fulfill({ json: j }); }
    if (u.hostname === 'localhost' && u.pathname.startsWith('/api/')) { try { const r = await fetch('https://jachwi-navi.vercel.app' + u.pathname + u.search, { method: req.method(), headers: { 'content-type': req.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() }); return route.fulfill({ status: r.status, contentType: r.headers.get('content-type') || 'application/json', body: Buffer.from(await r.arrayBuffer()) }); } catch (e) { return route.abort(); } }
    return route.continue();
  });
  const p = await ctx.newPage(); let cur = '';
  p.on('pageerror', e => out.errors.push(cur + ' :: ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) out.errors.push(cur + ' :: console ' + m.text().slice(0, 160)); });
  p.on('response', r => { const u = r.url(); if (r.status() >= 400 && /localhost|vercel\.app/.test(u) && !/favicon/.test(u)) out.bad.push(cur + ' :: ' + r.status() + ' ' + u.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)); });
  p.on('dialog', d => d.dismiss());
  p.on('popup', pp => pp.close().catch(() => {}));
  await p.goto(BASE + '/app.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const R = ['home', 'input', 'result', 'contract', 'timeline', 'docs', 'moveout', 'map', 'recommend', 'infra', 'spend', 'calendar', 'condition', 'support', 'coach'];
  for (const r of R) {
    await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(r === 'support' ? 5000 : 1800);
    const n = await p.locator('#app [data-act]').count(); const seen = new Set();
    for (let i = 0; i < Math.min(n, 90); i++) {
      if (await p.evaluate(x => location.hash.slice(1) !== x, r)) { await p.evaluate(x => { location.hash = x; }, r); await p.waitForTimeout(900); }
      const el = p.locator('#app [data-act]').nth(i); if (!(await el.count())) break;
      const info = await el.evaluate(e => ({ act: e.dataset.act, v: e.dataset.v || '', tag: e.tagName, type: e.type || '', vis: !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden', txt: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20) })).catch(() => null);
      if (!info || !info.vis || SKIP.has(info.act)) { out.skipped++; continue; }
      const key = info.act + '|' + info.v; if (seen.has(key) && seen.size > 25) continue; seen.add(key);
      cur = r + ' > ' + info.act + (info.v ? '(' + info.v.slice(0, 18) + ')' : '') + ' "' + info.txt + '"';
      try {
        if (info.tag === 'INPUT' && info.type === 'checkbox') await el.click({ timeout: 2500, force: true }); else if (info.tag === 'SELECT') { const opts = await el.locator('option').count(); if (opts > 1) await el.selectOption({ index: 1 }); }
        else await el.click({ timeout: 2500 });
        out.clicks++;
      } catch (e) { out.stuck.push(cur + ' :: ' + e.message.split('\n')[0].slice(0, 90)); }
      await p.waitForTimeout(350);
      if (await p.evaluate(() => !!document.querySelector('.acc-menu'))) await p.keyboard.press('Escape');
      if (!p.url().startsWith(BASE)) { await p.goto(BASE + '/app.html#' + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); }
    }
  }
  out.errors = [...new Set(out.errors)]; out.bad = [...new Set(out.bad)];
  console.log(JSON.stringify(out, null, 1)); await b.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
