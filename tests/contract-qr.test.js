// T-17: 내 계약 '휴대폰으로 이어서 보기' QR 인코딩이 끝났을 때 화면 전체를 다시 그리지 않는다
// (다시 그리면 data-mo-enter가 빠져 진행 중인 등장 모션이 끊긴다 — 배포 실측 44ms 렌더 → 134ms 재렌더).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8').replace(/\r\n/g, '\n');

// 이름으로 함수 본문(중괄호 짝)을 잘라 낸다
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

test('T-17: deviceCards는 공용 encoded()를 쓰지 않는다 (완료 시 render(true) 호출 경로 제거)', () => {
  assert.doesNotMatch(fnBody('deviceCards'), /\bencoded\(/);
});

test('T-17: deviceCards는 QR 자리 표시(data-dev-qr)를 두고 devQr로 데이터를 받는다', () => {
  const b = fnBody('deviceCards');
  assert.match(b, /data-dev-qr/);
  assert.match(b, /\bdevQr\(/);
});

test('T-17: devQr는 인코딩 완료 시 render를 부르지 않고 QR 자리만 바꾼다', () => {
  const b = fnBody('devQr');
  assert.match(b, /encodePayload\(/, '압축은 공용 encodePayload 재사용');
  assert.doesNotMatch(b, /\brender\(/, 'render 호출 금지');
  assert.match(b, /\[data-dev-qr\]/, 'QR 자리만 찾아 교체');
});

test('T-17: devQr는 같은 데이터면 캐시를 돌려주고, 같은 데이터로 중복 압축을 시작하지 않는다', () => {
  const b = fnBody('devQr');
  assert.match(b, /\.key\s*===\s*key/, '완료 캐시 비교');
  assert.match(b, /\.pending\s*!==\s*key/, '진행 중 중복 방지');
});

test('T-17 리뷰 #1: 늦게 끝난 옛 압축이 최신 캐시를 덮지 않는다 (pending === key일 때만 저장)', () => {
  assert.match(fnBody('devQr'), /if\s*\(\s*DEV_QR\.pending\s*!==\s*key\s*\)\s*return/);
});

test('T-17 QA 권고: 압축이 실패하면 pending을 비워 다음 렌더에서 다시 시도한다', () => {
  const b = fnBody('devQr');
  assert.match(b, /\.catch\(/);
  assert.match(b, /DEV_QR\.pending\s*=\s*''/);
});

test('T-17: 공용 encoded()와 캘린더 phonePanel은 그대로 encoded를 쓴다 (다른 팀원 영역 미수정)', () => {
  assert.match(fnBody('encoded'), /render\(true\)/);
  assert.match(fnBody('phonePanel'), /\bencoded\('cal'/);
});
