// T-33 모바일 서류함: 긴 발급처 링크 단추가 줄바꿈 없이 넓게 차지해 서류 이름 칸이 좁아지는 문제 (PR #106 재리뷰 후속 3)
// 화면 폭 측정은 브라우저에서 한다(390px: 이름 칸 94px → 넓어져야 함). 이 테스트는 그 규칙이 app.html <style>에서 빠지지 않게 지킨다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
const css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
function rule(sel) {
  const i = css.indexOf(sel + ' {');
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
}

test('서류함 줄의 링크 단추는 줄바꿈되고 폭이 제한된다', () => {
  const r = rule('.mo-docs .dq .sp-get');
  assert.ok(r, '.mo-docs .dq .sp-get 규칙 없음');
  assert.match(r, /white-space:\s*normal/);
  assert.match(r, /max-width:\s*[\d.]+em/);
});

test('공용 .sp-get(지원사업 상세 등)은 그대로 한 줄 유지', () => {
  assert.match(rule('.sp-get'), /white-space:\s*nowrap/);
});
