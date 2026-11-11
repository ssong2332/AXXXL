// 도형·면적·가져오기 검증 단위 테스트. 실행: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonArea, validatePolygon, scaleToArea, itemOutside, itemsOverlap, itemCorners, PYEONG_M2 } from '../web/js/geometry.js';
import { createHouse, sampleHouses, draftShape, checkAreaInput, exportData, parseImport, PRESETS } from '../web/js/model.js';

test('평 → ㎡ 환산은 400/121', () => {
  assert.ok(Math.abs(10 * PYEONG_M2 - 33.0578) < 1e-3);
});

test('모든 모양 후보가 목표 면적과 일치하고 올바른 도형이다', () => {
  for (const key of Object.keys(PRESETS)) {
    const pts = draftShape(key, 23.14);
    assert.equal(validatePolygon(pts), null, key);
    assert.ok(Math.abs(polygonArea(pts) - 23.14) < 0.01, key + ' ' + polygonArea(pts));
  }
});

test('면적 입력: 유한한 양수만 받는다', () => {
  for (const bad of [0, -3, NaN, Infinity, '7', null]) assert.ok(checkAreaInput(bad, 'py'), String(bad));
  assert.equal(checkAreaInput(7, 'py'), null);
  assert.ok(checkAreaInput(0.1, 'm2'));
  assert.ok(checkAreaInput(500, 'm2'));
});

test('잘못된 도형을 거부한다', () => {
  assert.ok(validatePolygon([[0, 0], [1, 0]]));
  assert.ok(validatePolygon([[0, 0], [2, 2], [2, 0], [0, 2]]), '나비 모양 자기 교차');
  assert.ok(validatePolygon([[0, 0], [1, 0], [2, 0]]), '면적 0');
  assert.ok(validatePolygon([[0, 0], [NaN, 0], [1, 1]]));
  assert.equal(validatePolygon([[0, 0], [3, 0], [3, 2], [0, 2]]), null);
});

test('면적 유지 축소·확대 후 면적이 목표와 같다', () => {
  const pts = scaleToArea([[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3]], 20);
  assert.ok(Math.abs(polygonArea(pts) - 20) < 1e-9);
});

test('물체 꼭짓점 회전과 방 밖·겹침 판정', () => {
  const it = { x: 1, y: 1, w: 2, d: 1, rot: 90 };
  const c = itemCorners(it);
  assert.deepEqual(c.map((p) => p.map((v) => Math.round(v * 100) / 100 + 0)),[[1.5, 0], [1.5, 2], [0.5, 2], [0.5, 0]]);
  const room = [[0, 0], [4, 0], [4, 1.5], [2, 1.5], [2, 4], [0, 4]]; // ㄱ자
  assert.equal(itemOutside(room, { x: 1, y: 1, w: 1, d: 1, rot: 0 }), false);
  assert.equal(itemOutside(room, { x: 2.5, y: 2.5, w: 0.5, d: 0.5, rot: 0 }), true);
  assert.equal(itemOutside(room, { x: 2, y: 1.5, w: 1, d: 1, rot: 0 }), true, '안쪽 모서리에 걸침');
  assert.equal(itemsOverlap({ x: 0, y: 0, w: 1, d: 1, rot: 0 }, { x: 0.5, y: 0, w: 1, d: 1, rot: 0 }), true);
  assert.equal(itemsOverlap({ x: 0, y: 0, w: 1, d: 1, rot: 0 }, { x: 1, y: 0, w: 1, d: 1, rot: 0 }), false, '맞닿기만 함');
});

test('샘플 집은 가상 표시가 있고 물체가 방 안에 있다', () => {
  for (const h of sampleHouses()) {
    assert.equal(h.sample, true);
    assert.equal(validatePolygon(h.shape.points), null);
    for (const it of h.items) assert.equal(itemOutside(h.shape.points, it), false, h.name + ' ' + it.type);
  }
});

test('JSON 왕복과 잘못된 입력 거부', () => {
  const houses = sampleHouses();
  const text = JSON.stringify(exportData(houses));
  assert.ok(!text.includes('blob:'));
  const back = parseImport(text);
  assert.equal(back.length, 2);
  assert.deepEqual(back[0].shape.points, houses[0].shape.points);
  assert.equal(back[0].items.length, houses[0].items.length);

  const bad = (mut) => { const d = exportData(sampleHouses()); mut(d); return () => parseImport(JSON.stringify(d)); };
  assert.throws(() => parseImport('{not json'));
  assert.throws(bad((d) => { d.app = 'other'; }));
  assert.throws(bad((d) => { d.version = 2; }));
  assert.throws(bad((d) => { d.houses[0].shape.points = [[0, 0], [2, 2], [2, 0], [0, 2]]; }));
  assert.throws(bad((d) => { d.houses[0].items[0].type = 'rocket'; }));
  assert.throws(bad((d) => { d.houses[0].items[0].w = 'NaN'; }));
  assert.throws(bad((d) => { d.houses[0].checks.water.status = 'great'; }));
  assert.throws(bad((d) => { d.houses[0].name = 'x'.repeat(41); }));
  // HTML이 섞인 이름은 거부하지 않고 글자 그대로 보존한다(화면에서 글자로만 표시)
  const d = exportData(sampleHouses()); d.houses[0].name = '<img src=x onerror=alert(1)>';
  assert.equal(parseImport(JSON.stringify(d))[0].name, '<img src=x onerror=alert(1)>');
});

test('새 집 기본값: 현장 체크는 모두 확인 못 함', () => {
  const h = createHouse({ name: '새 집', value: 20, unit: 'm2' });
  assert.ok(Object.values(h.checks).every((c) => c.status === 'unchecked'));
});
