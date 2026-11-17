// GET /api/calendar?d=<payload>   (vercel.json 에서 /cal.ics 로도 연결)
// GET /api/calendar?u=<구독 토큰>  로그인한 사람의 계정에 저장된 최신 일정 (앱에서 고치면 구독한 캘린더에도 반영)
// 휴대폰 캘린더(아이폰·구글)가 구독하는 .ics 주소.
//   d: 일정 정보가 주소 안에 담겨 온다. 서버는 .ics 로 바꿔 줄 뿐 저장하지 않는다.
//   u: Supabase 함수 cal_feed(토큰)로 그 사람의 일정 묶음(d 와 같은 모양)만 받아 온다. 공개(publishable) 키만 쓴다.
//   d = 'z' + base64url(deflate-raw(JSON))  또는  'j' + base64url(JSON)
'use strict';

const zlib = require('zlib');
const ICS = require('../ics.js');
const { supabase } = require('./config.js');

function b64url(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

function decode(d) {
  const raw = d[0] === 'z' ? zlib.inflateRawSync(b64url(d.slice(1)), { maxOutputLength: 200000 }) : b64url(d.slice(1));
  return JSON.parse(raw.toString('utf8'));
}

async function feedOf(token, env, fetchFn) {
  const sb = supabase(env);
  if (!sb) return { status: 503, msg: '지금은 구독 주소를 쓸 수 없어요.' };
  const r = await fetchFn(sb.url + '/rest/v1/rpc/cal_feed', { method: 'POST', headers: { apikey: sb.key, Authorization: 'Bearer ' + sb.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }) });
  if (!r.ok) return { status: 502, msg: '일정을 불러오지 못했어요.' };
  const d = await r.json();
  if (!d || typeof d !== 'string') return { status: 404, msg: '구독 주소를 찾지 못했어요. 앱에서 다시 구독해 주세요.' };
  return { d };
}

async function handler(req, res, deps) {
  deps = deps || {};
  const u = String(req.query.u || ''), env = deps.env || process.env, fetchFn = deps.fetch || fetch;
  let d = String(req.query.d || ''), live = false;
  if (u) {
    if (!/^[A-Za-z0-9_-]{24,64}$/.test(u)) return res.status(400).send('잘못된 주소예요.');
    let f; try { f = await feedOf(u, env, fetchFn); } catch (e) { f = { status: 502, msg: '일정을 불러오지 못했어요.' }; }
    if (!f.d) return res.status(f.status).send(f.msg);
    d = f.d; live = true;
  }
  if (!d || d.length > 6000) return res.status(400).send('잘못된 주소예요.');
  let payload;
  try { payload = decode(d); } catch (e) { return res.status(400).send('일정 정보를 읽지 못했어요.'); }
  const body = ICS.build(payload, { name: '자취 캘린더' });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="jachwi-calendar.ics"');
  // 계정 구독은 고친 내용이 빨리 보이게 짧게, 주소에 담긴 일정은 바뀌지 않으니 길게
  res.setHeader('Cache-Control', live ? 'public, s-maxage=300' : 'public, s-maxage=3600');
  res.status(200).send(body);
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
