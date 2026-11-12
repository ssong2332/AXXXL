# ADR-0003: 온보딩 `#start` 단계 이동을 등장으로 판정하는 위치

> 상태: 승인 (2026-11-12, 사용자 답 "승인 (Recommended)")
> 날짜: 2026-11-12

## 맥락

- 사용자 답 원문(2026-11-12, 메인 세션 전달): "이 정도면 되고, 내가 담당하는 걸로 하자 그냥 진행해" — 첫 실행 길잡이(온보딩, `#start`)를 내 화면으로 편입하고 모션을 적용한다(Tasks T-16, PRD F-12).
- 온보딩은 한 라우트(`start`) 안에서 `S.obStep` 1~4를 '다음'(`obnext`)·'이전'(`obprev`) → `render(false)`로 바꾼다. `render()`는 view 호출 뒤 `last = r`로 갱신하므로 단계 이동 때 `last === 'start'`다.
- 기존 규칙(DECISIONS #10, ADR-0001): 등장 = `JS.isEnter(last, screen)` = `last !== screen`. 이것만으로는 단계 이동이 등장이 아니다.
- 제약: 공용 `render()` 수정 금지(Architecture 금지 #1), T-09 블록은 승인·병합된 기반이고 정적 검사가 블록 구성을 고정한다(`tests/screens-zones.test.js`), 같은 단계 `render(true)` 재생 없음(F-07 ②), 움직임 줄이기 0개(F-07 ①).

## 검토한 대안

| 대안 | 장점 | 단점 |
|---|---|---|
| A. T-09 블록의 `moBegin(screen, sub)`에 선택 인자를 추가하고 `MO`에 직전 키 필드 추가 | 등장 판정이 한 함수에 모임 | 승인된 T-09 구역 수정 → 6개 화면 전체 회귀 범위, Architecture "T-09 구역 수정은 T-09 보완 재작업" 규칙과 충돌, `MO` 규격·정적 검사(`var MO = { prev, open, enter, jobs }`) 변경 필요 |
| B. 순수 함수 `JS.stepEnter(last, prevKey, screen, key)`(screens-core T-16 구역) + app.html 새 T-16 JS 블록의 `moBeginStep(screen, step)`이 `moBegin`을 부른 뒤 `MO.enter[screen]`만 넓힘 | T-09 블록·`render()`·`MO` 규격 0줄 수정, 판정 규칙을 `node:test`로 단위 검사 가능, 기존 6개 화면 동작 불변 | 등장 판정이 두 곳(T-09 `moBegin` + T-16 `moBeginStep`)에 나뉨, `MO.enter`를 T-16이 덮어씀(의미는 같음: 화면 등장 여부) |
| C. 순수 함수 없이 `viewStart` 안에서 직접 `MO.enter.start`를 계산 | 코드 최소 | 판정 규칙을 Node에서 단위 검사할 수 없음, view에 모션 상태 로직이 섞여 view 수정 범위("호출 추가만")를 넘음 |

## 결정

B. 결정적 이유: 승인된 T-09 기반과 6개 화면의 동작·검사를 건드리지 않고, 새 판정 규칙을 순수 함수로 단위 검사할 수 있다.

## 결과 (트레이드오프 포함)

- 얻는 것: `render()`·T-09 블록 수정 0줄. 같은 단계 `render(true)`·`render(false)`는 키가 같아 재생 없음. 움직임 줄이기는 `moRoot`·no-preference 규칙 그대로라 0개.
- 감수하는 것: `moBeginStep`이 `moBegin` 뒤에 `MO.enter[screen]`을 다시 쓰므로, 나중에 `moBegin`의 등장 판정을 바꾸면 T-16도 함께 확인해야 한다. 단계 키 메모리(`moSubKey`)는 새로고침 시 사라지지만 그때는 `last === ''`라 어차피 등장이다.
- 등장 시 보이는 모션(F-12 ②③, 2026-11-12 메인 세션 결정 — 사용자 원문 "더 눈에 띄게", "그냥 진행해" 근거): `viewStart` 마크업·클래스는 바꾸지 않고, T-16 CSS가 `.mo-start[data-mo-enter] .ob-card > *`에 T-09 keyframes `mo-in`을 걸고 `:nth-child(2~6)`에 `calc(var(--mo-step) * 1~5)`, `:nth-child(n+7)`에 `* 6` 지연을 줘 제목·설명·입력칸·안내 띠·버튼 줄이 차례로 올라온다. 끝 시각 ≤ 930ms(현재 자식 최대 5개라 770ms). 4칸 진행 표시 현재 칸은 `mo-start-fill`.
- 정적 검사 `tests/screens-zones.test.js`의 CSS 구역 범위를 T-16 끝까지 넓히고 T-16 JS 블록 위치를 고정한다(Architecture "정적 검사 — T-16 확장").
