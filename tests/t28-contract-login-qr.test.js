// T-28: 내 계약 '휴대폰으로 이어서 보기' — 로그인한 PC는 QR 대신 계정 안내 (PRD F-15, DECISIONS #34)
// deviceCards() 본문을 잘라 가짜 전역(IS_PHONE·accOn·devQr 등)과 함께 실행해 출력 글자를 단언한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');

function fnBody(name) {
  const at = HTML.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 없음');
  let i = HTML.indexOf('{', at), depth = 0;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === '{') depth++;
    else if (HTML[j] === '}' && --depth === 0) return HTML.slice(at, j + 1);
  }
  assert.fail(name + ' 중괄호 짝 없음');
}

const SRC = fnBody('deviceCards');
const NOTE = '<p class="s13 sub">휴대폰에서 같은 계정으로 로그인하면 그대로 이어져요.</p>';
const H2 = '<h2 style="font-size:16px">휴대폰으로 이어서 보기</h2>';
const INSTALL_PART = '<section class="card stack"><h2 style="font-size:16px">[ic:home] 앱처럼 설치</h2>' +
  '<p class="s13 sub">휴대폰 브라우저 메뉴에서 <b>홈 화면에 추가</b>(또는 <b>앱 설치</b>)를 누르면 앱처럼 열려요.</p>' +
  '<p class="s12 muted">설치하면 인터넷이 잠깐 끊겨도 화면이 열려요.</p></section>';
const PRIV = '<p class="s12 muted">정보는 QR 주소의 # 뒤에만 담겨 서버로 보내지지 않아요.</p>';

// opt: phone, session(로그인 여부 — accOn 결과), qr(devQrHtml 결과)
function run(opt) {
  const calls = { devQr: 0, accOn: 0 };
  const env = {
    window: {}, navigator: {}, INSTALL: null, IS_IOS: false, IS_PHONE: !!opt.phone,
    ic: (n) => '[ic:' + n + ']',
    accOn: () => { calls.accOn++; return !!opt.session; },
    exportObj: () => ({ gu: 'x' }),
    devQr: () => { calls.devQr++; return 'DATA'; },
    devQrHtml: (d) => (d ? opt.qr || '' : ''),
  };
  const names = Object.keys(env);
  const fn = new Function(...names, SRC + '\nreturn deviceCards();');
  return { out: fn(...names.map((k) => env[k])), calls };
}

// 정상
test('T-28 정상: 로그인한 PC → 제목 다음 계정 안내만, QR·data-dev-qr·# 문구 없음, devQr 0회', () => {
  const { out, calls } = run({ session: true, qr: '<img data-qr>' });
  assert.equal(out, INSTALL_PART + '<section class="card stack">' + H2 + NOTE + '</section>');
  assert.equal(calls.devQr, 0);
  assert.doesNotMatch(out, /data-dev-qr|data-qr|# 뒤에만/);
});

// 경계
test('T-28 경계: 로그인 안 한 PC(QR 준비 전) → 지금과 같은 출력(QR 만드는 중)', () => {
  const { out, calls } = run({ session: false });
  assert.equal(out, INSTALL_PART + '<section class="card stack">' + H2 +
    '<p class="s13 muted" data-dev-qr>QR을 만드는 중…</p>' + PRIV + '</section>');
  assert.equal(calls.devQr, 1);
  assert.doesNotMatch(out, /같은 계정으로 로그인/);
});

test('T-28 경계: 로그인 안 한 PC(QR 준비됨) → QR 그대로', () => {
  const { out } = run({ session: false, qr: '<img data-qr>' });
  assert.equal(out, INSTALL_PART + '<section class="card stack">' + H2 + '<img data-qr>' + PRIV + '</section>');
});

test('T-28 경계: 로그인 기능 꺼짐(ACC.cli 없음 → accOn 거짓) → QR 유지', () => {
  // accOn()의 실제 정의가 ACC.cli 없을 때 거짓인지 확인 (accOn 자체는 수정 금지 대상)
  assert.match(fnBody('accOn'), /ACC\.cli\s*&&/);
  const { out, calls } = run({ session: false, qr: '<img data-qr>' });
  assert.match(out, /<img data-qr>/);
  assert.equal(calls.devQr, 1);
});

// 예외
test('T-28 예외: 휴대폰 → 로그인해도 이어 보기 구역 없음, devQr 0회', () => {
  for (const session of [false, true]) {
    const { out, calls } = run({ phone: true, session, qr: '<img data-qr>' });
    assert.equal(out, INSTALL_PART, 'session=' + session);
    assert.equal(calls.devQr, 0);
  }
});

test('T-28 예외: 로그인 갈래가 있어도 T-17 단언 유지(encoded 없음, data-dev-qr·devQr 있음) — 판정은 !IS_PHONE && accOn()', () => {
  assert.doesNotMatch(SRC, /\bencoded\(/);
  assert.match(SRC, /data-dev-qr/);
  assert.match(SRC, /\bdevQr\(/);
  assert.match(SRC, /var acc = !IS_PHONE && accOn\(\);/);
});
