# ADR-0001: 계약·신고 6개 화면 안 모션 구현 방식

> 상태: 승인 (2026-11-11, 사용자 답 "둘 다 승인 (Recommended)")
> 날짜: 2026-11-11

## 맥락

- PRD F-07~F-11·N-04: 박수홍 담당 6개 화면(`#input` `#result` `#timeline` `#contract` `#moveout` `#docs`) 안에만 차분한 모션(0.2~0.4초, 차례 등장 전체 0.6초 이하, 이동 짧게)을 넣는다. 사용자 답 "내 화면 안 모션만 (Recommended)", "차분하게 (Recommended)", "공통 모션이 뭐야 나는 내 화면에서만 모션을 넣을 건데" → "추천으로 진행하자."
- 구조 제약(진단 `.artifacts/design-diagnosis/diagnosis.md`): 공용 `render(keep)`(app.html 2459~2481줄)가 화면 전체를 `innerHTML`로 다시 만든다. 입력 한 칸에도 `render(true)`가 돌기 때문에 등장 모션을 그냥 붙이면 입력할 때마다 다시 재생된다. `render()`·헤더·탭은 다른 팀원 화면도 쓴다.
- 공용 466줄 `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }`는 바꾸지 않는다(OQ #6).
- 네 화면 묶음(T-10~T-13)이 별도 worktree에서 같은 app.html을 동시에 고친다.

## 검토한 대안

| 대안 | 장점 | 단점 |
|---|---|---|
| A. 화면 루트 `<div class="mo mo-{화면}">` 범위 + CSS 애니메이션 + view 안에서 `last !== 화면`으로 등장 판정 + 순수 함수는 새 파일 `screens-core.js` | `render()` 0줄 수정, 범위가 클래스로 기계 검사 가능, 설치 없음, 단위 테스트 가능 | `render()`의 내부 변수 `last`에 기대므로 누가 `render()`의 `last` 갱신 순서를 바꾸면 깨진다(정적 테스트로는 못 잡음 — 리뷰 대상). 첫 로드 직후 비동기 `render(true)`가 등장을 끊을 수 있음 |
| B. `render()`에 2줄 추가해 `keep` 값을 `app.dataset`·전역에 기록 | 등장 판정이 `keep`과 정확히 일치 | 공용 함수 수정 — 다른 팀원 화면과 병합 충돌 위험, PRD "render 전환 방식 불변"에 가까운 영역 |
| C. 키 기반 DOM 비교(morphdom 등)로 `innerHTML` 재생성 대체 | 바뀐 요소만 갱신돼 모션이 자연스러움 | 공용 렌더 구조 교체 — 전 화면 영향, 라이브러리 추가(설치 허용 미확인) |
| D. 외부 애니메이션 라이브러리(GSAP 등, CDN) | 표현력 | 차분한 모션에 과함, 외부 로드 추가, 움직임 줄이기 처리를 따로 해야 함 |
| E. View Transitions API 화면 전환 | 화면 이동 모션 | PRD 범위 제외(M1 화면 이동 모션은 팀 합의 뒤) |

## 결정

A를 택한다. 결정적 이유: 공용 `render()`를 한 줄도 바꾸지 않고 내 6개 화면 안에서만 등장/재그리기를 구분할 수 있다(`render()`는 view 호출 뒤 2480줄에서 `last`를 갱신).

세부(DECISIONS #9~#14·#18):
- 범위: 모든 새 CSS 선택자는 `.mo`로 시작, keyframes는 `mo-` 접두사.
- 움직임 줄이기: 모션 선언은 전부 `@media (prefers-reduced-motion: no-preference)` 안. JS 모션은 `matchMedia` 확인 뒤 실행.
- 접기: `grid-template-rows` 0fr↔1fr 전환, `render` 없이 클래스 토글, 상태는 메모리.
- 렌더 뒤 작업(카운트·스크롤)은 `requestAnimationFrame` 1회, 카운트 시계는 Web Animations API.

## 결과 (트레이드오프 포함)

- 얻는 것: 다른 팀원 화면 동작 불변을 정적 테스트(선택자 접두사·466줄 문자열·구역 마커)와 `git diff` 구역 확인으로 보일 수 있다. 네 worktree가 구역 마커로 나뉘어 병합 충돌이 줄어든다.
- 감수하는 것: ① `last` 의존 — `render()`가 바뀌면 T-09 보완이 필요하다. ② 첫 로드 직후 비동기 재그리기가 등장 모션을 끊을 수 있다(최종 상태는 보임 — 재생 안 함 규칙과 일치). ③ `innerHTML` 재생성 때문에 "방금 바뀐 것"의 모션은 직전 값 기억(`moChanged`)으로만 가능하다. ④ 새 파일 `screens-core.js`가 오프라인 캐시에 없으면 모션 없이 동작한다(sw.js 미수정).
