# Architecture — 자취 계약 내비 (계약·신고 영역)

> 소유자: architect | 상태: 승인 | 최종 수정: 2026-11-11
> 승인 (2026-11-11, 사용자 답 "둘 다 승인 (Recommended)" — 메인 세션이 사용자 지시로 머리글 변경)
> 상태는 초안/승인 두 가지. "승인"으로 바꾸는 것은 사용자만 한다 — 승인 전 구현 착수 금지 (AGENTS.md 파이프라인 규칙).
> 범위: 박수홍 담당 계약·신고 6개 화면(app.html `#input` `#result` `#timeline` `#contract` `#moveout` `#docs`)의 현재 시연판 구조와, PRD F-07~F-11·N-04·N-05(Tasks T-09~T-14) 구현에 필요한 설계만 다룬다. 다른 팀원 영역(지원사업·코치·캘린더·지출·집 상태·주변 탐색)과 공용 화면 틀은 설계 대상이 아니다.
> 줄 번호는 2026-11-11 브랜치 `parkSuHong-docs` 기준이다. 구현은 PR #22 병합 뒤 최신 main에서 시작하므로 줄 번호가 달라질 수 있다 — 구역은 **함수 이름과 마커 주석**으로 찾는다.

## 금지 (구현자 공통 — 이 문서의 다른 절보다 우선)

| # | 금지 | 이유 |
|---|---|---|
| 1 | 공용 `render()`·`route()`·`headerBar()`·`GROUPS`/`ROUTES`·`boot()`·공용 `click`/`change`/`input`/`submit` 리스너 수정 | PRD 범위 제외(화면 전환 방식·헤더·탭 불변), F-07 ④ |
| 2 | app.html 466줄 `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }` 수정 | PRD OQ #6 확정 — 공용 확대는 팀 합의 뒤 |
| 3 | `.mo` 범위 밖에 걸리는 CSS 선택자 추가, 기존 CSS 규칙(T-09 블록 밖) 수정 | 다른 팀원 화면 불변 (F-07 ④) |
| 4 | `@media (prefers-reduced-motion: no-preference)` 밖에 `animation`·`transition` 선언 | F-07 ① |
| 5 | 모션 길이·지연을 숫자로 직접 쓰기 — 토큰(`var(--mo-*)`, `JachwiScreens.T`)만 사용 | N-04, CodingRules "설정 및 상수" |
| 6 | `setTimeout` 체이닝으로 모션 순서 제어 | CodingRules 금지 3 |
| 7 | 계산 함수(`demo/engine.js`, `rules-core.js`, `buildTimeline`·`phase`·`nowKey`·`dueTag`·`openTasks`·`evaluate`·`judge`) 수정 | N-05, F-08 ⑥·F-09 ⑧·F-10 ⑦ |
| 8 | 자기 구역 밖 수정(아래 "수정 구역" 표). 필요하면 화면 작업에서 고치지 말고 T-09 보완으로 되돌린다 | 4개 worktree 동시 작업 충돌 방지 (Tasks 착수 조건) |
| 9 | 반복해서 계속 도는 모션(`infinite`·반복 횟수 2 이상) | N-04 |

## 실행환경 사전 확인 (기술 선택 전)

메인 세션이 2026-11-11 읽기 전용으로 관찰해 전달한 원문이다(인용). architect는 실행 권한이 없어 재실행하지 않았다.

| 확인 항목 | 읽기 전용 확인 방법과 전달할 근거 | 확인 결과 |
|---|---|---|
| 실제 런타임·버전 | `node -v` / `python --version` / `npm -v` | v22.14.0 / Python 3.13.2 / 10.9.2 (인용) |
| 설치 허용 여부 | 사용자 답변 | 미확인 — 사용자에게 물은 적 없음(인용). 확인 방법: 메인 세션이 사용자에게 질문. 이 항목에 의존하는 선택(Playwright 러너)은 확정하지 않는다 — ADR-0002 |
| 테스트 실행 수단 | `node --test "tests/*.test.js"` (CodingRules 검증된 명령어) | 133개 통과(인용). `npx --no-install playwright --version` → "npm error npx canceled due to missing packages and no YES option: ["playwright@1.65.0"]" — 설치 안 됨(인용). 저장소 루트 package.json 없음, `demo/package.json` dependencies는 "@anthropic-ai/sdk", "@vercel/blob"(서버 함수용)(인용) |
| 브라우저 실물 확인 수단 (웹 UI인 경우) | 도구 목록 | 메인 세션: Browser pane + Playwright MCP 도구(대화형, 저장소 안 러너 아님). implementer 서브 세션: Browser pane(인용, `.claude/agents/implementer.md`). 창 크기 변경(390×844)·움직임 줄이기 에뮬레이션 가능 여부는 미확인 — 확인 방법: T-09 착수 시 각 세션이 도구로 1회 시도하고 결과를 증거에 기록 |
| 로컬 실행 | `.claude/launch.json` "demo-static" | `python -m http.server 8765 --directory demo` (인용) |

## 기술 스택

| 계층 | 선택 | 선택 이유 (DECISIONS/ADR 참조) |
|---|---|---|
| 언어 | 브라우저 JavaScript(ES5 스타일, 빌드 없음) + CSS | DECISIONS #1 |
| 프레임워크 | 없음 — `app.html` 한 파일의 문자열 템플릿 + `innerHTML` 렌더 | DECISIONS #1 |
| 모션 | CSS 애니메이션·전환 + Web Animations API(숫자 카운트 시계). 외부 라이브러리 없음 | DECISIONS #9·#13·#18, ADR-0001 |
| 저장소 | 브라우저 localStorage(입력값), IndexedDB(서류 파일) — 서버 저장 없음 | PRD N-02 |
| 테스트 | Node 22 내장 `node:test`, 저장소 루트 `tests/` | DECISIONS #2·#17, ADR-0002 |
| 배포 | Vercel, Root `demo/` | DECISIONS #2(인용: 메인 세션 전달) |

## 구조 개요

```
demo/
  app.html            화면 전체(공용 틀 + 모든 팀원 화면). 이번 작업은 아래 구역만 수정
    <head> script 태그     T-09가 screens-core.js 태그 1줄 추가
    <style> 끝            T-09 모션 기반 블록 + T-10~T-13 빈 구역 마커
    <script> 안           T-09 연결 블록(MO 상태·헬퍼·접기 리스너) + 각 화면 view 함수
  engine.js           신고·기한·나이·입력 검사·서류 준비(순수 함수) — 이번 작업에서 수정하지 않음
  rules-core.js       지원 자격 판정(이성준) — 수정하지 않음
  screens-core.js     (새 파일, T-09) 계약·신고 6개 화면 전용 순수 함수: 모션 토큰·등장 판정·차례 지연·카운트 값
                      + T-10~T-13 화면 순수 함수 구역(마커로 나눔). DOM·S·today 접근 금지
tests/
  screens-core.test.js     T-09: 토큰·순수 함수 단위 테스트
  screens-zones.test.js    T-09: app.html 정적 검사(구역 마커·.mo 범위·reduce·토큰 사용)
  screen-result.test.js    T-10 / screen-timeline.test.js T-11 / screen-moveout-docs.test.js T-12 / screen-input-contract.test.js T-13
```

## 모듈 경계와 책임

| 모듈 | 책임 | 의존 대상 |
|---|---|---|
| `demo/engine.js` (JachwiEngine, `JE`) | 신고 의무·기한, 전입 기한, 만료·갱신 통지일, 만 나이, 입력 검사, 서류 준비 판정 | 없음 |
| `demo/rules-core.js` | 승인 공고로 지원 자격 판정 | 없음 |
| `demo/screens-core.js` (JachwiScreens, `JS`) — 새 파일 | 내 6개 화면의 모션 토큰과 모션·화면 순수 함수(입력은 plain 값, 출력은 값) | 없음 |
| app.html T-09 연결 블록 | 등장 여부 판정(`last` 읽기), 움직임 줄이기 확인, 화면 루트 감싸기, 렌더 뒤 작업 실행(카운트·스크롤), 접기 토글, 변화 감지 | screens-core.js(없으면 모션 없이 최종 상태), app.html 클로저 변수 `last`·`app` |
| app.html view 함수 6개 | 화면 HTML 문자열 생성. 모션은 T-09 헬퍼로만 붙임 | engine.js, rules-core.js, screens-core.js, T-09 연결 블록 |
| app.html 공용 `render(keep)` | 화면 전체 `innerHTML` 재생성, 스크롤 복원 — 이번 작업에서 0줄 수정 | 각 view 함수 |

## 데이터 흐름

1. 입력: 조건 입력·체크·파일 올림 → 공용 리스너가 `S` 갱신 + `save()`(localStorage) → `render(true)`. 화면 이동: `hashchange` → `render(false)`.
2. `render()`는 view 함수를 호출하기 **직전까지 `last`(직전 화면 이름)를 바꾸지 않는다**(2480줄에서 갱신). 내 view는 첫 줄에서 `moBegin('{화면}')`을 불러 `last !== '{화면}'`이면 "등장"으로 판정한다(DECISIONS #10).
3. view가 `moRoot('{화면}', html)`로 결과를 감싼다 → `<div class="mo mo-{화면}" [data-mo-enter]>…</div>`. 등장일 때만 `data-mo-enter`가 붙고, CSS 등장 모션은 이 속성 아래에서만 재생된다.
4. `render()`가 `innerHTML`을 넣고 스크롤을 처리(2478~2479줄)한 뒤, `moRoot`가 예약한 `requestAnimationFrame` 1회가 렌더 뒤 작업(숫자 카운트, 타임라인 '지금' 단계 스크롤)을 실행한다.
5. 접기·펼치기는 `render` 없이 T-09 클릭 리스너가 DOM 클래스만 바꾸고 열림 상태를 메모리 `MO.open`에 기록한다 → 이후 `render(true)`에서도 그 상태로 다시 그린다.

## 화면 메커니즘 — 내 6개 화면 모션 (F-07, N-04)

### 1. 모션 토큰 (DECISIONS #12)

값의 단일 원본은 `demo/screens-core.js`의 `JachwiScreens.T`이고, CSS는 같은 값을 T-09 블록의 `.mo { … }` 한 줄에 사용자 정의 속성으로 둔다. `tests/screens-zones.test.js`가 두 값이 같은지 검사한다.

| 토큰 | JS `T.` | CSS | 값 | 쓰임 |
|---|---|---|---|---|
| 짧게 | `short` | `--mo-short` | 200ms | 배지 나타나기(pop), 체크 그리기 |
| 기본 | `base` | `--mo-base` | 300ms | 카드 등장, 접기·펼치기 높이 |
| 길게 | `long` | `--mo-long` | 400ms | 막대 채우기, 숫자 카운트 |
| 차례 간격 | `step` | `--mo-step` | 50ms | 차례 등장 지연 단위 |
| 최대 차례 | `maxStep` | (클래스 `.mo-s0`~`.mo-s6`) | 6 | 7번째 이후는 6번과 같이 나타남 |
| 전체 상한 | `total` | — | 600ms | 검사용: `step × maxStep + base = 600` |
| 이동 거리 | `shift` | `--mo-shift` | 8px | 카드 등장 시 아래→제자리 |
| 감속 곡선 | `ease` | `--mo-ease` | `cubic-bezier(0.2, 0, 0, 1)` | 등장·채우기·카운트 |
| 양방향 곡선 | `easeIO` | `--mo-ease-io` | `cubic-bezier(0.4, 0, 0.2, 1)` | 접기·펼치기 |

- 막대 채우기·숫자 카운트는 지연 0으로 시작한다(차례 등장 묶음에 넣지 않는다).
- 카운트는 `T.long` 동안 `countAt(from, to, p)` 값으로 텍스트를 바꾼다.

### 2. 범위 한정 (DECISIONS #9)

- 내 6개 view는 반환 HTML 전체를 `moRoot(screen, html)`로 감싼다(조기 반환 경로 포함). `screen` 값: `input` `result` `timeline` `contract` `moveout` `docs`.
- 모든 새 CSS 선택자는 `.mo` 또는 `.mo-{화면}`으로 시작한다. 새 `@keyframes` 이름은 `mo-` 접두사.
- `#app`에는 속성·클래스를 붙이지 않는다(공용 요소라 다른 화면으로 나갈 때 남는다). 확인 근거: app.html에 `#app >`·`.main >` 자식 선택자 0건(grep) — 감싸는 div가 기존 레이아웃을 바꾸지 않는다.

### 3. 움직임 줄이기 (DECISIONS #11)

- CSS: T-09·T-10~T-13 구역의 모든 `animation`·`transition` 선언은 `@media (prefers-reduced-motion: no-preference) { … }` 안에만 둔다. 줄이기가 켜지면 선언 자체가 없으므로 최종 상태가 바로 보인다. `!important` 불필요, 공용 466줄은 그대로.
- JS: 숫자 카운트·스크롤 등 JS 모션은 `moReduce()`가 참이면 실행하지 않는다(값은 처음부터 최종값으로 그려져 있음). 스크롤은 모션이 아니라 위치 이동이므로 줄이기와 무관하게 수행한다(아래 5).
- `screens-core.js`를 못 불러온 경우(오프라인 캐시 누락 등) `moReduce()`가 참을 반환해 모션 없이 동작한다.

### 4. 등장은 화면 이동 때만 (DECISIONS #10)

| 호출 | `last` 대 화면 | 등장 모션 | 근거 |
|---|---|---|---|
| `hashchange` → `render(false)`, 다른 화면에서 들어옴 | 다름 | 1회 재생 | F-07 ②, PRD 모션 상태 표 |
| 첫 로드 `boot()` → `render(false)` | `last === ''` → 다름 | 1회 재생 | 동일 |
| 입력·체크·파일·비동기 데이터 도착 → `render(true)` | 같음 | 재생 안 함 | F-07 ② |
| 같은 화면에서 `render(false)`(백업 불러오기 등) | 같음 | 재생 안 함 | PRD "다른 화면에서 들어옴"만 등장 |

- `render()` 수정 0줄. view 함수는 `render()`와 같은 클로저 안에 있어 `var last`(2450줄)를 읽을 수 있다.
- 알려진 한계: 페이지 첫 로드 직후 비동기 `render(true)`(`loadFiles` 2608줄, `loadRules` 945줄, `loadPlaces` 1743줄)가 0.6초 안에 오면 등장 모션이 중간에 끊기고 최종 상태가 보인다. 재생 안 함 규칙과 일치하므로 허용. 등장 검증은 해시 이동으로 한다(첫 로드로 하지 않는다).

### 5. 렌더 뒤 작업 (숫자 카운트·스크롤)

- `moAfter(fn)`: view가 렌더 뒤 할 일을 등록한다. `moRoot`가 `requestAnimationFrame` 1회를 예약해 등록된 일을 실행 — `render()`의 `scrollTo`(2478~2479줄)보다 뒤, 첫 페인트 전이다. 실행 시점에 그 `.mo` 루트가 문서에 없으면(사이에 다시 그려짐) 건너뛴다. 각 작업은 `try/catch`로 감싸 실패해도 화면은 최종 상태로 남고 `console.error`로만 알린다.
- 숫자 카운트 `moNum(key, value)`: HTML에는 최종값을 그대로 쓰고(`<span class="mo-num" data-mo-num="{key}">{value}</span>`), 등장이거나 값이 바뀐 경우에만 렌더 뒤 `el.animate([{opacity:1},{opacity:1}], {duration: T.long, easing: 'linear', id: 'mo-count'})`를 **시계**로 만들어 rAF마다 `effect.getComputedTiming().progress`로 `countAt` 값을 쓰고, `finished`에서 최종값을 쓴다(DECISIONS #18 — `getAnimations()`로 측정 가능, `setTimeout` 미사용).
- 타임라인 '지금' 단계 이동(F-09 ②): 등장일 때만 `moAfter`로 `scrollIntoView({ block: 'start', behavior: 'auto' })`. 부드러운 스크롤은 길이를 통제할 수 없어 N-04를 깰 수 있으므로 쓰지 않는다(DECISIONS #15). 고정 상단바 가림은 T-11 구역에서 `.mo-timeline .stage { scroll-margin-top: … }`로 처리(휴대폰 상단바 56px + safe-area, app.html 97줄).

### 6. 변화 감지 (체크 그리기·업로드 배지·준비 수 증가)

`innerHTML` 재생성은 새 요소를 만들므로 "방금 바뀐 것"만 움직이려면 직전 값을 기억해야 한다.

- `moChanged(key, value)`: 같은 화면에서 직전 렌더의 값과 다르면 직전 값을 반환, 아니면 `undefined`. 등장 렌더에서는 기록만 하고 `undefined`. `MO.prev`에 저장(메모리, 저장소 아님).
- 용도: 체크 그리기(`key='task:'+id`, 값 `!!S.done[id]`, `false→true`일 때만 `.mo-pop` 계열 클래스), 업로드 배지(칸별 파일 수 증가), 준비 수·막대(직전 값에서 새 값으로 — 막대는 `style="--mo-from:{직전%}"` + `.mo-grow`, 숫자는 `moNum`이 직전 값부터 카운트).

### 7. 접기·펼치기 (F-08 ③, F-09 ①·⑥, DECISIONS #14)

| 요소 | 규격 |
|---|---|
| 버튼 | `<button type="button" data-mo-toggle="{key}" aria-expanded="{true|false}" aria-controls="{panelId}">` — `moToggle(key, open, labelHtml, cls)`가 만든다 |
| 패널 | `<div class="mo-fold{ open}" id="{panelId}" data-mo-panel="{key}"{ inert}><div class="mo-fold-in">…</div></div>` — `moPanel(key, open, innerHtml)`가 만든다. 닫힘이면 `inert` |
| 높이 모션 | `.mo .mo-fold { display:grid; grid-template-rows:0fr }` `.open { 1fr }`(레이아웃은 media 밖), `transition: grid-template-rows var(--mo-base) var(--mo-ease-io)`는 no-preference 안 |
| 상태 | `moOpen(key, def)`: `MO.open[key]`가 없으면 `def`를 기록하고 반환. 화면 등장(`moBegin`이 참) 때 그 화면 접두사(`{screen}:`) 키를 지워 기본값으로 다시 시작 |
| 기본값 결정 | 등장 때 한 번 정한 값을 그 방문 동안 유지한다 — 체크로 단계가 다 끝나도 `render(true)`에서 갑자기 접히지 않는다. 다음 등장 때 다시 접힌 채 시작 |
| 리스너 | T-09 블록의 `document.addEventListener('click', …)` 1개가 `[data-mo-toggle]`만 처리(공용 리스너는 `data-act`만 보므로 겹치지 않음). `render` 호출 없음 |

## 데이터 모델과 인터페이스

| 엔티티/인터페이스 | 규격 (필드·타입·제약) | 사용 모듈 |
|---|---|---|
| `S` (기존) | localStorage에 저장되는 앱 상태. 이번 작업은 **새 필드를 추가하지 않는다**(모션 상태는 저장하지 않음) | app.html 전체 |
| `MO` (새, 메모리) | `{ prev: {[key]: any}, open: {[key]: boolean}, enter: {[screen]: boolean}, jobs: Function[] }`. key 형식 `'{screen}:{종류}:{id}'`. 새로고침 시 사라짐 | T-09 연결 블록 |
| `JachwiScreens.T` | 위 토큰 표의 9개 값. 숫자는 ms 정수 | screens-core, T-09 블록, 테스트 |
| `JS.isEnter(last: string, screen: string) → boolean` | `last !== screen` | T-09 블록 |
| `JS.stepIndex(i: number) → 0..6` | 음수·NaN → 0, 6 초과 → 6 | view(`moStep`) |
| `JS.stepDelay(i) → ms` | `stepIndex(i) * T.step` | 테스트 |
| `JS.countAt(from, to, p) → 정수` | `p`를 0..1로 자름, 감속 곡선 적용, `p=1`이면 정확히 `to` | 카운트 |
| `JS.shouldAnimate(reduce: boolean, entering: boolean) → boolean` | `!reduce && entering` | T-09 블록 |
| T-09 연결 헬퍼 (app.html) | `moBegin(screen)→boolean`, `moRoot(screen, html)→string`, `moStep(i)→' mo-in mo-s{n}'`, `moNum(key, value)→string`, `moChanged(key, value)→prev|undefined`, `moOpen(key, def)→boolean`, `moToggle(...)`, `moPanel(...)`, `moAfter(fn)`, `moReduce()→boolean` | 내 view 6개만 |
| CSS 클래스 (T-09) | `.mo-in`+`.mo-s0`~`.mo-s6`(등장, `[data-mo-enter]` 아래서만), `.mo-fill`(막대 0→현재, 등장 때만), `.mo-grow`+`--mo-from`(막대 직전→현재), `.mo-pop`(배지·체크 나타나기), `.mo-fold`/`.mo-fold-in`/`.open`, `.mo-num` | 내 view 6개 |
| 화면 순수 함수 (T-10~T-13, screens-core 각 구역) — 권장 시그니처, 입력은 plain 값(DOM·`S`·전역 `today` 접근 금지, 날짜는 인자로) | T-10 `resultSummary({ reportRequired, verdicts: string[] }) → { tasks, byVerdict }`, `allMet(res: [{ok}]) → boolean`. T-11 `scrollTarget(stages: [{key, done}], nowKey) → key|null`(OQ #4: 지금 단계 있으면 그 키, 없고 모두 완료면 마지막 키, 그 외 null). T-12 `dateChipParts(date) → {...}`, 갱신 통지 중복 제거 규칙. T-13 필요 시만 | 각 화면 view, 각 화면 테스트 |

### 계층 규칙 (DB·외부 API가 있는 프로젝트만 — 없으면 "해당 없음" 기재)

기준은 `.agents/skills/clean-architecture/SKILL.md`. 이 프로젝트에 적용할 결정만 아래에 적는다.

| 항목 | 결정 |
|---|---|
| 의존성 방향 | 순수 함수 파일(engine.js·rules-core.js·screens-core.js) ← app.html view. 순수 함수 파일은 DOM·localStorage·서로를 참조하지 않는다 |
| Repository 포트 | 해당 없음 — 이번 범위에 DB·외부 API 호출이 없다(서류 IndexedDB는 기존 코드 그대로) |
| DTO ↔ 도메인 변환 위치 | 해당 없음 — 서버 경계 없음. 화면 순수 함수에 넘길 plain 값은 view 함수가 만든다 |
| 순환 의존성 | 금지 |

## app.html 수정 구역 (4개 worktree 동시 작업)

T-09가 main에 먼저 병합되며, 그때 **빈 구역 마커**를 미리 만든다. T-10~T-13은 자기 마커 사이와 자기 함수 안만 고친다. 서로 다른 구역 사이에 바뀌지 않는 줄(마커)이 끼어 있으므로 git 3-way 병합이 충돌 없이 합쳐진다.

| 구역 | 위치 (찾는 법) | 소유 | 허용 수정 |
|---|---|---|---|
| head 스크립트 | `<script src="engine.js" defer></script>` 바로 다음 줄 | T-09 | `<script src="screens-core.js" defer></script>` 1줄 추가 |
| CSS 모션 기반 | `</style>` 바로 앞, `/* ===== mo:T-09 내 화면 6개 모션 (계약·신고 전용) ===== */` ~ `/* ===== /mo:T-09 ===== */` | T-09 | 토큰·공용 keyframes(`mo-in` `mo-fill` `mo-grow` `mo-pop`)·`.mo-s0~6`·`.mo-fold` |
| CSS 화면 구역 | T-09 블록 다음에 순서대로 `/* ===== mo:T-10 #result ===== */`~`/* ===== /mo:T-10 ===== */`, `mo:T-11 #timeline`, `mo:T-12 #moveout #docs`, `mo:T-13 #input #contract` — 구역 사이 빈 줄 1개 | 각 T | 자기 마커 사이에만. 선택자는 `.mo-{자기 화면}`으로 시작, keyframes는 `mo-{화면}-` 접두사 |
| JS T-09 연결 블록 | `// ---------- 메뉴 구조 ----------` 바로 앞, `// ===== mo:T-09 =====` ~ `// ===== /mo:T-09 =====` | T-09 | MO 상태·헬퍼·접기 리스너 |
| screens-core.js | 파일 안 `// ===== T-09 =====`, `// ===== T-10 =====` … `// ===== T-13 =====` 구역(각 `// ===== /T-xx =====`로 끝) | 각 T | 자기 구역에 `api.이름 = function …` 추가만. T-09 구역·UMD 머리·꼬리 수정 금지 |
| T-10 | `// ---------- 자격 판정 (필수 ①) ----------` 주석부터 `viewResult` 끝 `}`까지 | T-10 | `viewResult` 본문, 그 위 새 helper |
| T-11 | `taskItem` 함수(1148~1157줄) + `viewTimeline` 함수(1164~1176줄) | T-11 | `viewTimeline` 본문·그 바로 위 새 helper. `taskItem`은 **선택 인자 `o`에 새 속성만 추가**하고, 그 속성이 없을 때 출력이 지금과 같아야 한다(퇴거 준비도 같은 함수 사용) |
| T-12 | `viewDocs` 함수(1652~1668줄), `// ---------- 퇴거 준비 ----------`부터 `viewMoveout` 끝까지 | T-12 | 두 view 본문·각 view 바로 위 새 helper. 날짜 칩은 새 helper로 만들고 공용 위치의 `dateBlk`(1161줄)는 고치지 않는다. 갱신 통지 할 일의 날짜 숨김은 `taskItem`을 고치지 말고 넘기는 객체 복사본으로 처리(예: `Object.assign({}, t, { due: null })` — `dueTag`는 `t.due`가 없으면 빈 배지, 1040줄) |
| T-13 | `// ---------- 내 계약 ----------`부터 `viewContract` 끝, `// ---------- 조건 입력 (필수 ①) ----------`부터 `viewInput` 끝 | T-13 | 두 view 본문·각 view 바로 위 새 helper. `homeCard()`·`deviceCards()`·`regionFields()`는 호출만 |
| tests/ | 위 "구조 개요"의 파일 이름 | 각 T | 자기 테스트 파일만 새로 만든다. 남의 테스트 파일·`answer-key.json` 수정 금지 |
| 모든 화면 작업 금지 구역 | 위 "금지" 표 + T-09 구역들 + 마커 줄 자체 + 다른 T 구역 + `sw.js`·`index.html`·`admin.html` | — | 수정 필요 시 멈추고 메인 세션에 보고 → T-09 보완(재작업 태스크) |

새 이벤트 처리가 필요하면 화면 작업이 `document.addEventListener`를 추가하지 않는다. 현재 필요한 상호작용(접기=T-09 리스너, 체크=기존 `data-act="task"`, 파일=기존 `addfile`, '조건 입력에서 고치기'=`href="#input"` 링크, '판정 보기'=`href="#result"` 링크)은 모두 기존·T-09 처리로 충분하다.

### 병합 순서·충돌 처리

| 순서 | 내용 |
|---|---|
| 1 | PR #22(T-05 서류함) main 병합 |
| 2 | T-09 브랜치(최신 main에서) → 리뷰·QA → main 병합 |
| 3 | T-10·T-11·T-12·T-13 worktree를 2의 main에서 각각 생성, 동시 진행. 병합은 끝난 순서대로(서로 의존 없음) |
| 4 | 각 PR 병합 직전: 최신 main을 자기 브랜치에 병합 → `node --test "tests/*.test.js"` 재실행 → 자기 화면 재확인 → 증거 저장 |
| 5 | 충돌이 자기 구역 밖에서 나면 구역 위반이다 — 남의 구역을 고쳐 해소하지 말고 멈추고 메인 세션에 보고 |
| 6 | 넷 모두 병합 뒤 T-14가 main에서 통합 검증 |

`docs/Tasks.md`·`docs/CodingRules.md`는 worktree에서 고치지 않는다(Tasks는 planner, 명령은 기존 원문 그대로 쓰므로 새 행 불필요).

## 테스트 전략

케이스 도출·부실 테스트 방지 기준은 `.agents/skills/tdd-practitioner/SKILL.md`를 따른다 (정상 1 + 경계 2 + 예외 2 이상, 실제 값 단언, 비동기 대기, 외부 의존성 격리). 아래에는 이 프로젝트의 선택만 적는다.

| 항목 | 결정 |
|---|---|
| 테스트 프레임워크 | Node 22 내장 `node:test`(설치 없음). 명령 원문: `node --test "tests/*.test.js"`. 저장소 안 E2E 러너(Playwright)는 두지 않는다 — DECISIONS #5 유지, 이번 사유는 DECISIONS #17·ADR-0002 |
| 테스트 디렉토리 배치 | 저장소 루트 `tests/` (배포 Root `demo/` 밖). 파일 이름은 "구조 개요" 참조 |
| 커버 범위 기준 | ① 모션 토큰·순수 함수(screens-core) 단위 테스트 ② app.html 정적 검사(아래) ③ 화면 순수 함수 단위 테스트(T-10~T-13 각자) ④ 회귀 N-05: fail 0, pass 133 이상(기준 `.artifacts/verification/T-05/20261111-215844-green`(인용)), 정답표 30/30 ⑤ 화면·모션 실측은 브라우저 도구로(아래 "실측 절차") |
| Mock/Stub 대상 (외부 의존성) | 없음 — 순수 함수만 Node에서 실행. app.html은 파일 텍스트로만 읽는다(`fs.readFileSync`). `matchMedia`는 `shouldAnimate(reduce, entering)`에 값을 넘겨 대신 검사 |

### 정적 검사 `tests/screens-zones.test.js` (T-09가 Red-First로 작성, T-10~T-13이 계속 통과시킴)

| # | 검사 | 실패 시 의미 |
|---|---|---|
| Z1 | CSS 마커 쌍 `mo:T-09`·`mo:T-10`~`mo:T-13`, JS 마커 쌍 `mo:T-09`이 각각 정확히 1번, 이 순서로 있다 | 구역 훼손 |
| Z2 | `<script src="screens-core.js" defer></script>`가 1번, engine.js 태그 다음에 있다 | 로드 순서 |
| Z3 | 466줄 규칙 문자열 `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }`가 정확히 1번 그대로 있다 | 공용 규칙 변경(F-07 ④·OQ #6) |
| Z4 | CSS 구역 안의 모든 `animation`·`transition` 선언이 `@media (prefers-reduced-motion: no-preference)` 블록 안에 있다(중괄호 깊이 스캔) | F-07 ① |
| Z5 | CSS 구역 안의 모든 선택자가 `.mo`로 시작한다(@-규칙, keyframes 단계 `from`/`to`/`%` 제외). keyframes 이름은 `mo-` 접두사 | 범위 이탈(F-07 ④) |
| Z6 | CSS 구역 안 시간 리터럴(`\d+ms`, `\d*\.?\d+s`)은 T-09 토큰 선언 줄에만 있고, 그 값이 `JachwiScreens.T`와 같다. 나머지는 `var(--mo-short|base|long)`와 `calc(var(--mo-step) * n)`(n ≤ 6)만 | N-04 길이·0.6초 상한 |
| Z7 | `infinite` 0건, `animation-iteration-count` 0건 | N-04 반복 모션 0개 |

### 실측 절차 (브라우저 — 설치 없음)

실행 주체는 각 worktree의 implementer(Browser pane), QA, 메인 세션(Browser pane·Playwright MCP). 로컬 서버: `python -m http.server 8765 --directory demo`. 결과(스니펫 출력 원문·URL·시각·창 크기)를 `.artifacts/verification/T-xx/{실행ID}/`에 저장한다. 창 크기 390×844·1280×800 설정과 움직임 줄이기 에뮬레이션이 그 도구에서 되는지는 미확인 — 안 되면 AGENTS.md "화면 검증 도구 실패 처리" 표대로 메인 세션 확인으로 넘기고 해당 AC를 미검증으로 보고한다.

| 기준 | 방법 | 통과 |
|---|---|---|
| 길이·0.6초 (F-07 ③) | 다른 화면(예: `#home`)에서 해시 이동 직후 스니펫 M1 | 모든 행 `ok: true`, 행 1개 이상 |
| `render(true)` 재생 없음 (F-07 ②) | 등장이 끝난 뒤(1초 대기) 입력·체크(예: 시연 모드 헤더 `[data-sim]` 변경, 타임라인 체크) 직후 M1 | `mo-in`·`mo-fill`·`mo-count`(값이 안 바뀐 것) 0개. 체크 그리기·업로드 배지처럼 그 조작이 의도한 것만 있음 |
| 움직임 줄이기 (F-07 ①) | 줄이기를 켠 상태(아래)에서 `matchMedia('(prefers-reduced-motion: reduce)').matches === true` 확인 후 해시 이동·체크·접기 직후 M1 | 0개, 화면은 최종 상태 |
| 다른 화면 불변 (F-07 ④) | `#home` `#support` `#coach` `#calendar` `#map`에서 `document.querySelector('.mo') === null` + 콘솔 오류 비교 + `git diff main...HEAD -- demo/app.html`의 모든 hunk가 자기 구역 안 | 모두 참 |
| 높이 (F-09 ③, F-11 ②⑤) | 390×844, 예시 데이터에서 `document.documentElement.scrollHeight` | 기준 6,793 / 1,880 / 3,048px보다 작음 — 측정값을 기준과 나란히 기록 |

움직임 줄이기를 켜는 수단(설치 없음): ① Windows 설정 > 접근성 > 시각 효과 > "애니메이션 효과" 끄기 — Chromium 계열이 `reduce`로 보고한다(추정 — 확인 방법: 위 `matchMedia` 값). 사용자 기기 설정이므로 메인 세션이 사용자에게 요청한다. ② DevTools Rendering 패널 "Emulate CSS media feature prefers-reduced-motion"(사람이 조작). ③ Playwright MCP에 미디어 에뮬레이션 기능이 있으면 사용(미확인).

스니펫 M1(콘솔/도구의 evaluate에 그대로 붙여 넣는다):

```js
(() => {
  const root = document.querySelector('#app .mo');
  if (!root) return 'no .mo root';
  return document.getAnimations()
    .filter(a => a.effect && a.effect.target && root.contains(a.effect.target))
    .filter(a => (a.animationName || '').startsWith('mo-') || (a.id || '').startsWith('mo-') || (a.transitionProperty && a.effect.target.closest('.mo-fold')))
    .map(a => { const t = a.effect.getComputedTiming(); return { name: a.animationName || a.id || a.transitionProperty, dur: t.duration, delay: t.delay, end: t.delay + t.duration, iter: t.iterations, ok: t.duration >= 200 && t.duration <= 400 && t.delay + t.duration <= 600 && t.iterations === 1 }; });
})()
```

## 배포

| 항목 | 결정 |
|---|---|
| 호스팅 / 실행 대상 | Vercel, 프로젝트 Root `demo/`(인용 — 메인 세션 전달). 정적 파일 + `demo/api/` 서버 함수(다른 팀원 영역, 이번 범위 밖) |
| 빌드·릴리스 파이프라인 | main 병합 시 GitHub Actions `.github/workflows/deploy-vercel.yml`이 Vercel 운영 배포를 실행하고 테스트 단계는 없다(인용 — 이 브랜치 작업 트리에서는 `.github/workflows/`를 찾지 못해 직접 확인 못 함, main에서 확인 필요). 따라서 병합 전 각 worktree에서 `node --test "tests/*.test.js"`를 실행하는 것이 유일한 자동 게이트다 |
| 환경과 승격 | 로컬(`python -m http.server 8765 --directory demo`) → main 병합 = 운영. 스테이징 없음 |
| 환경별 설정 | 이번 작업에 환경 변수 없음. 새 파일 `screens-core.js`는 상대 경로 정적 파일 |
| DB·상태 마이그레이션 | 해당 없음 — `S`에 새 필드를 넣지 않고 모션 상태는 메모리에만 둔다 |
| 롤백 절차 | 문제 PR의 병합 커밋을 `git revert`해 main에 다시 병합 → 자동 배포. 화면 작업 PR은 구역이 분리돼 하나만 되돌릴 수 있다. T-09를 되돌리려면 T-10~T-13이 그 헬퍼를 쓰므로 함께 되돌려야 한다 |
| 헬스체크 / 스모크 테스트 | 배포 뒤 메인 세션이 운영 URL에서 6개 화면 해시 이동 + 콘솔 오류 확인(T-14 범위). 서비스 워커는 network-first(sw.js 11줄)라 새 `screens-core.js`는 SHELL 목록에 넣지 않아도 첫 온라인 로드 때 캐시된다(추정 — 확인 방법: DevTools Application > Cache Storage `jachwi-v18`에 `/screens-core.js` 존재). sw.js는 수정하지 않는다 |

## 에러 처리

| 항목 | 결정 |
|---|---|
| 예외를 잡는 위치 | 모션 계층만 정한다: `moAfter` 실행기가 작업마다 `try/catch` 후 `console.error` — 화면 HTML은 이미 최종 상태라 사용자 영향 없음. view 함수·계산의 기존 예외 처리는 바꾸지 않는다 |
| 실패가 사용자에게 드러나는 방식 | 모션 실패·`screens-core.js` 누락 시 모션 없이 최종 상태가 보인다(오류 문구 없음). 입력 오류 문구는 기존(F-01, DECISIONS #7) 그대로 |
| 경계 간 전파 | 순수 함수는 잘못된 입력을 경계값으로 자른다(`stepIndex`·`countAt`) — 던지지 않는다. 모션 계층의 오류는 화면·계산 쪽으로 전파하지 않는다 |

## 관측성

| 항목 | 결정 |
|---|---|
| 로깅 | 브라우저 콘솔만 — 모션 작업 실패 시 `console.error`. 서버 로그 없음(N-02 외부 전송 0건) |
| 에러 추적 / 모니터링 | 없음 — 시연판, 개인정보 외부 전송 금지(N-02) |
| 메트릭 | 없음 — 검증 시 스니펫 M1·높이 측정을 증거로 남긴다 |

## 주요 결정

결정 기록은 [DECISIONS.md](DECISIONS.md)와 [adr/](adr/)에 있다. 이 문서에는 결과만 반영한다. 이번 추가: DECISIONS #9~#18, ADR-0001(모션 구현 방식), ADR-0002(검증 수단).
