// 공공데이터 서버 함수 묶음 — /api/support · /api/welfare · /api/lh · /api/holidays · /api/period · /api/bus-arrival · /api/safety
// Vercel Hobby 요금제는 배포 하나에 서버 함수를 12개까지만 올릴 수 있어서, 같은 성격의 공공데이터 함수를 하나로 묶었다. (11/16 버스 도착·밤길 안전 2개 추가 — 함수 13개로 배포가 거절돼 여기로 옮김)
// 주소는 그대로다: vercel.json 의 rewrites 가 /api/<이름> 을 /api/public?fn=<이름> 으로 보낸다. (로컬은 dev-server.js 가 같은 일을 함)
// 실제 처리는 _support.js 등 밑줄로 시작하는 파일이 한다 (밑줄 파일은 Vercel이 따로 함수로 만들지 않음).
'use strict';

const HANDLERS = {
  support: require('./_support.js'),
  welfare: require('./_welfare.js'),
  lh: require('./_lh.js'),
  holidays: require('./_holidays.js'),
  period: require('./_period.js'),
  'bus-arrival': require('./_bus-arrival.js'),
  safety: require('./_safety.js')
};

module.exports = async (req, res) => {
  const q = req.query || {};
  const fn = String(q.fn || '');
  const h = Object.prototype.hasOwnProperty.call(HANDLERS, fn) ? HANDLERS[fn] : null;
  if (!h) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: '없는 주소예요.' }));
  }
  delete q.fn;
  return h(req, res);
};
module.exports.HANDLERS = HANDLERS;
