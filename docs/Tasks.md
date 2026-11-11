# Tasks — 자취 계약 내비 (계약·신고 영역)

> 소유자: planner | 최종 수정: 2026-11-11
> vibe 모드 — 메인 세션이 직접 상태를 바꾼다 (.agents/skills/vibe-mode/SKILL.md 3단계 완료 판정).

## 상태 판정표

| 상태 | 의미 | 전환 주체·시점 |
|---|---|---|
| 대기 | 착수 전 | 초기값 |
| 진행 | 구현 중 | 착수 시 |
| 완료 | Red 출력 + 테스트 출력 + (화면이면) 실물 확인 + 범위 밖 diff 없음 | vibe 모드 완료 판정 충족 시 |
| 보류 | 사용자 결정 대기 (Open Question 번호 기재) | 메인 세션 |

완료 판정은 임의로 하지 않는다 — 근거 열이 비어 있으면 완료로 표시 금지.

## 작업 목록

T-01은 고정 첫 작업이다 — T-01 완료 전 T-02 이후 작업 착수 금지.

| ID | 작업 | 관련 요구사항 | 선행 | 상태 | 근거 |
|---|---|---|---|---|---|
| T-01 | 테스트 하네스 (node:test + 스모크 1개 + 검증된 명령어 등록) | 전체 | — | 완료 | Red `.artifacts/verification/T-01/20261111-141616-red2` (engine.js 없음, fail 1) → Green `.artifacts/verification/T-01/20261111-141627-green` (pass 1, 종료 코드 0). 화면 변경 없음 |
| T-02 | 규칙(`demo/rules.js`)·계산(`demo/engine.js`) 분리, 신고·자격·기한 단위 테스트 | F-02, F-03, F-04, F-05 | T-01 | 완료 | Red `.artifacts/verification/T-02/20261111-141739-red2` (fail 22) → Green `…/20261111-141806-green` (pass 23) → Refactor `…/20261111-141915-refactor` (pass 54). 화면 변경 없음 |
| T-03 | 테스트 조건 30개 정답표 | N-01 | T-02 | 완료 | `.artifacts/verification/T-03/20261111-141856-run1` 1건 불일치 — 원인은 정답표 26번 손계산 오류(early), 정답표 수정 → `…/20261111-141905-run2` pass 54 (정답표 30/30). 엔진이 먼저 있어 Red 선행 아님 — 검증표 |
| T-04 | app.html에 조건 입력·자격 판정 새 화면, 기존 화면이 엔진 사용 | F-01, F-02, F-03, N-02, N-03 | T-02 | 진행 | 회귀 `.artifacts/verification/T-04/20261111-142228-regression` pass 54. 실물 확인 `.artifacts/verification/T-04/20261111-1422-browser/meta.md`. 화면 자동 테스트 없음(DECISIONS #5) — 사용자 화면 확인 대기 |
| T-05 | 퇴거 준비 날짜를 엔진으로, 서류함 하나로 통합 | F-05, F-06 | T-02 | 진행 | 퇴거·타임라인 갱신 통지 마감을 엔진 `renewDue`로 교체(T-04와 같은 diff). 서류함 통합(index.html 쪽 정리)은 미착수 |
| T-06 | main(이성준 님 rules-core) 병합: 자격은 rules-core, 신고·기한은 engine.js, 온보딩 4단계에 출생연월·무주택·유사 수혜 | F-01~F-05 | T-04 | 진행 | 단위 `.artifacts/verification/T-06/20261111-150508-final` 80개 중 pass 73·fail 0·todo 7(무주택·중복 수혜 — rules-core 보강 필요). 실물 확인 `.artifacts/verification/T-06/20261111-browser/meta.md`. 병합 커밋 전 |
