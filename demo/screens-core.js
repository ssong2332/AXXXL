/* 자취 계약 내비 — 계약·신고 6개 화면(#input #result #timeline #contract #moveout #docs) 전용 순수 함수
 * 맡는 일: 모션 토큰(길이·지연·곡선의 단일 원본), 등장 판정, 차례 지연, 숫자 카운트 값 + 화면별 순수 함수(T-10~T-13 구역)
 * 팀 공통 규칙이 아니다. DOM·저장소·앱 상태를 읽지 않는다 — 입력은 plain 값, 날짜도 인자로 받는다.
 * 브라우저: <script src="screens-core.js"> → 전역 JachwiScreens / Node: require('./screens-core.js')
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JachwiScreens = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var api = {};

  // ===== T-09 =====
  // CSS 사용자 정의 속성(app.html mo:T-09 블록의 .mo 토큰 줄)과 같은 값 — tests/screens-zones.test.js Z6이 대조한다
  var T = Object.freeze({
    short: 250, base: 450, long: 600,
    step: 80, maxStep: 6, total: 930,
    shift: 20,
    ease: 'cubic-bezier(0.3, 0.7, 0.4, 1)', easeIO: 'cubic-bezier(0.4, 0, 0.2, 1)'
  });

  function num(v) { var n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return n; }

  // CSS cubic-bezier(x1, y1, x2, y2)와 같은 곡선: 시간 비율 t → 진행 비율
  function bezier(x1, y1, x2, y2) {
    function at(a1, a2, s) { return ((1 - 3 * a2 + 3 * a1) * s + (3 * a2 - 6 * a1)) * s * s + 3 * a1 * s; }
    function slope(a1, a2, s) { return 3 * (1 - 3 * a2 + 3 * a1) * s * s + 2 * (3 * a2 - 6 * a1) * s + 3 * a1; }
    return function (t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      var s = t, i, d;
      for (i = 0; i < 8; i++) { d = slope(x1, x2, s); if (Math.abs(d) < 1e-6) break; s -= (at(x1, x2, s) - t) / d; }
      if (!(s >= 0 && s <= 1) || Math.abs(at(x1, x2, s) - t) > 1e-5) {
        var lo = 0, hi = 1;
        s = t;
        for (i = 0; i < 40; i++) { if (at(x1, x2, s) < t) lo = s; else hi = s; s = (lo + hi) / 2; }
      }
      return at(y1, y2, s);
    };
  }
  var easeOut = bezier(0.2, 0, 0, 1);

  // 직전 화면과 다르면 등장 (첫 로드는 직전 화면이 빈 값)
  function isEnter(last, screen) { return (last === undefined || last === null ? '' : String(last)) !== String(screen); }

  // 움직임 줄이기가 꺼져 있고 등장일 때만 등장 모션을 붙인다
  function shouldAnimate(reduce, entering) { return !reduce && !!entering; }

  // 차례 번호 0..maxStep — 음수·숫자 아님은 0, 7번째 이후는 마지막 차례와 같이
  function stepIndex(i) {
    var n = num(i);
    if (isNaN(n) || n <= 0) return 0;
    return Math.min(T.maxStep, Math.floor(n));
  }
  function stepDelay(i) { return stepIndex(i) * T.step; }

  // 숫자 카운트: 진행 p(0..1)일 때 보여 줄 정수 — 끝(p=1)에서는 정확히 목표값
  function countAt(from, to, p) {
    var b = num(to);
    if (!isFinite(b)) b = 0;
    var a = num(from);
    if (!isFinite(a)) return b;
    var q = num(p);
    if (isNaN(q) || q <= 0) return Math.round(a);
    if (q >= 1) return b;
    return Math.round(a + (b - a) * easeOut(q));
  }

  api.T = T;
  api.isEnter = isEnter;
  api.shouldAnimate = shouldAnimate;
  api.stepIndex = stepIndex;
  api.stepDelay = stepDelay;
  api.countAt = countAt;
  // ===== /T-09 =====

  // ===== T-10 =====
  // 자격 판정 요약(F-08 ①): 할 일 = 전입신고(모두) + 전월세 신고(대상일 때). 대상을 모르면 taskUnsure 1.
  // byVerdict는 화면 목록에 보이는 판정 글자('해당 가능'·'확인 필요'·'답하면 판정'·'해당 안 됨'·'마감')별 개수
  api.resultSummary = function (o) {
    var src = o && typeof o === 'object' ? o : {};
    var list = Array.isArray(src.verdicts) ? src.verdicts : [];
    var by = {};
    list.forEach(function (v) { if (typeof v === 'string' && v) by[v] = (by[v] || 0) + 1; });
    return {
      tasks: 1 + (src.reportRequired === true ? 1 : 0),
      taskUnsure: src.reportRequired === null ? 1 : 0,
      byVerdict: by,
      ok: by['해당 가능'] || 0
    };
  };
  // 조건이 1개 이상이고 모두 ok === true일 때만 참 — 접힌 채 시작(F-08 ③)
  api.allMet = function (res) {
    return Array.isArray(res) && res.length > 0 && res.every(function (r) { return !!r && r.ok === true; });
  };
  // ===== /T-10 =====

  // ===== T-11 =====
  // 타임라인 '지금' 단계 이동 대상 (F-09 ②, OQ #4). stages: [{ key, done }] 화면 순서대로, nowKey: '지금' 단계 키
  // 모든 단계 완료 → 마지막 단계 / '지금'이 첫 단계(계약 전)거나 없음 → null(이동 없이 맨 위) / 그 외 → '지금' 단계
  api.scrollTarget = function (stages, nowKey) {
    if (!Array.isArray(stages) || !stages.length) return null;
    var allDone = stages.every(function (s) { return s && s.done; });
    if (allDone) return stages[stages.length - 1].key;
    if (nowKey == null) return null;
    for (var i = 0; i < stages.length; i++) if (stages[i] && stages[i].key === nowKey) return i === 0 ? null : nowKey;
    return null;
  };
  // ===== /T-11 =====

  // ===== T-12 =====
  // 퇴거 준비·서류함 (F-10). 날짜는 인자로 받는다.
  var WD_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  function isDate(d) { return Object.prototype.toString.call(d) === '[object Date]' && !isNaN(d.getTime()); }

  // 날짜 칩 세 줄: '9월' / '11' / '월요일' — 요일을 한 글자로 써서 '9월 월'처럼 달과 헷갈리는 표기를 막는다 (F-10 ②)
  api.dateChipParts = function (d) {
    if (!isDate(d)) return null;
    var m = d.getMonth() + 1, day = d.getDate(), wd = WD_FULL[d.getDay()];
    return { month: m + '월', day: String(day), wd: wd, label: m + '월 ' + day + '일 ' + wd };
  };

  // 지정한 할 일의 날짜만 지운 복사본 — 갱신 통지 마감은 '중요한 날짜'에만 날짜를 둔다 (F-10 ①, OQ #8). 원본은 바꾸지 않는다
  api.hideDue = function (tasks, ids) {
    if (!Array.isArray(tasks)) return [];
    var hide = Array.isArray(ids) ? ids : [];
    return tasks.map(function (t) {
      return t && hide.indexOf(t.id) >= 0 ? Object.assign({}, t, { due: null }) : t;
    });
  };

  // 준비 막대 비율(정수 %) — 전체 0·숫자 아님은 0, 0..100으로 자름 (F-10 ⑤)
  api.readyPct = function (ready, total) {
    var r = num(ready), t = num(total);
    if (!isFinite(r) || !isFinite(t) || t <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(r / t * 100)));
  };
  // ===== /T-12 =====

  // ===== T-13 =====
  // 내 계약 화면의 '조건 입력 값 확인' 행 (F-11 ③). 입력은 plain 값, 고치기는 조건 입력에서만 한다.
  // 빈 값은 '아직 안 넣음', 형식이 틀린 값은 '확인 필요' — 둘 다 missing: true. 예외를 던지지 않는다.
  var INCOME_LABEL = { '100': '100% 이하', '150': '100% 초과 ~ 150% 이하', over: '150% 초과', unknown: '잘 모르겠어요' };
  function factsEmpty(x) { return x === undefined || x === null || x === ''; }
  function factsMoney(x) {
    var n = typeof x === 'number' ? x : /^\s*\d+(\.\d+)?\s*$/.test(String(x)) ? Number(x) : NaN;
    if (!isFinite(n) || n < 0) return null;
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '만 원';
  }
  function factsDate(x) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return m[1] + '.' + m[2] + '.' + m[3];
  }
  function factsMonth(x) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(x));
    if (!m || +m[2] < 1 || +m[2] > 12) return null;
    return m[1] + '년 ' + (+m[2]) + '월';
  }
  function contractFacts(v) {
    v = v || {};
    var spec = [
      ['deposit', '보증금', factsMoney],
      ['rent', '월세', factsMoney],
      ['term', '계약 기간', function (x) { return String(x) === '1' || String(x) === '2' ? String(x) + '년' : null; }],
      ['contract', '계약일', factsDate],
      ['move', '입주일', factsDate],
      ['birth', '출생연월', factsMonth],
      ['income', '가구 소득', function (x) { return Object.prototype.hasOwnProperty.call(INCOME_LABEL, String(x)) ? INCOME_LABEL[String(x)] : null; }]
    ];
    return spec.map(function (s) {
      var raw = v[s[0]];
      if (factsEmpty(raw)) return { key: s[0], label: s[1], value: '아직 안 넣음', missing: true };
      var out = s[2](raw);
      return { key: s[0], label: s[1], value: out === null ? '확인 필요' : out, missing: out === null };
    });
  }
  api.contractFacts = contractFacts;
  // ===== /T-13 =====

  // ===== T-16 =====
  // 첫 실행 길잡이 #start 단계 등장 판정 (F-12 ②③, DECISIONS #20): 화면 이동이거나 단계 키가 직전 렌더와 다르면 등장.
  // 앞·뒤 방향 구분 없음('이전'도 등장). prevKey가 null·undefined면 빈 값으로 본다. 던지지 않는다.
  api.stepEnter = function (last, prevKey, screen, key) {
    return isEnter(last, screen) || (prevKey == null ? '' : String(prevKey)) !== String(key);
  };
  // ===== /T-16 =====

  return api;
});
