// 11/17 코드 점검 지적 중 지원사업·홈(주연서 담당) 수정 확인 — 실행: node --test tests/review-1117.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const O = require('../demo/api/_open.js');

// 서버 함수에 넘길 가짜 req·res
function call(handler, query) {
  return new Promise((done) => {
    const res = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; done(this); } };
    handler({ query, headers: {} }, res);
  });
}
// 바깥 API 호출 수를 센다
function countFetch(t) {
  const real = global.fetch; let n = 0;
  global.fetch = async () => { n++; throw new Error('test: no network'); };
  t.after(() => { global.fetch = real; });
  return () => n;
}

test('7번: 지역 목록에 없는 5자리 코드(99999)는 접수 기간 API에서 바로 거절하고 온통청년을 부르지 않는다', async (t) => {
  const calls = countFetch(t), env = process.env.YOUTH_API_KEY;
  process.env.YOUTH_API_KEY = 'test-key'; t.after(() => { if (env === undefined) delete process.env.YOUTH_API_KEY; else process.env.YOUTH_API_KEY = env; });
  const period = require('../demo/api/_period.js');
  const r = await call(period, { zip: '99999', ids: '202611170001' });
  assert.equal(r.code, 400);
  assert.equal(calls(), 0);
});

test('7번: loadZip도 모르는 지역 코드면 바깥 API를 부르기 전에 멈춘다', async (t) => {
  const calls = countFetch(t);
  const support = require('../demo/api/_support.js');
  await assert.rejects(support.loadZip('99999', 'test-key'));
  assert.equal(calls(), 0);
});

test('11번: LH 공고 조회 날짜는 서버 시간대와 상관없이 한국 날짜로 만든다', () => {
  const LH = require('../demo/api/_lh.js');
  // 2026-11-17 23:30 UTC = 한국 11월 18일 오전 8시 30분
  assert.equal(LH.kstYmd(Date.UTC(2026, 10, 17, 23, 30)), '20261118');
  // 2026-11-18 15:00 UTC = 한국 11월 19일 0시
  assert.equal(LH.kstYmd(Date.UTC(2026, 10, 18, 15, 0)), '20261119');
  assert.equal(LH.kstYmd(Date.UTC(2026, 10, 18, 14, 59)), '20261118');
});

test('17번: 내부망 주소 판별(privateIp)', () => {
  ['10.0.0.1', '127.0.0.1', '0.0.0.0', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '100.64.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.1.2.3']
    .forEach((ip) => assert.equal(O.privateIp(ip), true, ip));
  ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '100.63.0.1', '211.231.99.80', '2001:4860:4860::8888', '::ffff:8.8.8.8']
    .forEach((ip) => assert.equal(O.privateIp(ip), false, ip));
});

test('17번: 공고 주소 검사(publicUrl) — 내부망·IP 직접·다른 포트·계정 정보·다른 프로토콜은 막는다', async (t) => {
  const real = dns.promises.lookup;
  const table = { 'www.example.go.kr': [{ address: '211.231.99.80', family: 4 }], 'inner.example.com': [{ address: '10.0.0.5', family: 4 }], 'mixed.example.com': [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] };
  dns.promises.lookup = async (h) => { if (table[h]) return table[h]; throw new Error('ENOTFOUND'); };
  t.after(() => { dns.promises.lookup = real; });
  assert.ok(await O.publicUrl('https://www.example.go.kr/notice?id=1'));
  assert.ok(await O.publicUrl('http://www.example.go.kr:80/a'));
  for (const bad of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://localhost/', 'http://intranet/', 'http://a.local/',
    'https://inner.example.com/', 'https://mixed.example.com/', 'https://www.example.go.kr:8080/', 'https://user:pw@www.example.go.kr/', 'ftp://www.example.go.kr/', 'file:///etc/passwd', 'javascript:alert(1)', 'https://nowhere.example.org/', 'not a url']) {
    assert.equal(await O.publicUrl(bad), null, bad);
  }
});

test('2번: 홈 "남은 납부" 카드와 지원 카드는 납부 항목 이름·공고 이름을 esc()로 그린다', () => {
  const html = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
  const home = html.slice(html.indexOf('function viewHome()'), html.indexOf('// ---------- 주변 탐색 ----------'));
  const payH = /var payH = [^\n]*/.exec(home)[0];
  assert.ok(/esc\(first\.title\)/.test(payH) && /esc\(nb\.title\)/.test(payH), payH);
  assert.ok(!/\+ (first|nb)\.title\b/.test(payH), payH);
  const sup = /var sup = [^\n]*/.exec(home)[0];
  assert.ok(/esc\(el\.p\.name\)/.test(sup) && /esc\(el\.p\.status\)/.test(sup), sup);
});

test('작은 쪽이 스크립트·meta로 다른 주소로 넘기면 그 주소를 따라간다 (scriptHop)', () => {
  assert.equal(O.scriptHop('<html><head><title>데이터 처리중 :</title><script>location.href = "/mainA.do";</script></head></html>'), '/mainA.do');
  assert.equal(O.scriptHop("<script>document.location.href='/index.do'</script>"), '/index.do');
  assert.equal(O.scriptHop('<script>location.replace("/ko/main.do");</script>'), '/ko/main.do');
  assert.equal(O.scriptHop('<meta http-equiv="refresh" content="0; url=/main/main.do">'), '/main/main.do');
  assert.equal(O.scriptHop('<meta http-equiv="refresh" content="0;URL=default/">'), 'default/');
  // 긴 본문(실제 화면)에 든 이동 스크립트는 따라가지 않는다
  assert.equal(O.scriptHop('<html>' + 'x'.repeat(5000) + '<script>function go(){location.href="/a.do";}</script></html>'), '');
  // 이동이 없으면 빈 값
  assert.equal(O.scriptHop('<html><body>안내</body></html>'), '');
});
