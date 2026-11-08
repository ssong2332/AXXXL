// GET /api/calendar?d=<payload>   (vercel.json 에서 /cal.ics 로도 연결)
// 휴대폰 캘린더(아이폰·구글)가 구독하는 .ics 주소.
// 일정 정보는 주소(d) 안에 담겨 오고, 서버는 그걸 .ics 로 바꿔 줄 뿐 저장하지 않는다.
//   d = 'z' + base64url(deflate-raw(JSON))  또는  'j' + base64url(JSON)
'use strict';

const zlib = require('zlib');
const ICS = require('../ics.js');

function b64url(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

module.exports = (req, res) => {
  const d = String(req.query.d || '');
  if (!d || d.length > 6000) return res.status(400).send('잘못된 주소예요.');
  let payload;
  try {
    const raw = d[0] === 'z' ? zlib.inflateRawSync(b64url(d.slice(1)), { maxOutputLength: 200000 }) : b64url(d.slice(1));
    payload = JSON.parse(raw.toString('utf8'));
  } catch (e) { return res.status(400).send('일정 정보를 읽지 못했어요.'); }
  const body = ICS.build(payload, { name: '자취 캘린더' });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="jachwi-calendar.ics"');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).send(body);
};
