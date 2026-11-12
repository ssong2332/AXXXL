// app.html <style> 안 중괄호 짝 검사 — 닫히지 않은 @media 블록이 뒤쪽 CSS 전부를 그 조건 안에 가두는 것을 막는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'demo', 'app.html'), 'utf8');

function styleBlocks(src) {
  const out = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

// 주석·문자열 안의 중괄호는 세지 않는다.
function stripCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
}

function openBlocksAtEnd(css) {
  const stack = [];
  const re = /@media[^{]*\{|\{|\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (m[0] === '}') {
      if (!stack.length) return { error: '여는 괄호 없이 닫힘', at: m.index };
      stack.pop();
    } else stack.push(m[0].trim());
  }
  return { open: stack };
}

test('app.html: <style> 블록이 1개 이상 있다', () => {
  assert.ok(styleBlocks(html).length >= 1);
});

test('app.html: 모든 <style> 블록의 중괄호가 짝이 맞는다 (닫히지 않은 @media 없음)', () => {
  styleBlocks(html).forEach((css, i) => {
    const r = openBlocksAtEnd(stripCss(css));
    assert.equal(r.error, undefined, 'style #' + i + ': ' + r.error);
    assert.deepEqual(r.open, [], 'style #' + i + ' 끝에서 열린 채 남은 블록: ' + JSON.stringify(r.open));
  });
});

test('app.html: 휴대폰 캘린더 @media (max-width: 599px) 블록 뒤의 지원사업 규칙은 미디어 조건 밖에 있다', () => {
  const css = stripCss(styleBlocks(html).join('\n'));
  const at = css.indexOf('.sp-region {');
  assert.ok(at > 0, '.sp-region 규칙을 찾지 못함');
  const r = openBlocksAtEnd(css.slice(0, at));
  assert.deepEqual(r.open, [], '.sp-region 앞에서 열린 블록: ' + JSON.stringify(r.open));
});
