# ADR-0002: 모션·화면 기준 검증 수단

> 상태: 승인 (2026-11-11, 사용자 답 "둘 다 승인 (Recommended)")
> 날짜: 2026-11-11

## 맥락

- 검증할 기준: F-07 ①(움직임 줄이기 시 모션 없음) ②(`render(true)` 시 등장 재생 없음) ③(각 0.2~0.4초, 차례 등장 전체 0.6초 이하) ④(다른 화면 불변), N-04(반복 모션 0개), N-05 회귀, F-08~F-11 화면 기준(높이·배지·접기·고정 버튼).
- 실행환경(2026-11-11 메인 세션 관찰, 인용): Node v22.14.0, `node --test "tests/*.test.js"` 133개 통과, Playwright 미설치(`npx --no-install playwright --version` → "npm error npx canceled due to missing packages …"), 저장소 루트 package.json 없음, 패키지 추가 설치 허용 범위 **미확인**. 메인 세션에 Browser pane과 Playwright MCP(대화형), implementer에 Browser pane.
- 기존 결정 #5: E2E 러너(Playwright)를 두지 않고 Browser pane 실물 확인으로 대신(vibe 모드 사유). AGENTS.md는 E2E를 안 쓰면 사유를 Architecture에 기록하라고 한다.

## 검토한 대안

| 대안 | 장점 | 단점 |
|---|---|---|
| A. `node:test` 정적 검사(app.html 텍스트: 구역 마커·`.mo` 범위·no-preference 안 선언·토큰만 사용·466줄 불변·반복 0) + 순수 함수 단위 테스트 + 브라우저 실측 스니펫(`document.getAnimations()`의 `getComputedTiming()`) | 설치 없음, 지금 바로 Red-First 가능, 길이·상한·반복은 정적·실측 두 겹 | 화면 흐름 자동 회귀가 없어 실측은 사람·에이전트가 매번 수행, 움직임 줄이기 실측은 OS 설정·DevTools 조작이 필요(사용자 협조) |
| B. 저장소에 `@playwright/test` 설치 + 브라우저 내려받기, `emulateMedia({ reducedMotion: 'reduce' })`·뷰포트 390×844로 자동 E2E | 움직임 줄이기·높이·`render(true)` 재생 없음을 반복 자동 검증, CI에 붙일 수 있음 | **설치 필요 — 사용자 승인 필요**(허용 범위 미확인), 루트 package.json 신설, 브라우저 바이너리 수백 MB, 마감(11/17) 전 하네스 구축 비용, 결정 #5 변경 필요 |
| C. jsdom으로 Node에서 DOM 테스트 | 브라우저 없이 DOM 구조 검사 | 설치 필요, CSS 애니메이션·레이아웃·`matchMedia`를 실제로 계산하지 않아 핵심 기준을 못 검증 |

## 결정

A를 택한다(DECISIONS #17). 결정적 이유: 설치 허용 범위가 미확인인 상태에서 설치에 의존하는 선택을 확정할 수 없고(AGENTS.md 실행환경 표), A만으로 F-07 ①~④·N-04의 각 기준에 자동(정적) 또는 실측 증거를 하나 이상 붙일 수 있다.

B는 거절이 아니라 **보류**다. 사용자가 설치를 허용하고 자동 E2E를 원하면 새 결정 행과 새 ADR로 결정 #5·#17을 대체한다(승인된 기존 행은 수정하지 않음).

## 결과 (트레이드오프 포함)

- 얻는 것: T-09가 설치 없이 Red-First로 시작(정적 검사가 먼저 실패 → 블록 추가 후 통과). T-10~T-13 모두 같은 정적 검사를 계속 통과해야 하므로 구역·범위 위반이 회귀 테스트에서 걸린다.
- 감수하는 것: 화면 흐름 회귀는 자동이 아니다 — 각 작업과 T-14에서 실측 스니펫·높이 측정 증거를 `.artifacts/verification/`에 남겨야 한다. 움직임 줄이기 실측은 사용자 기기 설정 또는 DevTools 조작이 필요하며, 불가하면 해당 AC는 미검증으로 보고한다. 창 크기 변경 가능 여부는 도구별로 미확인이다.
