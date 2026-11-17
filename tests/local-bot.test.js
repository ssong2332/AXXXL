// 동네봇: 가게 이름(브랜드)·프랜차이즈 질문, 받아 둔 범위로 '없음' 말하기 (팀원 제보 재현)
const test = require('node:test');
const assert = require('node:assert/strict');
const AS = require('../demo/assistant-core.js');

// 가게 많은 동네: 카페·편의점이 가까이 잔뜩 있고, 지하철역은 394m
const list = [];
for (let i = 0; i < 70; i++) list.push({ id: 'c' + i, name: '동네카페' + i, cat: 'cafe', sub: '카페', cn: '음식점 > 카페', min: 1, m: 20 + i });
list.push({ id: 'mega', name: '메가MGC커피 신림역점', cat: 'cafe', sub: '커피전문점', cn: '음식점 > 카페 > 커피전문점 > 메가MGC커피', min: 3, m: 210 });
list.push({ id: 'sb', name: '스타벅스 신림점', cat: 'cafe', sub: '커피전문점', cn: '음식점 > 카페 > 커피전문점 > 스타벅스', min: 4, m: 260 });
list.push({ id: 'e24', name: '이마트24 신림점', cat: 'life', sub: '편의점', cn: '가정,생활 > 편의점 > 이마트24', min: 1, m: 60 });
list.push({ id: 'dai', name: '다이소 신림점', cat: 'life', sub: '생활용품점', cn: '가정,생활 > 생활용품점 > 다이소', min: 5, m: 330 });
list.push({ id: 'st', name: '신림역 2호선', cat: 'transit', sub: '지하철역', cn: '교통,수송 > 지하철,전철 > 수도권2호선', min: 5, m: 394 });
list.sort((a, b) => a.m - b.m);
const facts = { places: { hasHome: true, list, source: '카카오맵 기준' } };
const ask = (q) => AS.answer({ q, bot: 'local', history: [], cards: [], facts, repairs: [] });
const names = (r) => ((r.blocks || []).find((b) => b.type === 'places') || { items: [] }).items.map((p) => p.name);

test('프랜차이즈 카페를 물으면 개인 카페가 아니라 브랜드 단계가 있는 카페만', () => {
  const r = ask('주변의 프랜차이즈 카페를 찾아줘');
  assert.deepEqual(names(r), ['메가MGC커피 신림역점', '스타벅스 신림점']);
  assert.match(r.text, /프랜차이즈 카페/);
});

test('가게 이름(메가커피·스타벅스·다이소)은 그 이름으로 찾는다', () => {
  assert.deepEqual(names(ask('근처 메가커피 어디 있어?')), ['메가MGC커피 신림역점']);
  assert.deepEqual(names(ask('스타벅스 어디야?')), ['스타벅스 신림점']);
  assert.deepEqual(names(ask('가까운 다이소 어디야?')), ['다이소 신림점']);
  assert.equal(AS.route ? AS.route('스타벅스 어디야?') : 'local', 'local');
});

test('마트를 물어도 이마트24(편의점)를 마트로 답하지 않는다', () => {
  assert.ok(!names(ask('근처 마트 어디야?')).includes('이마트24 신림점'));
});

test('가까운 60곳이 다 차는 동네에서도 394m 지하철역을 찾는다', () => {
  assert.deepEqual(names(ask('가까운 지하철역 어디야?')), ['신림역 2호선']);
});

test('없을 때는 1km가 아니라 실제로 받아 둔 범위로 말한다', () => {
  const r = ask('근처 투썸 어디야?');
  assert.match(r.text, /집에서 \d+m 안에서 받아 둔 장소 중에는 투썸플레이스가 없어요/);
  assert.doesNotMatch(r.text, /1km/);
  const r2 = ask('근처 약국 어디야?');
  assert.doesNotMatch(r2.text, /1km/);
  assert.match(r2.text, /지도 탐색에서 찾아 보세요/);
});
