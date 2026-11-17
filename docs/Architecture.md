# Architecture — 자취 계약 내비 (계약·신고 영역)

> 소유자: architect | 상태: 승인 | 최종 수정: 2026-11-17 (T-29 QR 받기 집 위치·실제 날짜·`term` 정수 — DECISIONS #35, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 금지 #1·#8, 데이터 모델 `JS.checkImport` 행 한계 문구·T-29 1행, 수정 구역 T-29 4행·tests 행. 기존 함수 시그니처 변경 없음 — `checkImport` 규칙 강화와 새 순수 함수 2개) / 이전: 2026-11-17 (T-25~T-28 레포 감사 반영 병렬 작업 경계 — DECISIONS #32~#34, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 금지 #1·#8, 데이터 모델 T-25·T-26 2행, 수정 구역 T-25~T-28 공통·4행. 기존 인터페이스·데이터 모델 규격 변경 없음 — 새 순수 함수 2개 추가만) / 이전: 2026-11-16 (T-24 R5 금액 칸에 입력 원문 보이기 — DECISIONS #31, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 금지 #1, 수정 구역 T-24 R5 1행, 주요 결정) / 이전: 2026-11-16 (T-24 R4 값 통째 교체 시 금액 안내 비우기 — DECISIONS #30, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 금지 #1, 수정 구역 T-24 R4 1행, 주요 결정) / 이전: 2026-11-16 (T-24 PR #66 리뷰 반영 R1~R3 예외 — DECISIONS #29, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 금지 #1, 수정 구역 T-24 5행·tests 행, 주요 결정) / 이전: 2026-11-16 (T-23 범위 추가 B8~B10 예외 — DECISIONS #27·#28, **바뀐 부분 사용자 확인 대기**: 바뀐 절은 구조 개요 screens-core 줄, 데이터 모델 T-23 B10 2행, 수정 구역 T-23 B8·B9·B10 3행, 테스트 전략 "T-23 재작업 테스트" B8~B10 3행, 주요 결정) / 이전: 2026-11-16 (T-23 버그 B1~B7 재작업 예외 — DECISIONS #24~#26, **바뀐 부분 사용자 확인 대기**(AGENTS.md "진행 중 요구사항 변경" 2행): 바뀐 절은 금지 #1·#7, 구조 개요 screens-core 줄, 데이터 모델 T-23 2행, 수정 구역 T-23 7행·tests 행, 테스트 전략 "T-23 재작업 테스트" 절) / 이전: 2026-11-12 (T-15 모션 토큰 값만 변경 — DECISIONS #19 / T-16 온보딩 `#start` 편입 — DECISIONS #20, ADR-0003 / T-18 신고 대상 지역 `reportArea` — DECISIONS #21: 금지 #7, 구조 개요, 모듈 경계, 데이터 모델. 바뀐 절: 머리글 범위, 구조 개요, 모듈 경계, 화면 메커니즘 2·3·4·8, 데이터 모델, 수정 구역, 정적 검사, 실측 절차, 주요 결정 / T-21 PR #37 리뷰 반영 — DECISIONS #23, ADR-0004(승인 2026-11-12, 사용자 답 "승인 (Recommended)"): 바뀐 절은 금지 #1·#7, 구조 개요 engine.js 줄, 모듈 경계 engine.js 행, 데이터 모델 `reportArea` 행, 수정 구역 T-21 4행·tests 행, 테스트 전략 커버 범위, 주요 결정)
> 승인 (2026-11-11, 사용자 답 "둘 다 승인 (Recommended)" — 메인 세션이 사용자 지시로 머리글 변경)
> 상태는 초안/승인 두 가지. "승인"으로 바꾸는 것은 사용자만 한다 — 승인 전 구현 착수 금지 (AGENTS.md 파이프라인 규칙).
> 범위: 박수홍 담당 계약·신고 6개 화면(app.html `#input` `#result` `#timeline` `#contract` `#moveout` `#docs`)과 2026-11-12 편입한 첫 실행 길잡이(온보딩 `#start`, T-16) — 합계 7개 — 의 현재 시연판 구조와, PRD F-07~F-11·N-04·N-05(Tasks T-09~T-14)·온보딩 모션(Tasks T-16, PRD F-12) 구현에 필요한 설계만 다룬다. 다른 팀원 영역(지원사업·코치·캘린더·지출·집 상태·주변 탐색)과 공용 화면 틀은 설계 대상이 아니다.
> 줄 번호는 2026-11-11 브랜치 `parkSuHong-docs` 기준이다. 구현은 PR #22 병합 뒤 최신 main에서 시작하므로 줄 번호가 달라질 수 있다 — 구역은 **함수 이름과 마커 주석**으로 찾는다.

## 금지 (구현자 공통 — 이 문서의 다른 절보다 우선)

| # | 금지 | 이유 |
|---|---|---|
| 1 | 공용 `render()`·`route()`·`headerBar()`·`GROUPS`/`ROUTES`·`boot()`·공용 `click`/`change`/`input`/`submit` 리스너 수정. 예외: T-21은 지역 선택 `change` 리스너(`data-sp-sel`)의 `S.gu` 대입 한 줄만 허용(아래 "수정 구역" T-21 리스너 행). T-23은 공용 리스너가 부르는 `setField(t)`의 `data-num` 처리 한 줄 교체와 그 함수 바로 위 2줄 추가만 허용(DECISIONS #24, "수정 구역" T-23 B6 행) — `change`·`input` 리스너 줄 자체, `boot()`(QR 받는 쪽 포함) 수정은 T-23에서도 0줄. T-24는 공용 `click` 리스너 안 `else if (a === 'obnext') {` 블록에 1줄 추가와 `else if (a === 'obdone') {` 줄 맨 앞 검사 삽입, 그리고 R4로 `else if (a === 'reset') {`·`else if (a === 'demo') {`·`else if (a === 'startreal') {` 세 줄의 `S = clone(…);` 바로 뒤에 `AMT_NOTE = {};` 삽입(합계 4곳)만 허용(DECISIONS #29·#30, "수정 구역" T-24 R1·R3·R4 행) — `boot()`(`#demo`·`#import=` 포함)는 T-24에서도 0줄, 그 밖의 `data-act` 분기·리스너 머리 줄 수정은 T-24에서도 0줄. T-24 R5는 `function amtNote(k)` 줄 바로 다음에 1줄(`function amtVal(k, v)`) 추가만 허용(DECISIONS #31, "수정 구역" T-24 R5 행) — `var AMT_NOTE`·`amtNote`·`setField` 줄과 리스너 줄은 R5에서도 0줄. T-25는 `boot()` 안 `#import=` 블록의 `decodePayload(dd).then(…)` 한 줄만 허용(DECISIONS #32, "수정 구역" T-25 행) — `boot()`의 다른 줄(`#demo`·`#phone=`·`#import=` 블록의 `var dd = …` 줄 포함)은 T-25에서도 0줄. T-26·T-27·T-28은 `boot()`·리스너 0줄. T-29는 같은 `decodePayload(dd).then(…)` 한 줄 안 1문장 삽입만 허용(DECISIONS #35, "수정 구역" T-29 QR 받는 줄 행) — `boot()`의 다른 줄은 0줄 | PRD 범위 제외(화면 전환 방식·헤더·탭 불변), F-07 ④ |
| 2 | app.html 466줄 `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }` 수정 | PRD OQ #6 확정 — 공용 확대는 팀 합의 뒤 |
| 3 | `.mo` 범위 밖에 걸리는 CSS 선택자 추가, 기존 CSS 규칙(T-09 블록 밖) 수정 | 다른 팀원 화면 불변 (F-07 ④) |
| 4 | `@media (prefers-reduced-motion: no-preference)` 밖에 `animation`·`transition` 선언 | F-07 ① |
| 5 | 모션 길이·지연을 숫자로 직접 쓰기 — 토큰(`var(--mo-*)`, `JachwiScreens.T`)만 사용 | N-04, CodingRules "설정 및 상수" |
| 6 | `setTimeout` 체이닝으로 모션 순서 제어 | CodingRules 금지 3 |
| 7 | 계산 함수(`demo/engine.js`, `rules-core.js`, `buildTimeline`·`phase`·`nowKey`·`dueTag`·`openTasks`·`evaluate`·`judge`) 수정. 예외: T-18은 `engine.js`에 `reportArea` 추가와 `deadlines`의 지역 판정 교체만 허용(DECISIONS #21). T-21은 `engine.js`의 `reportArea` 본문 보완, 그 바로 위 시·군·구 이름 표 상수 추가, 맨 끝 `return { … }` 객체에 그 표를 내보내는 속성 1개(`reportAreaSgg`) 추가만 허용(DECISIONS #23, ADR-0004) — `reportArea`·`deadlines` 시그니처·반환 형식, `deadlines` 본문, 그 밖의 함수 수정 금지. T-23은 `openTasks`의 `var skip = …` 한 줄에 입주 준비(`prep`) 제외 조건 추가만 허용(DECISIONS #25) — `engine.js`(`validate` 포함)·`rules-core.js`·`buildTimeline`(할 일 id·`urgent` 값 포함)·`phase`·`nowKey`·`dueTag`·`evaluate`·`judge`는 T-23에서도 0줄 | N-05, F-08 ⑥·F-09 ⑧·F-10 ⑦ |
| 8 | 자기 구역 밖 수정(아래 "수정 구역" 표). 필요하면 화면 작업에서 고치지 말고 T-09 보완으로 되돌린다. 예외: T-27은 다른 팀원 화면 `#home`(`viewHome`)의 `var payH = …` 한 줄 안 두 식만, T-28은 T-13 행이 "호출만"으로 묶은 `deviceCards()` 본문만 허용(DECISIONS #34, "수정 구역" T-27·T-28 행). T-29는 다른 팀원 지도 코드의 `function kakao(kind, p)` 안 `if (kind === 'rv') { …` 한 줄과 `function homeRvFresh(h)` 한 줄의 `rvUrl` 식만 허용(DECISIONS #35, "수정 구역" T-29 로드뷰 주소 행) | 4개 worktree 동시 작업 충돌 방지 (Tasks 착수 조건) |
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
    <style> 끝            T-09 모션 기반 블록 + T-10~T-13 빈 구역 마커 + T-16 구역(#start)
    <script> 안           T-09 연결 블록(MO 상태·헬퍼·접기 리스너) + T-16 연결 블록(단계 등장) + 각 화면 view 함수
  engine.js           신고·기한·나이·입력 검사·서류 준비(순수 함수) — T-18의 `reportArea` 추가·`deadlines` 지역 판정 교체, T-21의 `reportArea` 본문 보완·시·군·구 이름 표 외에는 수정하지 않음
  rules-core.js       지원 자격 판정(이성준) — 수정하지 않음
  screens-core.js     (새 파일, T-09) 계약·신고 6개 화면 전용 순수 함수: 모션 토큰·등장 판정·차례 지연·카운트 값
                      + T-10~T-13·T-16 화면 순수 함수 구역(마커로 나눔) + T-23 금액 해석 구역(`parseAmount`, B10 `yearDate`·`yearTasks`). DOM·S·today 접근 금지
tests/
  screens-core.test.js     T-09: 토큰·순수 함수 단위 테스트
  screens-zones.test.js    T-09: app.html 정적 검사(구역 마커·.mo 범위·reduce·토큰 사용)
  screen-result.test.js    T-10 / screen-timeline.test.js T-11 / screen-moveout-docs.test.js T-12 / screen-input-contract.test.js T-13
  screen-start.test.js     T-16: stepEnter 단위 테스트 + T-16 JS 블록 정적 검사
```

## 모듈 경계와 책임

| 모듈 | 책임 | 의존 대상 |
|---|---|---|
| `demo/engine.js` (JachwiEngine, `JE`) | 신고 대상 지역 판정(`reportArea`, T-18 — DECISIONS #21, T-21 보완 — DECISIONS #23: 일반 도·강원·전북·전남광주의 시·군·구 소속 판단용 이름 표를 안에 둠, `demo/data/regions.js`를 읽지 않음), 신고 의무·기한, 전입 기한, 만료·갱신 통지일, 만 나이, 입력 검사, 서류 준비 판정 | 없음 |
| `demo/rules-core.js` | 승인 공고로 지원 자격 판정 | 없음 |
| `demo/screens-core.js` (JachwiScreens, `JS`) — 새 파일 | 내 7개 화면(6개 + `#start`)의 모션 토큰과 모션·화면 순수 함수(입력은 plain 값, 출력은 값) | 없음 |
| app.html T-09 연결 블록 | 등장 여부 판정(`last` 읽기), 움직임 줄이기 확인, 화면 루트 감싸기, 렌더 뒤 작업 실행(카운트·스크롤), 접기 토글, 변화 감지 | screens-core.js(없으면 모션 없이 최종 상태), app.html 클로저 변수 `last`·`app` |
| app.html T-16 연결 블록 | 온보딩 단계 이동을 등장으로 판정(`moBeginStep`) — `moBegin`을 부른 뒤 등장 여부만 단계 키로 넓힌다 | T-09 연결 블록(`moBegin`·`MO`), screens-core.js(`stepEnter`), 클로저 변수 `last`(읽기만) |
| app.html view 함수 7개 (6개 + `viewStart`) | 화면 HTML 문자열 생성. 모션은 T-09 헬퍼(`viewStart`는 T-16 `moBeginStep` 포함)로만 붙임 | engine.js, rules-core.js, screens-core.js, T-09·T-16 연결 블록 |
| app.html 공용 `render(keep)` | 화면 전체 `innerHTML` 재생성, 스크롤 복원 — 이번 작업에서 0줄 수정 | 각 view 함수 |

## 데이터 흐름

1. 입력: 조건 입력·체크·파일 올림 → 공용 리스너가 `S` 갱신 + `save()`(localStorage) → `render(true)`. 화면 이동: `hashchange` → `render(false)`.
2. `render()`는 view 함수를 호출하기 **직전까지 `last`(직전 화면 이름)를 바꾸지 않는다**(2480줄에서 갱신). 내 view는 첫 줄에서 `moBegin('{화면}')`을 불러 `last !== '{화면}'`이면 "등장"으로 판정한다(DECISIONS #10).
3. view가 `moRoot('{화면}', html)`로 결과를 감싼다 → `<div class="mo mo-{화면}" [data-mo-enter]>…</div>`. 등장일 때만 `data-mo-enter`가 붙고, CSS 등장 모션은 이 속성 아래에서만 재생된다.
4. `render()`가 `innerHTML`을 넣고 스크롤을 처리(2478~2479줄)한 뒤, `moRoot`가 예약한 `requestAnimationFrame` 1회가 렌더 뒤 작업(숫자 카운트, 타임라인 '지금' 단계 스크롤)을 실행한다.
5. 접기·펼치기는 `render` 없이 T-09 클릭 리스너가 DOM 클래스만 바꾸고 열림 상태를 메모리 `MO.open`에 기록한다 → 이후 `render(true)`에서도 그 상태로 다시 그린다.

## 화면 메커니즘 — 내 6개 화면 모션 (F-07, N-04)

### 1. 모션 토큰 (DECISIONS #12 → 값은 #19로 대체, 2026-11-12 T-15)

값의 단일 원본은 `demo/screens-core.js`의 `JachwiScreens.T`이고, CSS는 같은 값을 T-09 블록의 `.mo { … }` 한 줄에 사용자 정의 속성으로 둔다. `tests/screens-zones.test.js`가 두 값이 같은지 검사한다.

| 토큰 | JS `T.` | CSS | 값 | 쓰임 |
|---|---|---|---|---|
| 짧게 | `short` | `--mo-short` | 250ms | 배지 나타나기(pop), 체크 그리기 |
| 기본 | `base` | `--mo-base` | 450ms | 카드 등장, 접기·펼치기 높이 |
| 길게 | `long` | `--mo-long` | 600ms | 막대 채우기, 숫자 카운트 |
| 차례 간격 | `step` | `--mo-step` | 80ms | 차례 등장 지연 단위 |
| 최대 차례 | `maxStep` | (클래스 `.mo-s0`~`.mo-s6`) | 6 | 7번째 이후는 6번과 같이 나타남 |
| 전체 상한 | `total` | — | 930ms | 검사용: `step × maxStep + base = 930` |
| 이동 거리 | `shift` | `--mo-shift` | 20px | 카드 등장 시 아래→제자리 |
| 감속 곡선 | `ease` | `--mo-ease` | `cubic-bezier(0.3, 0.7, 0.4, 1)` | 등장·채우기·카운트 |
| 양방향 곡선 | `easeIO` | `--mo-ease-io` | `cubic-bezier(0.4, 0, 0.2, 1)` | 접기·펼치기 |

- 막대 채우기·숫자 카운트는 지연 0으로 시작한다(차례 등장 묶음에 넣지 않는다).
- 카운트는 `T.long` 동안 `countAt(from, to, p)` 값으로 텍스트를 바꾼다.

### 2. 범위 한정 (DECISIONS #9)

- 내 7개 view는 반환 HTML 전체를 `moRoot(screen, html)`로 감싼다(조기 반환 경로 포함). `screen` 값: `input` `result` `timeline` `contract` `moveout` `docs` `start`(T-16 추가 — 기존 6개 규칙·검사는 그대로).
- 모든 새 CSS 선택자는 `.mo` 또는 `.mo-{화면}`으로 시작한다. 새 `@keyframes` 이름은 `mo-` 접두사.
- `#app`에는 속성·클래스를 붙이지 않는다(공용 요소라 다른 화면으로 나갈 때 남는다). 확인 근거: app.html에 `#app >`·`.main >` 자식 선택자 0건(grep) — 감싸는 div가 기존 레이아웃을 바꾸지 않는다.

### 3. 움직임 줄이기 (DECISIONS #11)

- CSS: T-09·T-10~T-13·T-16 구역의 모든 `animation`·`transition` 선언은 `@media (prefers-reduced-motion: no-preference) { … }` 안에만 둔다. 줄이기가 켜지면 선언 자체가 없으므로 최종 상태가 바로 보인다. `!important` 불필요, 공용 466줄은 그대로.
- JS: 숫자 카운트·스크롤 등 JS 모션은 `moReduce()`가 참이면 실행하지 않는다(값은 처음부터 최종값으로 그려져 있음). 스크롤은 모션이 아니라 위치 이동이므로 줄이기와 무관하게 수행한다(아래 5).
- `data-mo-enter`: `moRoot`는 `JS.shouldAnimate(moReduce(), MO.enter[screen])`가 참일 때만 붙인다 — 줄이기 환경(또는 `screens-core.js` 미로드)에서는 등장 렌더여도 붙이지 않는다.
- `screens-core.js`를 못 불러온 경우(오프라인 캐시 누락 등) `moReduce()`가 참을 반환해 모션 없이 동작한다.

### 4. 등장은 화면 이동 때만 (DECISIONS #10)

| 호출 | `last` 대 화면 | 등장 모션 | 근거 |
|---|---|---|---|
| `hashchange` → `render(false)`, 다른 화면에서 들어옴 | 다름 | 1회 재생 | F-07 ②, PRD 모션 상태 표 |
| 첫 로드 `boot()` → `render(false)` | `last === ''` → 다름 | 1회 재생 | 동일 |
| 입력·체크·파일·비동기 데이터 도착 → `render(true)` | 같음 | 재생 안 함 | F-07 ② |
| 같은 화면에서 `render(false)`(백업 불러오기 등) | 같음 | 재생 안 함 | PRD "다른 화면에서 들어옴"만 등장 |
| (`#start`만, T-16) 온보딩 '다음'(`obnext`)·'이전'(`obprev`) → `render(false)`로 `S.obStep`이 바뀜 | 같음(`start`) — 단계 키 `'start:'+단계`가 직전 렌더와 다름 | 1회 재생 | 아래 8, DECISIONS #20, ADR-0003 |
| (`#start`만) 같은 단계 안 입력 변경 → `render(true)`, 또는 같은 단계에서 `render(false)` | 같음 — 단계 키도 같음 | 재생 안 함 | F-07 ② 규칙을 단계 단위로 적용 |

- `render()` 수정 0줄. view 함수는 `render()`와 같은 클로저 안에 있어 `var last`(2450줄)를 읽을 수 있다.
- 알려진 한계: 페이지 첫 로드 직후 비동기 `render(true)`(`loadFiles` 2608줄, `loadRules` 945줄, `loadPlaces` 1743줄)가 0.93초(`T.total`) 안에 오면 등장 모션이 중간에 끊기고 최종 상태가 보인다. 재생 안 함 규칙과 일치하므로 허용. 등장 검증은 해시 이동으로 한다(첫 로드로 하지 않는다).

### 5. 렌더 뒤 작업 (숫자 카운트·스크롤)

- `moAfter(fn)`: view가 렌더 뒤 할 일을 등록한다. `moRoot`가 `requestAnimationFrame` 1회를 예약해 등록된 일을 실행 — `render()`의 `scrollTo`(2478~2479줄)보다 뒤, 첫 페인트 전이다. 실행 시점에 그 `.mo` 루트가 문서에 없으면(사이에 다시 그려짐) 건너뛴다. 각 작업은 `try/catch`로 감싸 실패해도 화면은 최종 상태로 남고 `console.error`로만 알린다.
- 숫자 카운트 `moNum(key, value)`: HTML에는 최종값을 그대로 쓰고(`<span class="mo-num" data-mo-num="{key}">{value}</span>`), 등장이거나 값이 바뀐 경우에만 렌더 뒤 `el.animate([{opacity:1},{opacity:1}], {duration: T.long, easing: 'linear', id: 'mo-count'})`를 **시계**로 만들어 rAF마다 `effect.getComputedTiming().progress`로 `countAt` 값을 쓰고, `finished`에서 최종값을 쓴다(DECISIONS #18 — `getAnimations()`로 측정 가능, `setTimeout` 미사용).
- 타임라인 '지금' 단계 이동(F-09 ②): 등장일 때만 `moAfter`로 `scrollIntoView({ block: 'start', behavior: 'auto' })`. 부드러운 스크롤은 길이를 통제할 수 없어 N-04를 깰 수 있으므로 쓰지 않는다(DECISIONS #15). 고정 상단바 가림은 T-11 구역에서 `.mo-timeline .stage { scroll-margin-top: … }`로 처리(휴대폰 상단바 56px + safe-area, app.html 97줄).

### 6. 변화 감지 (체크 그리기·업로드 배지·준비 수 증가)

`innerHTML` 재생성은 새 요소를 만들므로 "방금 바뀐 것"만 움직이려면 직전 값을 기억해야 한다.

- `moChanged(key, value)`: 같은 화면에서 직전 렌더의 값과 다르면 직전 값을 반환, 아니면 `undefined`. 등장 렌더에서는 기록만 하고 `undefined`. `MO.prev`에 저장(메모리, 저장소 아님).
- key는 `MO` 규격대로 `'{screen}:{종류}:{id}'` — `moScreenOf(key)`가 첫 `:` 앞을 화면 이름으로 읽어 `MO.enter[화면]`(등장 여부)을 찾으므로, 화면 접두사가 없으면 등장 렌더에서도 직전 값을 반환한다.
- 용도: 체크 그리기(`key='{screen}:task:'+id` — 예: 타임라인 `'timeline:task:'+id`, 값 `!!S.done[id]`, `false→true`일 때만 `.mo-pop` 계열 클래스), 업로드 배지(칸별 파일 수 증가), 준비 수·막대(직전 값에서 새 값으로 — 막대는 `style="--mo-from:{직전%}"` + `.mo-grow`, 숫자는 `moNum`이 직전 값부터 카운트).

### 7. 접기·펼치기 (F-08 ③, F-09 ①·⑥, DECISIONS #14)

| 요소 | 규격 |
|---|---|
| 버튼 | `<button type="button" data-mo-toggle="{key}" aria-expanded="{true|false}" aria-controls="{panelId}">` — `moToggle(key, open, labelHtml, cls)`가 만든다 |
| 패널 | `<div class="mo-fold{ open}" id="{panelId}" data-mo-panel="{key}"{ inert}><div class="mo-fold-in">…</div></div>` — `moPanel(key, open, innerHtml)`가 만든다. 닫힘이면 `inert` |
| 높이 모션 | `.mo .mo-fold { display:grid; grid-template-rows:0fr }` `.open { 1fr }`(레이아웃은 media 밖), `transition: grid-template-rows var(--mo-base) var(--mo-ease-io)`는 no-preference 안 |
| 상태 | `moOpen(key, def)`: `MO.open[key]`가 없으면 `def`를 기록하고 반환. 화면 등장(`moBegin`이 참) 때 그 화면 접두사(`{screen}:`) 키를 지워 기본값으로 다시 시작 |
| 기본값 결정 | 등장 때 한 번 정한 값을 그 방문 동안 유지한다 — 체크로 단계가 다 끝나도 `render(true)`에서 갑자기 접히지 않는다. 다음 등장 때 다시 접힌 채 시작 |
| 리스너 | T-09 블록의 `document.addEventListener('click', …)` 1개가 `[data-mo-toggle]`만 처리(공용 리스너는 `data-act`만 보므로 겹치지 않음). `render` 호출 없음 |

### 8. 첫 실행 길잡이 `#start` (T-16, DECISIONS #20, ADR-0003)

`render()`는 `r === 'start'`일 때 머리·탭 없이 `viewStart()`만 넣는다(수정 0줄). 단계 '다음'·'이전'은 라우트가 계속 `start`라 `last === 'start'`이므로 T-09 `moBegin`만으로는 등장이 아니다. 그래서 등장 판정 키를 **화면 + 단계**로 넓힌다.

| 항목 | 규격 |
|---|---|
| 등장 판정 | 순수 함수 `JS.stepEnter(last, prevKey, screen, key)` = `isEnter(last, screen) \|\| (prevKey == null ? '' : String(prevKey)) !== String(key)`. 화면 이동(기존 #10)이거나 단계 키가 직전 렌더와 다르면 등장. 앞·뒤 방향 구분 없음('이전'도 등장) |
| 단계 키 | `'start:' + st` — `st`는 `viewStart` 첫 줄의 `+S.obStep \|\| 1` 값 그대로(새로 계산하지 않는다) |
| 연결 헬퍼 | T-16 JS 블록의 `moBeginStep(screen, step) → boolean`. 순서: ① `key = screen + ':' + step`, `prev = moSubKey` ② `moBegin(screen)` 호출(MO.jobs 비움·등장 시 `screen:` 접기 키 정리 — T-09 동작 그대로) ③ `on = JS ? JS.stepEnter(last, prev, screen, key) : (last !== screen \|\| prev !== key)` ④ `MO.enter[screen] = on` ⑤ `moSubKey = key` ⑥ `return on`. `moSubKey`는 T-16 블록의 메모리 변수(초기값 `''`, 저장소 아님). `last`는 읽기만 |
| 재생 없음 | 같은 단계 `render(true)`·`render(false)`는 키가 같아 `MO.enter.start === false` → `moRoot`가 `data-mo-enter`를 붙이지 않음 → `.mo-in`·진행 칸 모션 0개 |
| 움직임 줄이기 | 변경 없음 — `moRoot`가 `JS.shouldAnimate(moReduce(), MO.enter.start)`로 판정하고, T-16 CSS 모션은 `no-preference` 안에만 있으므로 0개 |
| 카드 안 차례 등장 (F-12 ②③) | 마크업·클래스 변경 없이 T-16 CSS가 `section.card.ob-card`의 **직계 자식**을 차례로 올린다. `ob-card` 자체에는 `moStep`을 붙이지 않는다. keyframes는 T-09 `mo-in` 재사용. no-preference 안: `.mo-start[data-mo-enter] .ob-card > * { animation: mo-in var(--mo-base) var(--mo-ease) both }`(1번째는 지연 0), `.mo-start[data-mo-enter] .ob-card > :nth-child(2)`~`:nth-child(6)` 각각 `animation-delay: calc(var(--mo-step) * 1)`~`* 5`(숫자 리터럴로 — Z6 형식 `calc(var(--mo-step) * [0-6])`), `.mo-start[data-mo-enter] .ob-card > :nth-child(n+7) { animation-delay: calc(var(--mo-step) * 6) }`. 지연 규칙이 `> *`보다 우선순위가 높아(속성·의사 클래스 1개 더) 축약형이 지연을 덮지 않는다. 마지막 끝 시각 ≤ 80×6+450 = 930ms(`T.total`). 브랜드 줄·4칸 표시·'예시 데이터로 보기'·개인정보 안내는 정적 |
| `ob-card` 직계 자식 (app.html 3229~3245줄 확인) | 1단계: `h1` · `p.sub` · `div.form-grid` · (입주일 < 계약일일 때만) `div.banner.due` · `div.row`(버튼 줄) → 4~5개. 2단계: `h1` · `p.sub` · `div.form-grid` · (보증금·월세 입력 시) `div.banner` · `div.row` → 4~5개. 3단계: `h1` · `p.sub` · `homeCard()`의 `section.card`(1개, 2289~2295줄) · `div.form-grid` · `div.row` → 5개. 4단계: `h1` · `p.sub` · `div.form-grid` · `div.row` → 4개. 현재 최대 5개 → 마지막 지연 `* 4`, 끝 320+450 = 770ms. `:nth-child(6)`·`(n+7)`은 자식이 늘 때 대비 |
| 같은 단계 안내 띠 | 2단계 `div.banner`처럼 입력 뒤 `render(true)`로 새로 생기는 자식은 `data-mo-enter`가 없어 움직이지 않는다(재생 없음 규칙 그대로) |
| 4칸 진행 표시 현재 칸 채우기 | `.ob-steps li.now::before`(공용 CSS 692~695줄의 4px 막대)를 T-16 구역의 새 keyframes `mo-start-fill { from { transform: scaleX(0) } }`로 채운다. 레이아웃 줄(no-preference 밖): `.mo-start .ob-steps li.now::before { transform-origin: left center }`. 모션 줄(no-preference 안): `.mo-start[data-mo-enter] .ob-steps li.now::before { animation: mo-start-fill var(--mo-long) var(--mo-ease) both }`. 지연 0. `done` 칸은 움직이지 않는다 |
| T-09 `mo-fill` 재사용 안 하는 이유 | ① `.mo-fill`은 요소에 클래스를 붙여야 하는데 막대가 `::before` 가상 요소라 클래스를 붙일 수 없다 ② `mo-fill`은 `width: 0 → 지정 폭`인데 이 막대는 폭이 `auto`(flex 늘이기)라 보간되지 않는다. 공용 `.ob-steps` 마크업·규칙은 바꾸지 않는다 |
| 실측 | 가상 요소 애니메이션도 `document.getAnimations()`에 나오고 `effect.target`이 `li`(`pseudoElement: '::before'`)라 M1 스니펫이 그대로 잰다(추정 — 확인 방법: 단계 이동 직후 M1 결과에 `mo-start-fill` 행이 있는지) |

## 데이터 모델과 인터페이스

| 엔티티/인터페이스 | 규격 (필드·타입·제약) | 사용 모듈 |
|---|---|---|
| `S` (기존) | localStorage에 저장되는 앱 상태. 이번 작업은 **새 필드를 추가하지 않는다**(모션 상태는 저장하지 않음) | app.html 전체 |
| `MO` (새, 메모리) | `{ prev: {[key]: any}, open: {[key]: boolean}, enter: {[screen]: boolean}, jobs: Function[] }`. key 형식 `'{screen}:{종류}:{id}'`. 새로고침 시 사라짐 | T-09 연결 블록 |
| `JachwiScreens.T` | 위 토큰 표의 9개 값. 숫자는 ms 정수 | screens-core, T-09 블록, 테스트 |
| `JE.reportArea(sido: string\|undefined, gu: string\|undefined) → { inArea: true\|false\|null, reason: string }` (T-18) | 판정표는 DECISIONS #21. 순수 함수 — `S`·DOM·`today` 접근 금지, 던지지 않는다. `deadlines(S)`가 이 결과로 `report.required`(대상이면 기존 금액 기준, `false`면 false, `null`이면 null)·`report.reason`을 만든다. 금액 기준·기한 계산·반환 형식은 그대로. (T-21, DECISIONS #23·ADR-0004) 입력·반환 규격은 바뀌지 않는다. 충청북도·충청남도·경상북도·경상남도·강원특별자치도·전북특별자치도·전남광주통합특별시에서는 판정 순서 ① `gu`가 비었거나 공백뿐 → `{ inArea: null, reason: '시·군·구를 아직 고르지 않음' }` ② engine.js 안 이름 표(`시·도 → 시·군·구 이름[]`, 7개 시·도 136개, `demo/data/regions.js`와 같은 이름 그대로)에 없음 → `{ inArea: null, reason: '시·도와 시·군·구가 맞지 않음' }` ③ 있음 → #21 ②③ 그대로. 표는 `JE.reportAreaSgg`(`{ [시·도]: string[] }`, 읽기 전용 용도 — 테스트의 regions.js 일치 검사용)로도 내보낸다. 이름 비교는 `trim()` 뒤 완전 일치(부분 일치·형태 규칙 금지 — 전남광주의 `광산구` 등 단독 `~구`, 경남·강원 양쪽의 `고성군` 때문) | engine `deadlines`, 테스트 |
| `JS.isEnter(last: string, screen: string) → boolean` | `last !== screen` | T-09 블록 |
| `JS.stepIndex(i: number) → 0..6` | 음수·NaN → 0, 6 초과 → 6 | view(`moStep`) |
| `JS.stepDelay(i) → ms` | `stepIndex(i) * T.step` | 테스트 |
| `JS.countAt(from, to, p) → 정수` | `p`를 0..1로 자름, 감속 곡선 적용, `p=1`이면 정확히 `to` | 카운트 |
| `JS.shouldAnimate(reduce: boolean, entering: boolean) → boolean` | `!reduce && entering` | T-09 블록 |
| `JS.stepEnter(last: string, prevKey: string\|null\|undefined, screen: string, key: string) → boolean` (T-16, screens-core `// ===== T-16 =====` 구역) | `isEnter(last, screen) \|\| norm(prevKey) !== String(key)`, `norm(null/undefined) = ''`. 던지지 않는다 | T-16 블록 |
| T-16 연결 헬퍼 (app.html) | `moBeginStep(screen: string, step: number) → boolean` + 메모리 변수 `moSubKey: string`(초기 `''`). 규격은 화면 메커니즘 8 | `viewStart`만 |
| T-09 연결 헬퍼 (app.html) | `moBegin(screen)→boolean`, `moRoot(screen, html)→string`, `moStep(i)→' mo-in mo-s{n}'`, `moNum(key, value)→string`, `moChanged(key, value)→prev|undefined`, `moOpen(key, def)→boolean`, `moToggle(...)`, `moPanel(...)`, `moAfter(fn)`, `moReduce()→boolean` | 내 view 6개만 |
| CSS 클래스 (T-09) | `.mo-in`+`.mo-s0`~`.mo-s6`(등장, `[data-mo-enter]` 아래서만), `.mo-fill`(막대 0→현재, 등장 때만), `.mo-grow`+`--mo-from`(막대 직전→현재), `.mo-pop`(배지·체크 나타나기), `.mo-fold`/`.mo-fold-in`/`.open`, `.mo-num` | 내 view 7개 |
| CSS (T-16) | 새 클래스 없음. keyframes `mo-start-fill`(scaleX 0→1), 대상 `.mo-start .ob-steps li.now::before`. 카드 안 차례 등장은 T-09 `mo-in`을 `.mo-start[data-mo-enter] .ob-card > *`·`> :nth-child(2~6, n+7)`에 적용 | `viewStart` |
| `JS.parseAmount(text: any) → { ok: boolean, value: number\|null }` (T-23 B6, screens-core `// ===== T-23 =====` 구역, DECISIONS #24) | 만 원 단위 금액 해석. 순서: ① `String(text)`에서 공백·쉼표 제거, 빈 문자열이면 `{ ok: true, value: 0 }`(빈 칸 = 0, 지금과 같음) ② 끝의 `만원` 또는 `만`을 한 번 제거 ③ 남은 문자열이 비어 있지 않고 `/^(?:(\d+)억)?(?:(\d+)천)?(?:(\d+)백)?(\d*)$/`에 맞으면 `value = 억×10000 + 천×1000 + 백×100 + 끝 숫자`, `{ ok: true, value }` ④ 그 밖(`-`, 소수점, `원`만 붙음, 한글 숫자 `이천`, 숫자 없는 `억` 등) → `{ ok: false, value: null }`. 던지지 않는다. 예: `'1억'`→10000, `'1억 2천'`·`'1억2천만'`·`'1억 2000'`→12000, `'5천'`→5000, `'1,000'`→1000, `'50만원'`→50, `''`→0, `'-1'`·`'1.5억'`·`'이천'`·`'1억원'`·`'만'`→ok false | app.html `setField` |
| `AMT_NOTE` (T-23 B6, app.html 메모리) | `{ [field: 'deposit'\|'rent'\|'fee']: string }` — 해석하지 못한 원문(20자로 자름). `setField`가 해석 실패 시 기록하고 성공 시 지운다. `S`에 넣지 않는다(저장 안 함, 새로고침 시 사라짐). 같은 줄의 `amtNote(k) → string`이 칸 아래 안내 HTML(`<em class="s12" style="color:var(--no);font-style:normal" role="alert">` + `'` + `esc(원문)` + `'은(는) 금액으로 읽지 못했어요. 숫자나 '1억 2천'처럼 넣어 주세요.</em>`, 기록 없으면 `''`)을 만든다 | `setField`, `viewInput`·`viewContract`·`viewStart`의 지역 `num` 헬퍼 |
| `JS.yearDate(d: Date, now: Date) → string\|null` (T-23 B10, screens-core `// ===== T-23 =====` 구역, DECISIONS #28) | `d`·`now` 중 하나라도 유효한 Date가 아니면 `null`(T-12 구역 `isDate` 재사용 — 같은 UMD 함수 안, T-12 구역 수정 없음). 같은 해면 `null`. 다른 해면 `연도 + '.' + 월 + '.' + 일 + '(' + 요일 한 글자 + ')'` — 월·일 0 채움 없음, app.html `md(d)` 모양 앞에 `연도.`만 붙인 것. 요일 표는 이 구역의 새 상수 `['일', '월', '화', '수', '목', '금', '토']`(app.html `WD`와 같은 값 — 테스트로 대조). 예: `(new Date(2028, 10, 10), new Date(2026, 10, 16))` → `'2028.11.10(금)'`. 던지지 않는다 | `yearTasks`, 테스트 |
| `JS.yearTasks(tasks: Task[], now: Date) → Task[]` (T-23 B10, 같은 구역, DECISIONS #28) | 배열이 아니면 `[]`. 각 `t`가 객체이고 `t.dueText`가 없고 `t.due`가 유효한 Date이고 `t.due > now`이고 `yearDate(t.due, now)`가 `null`이 아니면 복사본 `Object.assign({}, t, { dueText: yearDate(t.due, now) + (t.legal ? ' 권장' : '') + ' · D-' + Math.round((t.due - now) / 864e5) })`, 그 밖은 원본 그대로(같은 참조). 원본 배열·객체는 바꾸지 않는다. 미래 날짜로 한정하는 이유: `dueTag`(금지 #7, 0줄)의 `dueText` 갈래 배지 색은 `t.urgent ? 'due' : ''`이고 원래 갈래는 `t.urgent \|\| t.due <= today ? 'due' : ''`(법정 기한 지남 갈래 포함)라, `t.due > today`일 때만 색·'권장'·D-값이 원래와 같다. 체크된 할 일은 `dueTag` 첫 줄이 '완료'를 먼저 돌려줘 영향 없음, `due: null`(퇴거 o1·o2) 복사본은 그대로 | app.html `viewMoveout`·`viewTimeline`(`tlStage`) |
| `JS.checkImport(o: any) → boolean` (T-25, screens-core `// ===== T-25 =====` 구역, DECISIONS #32) | QR로 받은 값을 통째로 받아도 되는지(PRD F-13 ② 판정표, OQ #12 "통째로 받지 않음"). ① `o`가 `null`·배열·객체 아님 → `false` ② 아래 키마다 `k in o`일 때만 검사(키가 없으면 통과 — 이 기기 값 유지), 하나라도 실패 → `false` ③ 모두 통과 → `true`. 표에 없는 키·`bills`·`events`는 보지 않는다(PR #76 `cleanBills`·`cleanEvents`가 담당). 규칙: `contract`·`move` = 문자열이고 `/^\d{4}-\d{2}-\d{2}$/`(`restoreJson`과 같은 식) / `deposit`·`rent`·`fee`·`age` = `typeof v === 'number' && isFinite(v) && v >= 0` / `term` = `(typeof v === 'number' \|\| typeof v === 'string') && +v >= 1 && +v <= 10`(engine `validate`의 `+S.term` 범위와 같음) / `income` ∈ `'100'`·`'150'`·`'over'`·`'unknown'` / `birth` = `null`·`''` 또는 문자열이고 `/^\d{4}-(0[1-9]\|1[0-2])$/` / `homeless`·`dup` = `null` 또는 `''`·`'yes'`·`'no'`·`'unknown'` / `gu`·`addr`·`nick`·`remind` = 문자열 / `sido`·`sgg`·`zip` = `null` 또는 문자열 / `done` = `null` 아님·배열 아님·`typeof 'object'` / `home` = `null` 또는 배열 아닌 객체. 입력을 바꾸지 않고 던지지 않는다. 구역 안 지역 이름(규칙 표 상수 등)은 자유, 단 screens-core 정적 검사(`tests/screens-core.test.js` 133행 — `document`·`localStorage`·`window.`·`setTimeout`·`S.` 금지) 때문에 변수 이름 `S`를 쓰지 않는다. ~~알려진 한계(바꾸지 않음): 날짜는 모양만 본다(`'2026-13-45'` 통과 — `restoreJson`과 같은 기준, PRD F-13 ②)~~ → 2026-11-17 T-29에서 `contract`·`move`·`term`·`home` 규칙을 강화(다음 행, DECISIONS #35). 이 행의 나머지 규칙·반환 형식은 그대로 | app.html `boot()` `#import=` 줄, 테스트 |
| T-29 갱신: `JS.checkImport` 규칙 3개 + `JS.rvUrlOk(u: any) → boolean` + `JS.cleanHome(h: any) → object\|null` (screens-core 기존 `// ===== T-25 =====` 구역 안, DECISIONS #35, PRD F-13 ② 2026-11-17 갱신분) | **① 날짜** `IMP_DATE` 교체: 문자열이고 `/^\d{4}-\d{2}-\d{2}$/`이고 `var d = new Date(v + 'T00:00:00Z'); !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v`(왕복 비교 — `2026-02-31`·`2026-04-31`·`2026-13-01`·`2026-02-29` 실패, `2028-02-29` 통과. `isNaN` 먼저 — 무효 Date의 `toISOString`은 던짐). **② `term`** 기존 식 끝에 `&& +v % 1 === 0` 추가(`2.5`·`'2.5'` 실패, `1`·`10`·`'2'` 통과). **③ `rvUrlOk`** `typeof u === 'string' && /^https:\/\/map\.kakao\.com\/\?panoid=\d+[\w.&=]*$/.test(u)` — 앱이 저장하는 로드뷰 주소(placeRoadview가 만드는 `https://map.kakao.com/?panoid=…&pan=…&zoom=0&map_type=TYPE_MAP&map_attribute=ROADVIEW&urlX=…&urlY=…`, app.html 저장 조건 `/panoid=/`)만 참. 허용 문자에 `"` `'` `<` `>` 공백·`:`가 없어 속성 탈출·`javascript:` 불가. **④ `home` 규칙**(`IMP_RULES.home` 교체 — 구역 지역 함수 `IMP_HOME`) `v === null`이면 참. 아니면 `IMP_OBJ(v)`이고 `lat` = `typeof 'number'`·`isFinite`·-90~90, `lng` = 같은 조건·-180~180(둘 다 필수 — 문자열·`NaN`·범위 밖 실패), 있으면: `label`·`src` = 문자열, `kid` = 문자열이고 `/^\d+$/`(app.html `setHome`·`kakaoId`와 같은 식), `named` = `1`, `rvUrl` = `rvUrlOk` 참. `rvAt`·그 밖 필드는 보지 않는다(⑤에서 버림). `label` 필수 아님 — 기존 `tests/t25-import-check.test.js` PC 페이로드 `home: { lat: 37.48, lng: 126.95 }`가 통과해야 함. **⑤ `cleanHome`** 구역 상수 `var HOME_KEYS = ['lat', 'lng', 'label', 'src', 'kid', 'named'];`. `IMP_OBJ(h)`가 아니면 `null`, 맞으면 새 객체에 `HOME_KEYS` 중 `k in h`인 것만 복사해 반환. 값 검사는 하지 않는다(호출 전제: `checkImport` 통과). 입력을 바꾸지 않고 던지지 않는다. `rvUrl`·`rvAt`는 로드뷰 캐시(app.html `homeRvFresh`·`fixPlaceRoadview`가 30일마다 다시 고름)라 받지 않는다. 정적 검사(`S.` 등 금지) 그대로 적용 | app.html `boot()` `#import=` 줄(`checkImport`·`cleanHome`), app.html `kakao`·`homeRvFresh`(`rvUrlOk`), 테스트 |
| `JS.amountUnitWarn(k: string, v: any) → string` (T-26, screens-core `// ===== T-26 =====` 구역, DECISIONS #33) | 구역 상수 `var UNIT_MAX = { deposit: 200000, rent: 1000 };`(만 원). `(k === 'deposit' \|\| k === 'rent') && typeof v === 'number' && v > UNIT_MAX[k]`이면 `'만 원 단위가 맞나요?'`, 그 밖(같음·작음·숫자 아님·문자열 숫자·`null`·다른 키)은 `''`. 던지지 않는다 | app.html `viewInput` 보증금·월세 줄, 테스트 |
| 화면 순수 함수 (T-10~T-13, screens-core 각 구역) — 권장 시그니처, 입력은 plain 값(DOM·`S`·전역 `today` 접근 금지, 날짜는 인자로) | T-10 `resultSummary({ reportRequired, verdicts: string[] }) → { tasks, byVerdict }`, `allMet(res: [{ok}]) → boolean`. T-11 `scrollTarget(stages: [{key, done}], nowKey) → key|null`(OQ #4, 판정 순서대로: ① 모든 단계 완료 → 마지막 단계 키(`nowKey`가 있어도) ② `nowKey`가 없거나 첫 단계(계약 전) → null(이동 없이 맨 위) ③ 그 외 → `nowKey`. PRD OQ #4는 '계약 전'과 '모두 완료'를 "'지금' 단계 없음"으로 본다). T-12 `dateChipParts(date) → {...}`, 갱신 통지 중복 제거 규칙. T-13 필요 시만 | 각 화면 view, 각 화면 테스트 |

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
| T-16 CSS 구역 | `/* ===== /mo:T-13 ===== */` 다음 빈 줄 1개 뒤 `/* ===== mo:T-16 #start ===== */` ~ `/* ===== /mo:T-16 ===== */`, 끝 마커 다음 첫 비공백 줄이 `</style>` | T-16 | 화면 메커니즘 8의 레이아웃 1줄·keyframes `mo-start-fill`·no-preference 블록(진행 칸 채우기 + `.ob-card > *` 차례 등장 7줄). 선택자는 `.mo-start`로 시작, 시간은 `var(--mo-base)`·`var(--mo-long)`·`calc(var(--mo-step) * 1~6)`만 |
| T-16 JS 블록 | `// ---------- 처음 시작하기 (온보딩) ----------` **바로 앞**, `// ===== mo:T-16 =====` ~ `// ===== /mo:T-16 =====`, 끝 마커 다음 첫 비공백 줄이 `// ---------- 처음 시작하기 (온보딩) ----------`. T-09 블록 뒤(`// ---------- 메뉴 구조 ----------` 앞)에는 두지 않는다 — Z1이 T-09 끝 다음 줄을 메뉴 구조로 고정하므로 | T-16 | `var moSubKey = '';`와 `function moBeginStep(screen, step)`만. `render(`·`setTimeout`·`setInterval`·`save(`·`localStorage`·`addEventListener(`·`last =` 쓰기 금지 |
| T-16 screens-core | `// ===== /T-13 =====` 다음 빈 줄 1개 뒤 `// ===== T-16 =====` ~ `// ===== /T-16 =====`, 그 뒤 `return api;` | T-16 | `api.stepEnter = function …`만. 기존 `isEnter`는 T-09 구역의 지역 함수라 T-16 구역에서 호출 가능(같은 UMD 함수 안) — T-09 구역 수정 금지 |
| T-16 view | `// ---------- 처음 시작하기 (온보딩) ----------`부터 `viewStart` 끝 `}`까지 | T-16 | **호출 추가만**: ① `var st = +S.obStep \|\| 1, R = evaluate();` 바로 다음 줄에 `moBeginStep('start', st);` ② `return` 식 전체를 `moRoot('start', …)`로 감싸기 — 이 2가지만. `ob-card`·그 자식에 `moStep` 등 클래스 추가 금지(차례 등장은 T-16 CSS가 담당). 문구·단계 수·버튼·`data-act`·`GU_LIST`·`.ob-steps` 마크업·흐름 변경 금지. `homeCard()`·`regionFields()`는 호출만 |
| T-21 리스너 (2026-11-12, 지원사업 코드 위치 — 소유 메모 아래) | `document.addEventListener('change', function (e) { var t = e.target, w = t.dataset && t.dataset.spSel; …` 리스너 안, `else { … }`(시·군·구 분기) 다음 줄의 `if (S.zip) S.gu = S.sgg;` 한 줄(2026-11-12 `parkSuHong-report-region` 기준 1959행 — 줄 번호가 아니라 이 텍스트로 찾는다. `if (w === 'sido')` 줄(1957행)이 아니다) | T-21 | 그 한 줄을 `S.gu = S.zip ? S.sgg : '';`로 바꾸는 것만. `if (w === 'sido')`·`else` 분기, `REGIONS` 조회, `u.sel = ''; u.more = 0; save(); render(true);` 줄, `regionFields()`·`regionOf()` 수정 금지. 시·군·구 분기에서는 `S.zip`이 항상 채워져 동작이 지금과 같다 |
| T-21 qaAnswer (2026-11-12, 물어보기 코드 위치 — 소유 메모 아래) | `function qaAnswer(q, R)`의 `RULES` 배열 안 `[/확정일자/, function () { … }]` 원소와 `[/전월세\|임대차 ?신고/, function () { … }]` 원소의 함수 본문 | T-21 | ① 확정일자: `rep.required ? … : …` 식을 true / false / `rep.required === null` 세 갈래로(null은 '대상이 아니라서'라고 단정하지 않음) ② 전월세: `if (!rep.required) return …` 한 줄을 `rep.required === null` 분기와 false 분기로 나누고, false 문구의 이유는 `esc(rep.reason)`(고정 금액 문구 금지). true 쪽(`late`·기한 안내) 문구, 두 원소의 정규식·`src`, `RULES` 순서, 다른 원소, `rep`·`early`·`late` 계산 줄 수정 금지 |
| T-21 내 계약 신고 칸 (2026-11-12) | `viewContract` 안 `'<dt>전월세 신고</dt><dd>' + ( … ) + '</dd>'`의 괄호 안 식 한 개 | T-21 | 식을 `R.report.required === null ? '확인 필요' : R.report.required ? md(R.report.due) + '까지' : '대상 아님'`로 바꾸는 것만. 같은 줄의 다른 `<dt>`/`<dd>`·`viewContract` 나머지 수정 금지(T-13 구역이지만 T-20이 같은 함수 근처를 고치므로 범위를 이 식으로 좁힘) |
| T-21 소유 메모 | 위 리스너는 지원사업(주연서) 코드, `qaAnswer()`는 물어보기(다른 팀원) 코드 위치다. PR #37 리뷰어가 병합 조건으로 요구했고 사용자가 리뷰를 그대로 전달해 이번에만 위 범위를 허용한다(메인 세션 전달, 인용). 그 이전 사용자 원문: "내 작업이면 하고 아니면 하지마"(인용) — 이 범위 밖의 지원사업·물어보기 동작은 계속 범위 밖 | — | 허용 수정 없음(기록 행) |
| T-23 공통 (2026-11-16) | 아래 T-23 행들. 줄 번호는 2026-11-16 `parkSuHong-t23` 기준(Tasks T-23 인용) — 줄 번호가 아니라 적힌 텍스트로 찾는다 | — | 근거: 사용자 지시 "네, 고쳐"와 OQ-T23-1~3 답(DECISIONS #24~#26, 메인 세션 전달 — 인용). 아래 행에 적힌 줄·식 밖은 T-23에서도 수정 금지. 다른 팀원 화면(`#home` `#support` `#coach` `#calendar` `#map`)의 바뀌는 동작은 각 행 "회귀 확인"대로 이전/이후를 나란히 기록한다 — 의도한 변화 외 차이가 나오면 고치지 말고 멈추고 보고 |
| T-23 B1 FRESH | `var FRESH = JSON.parse(JSON.stringify(DEMO));` 다음 줄 `Object.assign(FRESH, { gu: '관악구', addr: '', …` (1267행) | T-23 | 그 객체 리터럴의 `gu: '관악구'`를 `gu: ''`로 바꾸는 것만. 다른 속성, `DEMO`(예시 데이터는 서울 관악구 그대로), `delete FRESH.homeless…` 줄, `migrate`, 저장값 읽기 줄 수정 금지. 이미 저장된 `gu: '관악구'` 값은 바꾸지 않는다(Open Question — 보고서). **회귀 확인**(새 사용자 = '실제로 시작'·'처음부터 다시 입력' 직후): `#home` `#support` `#map` `#coach` 콘솔 오류 0. 의도한 변화 — 지원사업 머리 지역 '지역 미정'(`regionName`), 공고 목록 시·도 필터 없음(`myPrograms` "지역을 안 골랐으면 전부"), 지도 중심 예시 위치(`home()` → `DEMO_HOME`), 거주 조건 '직접 확인'(rules-core `user.gu` 빈 값). `#demo` 예시 상태는 이전과 같음 |
| T-23 B2 | 수정 없음 — `viewStart` 2단계 안내(3470행) | T-23 | 0줄. B1 뒤 새 사용자는 `S.sido` 없음·`S.gu === ''` → `reportArea` 첫 줄(engine.js 91행)이 `{ inArea: null, reason: '지역을 아직 고르지 않음' }` → 2단계 안내는 `R.report.required === null` 갈래('확인이 필요해요')로 간다. B1만으로 해소되지 않으면 `viewStart`를 고치지 말고 멈추고 보고(T-16 view 행의 문구·흐름 변경 금지 유지) |
| T-23 B3 lateNote | `function lateNote(t, c)`의 둘째 줄 `var d = t.legal ? … : t.id === 'rp' && t.due < today ? t.due : null;` (1565행, "parts" 절 — 어느 구역에도 속하지 않음) | T-23 | 그 줄의 `t.id === 'rp' && t.due < today` 조건 앞에 `t.urgent === true && `를 더하는 것만(DECISIONS #26). 첫 줄 `if (c) return '';`·반환 문구, `taskItem`, `buildTimeline`(할 일 id `'rp'`·`urgent` 값) 수정 금지. **회귀 확인**: `S.done.rp` 체크 기록이 세 갈래(신고 대상·확인 필요·확정일자) 모두에서 그대로 체크로 보임(id를 바꾸지 않으므로 유지 — 테스트로 확인), 퇴거 준비 화면의 `taskItem` 출력 불변 |
| T-23 B4 exportObj | `function exportObj() { var o = {}; ['gu', 'addr', … 'nick'].forEach(…); return o; }` 한 줄 (3096행, 내 계약 QR 보내는 쪽) | T-23 | ① 키 배열 끝에 `'sido', 'zip', 'sgg', 'birth', 'homeless', 'dup'` 추가 ② 이 6개 키만 `S[k] === undefined`이면 `null`로 담는다(JSON에서 빠지면 받는 쪽 `k in o`가 거짓이라 휴대폰의 옛 값이 남는다 — `null`이면 '답 없음'으로 덮어쓴다). 기존 16개 키 값 처리는 그대로. 받는 쪽(`boot()` 안 `#import=` 처리, 3887행)은 `Object.keys(exportObj())`로 키를 읽으므로 **0줄**(금지 #1). `devQr`·`devQrHtml`·`encodePayload`·`decodePayload`·`deviceCards` 수정 금지. **회귀 확인**: PC QR이 여전히 만들어짐, 휴대폰이 `null`을 받은 뒤 `#input`에서 '아직 안 정함'·자격 판정 '답하면 판정'(`S.homeless \|\| undefined` 경로)·새로고침 뒤 `migrate`가 `null`을 지움, PC 지역 미선택이면 휴대폰 지역도 '지역 미정' |
| T-23 B5 viewInput | T-13 구역 안 `viewInput`의 `var err = JE.validate(S);` 바로 다음 | T-23 (T-13 구역 — 예외 불필요) | 1줄 추가만: `err.contract`·`err.move`가 둘 다 없고 `pd(S.move) < pd(S.contract)`이면 `err.move = '입주일이 계약일보다 빨라요. 날짜를 확인해 주세요.'`(길잡이 1단계·내 계약 배너와 같은 문구). 기존 `f`가 입주일 칸 아래 `role="alert"`로 보이고 `bad`에 세어 '판정 보기'가 비활성. `engine.js` `validate` 수정 금지(금지 #7). 알려진 한계: `#result` 직접 이동은 지금처럼 판정을 보여 줌(`viewResult`는 `JE.validate`만 봄) — B5 지적 범위 밖, 바꾸지 않음 |
| T-23 B6 setField·금액 칸 | ① `function setField(t)` 둘째 줄 `if (t.hasAttribute('data-num')) { var n = parseInt(…); v = isNaN(n) ? 0 : n; }` (3855행) ② `function setField(t)` 바로 위 ③ screens-core `// ===== /T-16 =====` 다음 빈 줄 1개 뒤 `// ===== T-23 =====` ~ `// ===== /T-23 =====`, 그 뒤 `return api;` ④ `viewInput`·`viewContract`(T-13 구역)·`viewStart`(T-16 view 구역)의 지역 `var num = function (k, unit…) { … }` 한 줄씩 | T-23 | ① 그 한 줄을: `JS && JS.parseAmount`가 있으면 결과가 `ok: false`일 때 `AMT_NOTE[k] = String(v).slice(0, 20)` 기록 후 `return`(S·save 안 함 — 날짜 줄의 `return`과 같은 방식), `ok: true`면 `delete AMT_NOTE[k]` 후 `v = value`. `JS`가 없으면 지금 식 그대로(숫자 외 글자 제거, 안내 없음)로 교체 ② `var AMT_NOTE = {};`와 `function amtNote(k)`(데이터 모델 `AMT_NOTE` 행) 2줄 추가만 ③ `api.parseAmount = function …`만(데이터 모델 행 규격) ④ 각 `num`이 돌려주는 `<div class="unit">…</div>` 바로 뒤에 `+ amtNote(k)`를 붙이는 것만. 공용 `change`(3843행)·`input`(3852행) 리스너 줄, `setField`의 나머지 줄, `viewStart`의 다른 문구·단계·버튼·`data-act`·`.ob-card` 직계 자식 구성(안내는 `form-grid` 안이라 직계 자식 수 불변) 수정 금지. **회귀 확인**: `data-num` 속성이 이 3개 `num` 헬퍼(3422·3462·3506행)에만 있음을 grep으로 확인 — 주거비 관리 금액(`d.bill`, `actual`, `billadd`)은 자기 식으로 처리해 영향 없음 |
| T-23 B7 openTasks | `function openTasks(R, T)` 첫 줄 `var skip = today >= R.C ? { pre: 1, cday: 1 } : {}, flat = [];` (1422행) | T-23 | `today >= R.M`이면 `skip.prep = 1`이 되게 하는 것만(DECISIONS #25) — 그 줄 다음에 `if (today >= R.M) skip.prep = 1;` 1줄 추가(그 줄 자체는 그대로). `open`·`byDue`·반환 객체, `buildTimeline`의 `prep` 단계·할 일 수정 금지. **회귀 확인**: 입주일이 지난 상태에서 `#home` '다음 할 일', 헤더 종 숫자(`render` 안 `openTasks(R, T).dueNow.length`), 코치 사실(`coachFacts`의 `tasks`)에서 입주 준비 할 일이 빠짐(의도한 변화 — 이전/이후 기록), `#timeline` 입주 준비 단계·할 일은 그대로 보임 |
| T-23 B8 viewResult 머리 줄 (2026-11-16 추가) | ① T-10 구역, `function resultSummaryCard(R) { … }` 끝 `}` 다음 줄 = `function viewResult() {` 바로 위 ② `viewResult`의 마지막 `return moRoot('result', '<div class="page-head"><div><p class="eyebrow">' + …` 줄 안의 식 `esc(S.gu) + ' · ' + ageText()` (줄 번호 대신 이 식 텍스트로 찾는다 — B1~B7 병합 뒤 줄 번호가 달라짐) | T-23 (T-10 구역 — 이 행으로 명시 허용. "T-23 공통" 행의 "아래 행에 적힌 줄·식 밖 수정 금지"에서 이 두 곳은 허용 안쪽) | ① 1줄 추가만: `function resultPlace() { var t = function (x) { return x == null ? '' : String(x).trim(); }, p = t(S.gu) \|\| t(S.sido); return p ? esc(p) + ' · ' : ''; }` ② 그 식을 `resultPlace() + ageText()`로 바꾸는 것만. 규칙: 지역은 `S.gu` > `S.sido` > 없음, 지역이 비면 구분점도 붙이지 않음 — T-22 `JS.homeLabel`(screens-core T-13 구역)의 지역 부분과 같은 규칙. `JS.homeLabel`은 집 이름(`addr`·'내 자취방')까지 붙여 돌려주므로 재사용하지 않고, T-13 구역(screens-core·app.html)은 고치지 않는다. 같은 줄의 `ageText()`·`incomeLabel()`·보증금·월세 부분, `viewResult`의 나머지 줄(B9 ③ 한 줄 제외) 수정 금지. 결과: `gu: '관악구'` → `관악구 · 만 26세 · …`(이전과 같음), `gu: ''`·`sido: '충청남도'` → `충청남도 · 만 26세 · …`, 둘 다 없음 → `만 26세 · …`. **회귀 확인**: `resultPlace`·`viewResult`는 `#result`에서만 불림(grep으로 호출처 1곳 확인) — 다른 팀원 화면 영향 0 |
| T-23 B9 출생연월 (2026-11-16 추가) | ① T-13 구역, `var INPUT_WIDE = { … };` 줄 다음 = `function viewInput() {` 바로 위 ② `viewInput` 안 `var err = JE.validate(S);` 다음(B5 날짜 순서 줄이 있으면 그 줄 다음) ③ T-10 구역 `viewResult` 안 `var err = JE.validate(S);` 바로 다음 | T-23 (T-13·T-10 구역 — 이 행으로 명시 허용) | ① 1줄 추가만: `function birthErr(err) { if (!err.birth && S.birth && (S.birth > iso(realToday()).slice(0, 7) \|\| (!err.contract && S.birth > iso(pd(S.contract)).slice(0, 7)))) err.birth = '출생연월이 계약일이나 이번 달보다 늦어요. 날짜를 확인해 주세요.'; }` ② `birthErr(err);` 1줄 ③ `birthErr(err);` 1줄 — 이 3줄만(DECISIONS #27). 비교는 `'YYYY-MM'` 문자열 비교: `err.birth`가 없으면 `validate` 정규식(`^\d{4}-(0[1-9]\|1[0-2])$`)을 통과한 값이고, 계약일은 `iso(pd(…))`로 0 채운 모양으로 맞춘다(`parseDate`는 `2026-1-5`도 받으므로 `S.contract`를 그대로 자르지 않는다). '이번 달'은 `realToday()`(시뮬레이션 `today`가 아님). 효과: `#input`은 기존 `f`가 출생연월 칸 아래 `role="alert"`로 안내하고 `bad`에 세어 '판정 보기' 비활성, `#result`는 기존 조기 반환('조건에 고칠 칸이 있어 판정할 수 없어요')으로 가서 머리 줄·지원 조건에 음수 나이가 나오지 않음. **수정 금지**: `engine.js` `validate`·`age`(금지 #7), 공용 `curAge()`·`ageText()`(1296~1297행 근처 — `#support` 머리 줄(`curAge() ? ' · 만 ' + curAge() + '세' : ''`)·`supUser`·`supCtx`가 같이 쓰는 공용 함수라 고치면 다른 팀원 화면 동작이 바뀜), `viewStart`(T-16 view — 4단계 출생연월 칸). **알려진 한계(바꾸지 않음)**: 이미 미래 출생연월이 저장된 사용자의 `#support` 머리 줄은 지금처럼 '만 -4세'(다른 팀원 화면 — 보고서 Open Question), 길잡이 4단계는 미래 출생연월을 막지 않음(입력 뒤 `#input`·`#result`에서 막힘). **회귀 확인**: `validate` 결과 불변(B5와 같음), 과거 출생연월(`'2000-05'`)·이번 달·계약 달과 같은 달은 안내 없음 |
| T-23 B10 연도 표시 (2026-11-16 추가) | ① screens-core `// ===== T-23 =====` ~ `// ===== /T-23 =====` 구역(B6 ③이 만드는 구역) 안 `api.parseAmount` 정의 다음 ② T-12 구역 `function moveoutChip(d)` 안 `if (!p) return dateBlk(d);` 다음 줄과 그 다음 `return '<span class="mv-chip' …` 줄 ③ T-12 구역 `viewMoveout` 마지막 `return` 안 식 `tasks.map(function (t) { return taskItem(t); })` ④ T-11 구역 `viewTimeline` 안 `function tlStage(s, cls)`의 `var items = s.tasks.map(` 부분 | T-23 (T-11·T-12 구역 + screens-core T-23 구역 — 이 행으로 명시 허용) | ① `api.yearDate`·`api.yearTasks`와 요일 상수 1개 추가만(데이터 모델 행 규격). 기존 `api.parseAmount`·다른 구역·UMD 머리·꼬리 수정 금지 ② `var y = d.getFullYear() !== today.getFullYear() ? d.getFullYear() : 0;` 1줄 추가, `return` 줄은 월 `<span aria-hidden="true">' + p.month + '</span>` 바로 앞에 `(y ? '<span aria-hidden="true">' + y + '년</span>' : '')`, `aria-label` 값 앞에 `(y ? y + '년 ' : '')`를 넣는 것만(칩 폭 52px 안 11px 글자 — 연도를 월 줄에 붙이지 않고 따로 한 줄. CSS는 고치지 않는다 — `.mv-chip`은 `min-height`라 높이만 늘어남). screens-core가 없을 때의 `dateBlk(d)` 대체 경로는 그대로(연도 없음) ③ 그 식을 `(JS && JS.yearTasks ? JS.yearTasks(tasks, today) : tasks).map(function (t) { return taskItem(t); })`로 바꾸는 것만 — `var tasks = moveoutTasks(…)` 줄은 그대로(날짜 숨김이 먼저, 숨긴 할 일은 `due: null`이라 연도 처리 대상 아님) ④ `s.tasks.map(`을 `(JS && JS.yearTasks ? JS.yearTasks(s.tasks, today) : s.tasks).map(`로 바꾸는 것만 — 같은 줄의 `moChanged('timeline:task:' + t.id, …)`·`chkCls` 부분 그대로(복사본도 `id`가 같아 체크 기록·체크 그리기 키 유지). **수정 금지**: 공용 `md()`(1240행 근처)·`ymd()`·`dateBlk()`·`taskItem`·`lateNote`(B3 줄 제외), `dueTag`·`buildTimeline`(금지 #7 — 타임라인 단계 `when` 문구, 코치 `assistantFacts`의 `stages`도 이 값을 씀), `viewTimeline` 머리 줄 `md(R.C) + ' 계약 · ' + md(R.M) + ' 입주'`, CSS. **알려진 한계(바꾸지 않음, DECISIONS #28)**: 올해가 아닌 **지난** 날짜는 'N일 지남'으로 그대로(색 규칙 때문 — 데이터 모델 `yearTasks` 행), 타임라인 단계 머리의 기간 문구, `#home` '다음 할 일' 배지(다른 팀원 화면 — `dueTag`를 직접 부름). **회귀 확인**: `md(`·`dueTag(` 정의 줄 텍스트 불변(테스트), `taskItem`은 `viewTimeline`·`viewMoveout`에서만 불림(grep), `#home`·`#calendar`·`#coach` 날짜 표시 이전/이후 같음 — 의도한 변화는 `#moveout`·`#timeline`의 올해가 아닌 미래 날짜 배지·`#moveout` 중요한 날짜 칩뿐. 390×844에서 칩 4줄이 잘리지 않는지 실물 확인 — 잘리면 CSS를 고치지 말고 멈추고 보고 |
| T-24 공통 (2026-11-16) | 아래 T-24 행들. 줄 번호는 2026-11-16 `parkSuHong-t23` HEAD 4b89d8c 기준(Tasks T-24 인용) — 줄 번호가 아니라 적힌 텍스트로 찾는다 | — | 근거: PR #66 리뷰 원문 1~3(Tasks T-24 인용)과 사용자 답 "3건 모두 수정 (Recommended)"·R1 "세 곳 모두 막기 (Recommended)"(선택지 설명: "조건 입력 '판정 보기' 비활성 + 자격 판정 화면도 '고칠 칸' 안내 + 길잡이 2단계 '다음' 막기. 입력·결과·길잡이가 같은 기준")(메인 세션 전달 — 인용), DECISIONS #29. 아래 행에 적힌 줄·식 밖은 T-24에서도 수정 금지. `engine.js`(`validate` 포함)·screens-core·`setField`·`AMT_NOTE`/`amtNote` 줄·`viewStart`(T-16 view 구역)·`viewContract`는 0줄. T-23 행의 "알려진 한계" 중 B5 `#result` 직접 이동, B9 길잡이 4단계 미검사는 이 T-24 행들로 대체된다(T-23 행 자체는 이력으로 그대로 둠) |
| T-24 R0 공용 검사 `inputErr` | T-13 구역, `function birthErr(err) { … }` 줄 다음 = `function viewInput() {` 바로 위 | T-24 (T-13 구역 — 예외 불필요) | 아래 7줄 함수 추가만(줄 나눔 그대로 — T-23 B5 테스트가 날짜 순서 줄을 한 줄로 잘라 쓴다): `  function inputErr() {` / `    var err = JE.validate(S);` / `    if (!err.contract && !err.move && pd(S.move) < pd(S.contract)) err.move = '입주일이 계약일보다 빨라요. 날짜를 확인해 주세요.';`(viewInput에서 **옮겨 온** 줄, 글자 그대로) / `    birthErr(err);` / `    ['deposit', 'rent'].forEach(function (k) { if (AMT_NOTE[k] && !err[k]) err[k] = ''; });` / `    return err;` / `  }`. 금액 칸 항목 값은 빈 문자열 — `Object.keys(err).length`에는 세지만 `viewInput`의 `f`가 `err[k]`가 거짓이면 문구를 내지 않아 `amtNote(k)` 안내와 문구가 두 번 나오지 않는다. 대상은 판정에 쓰는 `deposit`·`rent`만(`fee`는 `#input`에 칸이 없고 판정에 안 쓰임 — `#input`에 안 보이는 '고칠 칸'이 세어지는 것을 막음). `birthErr` 줄 자체 수정 금지. `AMT_NOTE`는 3862행 `var`(boot() 3909행 전에 실행)라 render 시점에 정의돼 있음 |
| T-24 R1·R2 viewInput·viewResult | ① T-13 구역 `viewInput` 안 연속 3줄 `var err = JE.validate(S);` + B5 날짜 순서 줄 + `birthErr(err);` ② T-10 구역 `viewResult` 안 연속 2줄 `var err = JE.validate(S);` + `birthErr(err);` | T-24 (T-13·T-10 구역 — T-23 B9 행과 같은 위치) | ① 그 3줄을 `var err = inputErr();` 1줄로 바꾸는 것만 ② 그 2줄을 `var err = inputErr();` 1줄로 바꾸는 것만. 같은 함수의 다른 줄(`moBegin`·`f`·`num`·`bad`·'판정 보기' 링크·`viewResult` 조기 반환 문구 '조건에 고칠 칸이 있어 판정할 수 없어요'·`resultPlace` 줄) 수정 금지 — `bad`와 조기 반환은 `Object.keys(err).length`를 그대로 써서 R1(금액 해석 실패)·R2(입주<계약)가 자동 반영된다. 효과: `#input` 금액 칸 해석 실패 동안 '고칠 칸이 N개'·'판정 보기' `aria-disabled`, 올바른 값으로 고치면 `setField`가 `AMT_NOTE[k]`를 지워 다시 활성 / `#result` 직접 이동 시 입주<계약·금액 해석 실패면 '조건에 고칠 칸' 안내. **알려진 한계(바꾸지 않음, DECISIONS #29)**: `AMT_NOTE`는 메모리 값(저장 안 함)이라 새로고침 뒤엔 사라지고, 그때는 저장된 이전 값(칸에도 그 값이 보임)으로 판정한다. 금액 칸 해석 실패 시 `aria-invalid`는 붙지 않음(`num` 헬퍼 수정 금지 — 안내는 `amtNote`의 `role="alert"`) |
| T-24 R1 길잡이 2단계 | 공용 `click` 리스너 안 `else if (a === 'obnext') {` 블록의 `if (st === 1 && pd(S.move) < pd(S.contract)) { toast('입주일이 계약일보다 빨라요.'); return; }` 줄 다음 | T-24 (금지 #1 T-24 예외) | 1줄 추가만: `if (st === 2 && (AMT_NOTE.deposit \|\| AMT_NOTE.rent \|\| AMT_NOTE.fee)) { toast('금액으로 읽지 못한 칸이 있어요. 칸 아래 안내대로 고쳐 주세요.'); return; }` — 기존 `st === 2` 금액 0 검사 줄보다 앞(해석 실패 안내가 먼저). 2단계는 3칸 모두 화면에 있고 칸 아래 안내도 보이므로 `fee`도 막는다(판정 기준 `inputErr`의 `deposit`·`rent`를 포함하는 상위 집합). 블록의 다른 줄, `obprev`, `viewStart` 수정 금지 |
| T-24 R3 길잡이 4단계 완료 | 공용 `click` 리스너 안 `else if (a === 'obdone') { S.onboarded = true; …` 줄(3817행) | T-24 (금지 #1 T-24 예외. T-16 view 구역 `viewStart`는 0줄 — 최소 예외) | 그 줄의 `{` 바로 뒤, `S.onboarded = true;` 앞에 `var oe = inputErr(); if (oe.birth) { toast(oe.birth); return; } `를 넣는 것만. `oe.birth`만 본다 — 길잡이는 지금까지 `validate`의 다른 칸(예: 월세만 넣고 보증금 빈 값)을 완료 조건으로 삼지 않았으므로 다른 키로 막으면 R3 범위 밖 흐름 변경. 출생연월 판정은 `#input`·`#result`와 같은 `inputErr` → `birthErr` 경로(형식 오류 문구 포함)라 기준이 같다. 안내는 기존 `obnext`와 같은 `toast` 방식(문구 = `birthErr` 문구 '출생연월이 계약일이나 이번 달보다 늦어요. 날짜를 확인해 주세요.'). 같은 줄의 `S.onboarded = true; S.obStep = 1; S.done = {}; save(); location.hash = 'home'; render(false); toast(…)` 부분 수정 금지. T-16 view 행의 "문구·단계 수·버튼·`data-act`·흐름 변경 금지"는 `viewStart`에 그대로 적용 — 이 행이 바꾸는 흐름은 사용자가 고른 '미래 출생연월이면 완료 막기' 하나뿐. 빈 값·과거·이번 달 출생연월은 지금처럼 완료. **회귀 확인**: `oe`가 리스너 안 다른 이름과 겹치지 않음(2026-11-16 grep 0건), 완료 뒤 `#home`·헤더 이동은 이전과 같음 |
| T-24 R4 값 통째 교체 시 금액 안내 비우기 (2026-11-16 추가) | 줄 번호는 2026-11-16 `parkSuHong-t23` HEAD 04d5f5b 기준 — 식 텍스트로 찾는다. ① 공용 `click` 리스너 `else if (a === 'reset') {` 줄(3812행) 안 `S = clone(DEMO);` 바로 뒤 ② 같은 줄 `S = clone(FRESH);` 바로 뒤 ③ `else if (a === 'demo') {` 줄(3823행)의 `S = clone(DEMO);` 바로 뒤 ④ `else if (a === 'startreal') {` 줄(3824행)의 `S = clone(FRESH);` 바로 뒤 ⑤ `function restoreJson(file)` 안 `S = migrate(Object.assign(clone(FRESH), o, { onboarded: true, demo: false, sim: null }));` 바로 뒤(3499행) | T-24 (①~④ 금지 #1 T-24 예외. ⑤ `restoreJson`은 이 행으로 명시 허용 — 금지 #8의 자기 구역 밖, 이 한 곳만) | 5곳 각각 같은 줄 안에 문장 `AMT_NOTE = {};` 하나를 넣는 것만(새 줄 없음, 같은 줄의 `save()`·`DATA = …`·`location.hash`·`render(…)`·`toast(…)`·`confirm(…)` 부분 그대로). 위치가 "대입 바로 뒤"인 이유: ② `reset` 실제 사용자 갈래는 `confirm` 취소 시 S가 그대로이므로 안내도 그대로 둬야 하고, 분기 맨 앞에 두면 취소해도 안내가 사라진다. `AMT_NOTE`는 `DOMContentLoaded` 콜백(1165행) 안 `var`(3867행)이고 참조(`inputErr` 3511·`obnext` 3817·`amtNote` 3868·`setField` 3871)는 모두 같은 콜백 안 함수가 호출 시점에 이름으로 읽으므로 재대입해도 옛 객체를 붙잡는 곳이 없다(2026-11-16 grep — `AMT_NOTE` 참조 5줄뿐). 공용 지점 한 곳에서 비우는 안은 고르지 않음: `save()`는 다른 칸 저장(`setField` 성공 등)에서도 불려 해석 실패 칸의 안내가 사라짐(R1 깨짐), `render()`는 금지 #1이고 `reset` 예시 갈래는 `render(true)`라 `render(false)`만으로는 못 덮음. **수정 금지**: `var AMT_NOTE`·`amtNote`·`setField` 줄, `boot()`(아래 한계), `engine.js`, 다른 `data-act` 분기. **알려진 한계(바꾸지 않음, DECISIONS #30)**: `boot()`의 `#demo`(3897행)는 페이지를 연 직후 1번(3914행 `boot();`) 돌고 그때 `AMT_NOTE`는 3867행에서 막 만든 빈 객체라 비울 것이 없음. `#import=`(3903행)는 S를 통째로 바꾸지 않고 `exportObj` 키만 덮어쓰며, 페이지 로드 직후 `decodePayload` 대기 중 사용자가 금액 칸에 해석 못 하는 글자를 넣은 경우에만 안내가 남음 — 이론상 경로라 금지 #1(`boot()` 0줄)을 유지. **회귀 확인**: `S = clone(`·`S = migrate(` grep 결과가 이 5곳 + `var S = clone(FRESH);`(1284행)·`boot()` `#demo`(3897행)뿐인지, 다른 팀원 화면(`#home`·`#support`·기기 연결 카드) 표시 이전/이후 같음 — `AMT_NOTE`는 `#input`·`#contract`·`#start` 금액 칸 안내에만 쓰임. **테스트**(`tests/t24-review.test.js`에 추가만, 기존 단언 수정 금지): 잘라 낸 `reset`·`demo`·`startreal` 분기를 가짜 `S`·`AMT_NOTE`·`clone`·`save`·`render`·`toast`·`confirm`·`location`·`PC` 주입으로 실행 — 정상: `AMT_NOTE = { deposit: '이천' }`에서 예시 `reset`·`demo`·`startreal` 뒤 빈 객체, 경계: 이미 빈 객체면 빈 객체·`save`/`render` 호출 횟수 이전과 같음, 예외: 실제 사용자 `reset`에서 `confirm` 취소 → `AMT_NOTE.deposit === '이천'` 그대로. 정적: app.html 전체에서 `AMT_NOTE = {};` 정확히 5번이고 각각 위 ①~⑤ 대입 바로 뒤, `var AMT_NOTE`·`amtNote`·`setField` 줄 텍스트 불변 |
| T-24 R5 금액 칸에 입력 원문 보이기 (2026-11-16 추가) | 줄 번호는 2026-11-16 `parkSuHong-t23` HEAD 82e2159 기준 — 식 텍스트로 찾는다. ① `function amtNote(k) { … }` 줄(3868행) 바로 다음 ② T-13 구역 `viewContract`의 `var num = function (k, unit) {` 줄(3426행) 안 식 `value="' + S[k] + '"` ③ T-16 view 구역 `viewStart`의 `var num = function (k, unit, ph) {` 줄(3466행) 안 식 `value="' + (S[k] \|\| '') + '"` ④ T-13 구역 `viewInput`의 `var num = function (k, unit) {` 줄(3518행) 안 식 `value="' + esc(S[k]) + '"` | T-24 (① 금지 #1 T-24 R5 예외. ②③ T-24 공통 행의 "`viewStart`·`viewContract` 0줄"에 대한 이 행의 예외 — 각 `num` 줄의 `value` 식만. ④ T-13 구역) | ① 1줄 추가만: `  function amtVal(k, v) { return esc(AMT_NOTE[k] ? AMT_NOTE[k] : v); }` ② `S[k]`를 `amtVal(k, S[k])`로 ③ `(S[k] \|\| '')`를 `amtVal(k, S[k] \|\| '')`로 ④ `esc(S[k])`를 `amtVal(k, S[k])`로 — 각 줄의 그 식만 바꾼다(식 앞뒤의 문자열 조각 `value="' + `·`+ '"…`는 그대로). 규칙: `AMT_NOTE[k]`가 있으면(참) 칸 `value`는 그 원문, 없으면 지금 값(각 헬퍼의 기존 식). 판정은 `amtNote`·`inputErr`와 같은 참/거짓 기준(`!= null`이 아님 — 빈 문자열 원문이면 안내도 '고칠 칸'도 없으므로 칸도 저장값을 보여 셋이 어긋나지 않게). `esc`는 `amtVal` 안에서 한 번 — ②③은 지금 `esc`가 없지만 `S[k]`는 `setField`가 숫자로만 저장하므로 숫자·`undefined`·`''`의 출력 글자는 이전과 같고(app.html `esc`는 `String(s)`), 원문 문자열은 사용자 입력이라 반드시 이스케이프한다(속성 값 `"` 탈출 방지). 부수효과(의도): 칸에 원문이 보이므로 이전 저장값과 같은 값을 다시 넣어도 포커스 시점 값(원문)과 달라 `change`가 나고 다시 그려져 안내가 풀린다(지금은 칸에 저장값이 보여 같은 값 재입력 시 `change`가 나지 않아 `input` 리스너가 `AMT_NOTE`를 지워도 안내가 다음 그리기까지 남음). **알려진 한계(바꾸지 않음, DECISIONS #31)**: `AMT_NOTE`는 `setField`가 `slice(0, 20)`으로 자른 원문이라 해석 못 하는 21자 이상 입력은 칸에 앞 20자만 보인다(`setField` 줄·T-23 테스트 '안내 원문은 20자로 자름' 0줄 유지). 새로고침 뒤엔 #29 한계대로 저장값이 보임. **수정 금지**: `var AMT_NOTE`·`amtNote`·`setField` 줄, `engine.js`, screens-core, 각 `num` 줄의 `value` 식 밖(`class`·`inputmode`·`data-field`·`data-num`·`placeholder`·`aria-invalid` 부분·`+ amtNote(k)` 끝), 세 화면의 다른 줄, 주거비 관리 금액 칸(`d.bill` — `data-num` 없음). **회귀 확인**: `data-num` 줄이 여전히 5줄(T-23 B6 정적 테스트), `amtVal(` 호출이 이 3곳 + 정의 1곳뿐(grep) — `#input`·`#contract`·`#start`만 영향, 다른 팀원 화면 0. **테스트**(`tests/t24-review.test.js`에 추가만, 기존 단언 수정 금지): 잘라 낸 `var AMT_NOTE`·`amtNote`·`amtVal` 3줄을 `esc` 주입으로 실행 — 정상: `AMT_NOTE.deposit = '이천'`이면 `amtVal('deposit', 500) === '이천'`, 경계: 기록 없음 → `amtVal('deposit', 500) === '500'`·`amtVal('fee', '') === ''`, `AMT_NOTE.deposit = ''`이면 `'500'`, 예외: 원문 `'"><b>'` → `'&quot;&gt;&lt;b&gt;'`(속성 탈출 없음). 연결: 잘라 낸 `setField`(T-23 `makeSetField` 방식)와 같은 `AMT_NOTE`로 `'이천'` → `amtVal('deposit', S.deposit) === '이천'`·`S.deposit` 이전 값, 이어서 이전 값과 같은 `'500'` → `amtVal(...) === '500'`·`AMT_NOTE`에 `deposit` 없음. 정적: `viewInput`·`viewContract`의 `num` 줄에 `value="' + amtVal(k, S[k]) + '"'`, `viewStart`의 `num` 줄에 `value="' + amtVal(k, S[k] \|\| '') + '"'` 각 1번, `data-num` 줄 중 `value="' + S[k]`·`esc(S[k])`·`(S[k] \|\| '')` 남은 것 0, `var AMT_NOTE`·`amtNote`·`setField` 줄 텍스트 불변. **실물 확인**(브라우저): `#input`·`#contract`·`#start` 2단계에서 보증금 저장값이 있는 상태로 `이천` 입력 후 다른 칸으로 이동 → 칸에 `이천`·안내 보임, 다시 원래 저장값과 같은 숫자 입력 후 이동 → 칸에 그 숫자·안내 사라짐 |
| T-25~T-28 공통 (2026-11-17) | 아래 4행. 줄 번호는 origin/main 78f7ab9 기준 참고값 — 줄 번호가 아니라 적힌 텍스트로 찾는다. 네 작업은 각자 별도 worktree·브랜치(78f7ab9에서 시작)에서 동시에 진행한다 | — | 근거: 사용자 답 "각각 서브 세션으로,4번 QR 계약값 검사 (Recommended),16번 금액 단위 경고 (Recommended),홈 납부 카드 이스케이프,QR 카드 A안", OQ #12 "통째로 받지 않음 (Recommended)", OQ #13 "조건 입력만 (Recommended)", F-13·F-15·T-27 "이대로 진행 (Recommended)"(메인 세션 전달 — 인용), DECISIONS #32~#34. **겹침 판정**: app.html 수정 위치 4곳(3304·3524~3531·3962·4347행)은 서로 수백 줄 떨어져 git 3-way 병합 충돌 없음. screens-core.js는 T-26이 `/T-16`과 `T-23` 사이, T-25가 `/T-23`과 `return api;` 사이에 넣어 바뀌지 않는 T-23 구역(26줄)이 끼므로 충돌 없음. 테스트는 각자 새 파일만 — **기존 테스트 파일 수정 0**(T-25·T-28은 아래 각 행의 기존 단언을 그대로 통과시켜야 함). 아래 행에 적힌 줄·식 밖은 수정 금지. `engine.js`·`rules-core.js`·`life-core.js`·`sw.js`·CSS 0줄. 병합은 끝난 순서대로, 병합 직전 최신 main을 자기 브랜치에 병합 → 회귀 재실행(위 "병합 순서" 4·5) |
| T-25 screens-core | `// ===== /T-23 =====` 다음 빈 줄 1개 뒤 `// ===== T-25 =====` ~ `// ===== /T-25 =====`, 그 뒤 빈 줄 1개와 `return api;` | T-25 | `api.checkImport = function …`와 그 규칙에 쓰는 구역 지역 상수만(데이터 모델 `JS.checkImport` 행 규격). T-23 구역·다른 구역·UMD 머리·꼬리 수정 금지 |
| T-25 QR 받는 줄 | `boot()` 안 `if (h.indexOf('#import=') === 0) {` 블록의 `      decodePayload(dd).then(function (o) { …` 한 줄(4347행) | T-25 (금지 #1 T-25 예외) | 그 한 줄 안에서만, 처리 순서: ① `.then(function (o) {` 바로 뒤 첫 문장으로 `if (!(JS && JS.checkImport && JS.checkImport(o))) { toast('QR 정보를 읽지 못했어요.'); return; }` — **확인 창 앞**에서 검사(DECISIONS #32). 실패 시 `S`·`save`·`render`·`history` 0회 ② 기존 조건 `if (o && typeof o === 'object' && confirm('…'))`는 `if (confirm('…'))`로 줄인다(①이 `o` 모양을 이미 봄 — confirm 문구 글자 그대로) ③ 기존 덮어쓰기 `Object.keys(exportObj()).forEach(…)`부터 `S.events = JL.cleanEvents(S.events) \|\| [];`와 주석, `S.onboarded = true; S.demo = false;`까지 글자 그대로 ④ `S.demo = false;` 바로 뒤, `save();` 앞에 `migrate(S);` 삽입(`S.demo`가 거짓이 된 뒤라 예시 답 채우기 갈래를 타지 않음 — `migrate`는 `S`를 직접 고침) ⑤ 나머지(`save(); PC.k = ''; loadPlaces(); render(false); toast(…)`·`.catch(…)`) 글자 그대로. 줄을 나누지 않는다. **지켜야 할 기존 단언**: `tests/t23-bugfix.test.js` 121~122행(줄이 `      decodePayload(dd).then(`로 시작, `Object.keys(exportObj()).forEach(function (k) { if (k in o) S[k] = o[k]; })` 포함), `tests/life-core.test.js` 247행(`if (k in o) S[k] = o[k]; }); S.bills = JL.cleanBills(S.bills) \|\| clone(FRESH).bills; S.events = JL.cleanEvents(S.events) \|\| [];` 연속 글자 포함). `JS`는 같은 콜백의 `var JS = window.JachwiScreens \|\| null;`(4028행)이고 `.then`은 비동기라 그 줄 실행 뒤에 돈다. 수정 금지: `exportObj`·`migrate` 정의·`decodePayload`·`restoreJson`·`var dd` 줄. 동작 변화(의도): `decodePayload`가 `null`·객체 아닌 값을 돌려주면 지금은 아무 일 없음 → 토스트 'QR 정보를 읽지 못했어요.' |
| T-26 screens-core | `// ===== /T-16 =====` 다음 빈 줄 1개 뒤 `// ===== T-26 =====` ~ `// ===== /T-26 =====`, 그 뒤 빈 줄 1개와 `// ===== T-23 =====` | T-26 | `var UNIT_MAX = …;`와 `api.amountUnitWarn = function …`만(데이터 모델 행 규격). T-16·T-23 구역(`parseAmount` 포함) 수정 금지 |
| T-26 조건 입력 금액 줄 | T-13 구역 `viewInput` 안 `      f('보증금', num('deposit', '만 원'), 'deposit') + f('월세 (관리비 제외)', num('rent', '만 원'), 'rent') +` 한 줄(3962행) | T-26 (T-13 구역 — 예외 불필요) | 두 `f` 호출에 넷째 인자만 추가: 보증금 `JS && JS.amountUnitWarn && !AMT_NOTE.deposit ? JS.amountUnitWarn('deposit', S.deposit) : ''`, 월세 같은 식에 `'rent'`·`AMT_NOTE.rent`·`S.rent`(DECISIONS #33). 셋째 인자까지·`num(…)` 호출·줄 끝 ` +`는 글자 그대로, 줄을 나누지 않는다. 표시 규칙은 기존 `f`(3952행) 그대로: `err[k]`가 참이면 오류 문구만, 아니면 hint(`<em class="s12 muted">`). `AMT_NOTE[k]`가 있을 때 `inputErr`가 `err[k] = ''`(거짓)로 두므로 `f`만으로는 hint가 `amtNote` 오류 안내와 같이 나온다 — 그래서 `!AMT_NOTE[k]` 조건으로 막는다(PRD F-14 ③). `bad`·'판정 보기'·`f` 정의·`num` 정의·`inputErr`·`setField`·`AMT_NOTE`/`amtNote`/`amtVal` 줄·`viewContract`·`viewStart`(OQ #13 — 조건 입력만) 수정 금지 |
| T-27 홈 납부 카드 | 다른 팀원 화면 `viewHome` 안 `    var payH = !mb.length ? (first ? …` 한 줄(3304행) | T-27 (금지 #8 T-27 예외 — 이 한 줄의 두 식만, DECISIONS #34) | 그 줄의 `first.title`을 `esc(first.title)`로, `nb.title`을 `esc(nb.title)`로 — 이 두 곳만. 같은 줄의 `md(…)`·문구·삼항 구조, 다음 줄 `var pay = …`, `esc` 정의, `viewHome`의 다른 줄, `life-core.js` 수정 금지. 홈 다른 줄의 이스케이프 누락을 발견하면 고치지 말고 위치 목록으로 보고 |
| T-28 내 계약 QR 카드 | `function deviceCards() {` ~ 그 함수 끝 `}`(3524~3531행) 본문 | T-28 (금지 #8 T-28 예외 — T-13 행 "`deviceCards()` 호출만"에 대한 이 행의 예외, DECISIONS #34) | 규칙: `var acc = !IS_PHONE && accOn();`(새 지역 변수 — 함수 안 다른 이름과 겹치지 않음) ① `d`는 `IS_PHONE \|\| acc`면 `''`, 아니면 지금처럼 `devQr(exportObj())` — 로그인 PC에서 `devQr` 0회 ② 반환 식의 '휴대폰으로 이어서 보기' 구역: `acc`면 제목 `<h2 style="font-size:16px">휴대폰으로 이어서 보기</h2>` 다음에 `<p class="s13 sub">휴대폰에서 같은 계정으로 로그인하면 그대로 이어져요.</p>`만(QR·`data-dev-qr`·'정보는 QR 주소의 # 뒤에만…' 문구 없음), `acc`가 거짓이면 **출력 글자가 지금과 같다** ③ `IS_PHONE`이면 지금처럼 구역 없음 ④ '앱처럼 설치' 구역(`standalone`·`inst`) 글자 그대로. 수정 금지: `accOn`·`devQr`·`devQrHtml`·`exportObj`·`encodePayload`·계정 코드·`viewContract`(호출 줄 포함)·`boot()`. **지켜야 할 기존 단언**: `tests/contract-qr.test.js`(22~27행 — `deviceCards` 본문에 `encoded(` 없음, `data-dev-qr`·`devQr` 있음 — 비로그인 갈래가 그대로 남으므로 통과), `tests/screen-input-contract.test.js` 57~63행(`viewContract` 안 `deviceCards()` 위치 — 0줄). 로그인·로그아웃 직후 `#contract`가 다시 그려지는지는 확인만 해 보고(안 그려져도 고치지 않음) |
| T-29 공통 (2026-11-17) | 아래 3행 + tests 행. 줄 번호는 parkSuHong-audit HEAD 178c463 기준 참고값 — 적힌 텍스트로 찾는다. 메인 세션 직접 구현(Tasks T-29), 변경 파일 3개(`demo/screens-core.js`·`demo/app.html`·새 `tests/t29-import-home-date.test.js`) | — | 근거: PR #80 리뷰(Tasks T-29 행 축어 인용), OQ #12 "통째로 받지 않음 (Recommended)"(인용), DECISIONS #35. `engine.js`·`rules-core.js`·`life-core.js`·`sw.js`·CSS·`restoreJson`·계정 동기화 코드 0줄. **처리 순서**: ① screens-core 수정 → ② app.html 받는 줄 → ③ app.html 로드뷰 주소 2줄. Red는 ①~③ 전에 새 테스트로 저장(AGENTS.md 검증 증거 보존) |
| T-29 screens-core | 기존 `// ===== T-25 =====` ~ `// ===== /T-25 =====` 구역 안(새 구역 없음) | T-29 | 데이터 모델 "T-29 갱신" 행 ①~⑤만: `IMP_DATE` 식 교체, `IMP_RULES.term` 식 끝 조건 1개 추가, `IMP_RULES.home`을 `IMP_HOME`으로 교체, 새 구역 상수 `HOME_KEYS`·지역 함수 `IMP_HOME`, 새 `api.rvUrlOk`·`api.cleanHome`. 구역 머리 주석 2줄 중 "날짜는 모양만 본다(restoreJson과 같은 기준)" 문구는 "날짜는 실제 달력 날짜까지 본다(T-29)"로 고친다. 다른 `IMP_*` 규칙·`api.checkImport` 본문 3줄·다른 구역 수정 금지. **지켜야 할 기존 단언**: `tests/t25-import-check.test.js` 전부(특히 94~117행 — PC 페이로드 `home: { lat: 37.48, lng: 126.95 }` 통과, `home` null 통과, `term` 1·10·'2' 통과, 0·11·'x'·null·true 실패, `home` `[]`·`'x'` 실패) — 깨지면 고치지 말고 멈추고 보고 |
| T-29 QR 받는 줄 | `boot()` 안 `      decodePayload(dd).then(function (o) { …` 한 줄(4379행) | T-29 (금지 #1 T-29 예외) | 그 줄 안 `/* 납부 항목·내 일정은 형식 검사 (life-core.js) */ ` 바로 뒤, `S.onboarded = true;` 바로 앞에 문장 `if ('home' in o) S.home = JS.cleanHome(o.home); ` 하나만 삽입. `JS`는 같은 줄 첫 검사(`JS && JS.checkImport && …`)를 통과했으므로 있음. `'home' in o`가 아니면 이 기기 집 값(로드뷰 캐시 포함) 그대로. 그 밖의 글자(첫 검사·`confirm` 문구·`forEach`·`cleanBills`·`cleanEvents`·주석·`migrate(S)`·`save` 이후·`.catch`) 그대로, 줄을 나누지 않는다. **지켜야 할 기존 단언**: T-25 행과 같음(`tests/t23-bugfix.test.js` 121~122행, `tests/life-core.test.js` 247행 연속 글자, `tests/t25-import-check.test.js` 받는 줄 호출 순서 `confirm`→`migrate`→`save`→`loadPlaces`→`render`→토스트) |
| T-29 로드뷰 주소 | 다른 팀원 지도 코드 ① `function kakao(kind, p) {` 안 `    if (kind === 'rv') { var rs = RVS[rvKey(p)]; if (rs && rs.url) return rs.url; if (p.rvUrl) return p.rvUrl; }` 한 줄(2869행) ② `  function homeRvFresh(h) { return !!h.rvUrl && …` 한 줄(2952행) | T-29 (금지 #8 T-29 예외, DECISIONS #35) | ① 그 줄의 `if (p.rvUrl)`만 `if (JS && JS.rvUrlOk && JS.rvUrlOk(p.rvUrl))`로 ② `!!h.rvUrl`만 `!!(JS && JS.rvUrlOk && JS.rvUrlOk(h.rvUrl))`로. 나머지 글자 그대로. 효과: 저장값·계정 동기화·QR 어디서 왔든 안전하지 않은 `rvUrl`은 (a) `kakao('rv', …)` 반환값이 들어가는 `href="…"` 문자열 연결 2곳(집 지도 카드 '로드뷰' 버튼, `openRoadview`의 '카카오맵에서 열기')과 (b) `homeRvFresh` 참일 때만 도는 `fromUrl(p.rvUrl)` → `a.href = u`(3019행)에 들어가지 않고, 좌표 링크·새로 고르기로 내려간다. `JS`는 같은 `DOMContentLoaded` 콜백의 `var JS`(4060행, 같은 2칸 들여쓰기 스코프 — 대입 전 호출이면 `undefined`라 거짓 쪽으로 안전). `RVS` 캐시(`placeRoadview`가 직접 만든 주소)·`fromUrl`·`placeRoadview`·`fixPlaceRoadview`·저장 조건 줄(2962~2963) 수정 금지 — 앱 자신이 만든 값이라 검사 대상 아님. 별도 HTML 이스케이프 줄은 두지 않는다(`rvUrlOk` 허용 문자에 `"`·`<`·`>`·`'`가 없어 이스케이프 결과가 원문과 같음 — DECISIONS #35) |
| tests/ | 위 "구조 개요"의 파일 이름 | 각 T | 자기 테스트 파일만 새로 만든다. 남의 테스트 파일·`answer-key.json` 수정 금지. **예외(T-16)**: `tests/screens-zones.test.js`는 아래 "정적 검사 — T-16 확장" 표의 변경만 허용(기존 단언 삭제·완화 금지). **예외(T-21)**: `tests/report-area.test.js`(T-18 파일)에 T-21 테스트 추가만 허용 — 기존 단언 삭제·완화 금지. **예외(T-23)**: 새 파일 `tests/t23-bugfix.test.js`. `tests/screen-timeline.test.js`의 "기한 계산(buildTimeline~openTasks) 텍스트" 테스트는 B7 때문에 해시 기준값 문자열 1개와 바로 위 주석 1줄(이전 값과 "T-23 B7 `openTasks` 입주 준비 제외로 갱신" 추가)만 바꾼다 — T-18 때와 같은 방식, 다른 단언 수정 금지. **예외(T-24)**: 새 파일 `tests/t24-review.test.js`. `tests/t23-bugfix.test.js`는 R0이 줄을 옮기므로 두 곳만 대상 텍스트를 바꾼다 — ① `orderLine()`의 `fnText('  function viewInput() {', '\n    var f = function')`를 `inputErr` 본문(`'  function inputErr() {'`부터 `'\n  function viewInput() {'` 앞까지)으로, 실패 메시지의 'viewInput'을 'inputErr'로 ② B9 정적 테스트(`viewInput·viewResult가 각각 birthErr(err)를 1번`)의 두 단언을 "`inputErr` 본문에 `birthErr(err);` 1번 + `viewInput`·`viewResult` 본문에 `var err = inputErr();` 각 1번"으로(검사 강도 유지 — 테스트 이름도 맞게). 같은 파일의 다른 테스트·`runOrder`·`runBirth`·B5/B9 케이스 값 수정 금지. **T-25~T-28(2026-11-17)**: 새 파일 `tests/t25-import-check.test.js`·`tests/t26-amount-unit.test.js`·`tests/t27-home-pay-escape.test.js`·`tests/t28-contract-login-qr.test.js` 각 1개만, 기존 테스트 파일 수정 예외 없음 — 기존 단언이 깨지면 고치지 말고 멈추고 보고. **T-29(2026-11-17)**: 새 파일 `tests/t29-import-home-date.test.js` 1개만, 기존 테스트 파일 수정 0. 방식은 `tests/t25-import-check.test.js`와 같음(받는 줄·`placeKey`·`kakaoId`·`rvKey`·`kakao` 함수 블록·`homeRvFresh` 줄을 app.html 텍스트에서 잘라 `new Function`으로 가짜 환경 실행). 케이스는 Tasks T-29 ⓑ 그대로. ⓒ 연결 회귀: 잘라 낸 받는 줄 실행(`confirm` 승낙) → `loadPlaces` 가짜가 잘라 낸 `placeKey(S.home)` 호출(던지지 않음) → `render` 가짜가 잘라 낸 `kakao('rv', S.home)` 호출(`https://map.kakao.com/`로 시작) — 정상 페이로드는 `S.home`이 `HOME_KEYS` 필드만(받은 `rvUrl`·`rvAt`·임의 필드 없음), 잘못된 `home`(`lat` '37.5'·`rvUrl` `javascript:alert(1)`) 페이로드는 토스트 1회·`S` 불변. 그리기 쪽: `S.home.rvUrl`이 `javascript:alert(1)`·`https://map.kakao.com/?panoid=1" onmouseover="x`이면 `kakao('rv', …)`가 그 값을 돌려주지 않고 `homeRvFresh`는 `false`, 정상 panoid 주소면 그대로 |
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
| Z6 | CSS 구역 안 시간 리터럴(`\d+ms`, `\d*\.?\d+s`)은 T-09 토큰 선언 줄에만 있고, 그 값이 `JachwiScreens.T`와 같다. 나머지는 `var(--mo-short|base|long)`와 `calc(var(--mo-step) * n)`(n ≤ 6)만 | N-04 길이·0.93초 상한(`T.total`) |
| Z7 | `infinite` 0건, `animation-iteration-count` 0건 | N-04 반복 모션 0개 |

### 정적 검사 — T-16 확장 (T-16이 Red-First로 고침, 2026-11-12)

Z1~Z7의 "CSS 구역"은 T-16부터 **T-09 시작 ~ T-16 끝**이다. T-16 구현은 `tests/screens-zones.test.js`를 아래만 바꾼다(기존 단언 삭제·완화 금지). 마커를 먼저 테스트에 넣어 Red(마커 없음)를 확인한 뒤 app.html을 고친다.

| # | 변경 | 결과 |
|---|---|---|
| E1 | `CSS_MARKS` 배열 끝에 `['/* ===== mo:T-16 #start ===== */', '/* ===== /mo:T-16 ===== */']` 추가(6쌍) | Z1이 T-16 마커 1번·순서 검사 |
| E2 | 끝 마커 참조 `CSS_MARKS[4][1]`(Z1 `</style>` 검사, `zoneCss()`, Z6 `zoneEnd`) 3곳을 `CSS_MARKS[CSS_MARKS.length - 1][1]`로 | Z4·Z5·Z6·Z7이 T-16 구역까지 스캔 |
| E3 | Z1의 구역 사이 빈 줄 반복 `k < 4`를 `k < CSS_MARKS.length - 1`로 | T-13 끝 → 빈 줄 1개 → T-16 시작 검사 |
| E4 | `JS_MARKS_T16 = ['// ===== mo:T-16 =====', '// ===== /mo:T-16 =====']` 추가, Z1에 단언 추가: 각 1번, 시작 < 끝, `</style>` 뒤, 끝 마커 다음 첫 비공백 줄이 `// ---------- 처음 시작하기 (온보딩) ----------`. 기존 `JS_MARKS`(T-09) 단언은 그대로 | T-16 JS 블록 위치 고정 |
| E5 | Z7에 T-16 JS 블록도 `iterations` 반복 없음 단언 추가 | N-04 |
| 테스트 이름 | Z1 제목의 "T-09~T-13"은 "T-09~T-13·T-16"으로 바꿔도 된다(문구만) | — |

`tests/screen-start.test.js`(T-16 새 파일)에 둘 것:

| 대상 | 케이스 (tdd-practitioner: 정상 1 + 경계 2 + 예외 2 이상) |
|---|---|
| `JS.stepEnter` | 정상: `('start', 'start:2', 'start', 'start:2') → false`(같은 단계 재그리기). 단계 이동: `('start','start:1','start','start:2') → true`, '이전' `('start','start:3','start','start:2') → true`. 화면 이동: `('home','start:2','start','start:2') → true`. 경계: 첫 로드 `('', '', 'start', 'start:1') → true`, `prevKey` `undefined`·`null` → true. 타입: `'start:'+2`와 `'start:2'` 같음 → false |
| T-16 JS 블록 텍스트 | `function moBeginStep(` 정의, `moBegin(` 호출 포함, `render(`·`setTimeout`·`setInterval`·`save(`·`localStorage`·`addEventListener(` 0건, `last` 쓰기(`/\blast\s*=[^=]/`) 0건 |
| `viewStart` 텍스트 | `moBeginStep('start'`·`moRoot('start'`가 각 1번, `viewStart` 본문에 `moStep(` 0건 |
| T-16 CSS 구역 텍스트 | `@keyframes mo-start-fill`, `li.now::before`의 `animation`이 `[data-mo-enter]` 아래·no-preference 안. `.mo-start[data-mo-enter] .ob-card > *`에 `animation: mo-in var(--mo-base) var(--mo-ease) both`가 no-preference 안. `> :nth-child(k)`(k=2..6)마다 `animation-delay: calc(var(--mo-step) * (k-1))`(리터럴 1..5), `> :nth-child(n+7)`에 `* 6` — 각 1번 |

### T-21 `reportArea` 보완 테스트 (`tests/report-area.test.js`에 추가, 2026-11-12, DECISIONS #23·ADR-0004)

| 대상 | 케이스 (tdd-practitioner: 정상 1 + 경계 2 + 예외 2 이상) |
|---|---|
| 빈 값 | 7개 시·도 각각 `''`·`undefined`·공백 → null, reason에 '시·군·구' |
| 섞인 값 | 서울 구 이름(`경상북도 + 관악구`) → null / 다른 시·도의 정상 이름(`경상북도 + 보은군`, `경상북도 + 천안시`, `강원특별자치도 + 청송군`) → null, reason에 '맞지 않' |
| 회귀(형태 규칙을 쓰지 않는 이유) | `전남광주통합특별시 + 광산구`·`+ 동구` → true, `경상남도 + 고성군` → false, `강원특별자치도 + 고성군` → null |
| 기존 판정 유지 | T-18 테스트 전부, `부산광역시 + ''`·`부산광역시 + 관악구` → true, 시도 없음 + `마포구` → true |
| 표 일치 | engine.js 이름 표의 7개 시·도 각각이 `require('../demo/data/regions.js')`의 같은 시·도 이름 목록과 같은 집합(개수 포함) — 엔진은 regions.js를 읽지 않고 테스트만 읽는다. 이름 표는 반환 객체 속성 `JE.reportAreaSgg`(`{ [시·도]: string[] }`)로 내보내 테스트가 읽는다(금지 #7 T-21 예외). `reportArea` 시그니처는 바꾸지 않는다 |
| `deadlines` | 빈 값·섞인 값이면 금액이 커도 `report.required === null` |

### T-23 재작업 테스트 (`tests/t23-bugfix.test.js`, 2026-11-16, DECISIONS #24~#26)

app.html 함수는 기존 방식대로 파일 텍스트에서 함수 본문을 잘라 `new Function`으로 만든다(`tests/screen-timeline.test.js` `taskItem`, `tests/legacy-user.test.js` `migrate`와 같은 방식). 각 B는 수정 전 Red를 먼저 저장한다(Tasks T-23 완료 조건 ①). 회귀 기준: `node --test "tests/*.test.js"` fail 0, pass 직전 기준 이상(345 — 인용, Tasks T-23), 정답표 30/30.

| B | 케이스 (tdd-practitioner: 정상 1 + 경계 2 + 예외 2 이상) |
|---|---|
| B1 | `Object.assign(FRESH, {…})` 텍스트의 `gu` 값이 `''`. `JE.reportArea(undefined, '')` → `inArea: null`, `JE.deadlines`(FRESH 같은 값 + 월세 50)의 `report.required === null`. `DEMO`의 `gu: '관악구'`는 그대로(예시 불변) |
| B3 | 잘라 낸 `lateNote`에 `today`를 주입: 신고 대상(`urgent: true`, 기한 지남) → 과태료 문구 있음 / 확인 필요(`urgent` 없음, 기한 지남) → `''` / 확정일자(`urgent` 없음, 입주일 지남) → `''` / 신고 대상·기한 전 → `''` / 체크됨(`c` 참) → `''` / `legal` 있는 전입신고 갈래 불변. `buildTimeline` 세 갈래 할 일 id가 모두 `'rp'`(체크 기록 유지) |
| B4 | 잘라 낸 `exportObj`에 `S` 주입: 6개 키 포함, `homeless`·`dup`·`sido` 없음 → `JSON.parse(JSON.stringify(o))`에 키가 `null`로 남음, 값 있음 → 그대로, 기존 16개 키 불변. 받는 쪽 루프(`Object.keys(exportObj()).forEach(… if (k in o) S[k] = o[k])`)를 같은 방식으로 돌려 휴대폰 옛 값(`homeless: 'yes'`)이 `null`로 바뀜 |
| B5 | `viewInput` 텍스트에 날짜 순서 줄이 있음 + 순서 판정 식을 잘라 실행: 입주 < 계약 → 안내, 같은 날 → 없음, 입주 > 계약 → 없음, 계약일 비어 있음 → 순서 안내 없음(기존 `err.contract`만). `engine.js` `validate` 결과는 이전과 같음 |
| B6 | `JS.parseAmount` — 데이터 모델 행의 예 전부(정상 `'1억'`·`'1억 2천'`, 경계 `''`·`'1,000'`·`'50만원'`, 예외 `'-1'`·`'1.5억'`·`'이천'`·`'1억원'`·`'만'`). 잘라 낸 `setField`에 가짜 `t`(`dataset.field`, `hasAttribute`)와 `S`·`save`·`JS`·`AMT_NOTE` 주입: `'1억'` → `S.deposit === 10000`·`AMT_NOTE` 없음, `'이천'` → `S.deposit` 이전 값 그대로·`AMT_NOTE.deposit === '이천'`·`save` 미호출, `JS` 없음 → 지금 동작(`'1억'` → 1) |
| B7 | 잘라 낸 `openTasks`에 `today`·`S` 주입: 입주일 지남 → `dueNow`·`upcoming`에 `prep` 단계 할 일 0개 / 입주 전날 → `prep` 할 일 남음 / 입주 당일 → 0개 / 계약일 지남 규칙(`pre`·`cday` 제외) 불변 / `mday`·`report` 할 일은 남음 |
| B8 | 잘라 낸 `resultPlace`에 `S`·`esc` 주입: `gu: '관악구'` → `'관악구 · '` / `gu: ''`·`sido: '충청남도'` → `'충청남도 · '` / `gu: '  '`·`sido` 없음 → `''` / `gu: null`·`sido: null` → `''` / `gu: '<b>'` → `esc` 적용. `viewResult` 텍스트에 `resultPlace() + ageText()`가 1번, `esc(S.gu) + ' · '` 0번 |
| B9 | 잘라 낸 `birthErr`에 `S`·`iso`·`pd`·`realToday`(2026-11-16 고정) 주입: `'2030-01'`·계약 `2026-03-01` → 안내 / `'2026-12'`·계약 `2027-01-01` → 안내(이번 달보다 늦음) / `'2026-05'`·계약 `2026-03-01` → 안내(계약 달보다 늦음) / `'2026-11'`·계약 `2026-12-01` → 없음(경계: 이번 달) / `'2026-03'`·계약 `2026-03-01` → 없음(경계: 계약 달) / `'2000-05'` → 없음 / `S.birth` 빈 값 → 없음 / 이미 `err.birth`(형식 오류) → 문구 그대로 / `err.contract` 있음·`'2030-01'` → 안내(이번 달 기준만). `viewInput`·`viewResult` 텍스트에 `birthErr(err);`가 각 1번. `JE.validate({…birth: '2030-01'})` 결과는 이전과 같음 |
| B10 | `JS.yearDate`: 같은 해 → `null` / 다른 해(앞·뒤) → `'2028.11.10(금)'` 모양 / Date 아님·Invalid Date → `null` / 결과가 `연도 + '.' +` 잘라 낸 app.html `md(d)` 결과와 같음(요일 표 대조). `JS.yearTasks`: 다른 해 미래 → 복사본 `dueText` / 같은 해 → 같은 참조 / 다른 해 과거 → 같은 참조 / `due: null`·`dueText` 있음 → 같은 참조 / `legal` 있음 → `' 권장'` 포함 / 배열 아님 → `[]` / 원본 불변. 잘라 낸 `dueTag`(`S.done`·`today`·`md`·`dday` 주입)로 원본과 복사본의 배지 색이 같고, 글자는 원본 `md(…)` 앞에 연도만 붙은 것과 같음(`'11.10(금) · D-725'` → `'2028.11.10(금) · D-725'`). 정적: `function md(d)`·`function dueTag(t)` 정의 줄 텍스트 불변, `viewMoveout`에 `JS.yearTasks(tasks, today)`, `tlStage`에 `JS.yearTasks(s.tasks, today)`, `moveoutChip`에 `y + '년</span>'` |

### 실측 절차 (브라우저 — 설치 없음)

실행 주체는 각 worktree의 implementer(Browser pane), QA, 메인 세션(Browser pane·Playwright MCP). 로컬 서버: `python -m http.server 8765 --directory demo`. 결과(스니펫 출력 원문·URL·시각·창 크기)를 `.artifacts/verification/T-xx/{실행ID}/`에 저장한다. 창 크기 390×844·1280×800 설정과 움직임 줄이기 에뮬레이션이 그 도구에서 되는지는 미확인 — 안 되면 AGENTS.md "화면 검증 도구 실패 처리" 표대로 메인 세션 확인으로 넘기고 해당 AC를 미검증으로 보고한다.

| 기준 | 방법 | 통과 |
|---|---|---|
| 길이·0.93초 (F-07 ③) | 다른 화면(예: `#home`)에서 해시 이동 직후 스니펫 M1 | 모든 행 `ok: true`, 행 1개 이상 |
| `render(true)` 재생 없음 (F-07 ②) | 등장이 끝난 뒤(1초 대기) 입력·체크(예: 시연 모드 헤더 `[data-sim]` 변경, 타임라인 체크) 직후 M1 | `mo-in`·`mo-fill`·`mo-count`(값이 안 바뀐 것) 0개. 체크 그리기·업로드 배지처럼 그 조작이 의도한 것만 있음 |
| 움직임 줄이기 (F-07 ①) | 줄이기를 켠 상태(아래)에서 `matchMedia('(prefers-reduced-motion: reduce)').matches === true` 확인 후 해시 이동·체크·접기 직후 M1 | 0개, 화면은 최종 상태 |
| 다른 화면 불변 (F-07 ④) | `#home` `#support` `#coach` `#calendar` `#map`에서 `document.querySelector('.mo') === null` + 콘솔 오류 비교 + `git diff main...HEAD -- demo/app.html`의 모든 hunk가 자기 구역 안 | 모두 참 |
| 온보딩 단계 등장 (T-16) | 온보딩 미완료 상태(새 브라우저 프로필 또는 `reset`)에서 `#start` 1단계 → 값 입력 → '다음' 직후 M1, '이전' 직후 M1. 같은 단계에서 입력만 바꾼 직후(1초 대기 뒤) M1 | 다음·이전: `mo-in`(`.ob-card` 직계 자식 수만큼, 지연 0·80·160…)·`mo-start-fill` 1개 이상, 모든 행 `ok: true`. 같은 단계 입력: 0개. 줄이기 켬: 다음·이전도 0개 |
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
    .map(a => { const t = a.effect.getComputedTiming(); return { name: a.animationName || a.id || a.transitionProperty, dur: t.duration, delay: t.delay, end: t.delay + t.duration, iter: t.iterations, ok: t.duration >= 250 && t.duration <= 600 && t.delay + t.duration <= 930 && t.iterations === 1 }; });
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

결정 기록은 [DECISIONS.md](DECISIONS.md)와 [adr/](adr/)에 있다. 이 문서에는 결과만 반영한다. 이번 추가: DECISIONS #9~#18, ADR-0001(모션 구현 방식), ADR-0002(검증 수단). 2026-11-12 추가: DECISIONS #19(모션 토큰 값 대체, T-15), DECISIONS #20·ADR-0003(온보딩 `#start` 편입·단계 등장 판정, T-16), DECISIONS #21(신고 대상 지역 판정표, T-18), DECISIONS #23·ADR-0004(승인 — 시·군·구 소속 판단, T-21). 2026-11-16 추가(T-23, 사용자 확인 대기): DECISIONS #24(금액 칸 억·천 환산 — #7 대체), #25(입주 뒤 입주 준비 할 일 홈 제외), #26(신고 대상 아닐 때 과태료 문구 없음). ADR 없음 — 대안 비교는 사용자 답으로 확정(#21과 같은 처리). 2026-11-16 추가(T-23 B8~B10, 사용자 확인 대기): DECISIONS #27(미래 출생연월은 내 화면 `#input`·`#result`에서 막음 — 공용 나이 함수 불변), #28(올해가 아닌 미래 날짜에 연도 — 내 화면 `#moveout`·`#timeline`만, 공용 `md()` 불변). B8은 T-22 '집' 칸 규칙을 그대로 따르므로 새 결정 없음. 2026-11-16 추가(T-24, 사용자 확인 대기): DECISIONS #29(입력·결과·길잡이 같은 검사 기준 — 공용 검사 `inputErr`, 금액 해석 실패·입주<계약·미래 출생연월 차단). 2026-11-16 추가(T-24 R4, 사용자 확인 대기): DECISIONS #30(S를 통째로 바꾸는 `reset`·`demo`·`startreal`·`restoreJson`에서 금액 안내 `AMT_NOTE` 비우기 — #29 보완, #29 한계 문장은 그대로). 2026-11-16 추가(T-24 R5, 사용자 확인 대기): DECISIONS #31(금액 해석 실패 동안 칸에 저장값 대신 입력 원문 — 공용 `amtVal`, #24 보완). 2026-11-17 추가(T-25~T-28, 사용자 확인 대기): DECISIONS #32(QR 받기 검사 `JS.checkImport` — 확인 창 앞, screens-core 없으면 받지 않음, 통과 시 `migrate`), #33(금액 단위 안내 `JS.amountUnitWarn` — 해석 실패 안내가 있으면 숨김), #34(T-27 `viewHome` 한 줄·T-28 `deviceCards` 본문 구역 예외). ADR 없음 — 대안 비교는 #32 이유 칸.
