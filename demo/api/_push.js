// GET /api/push   (vercel.json rewrites → /api/public?fn=push)
// 기한 알림(웹 푸시). Vercel 크론이 매일 00:00 UTC(한국 09:00)에 부른다. Authorization: Bearer <CRON_SECRET>
//  1) Supabase push_targets(비밀값) → 알림을 켠 기기의 푸시 주소 + 휴대폰 캘린더용 일정 묶음(cal_feed)
//  2) 일정 묶음에서 오늘(한국 날짜) 보낼 것만 고른다: 당일 일정·기한, 미리 알림(r: 3d·1d), 오늘 나가는 돈·들어오는 돈
//  3) web-push(VAPID)로 보낸다. 브라우저가 404·410으로 답한 주소는 push_drop 으로 지운다.
// 일정 묶음은 /cal.ics 와 같은 모양이다 (ics.js 머리말 참고). 서버는 아무것도 저장하지 않는다.
'use strict';

const zlib = require('zlib');
const { supabase } = require('./config.js');

function decode(d) {
  const b = Buffer.from(String(d).slice(1).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const raw = d[0] === 'z' ? zlib.inflateRawSync(b, { maxOutputLength: 200000 }) : b;
  return JSON.parse(raw.toString('utf8'));
}
function pad(n) { return String(n).padStart(2, '0'); }
// 한국 날짜 YYYYMMDD (+days)
function kstYmd(now, days) { const d = new Date(now + 9 * 3600e3 + (days || 0) * 86400e3); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); }
function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }

// 반복 돈(b)이 그날(YYYYMMDD)에 있는지 — ics.js 의 RRULE(FREQ=MONTHLY;BYMONTHDAY;COUNT|UNTIL)과 같은 규칙
function billOn(x, ymd) {
  if (!Array.isArray(x)) return false;
  const day = +x[2], every = Math.min(Math.max(+x[3] || 1, 1), 12), count = Math.max(0, Math.round(+x[4] || 0)), start = String(x[5] || ''), until = String(x[7] || '');
  if (!(+x[1] > 0) || !(day >= 1 && day <= 31) || !/^\d{6}$/.test(start)) return false;
  const y = +ymd.slice(0, 4), m = +ymd.slice(4, 6), d = +ymd.slice(6, 8);
  const diff = (y * 12 + m) - (+start.slice(0, 4) * 12 + +start.slice(4, 6));
  if (diff < 0 || diff % every) return false;
  if (count && diff / every >= count) return false;
  if (!count && /^\d{8}$/.test(until) && ymd > until) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return day === 31 ? d === dim : d === day;
}

// 오늘 보낼 알림 한 개(여러 일정을 묶어서). 보낼 것이 없으면 null
function dueMessage(p, now) {
  p = p || {};
  const today = kstYmd(now), ahead = p.r === '3d' ? 3 : p.r === '1d' ? 1 : 0, soon = ahead ? kstYmd(now, ahead) : '';
  const lines = [], later = [];
  (p.t || []).forEach((x) => { if (Array.isArray(x) && String(x[0]).slice(0, 8) === today) lines.push(String(x[0]).slice(8, 10) + ':' + String(x[0]).slice(10, 12) + ' ' + String(x[1] || '').slice(0, 40)); });
  (p.e || []).forEach((x) => {
    if (!Array.isArray(x)) return;
    if (x[0] === today) lines.push(String(x[1] || '').slice(0, 40));
    else if (soon && x[0] === soon) later.push(String(x[1] || '').slice(0, 40));
  });
  (p.b || []).forEach((x) => { if (billOn(x, today)) lines.push(String(x[0] || '').slice(0, 20) + ' ' + won(+x[1]) + (x[6] === 'i' ? ' 들어오는 날' : ' 내는 날')); });
  if (!lines.length && !later.length) return null;
  const all = lines.map((l) => '오늘 · ' + l).concat(later.map((l) => (ahead === 1 ? '내일' : ahead + '일 뒤') + ' · ' + l));
  const head = lines.length ? '오늘 챙길 일 ' + lines.length + '개' : (ahead === 1 ? '내일' : ahead + '일 뒤') + ' 기한 ' + later.length + '개';
  return { title: '자취대로 · ' + head, body: all.slice(0, 4).join('\n') + (all.length > 4 ? '\n외 ' + (all.length - 4) + '개' : ''), url: '/app.html#timeline', tag: 'jachwi-' + today };
}

function vapid(env) {
  const pub = String(env.VAPID_PUBLIC_KEY || '').trim(), priv = String(env.VAPID_PRIVATE_KEY || '').trim();
  return /^[A-Za-z0-9_-]{80,100}$/.test(pub) && /^[A-Za-z0-9_-]{40,50}$/.test(priv) ? { pub, priv } : null;
}

async function rpc(sb, fetchFn, name, body) {
  const r = await fetchFn(sb.url + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: sb.key, Authorization: 'Bearer ' + sb.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(name + ' ' + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function handler(req, res, deps) {
  deps = deps || {};
  const env = deps.env || process.env, fetchFn = deps.fetch || fetch, now = deps.now || Date.now();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const secret = String(env.CRON_SECRET || '');
  if (secret.length < 32 || String((req.headers || {}).authorization || '') !== 'Bearer ' + secret) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, error: '크론만 부를 수 있어요.' })); }
  const sb = supabase(env), keys = vapid(env);
  if (!sb || !keys) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: '알림 설정이 없어요.' })); }
  const wp = deps.webpush || require('web-push');
  wp.setVapidDetails('https://jachwi-navi.vercel.app', keys.pub, keys.priv);
  let rows;
  try { rows = await rpc(sb, fetchFn, 'push_targets', { p_key: secret }) || []; } catch (e) { res.statusCode = 502; return res.end(JSON.stringify({ ok: false, error: '보낼 곳을 불러오지 못했어요.' })); }
  const out = { ok: true, devices: rows.length, sent: 0, skipped: 0, dropped: 0, failed: 0 };
  for (const row of rows) {
    let msg = null;
    try { msg = dueMessage(decode(row.feed), now); } catch (e) { msg = null; }
    if (!msg) { out.skipped++; continue; }
    try { await wp.sendNotification({ endpoint: row.ep, keys: { p256dh: row.key_p256dh, auth: row.key_auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'normal' }); out.sent++; }
    catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { out.dropped++; try { await rpc(sb, fetchFn, 'push_drop', { p_key: secret, p_endpoint: row.ep }); } catch (x) { /* 다음 날 다시 지운다 */ } }
      else out.failed++;
    }
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(out));
}

module.exports = (req, res) => handler(req, res);
module.exports.handler = handler;
module.exports.dueMessage = dueMessage;
module.exports.billOn = billOn;
module.exports.kstYmd = kstYmd;
module.exports.vapid = vapid;
