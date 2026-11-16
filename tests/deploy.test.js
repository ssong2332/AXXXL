// 배포 점검: Vercel Hobby 요금제는 배포 하나에 서버 함수 12개까지만 올린다 (넘으면 배포 자체가 거절됨 — 11/12 #20, 11/16 #67).
// demo/api 에서 밑줄(_)로 시작하지 않는 .js 파일 하나가 함수 하나다. 공공데이터 함수는 api/public.js 하나로 묶고 vercel.json rewrites 로 주소를 유지한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const API = path.join(__dirname, '../demo/api');

test('배포: 서버 함수 12개 이하 (Vercel Hobby 한도)', () => {
  const fns = fs.readdirSync(API).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  assert.ok(fns.length <= 12, fns.length + '개: ' + fns.join(', ') + ' — 새 함수는 api/public.js 묶음에 넣으세요');
});

test('배포: 묶음 함수가 받는 주소마다 rewrite·로컬 서버·처리 파일이 있다', () => {
  const vj = JSON.parse(fs.readFileSync(path.join(__dirname, '../demo/vercel.json'), 'utf8'));
  const rw = vj.rewrites.find((r) => r.destination === '/api/public?fn=:fn');
  const names = /\(([^)]+)\)/.exec(rw.source)[1].split('|');
  const P = require('../demo/api/public.js');
  const dev = fs.readFileSync(path.join(__dirname, '../demo/dev-server.js'), 'utf8');
  for (const n of names) {
    assert.ok(P.HANDLERS[n], n + ' 처리 파일 없음');
    assert.ok(dev.includes("'" + n + "'"), n + ' 로컬 서버(dev-server.js) 연결 없음');
  }
  assert.deepEqual(Object.keys(P.HANDLERS).sort(), names.slice().sort());
  // vercel.json functions 설정은 실제 있는 함수 파일만 가리킨다
  for (const k of Object.keys(vj.functions || {})) assert.ok(fs.existsSync(path.join(__dirname, '../demo', k)), k + ' 파일 없음');
});
