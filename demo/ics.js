/*
 * 자취 계약 내비 · 캘린더(.ics) 만들기
 * 브라우저(window.JachwiICS)와 Vercel 함수(require) 양쪽에서 같은 코드로 쓴다.
 *
 * payload 형식 (짧게 만들어 URL에 담는다. 서버에 저장하지 않는다)
 *   r: 미리 알림 '3d' | '1d' | '0d'
 *   e: [[YYYYMMDD, 제목]]                      하루 종일 일정 (기한·계약일 등)
 *   t: [[YYYYMMDDHHMM, 제목, 분]]               시간 있는 내 일정 (한국 시간)
 *   b: [[이름, 금액, 날짜(1~28|31=말일), 주기(개월), 횟수|0, 시작 YYYYMM, 'o'|'i', 끝 YYYYMMDD]]  매달 반복
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JachwiICS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TRIG = { '3d': '-P2DT15H', '1d': '-PT15H', '0d': 'PT9H' };
  function pad(n) { return String(n).padStart(2, '0'); }
  function clean(s, max) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').slice(0, max || 80); }
  function esc(s) { return clean(s, 200).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function utf8len(ch) { var c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  function fold(line) {
    var out = '', bytes = 0;
    for (var i = 0; i < line.length; i++) { var n = utf8len(line[i]); if (bytes + n > 73) { out += '\r\n '; bytes = 1; } out += line[i]; bytes += n; }
    return out;
  }
  function isYmd(s) { return /^\d{8}$/.test(s); }
  function addDay(ymd) { var d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1)); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()); }
  function kstToUtc(s, plusMin) { // YYYYMMDDHHMM (KST, UTC+9 고정) → YYYYMMDDTHHMMSSZ
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10) - 9, +s.slice(10, 12) + (plusMin || 0)));
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  function build(p, opt) {
    opt = opt || {};
    p = p || {};
    var trig = TRIG[p.r] || TRIG['1d'];
    var stamp = opt.stamp || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jachwi-navi//calendar//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + esc(opt.name || '자취 캘린더'), 'X-WR-TIMEZONE:Asia/Seoul', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
    var n = 0, uids = {};
    function ev(fields, summary, desc, uidSeed, alarm) {
      if (n >= 300) return;
      var uid = hash(uidSeed); if (uids[uid]) return; uids[uid] = 1; n++;
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@jachwi-navi', 'DTSTAMP:' + stamp);
      fields.forEach(function (f) { L.push(f); });
      L.push('SUMMARY:' + esc(summary));
      if (desc) L.push('DESCRIPTION:' + esc(desc));
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(summary), 'TRIGGER:' + (alarm || trig), 'END:VALARM', 'END:VEVENT');
    }
    (p.e || []).forEach(function (x) {
      if (!Array.isArray(x) || !isYmd(x[0])) return;
      ev(['DTSTART;VALUE=DATE:' + x[0], 'DTEND;VALUE=DATE:' + addDay(x[0])], clean(x[1]), '자취 계약 내비에서 만든 일정이에요.', 'e' + x[0] + x[1]);
    });
    (p.t || []).forEach(function (x) {
      if (!Array.isArray(x) || !/^\d{12}$/.test(x[0])) return;
      var dur = Math.min(Math.max(+x[2] || 60, 10), 24 * 60);
      ev(['DTSTART:' + kstToUtc(x[0]), 'DTEND:' + kstToUtc(x[0], dur)], clean(x[1]), '', 't' + x[0] + x[1], '-PT1H');
    });
    (p.b || []).forEach(function (x) {
      if (!Array.isArray(x)) return;
      var name = clean(x[0], 30), amt = Math.max(0, Math.round(+x[1] || 0)), day = +x[2], every = Math.min(Math.max(+x[3] || 1, 1), 12), count = Math.max(0, Math.round(+x[4] || 0)), start = String(x[5] || ''), kind = x[6] === 'i' ? 'i' : 'o', until = String(x[7] || '');
      if (!amt || !(day >= 1 && day <= 31) || !/^\d{6}$/.test(start)) return;
      var y = +start.slice(0, 4), m = +start.slice(4, 6), dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
      var first = y + pad(m) + pad(Math.min(day === 31 ? dim : day, dim));
      var rule = 'FREQ=MONTHLY;INTERVAL=' + every + ';BYMONTHDAY=' + (day === 31 ? -1 : day) + (count ? ';COUNT=' + count : isYmd(until) ? ';UNTIL=' + until : '');
      ev(['DTSTART;VALUE=DATE:' + first, 'DTEND;VALUE=DATE:' + addDay(first), 'RRULE:' + rule], name + ' ' + amt.toLocaleString('ko-KR') + '원' + (kind === 'i' ? ' 입금' : ' 납부'), '자취 계약 내비에서 만든 반복 일정이에요.', 'b' + name + start);
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  return { build: build, version: 1 };
});
