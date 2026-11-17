/* 계정(선택): 로그인하면 내 기록을 다른 기기에서도 이어서 본다.
 * - 로그인 없이도 지금처럼 다 쓸 수 있다. 로그인은 "기기 바꿔도 이어 보기"용이다.
 * - Supabase Auth(카카오·구글·이메일)와 DB 한 줄(user_state)을 fetch로만 쓴다. supabase-js를 싣지 않는다.
 * - 서버에 올리지 않는 칸(SKIP): 집·통학 위치 좌표, 장소 저장, AI 대화, 사진과 묶인 집 상태 기록, 서류, 예시 모드·화면 상태.
 *   서류·사진 파일은 원래 다른 저장소(IndexedDB)에 있어 여기서 다루지 않는다.
 * - 열쇠는 공개 키(publishable)만 쓴다. 남의 기록은 DB 권한(RLS)이 막는다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JachwiAccount = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 위치·대화·사진·서류 (개인정보라서 이 기기에만)
  var PRIVATE = ['home', 'commute', 'rgc', 'saved', 'savedP', 'chat', 'rooms', 'bot', 'cond', 'files'];
  // 예시 모드·화면을 어디까지 열었는지 같은 이 기기 화면 상태
  var UI = ['demo', 'sim', 'pickHome', 'mapSel', 'mapCat', 'mapTheme', 'homeCat', 'recCat', 'calM', 'calSel', 'calEdit', 'calTab', 'calF', 'calHi', 'condTab', 'condFold', 'condAddOpen', 'actEdit', 'roomOpen', 'qa', 'aiCoach'];
  var SKIP = PRIVATE.concat(UI);
  var MAX = 200000;   // 한 사람 기록 상한(글자). 넘으면 올리지 않는다

  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

  // 서버에 올릴 부분만 고른다
  function pick(S) {
    var o = {};
    Object.keys(S || {}).forEach(function (k) { if (SKIP.indexOf(k) < 0 && S[k] !== undefined && typeof S[k] !== 'function') o[k] = S[k]; });
    o = JSON.parse(JSON.stringify(o));
    return JSON.stringify(o).length > MAX ? null : o;
  }

  // 서버 기록을 이 기기 상태에 덮는다. 위치·대화 같은 이 기기 칸은 그대로 둔다
  function apply(S, remote) {
    if (!isObj(remote)) return S;
    Object.keys(remote).forEach(function (k) { if (SKIP.indexOf(k) < 0 && k !== '__proto__' && k !== 'constructor') S[k] = remote[k]; });
    S.demo = false;
    return S;
  }

  // 로그인 후 어느 쪽을 남길지: 'pull'(서버 것을 가져옴) · 'push'(이 기기 것을 올림) · 'same'
  //  remoteAt: 서버에 마지막으로 올린 시각, localAt: 이 기기에서 마지막으로 고친 시각 (ms)
  //  이 기기가 아직 비어 있으면(온보딩 전·예시 모드) 서버 것을 가져온다
  function decide(remote, remoteAt, localAt, localFresh) {
    if (!remote) return 'push';
    if (localFresh) return 'pull';
    if (!localAt || remoteAt > localAt) return 'pull';
    if (remoteAt === localAt) return 'same';
    return 'push';
  }

  function b64urlDecode(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    if (typeof atob === 'function') return decodeURIComponent(Array.prototype.map.call(atob(s), function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    return Buffer.from(s, 'base64').toString('utf8');
  }
  function jwtClaims(tok) { try { return JSON.parse(b64urlDecode(String(tok).split('.')[1])); } catch (e) { return null; } }

  // 토큰 응답 → 이 앱이 저장하는 세션 모양
  function toSession(t, now) {
    if (!t || !t.access_token || !t.refresh_token) return null;
    var c = jwtClaims(t.access_token) || {}, u = t.user || {};
    var meta = u.user_metadata || {};
    var exp = +t.expires_at || +c.exp || Math.floor((now || Date.now()) / 1000) + (+t.expires_in || 3600);
    if (!c.sub && !u.id) return null;
    return {
      access_token: String(t.access_token), refresh_token: String(t.refresh_token), expires_at: exp,
      user: { id: String(u.id || c.sub), email: String(u.email || c.email || ''), name: String(meta.name || meta.full_name || meta.nickname || meta.preferred_username || ''), provider: String((u.app_metadata || c.app_metadata || {}).provider || '') },
      type: t.type ? String(t.type) : ''
    };
  }

  // OAuth·메일 링크에서 돌아왔을 때 주소의 #access_token=… 또는 #error=… 를 읽는다. 해당 없으면 null
  function parseAuthHash(hash, now) {
    var h = String(hash || '').replace(/^#/, '');
    if (!/(^|&)(access_token|error|error_description)=/.test(h)) return null;
    var q = {};
    h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {} } });
    if (q.error || q.error_description) return { error: q.error_description || q.error };
    var s = toSession(q, now);
    return s ? { session: s } : { error: '로그인 정보를 읽지 못했어요.' };
  }

  // 사람이 읽는 오류 문장
  function errText(j, status) {
    var m = String((j && (j.msg || j.error_description || j.message || j.error)) || '');
    var code = String((j && (j.error_code || j.code)) || '');
    if (/invalid_credentials|Invalid login credentials/i.test(code + m)) return '이메일이나 비밀번호가 맞지 않아요.';
    if (/email_not_confirmed|Email not confirmed/i.test(code + m)) return '메일함의 인증 링크를 먼저 눌러 주세요.';
    if (/user_already_exists|already registered/i.test(code + m)) return '이미 가입한 이메일이에요. 로그인해 주세요.';
    if (/weak_password|Password should be/i.test(code + m)) return '비밀번호는 6자 이상으로 정해 주세요.';
    if (/over_email_send_rate_limit|rate limit/i.test(code + m) || status === 429) return '잠시 뒤에 다시 해 주세요. 메일을 너무 자주 보냈어요.';
    if (/validation_failed|invalid.*email|Unable to validate email/i.test(code + m)) return '이메일 주소를 확인해 주세요.';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return '이 로그인 방식은 아직 준비 중이에요.';
    if (!status) return '인터넷 연결을 확인해 주세요.';
    return '잠시 문제가 생겼어요. 다시 해 주세요.';
  }

  var SESSION_KEY = 'jachwi-auth';

  // cfg: { url: 'https://<ref>.supabase.co', key: 'sb_publishable_…' }
  // io: { fetch, store: { get(k), set(k,v), del(k) }, now() }  (테스트에서 바꿔 끼운다)
  function client(cfg, io) {
    io = io || {};
    var F = io.fetch || (typeof fetch === 'function' ? fetch.bind(typeof self !== 'undefined' ? self : this) : null);
    var store = io.store || {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
      del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
    };
    var now = io.now || function () { return Date.now(); };
    var base = String(cfg.url).replace(/\/+$/, ''), key = String(cfg.key);
    var sess = null;
    try { sess = JSON.parse(store.get(SESSION_KEY) || 'null'); } catch (e) { sess = null; }
    if (sess && (!sess.access_token || !sess.user || !sess.user.id)) sess = null;

    function keep(s) { sess = s; if (s) store.set(SESSION_KEY, JSON.stringify(s)); else store.del(SESSION_KEY); return s; }

    function call(path, opt) {
      opt = opt || {};
      var h = { apikey: key, 'Content-Type': 'application/json' };
      if (opt.token) h.Authorization = 'Bearer ' + opt.token;
      Object.keys(opt.headers || {}).forEach(function (k) { h[k] = opt.headers[k]; });
      return F(base + path, { method: opt.method || 'GET', headers: h, body: opt.body === undefined ? undefined : JSON.stringify(opt.body) })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
            if (!r.ok) { var err = new Error(errText(j, r.status)); err.status = r.status; throw err; }
            return j;
          });
        }, function () { throw new Error(errText(null, 0)); });
    }

    // 만료 1분 전이면 새 토큰으로 바꾼 뒤 돌려준다. 바꾸지 못하면 로그아웃 상태가 된다
    function token() {
      if (!sess) return Promise.resolve(null);
      if (sess.expires_at - 60 > now() / 1000) return Promise.resolve(sess.access_token);
      return call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } })
        .then(function (t) { var s = toSession(t, now()); keep(s); return s ? s.access_token : null; },
          function (e) { if (e.status >= 400 && e.status < 500) keep(null); throw e; });
    }

    var api = {
      // 켜져 있는 로그인 방식: { email, kakao, google } (Supabase 공개 설정)
      providers: function () {
        return call('/auth/v1/settings').then(function (j) {
          var x = (j && j.external) || {};
          return { email: !!x.email && !j.disable_signup, kakao: !!x.kakao, google: !!x.google };
        });
      },
      session: function () { return sess; },
      user: function () { return sess && sess.user; },
      adopt: function (s) { return keep(s); },
      // 카카오는 이메일 동의(비즈 앱) 없이 닉네임·프로필만 받는다
      oauthUrl: function (provider, redirectTo) {
        var u = base + '/auth/v1/authorize?provider=' + encodeURIComponent(provider) + '&redirect_to=' + encodeURIComponent(redirectTo);
        if (provider === 'kakao') u += '&scopes=' + encodeURIComponent('profile_nickname profile_image');
        return u;
      },
      signUp: function (email, password, redirectTo) {
        return call('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirectTo), { method: 'POST', body: { email: email, password: password } })
          .then(function (t) { var s = toSession(t, now()); if (s) keep(s); return { session: s, confirm: !s }; });
      },
      signIn: function (email, password) {
        return call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } })
          .then(function (t) { var s = toSession(t, now()); if (!s) throw new Error(errText(null, 500)); return keep(s); });
      },
      recover: function (email, redirectTo) {
        return call('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), { method: 'POST', body: { email: email } });
      },
      setPassword: function (password) {
        return token().then(function (tk) { if (!tk) throw new Error('다시 로그인해 주세요.'); return call('/auth/v1/user', { method: 'PUT', token: tk, body: { password: password } }); })
          .then(function () { if (sess) { sess.type = ''; keep(sess); } });
      },
      signOut: function () {
        var tk = sess && sess.access_token; keep(null);
        return tk ? call('/auth/v1/logout', { method: 'POST', token: tk }).catch(function () {}) : Promise.resolve();
      },
      // 내 기록 한 줄: { state, updated_at } 또는 null
      pull: function () {
        return token().then(function (tk) {
          if (!tk) return null;
          return call('/rest/v1/user_state?select=state,updated_at&user_id=eq.' + encodeURIComponent(sess.user.id), { token: tk })
            .then(function (rows) { var r = rows && rows[0]; return r ? { state: r.state, at: Date.parse(r.updated_at) || 0 } : null; });
        });
      },
      // extra: { cal_token, cal_feed } 휴대폰 캘린더 구독용 (있을 때만 같이 올린다)
      push: function (state, extra) {
        return token().then(function (tk) {
          if (!tk) return null;
          var at = new Date(now()).toISOString(), body = { user_id: sess.user.id, state: state, updated_at: at };
          if (extra && /^[A-Za-z0-9_-]{24,64}$/.test(extra.cal_token || '')) { body.cal_token = extra.cal_token; body.cal_feed = typeof extra.cal_feed === 'string' && extra.cal_feed.length <= 6000 ? extra.cal_feed : null; }
          return call('/rest/v1/user_state?on_conflict=user_id', { method: 'POST', token: tk, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: body })
            .then(function () { return Date.parse(at); });
        });
      },
      // 기한 알림: 이 기기(브라우저)의 푸시 주소를 계정에 저장/삭제한다. sub = PushSubscription.toJSON()
      pushSave: function (sub) {
        var k = sub && sub.keys || {};
        if (!sub || !/^https:\/\//.test(sub.endpoint || '') || !k.p256dh || !k.auth) return Promise.reject(new Error('알림 주소를 만들지 못했어요.'));
        return token().then(function (tk) {
          if (!tk) throw new Error('다시 로그인해 주세요.');
          return call('/rest/v1/rpc/push_save', { method: 'POST', token: tk, body: { p_endpoint: sub.endpoint, p_p256dh: k.p256dh, p_auth: k.auth } });
        });
      },
      pushRemove: function (endpoint) {
        return token().then(function (tk) {
          if (!tk || !endpoint) return null;
          return call('/rest/v1/push_subs?endpoint=eq.' + encodeURIComponent(endpoint), { method: 'DELETE', token: tk, headers: { Prefer: 'return=minimal' } });
        });
      },
      // 탈퇴: 서버의 내 기록과 계정을 지운다 (이 기기 기록은 남는다)
      deleteMe: function () {
        return token().then(function (tk) {
          if (!tk) throw new Error('다시 로그인해 주세요.');
          return call('/rest/v1/rpc/delete_me', { method: 'POST', token: tk, body: {} });
        }).then(function () { keep(null); });
      }
    };
    return api;
  }

  return { SKIP: SKIP, PRIVATE: PRIVATE, pick: pick, apply: apply, decide: decide, parseAuthHash: parseAuthHash, toSession: toSession, errText: errText, client: client, SESSION_KEY: SESSION_KEY };
});
