// 예전에 저장된 사용자(무주택·중복 수혜 질문을 본 적 없음)가 '확인 필요'로만 보이던 문제 (11/11, PR #13 병합 뒤)
// 원칙: 답이 없다(값 없음)와 '모름'이라고 답했다('unknown')를 섞지 않는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../demo/engine.js');
const RC = require('../demo/rules-core.js');
const SC = require('../demo/support-core.js');
const SEED = require('../demo/rules/seed.js');

const TODAY = new Date(2026, 10, 11);
const PROGS = RC.publicView(SEED, TODAY).programs;
// app.html userOf()와 같게: toUser + 나이는 curAge()(출생연월이 없으면 예전 S.age를 쓴다)
const userOf = (S) => { const u = E.toUser(S); if (u.age === null && !S.birth && +S.age) u.age = +S.age; return u; };
const judge = (S) => PROGS.map((p) => RC.verdict(RC.evalProgram(p, userOf(S))));
// PR #13 이전에 저장된 값: birth·homeless·dup이 없다
const LEGACY = { gu: '관악구', deposit: 1000, rent: 45, age: 24, income: '150', contract: '2026-10-28', move: '2026-10-29', term: 2 };

test('toUser: 무주택·중복 수혜를 답하지 않았으면 값 없이 넘긴다', () => {
  const u = E.toUser(LEGACY);
  assert.equal(u.homeless, undefined); assert.equal(u.dup, undefined);
  assert.equal(E.toUser(Object.assign({}, LEGACY, { homeless: '', dup: null })).homeless, undefined); // '아직 안 정함' 빈칸
  assert.equal(E.toUser(Object.assign({}, LEGACY, { homeless: 'unknown', dup: 'unknown' })).dup, 'unknown'); // 모른다고 답함은 그대로
});

test('예전 사용자: 무주택·중복 수혜 때문에 승인 공고가 모두 확인 필요로 바뀌지 않는다', () => {
  assert.ok(judge(LEGACY).every((v) => v !== '확인 필요'), judge(LEGACY).join(','));
  // 모른다고 답한 사람은 확인 필요가 맞다
  assert.ok(judge(Object.assign({}, LEGACY, { homeless: 'unknown' })).every((v) => v === '확인 필요'));
  assert.equal(judge(Object.assign({}, LEGACY, { homeless: 'no' }))[0], '해당 안 됨');
});

test('지원사업 화면 판정: 답 안 한 질문만 남으면 ask, 모름이라고 답했으면 q', () => {
  const conds = (homeless) => [{ key: 'region', ok: true }, { key: 'homeless', ok: homeless === 'yes' ? true : null, ask: homeless ? '' : 'homeless' }];
  assert.equal(SC.verdict(conds(undefined)), 'ask');
  assert.equal(SC.verdict(conds('unknown')), 'q');
  assert.equal(SC.verdict(conds('yes')), 'ok');
  assert.equal(SC.verdict([{ ok: null, ask: 'age' }, { ok: false }]), 'no');
  assert.ok(SC.rank('ask', { k: 'open', sure: true, left: 3 }, { scope: 'sgg' }) < SC.rank('no', { k: 'open', sure: true, left: 3 }, { scope: 'sgg' }));
});

// app.html의 migrate()를 그대로 꺼내 시험한다 (화면 파일이라 require할 수 없음)
const html = fs.readFileSync(path.join(__dirname, '../demo/app.html'), 'utf8');
const src = /\r?\n  function migrate\(s\) \{[\s\S]*?\r?\n  \}\r?\n/.exec(html); // Windows에서 받으면 줄바꿈이 CRLF일 수 있다
const DEMO = { homeless: 'yes', dup: 'no' };
const migrate = src && new Function('DEMO', src[0] + '; return migrate;')(DEMO);

test('app.html: 처음 상태(FRESH)에 무주택·중복 수혜 기본값을 두지 않는다', () => {
  assert.match(html, /delete FRESH\.homeless; delete FRESH\.dup;/);
  assert.doesNotMatch(html, /Object\.assign\(FRESH, \{[^}]*homeless:/);
});

test('app.html migrate: 지원사업 화면의 예전 무주택 답은 S.homeless가 비어 있을 때만 옮긴다', () => {
  assert.ok(migrate, 'migrate()를 찾지 못함');
  assert.equal(migrate({ sup: { self: { homeless: 'y' } } }).homeless, 'yes');
  assert.equal(migrate({ sup: { self: { homeless: 'n' } } }).homeless, 'no');
  const kept = migrate({ homeless: 'unknown', sup: { self: { homeless: 'y' } } });
  assert.equal(kept.homeless, 'unknown'); assert.equal(kept.sup.self.homeless, undefined); // 이미 답이 있으면 덮지 않고, 옛 값은 지운다
  assert.equal(migrate({ homeless: '' }).homeless, undefined); // 빈칸은 답 없음
  const legacy = migrate(Object.assign({}, LEGACY));
  assert.equal(legacy.homeless, undefined); assert.equal(legacy.dup, undefined);
  const demo = migrate({ demo: true }); // 시연용 예시는 예시 인물의 답으로 채운다
  assert.equal(demo.homeless, 'yes'); assert.equal(demo.dup, 'no');
});
