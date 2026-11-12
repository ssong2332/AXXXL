# CHANGELOG — {{PROJECT_NAME}}

> 소유자: docs | 형식: [Keep a Changelog](https://keepachangelog.com/ko/) 축약. 최신이 위.

## [Unreleased]

### Added
- 2026-11-12 첫 실행 길잡이(`app.html#start`) 단계 등장 모션 (T-16, PRD F-12, DECISIONS #20, ADR-0003 제안 상태) — 담당 편입 후 `viewStart()` 단계 카드가 차례로 등장, `tests/screen-start.test.js`
- 2026-11-12 계약·신고 화면 디자인 개선과 모션 (T-10~T-13) — 자격 판정(요약·판정 배지·조건 접기), 타임라인(끝난 단계 접기·'지금' 이동·진행 막대·체크 그리기), 퇴거 준비·서류함, 조건 입력·내 계약 화면, `tests/result-screen.test.js`·`screen-timeline.test.js`·`screen-moveout-docs.test.js`·`screen-input-contract.test.js`
- 2026-11-12 계약·신고 6개 화면 모션 기반 (T-09) — 모션 토큰 `JachwiScreens.T`와 순수 함수 `demo/screens-core.js`, `demo/app.html`의 T-09 CSS·JS 구역과 T-10~T-13 구역 마커, `tests/screens-core.test.js`·`tests/screens-zones.test.js` (화면에 보이는 변화는 아직 없음 — 모션 적용은 T-10~T-13)
- 2026-11-12 내 화면 디자인 개선·모션 설계 — PRD F-07~F-11, Architecture, ADR-0001/0002, Tasks T-09~T-14
- 2026-11-11 서류함 지원별 준비 현황 — 승인된 공고의 제출 서류를 서류함 칸과 이어 "청년월세 3 / 5 준비"처럼 표시 (`engine.js` `docSlot`·`docReadiness`, `tests/docs.test.js`)
- 2026-11-11 자격 판정 화면 '답하면 판정' — 무주택·중복 수혜를 아직 안 답했으면 '해당 가능' 대신 표시 (`engine.js` `verdict`)
- 2026-11-11 계약·신고 계산 엔진 `demo/engine.js`(전월세 신고·전입신고·만료·갱신 통지 기한, 만 나이, 입력 검사)와 조건 입력·자격 판정 화면, 무주택·중복 수혜 판정, 테스트 조건 30개 정답표
- 2026-10-27 Claude 전용 스킬 `.claude/skills/cli-delegate/SKILL.md` — Codex·안티그래비티에 작업을 넘기는 CLI 위임 절차(프롬프트는 파일·stdin으로 전달)
- 2026-10-27 AGENTS.md "다른 도구 세션과의 핸드오프" 절 — `.artifacts/handoff/{작업ID}/{실행ID}/`의 prompt.md·report.md 규칙, 메인 오케스트레이터는 Claude Code 세션임을 명시
- 2026-10-27 `.codex/DEVELOPMENT.md`, `.codex/FRONTEND.md`(Codex 개발 보조·UI 지침), `.codex/tests/adapters.test.cjs`(연결 파일·훅 배선 검사)
- 2026-10-27 `.claude/hooks/test-contract-check.js` — contract-check C5 워크트리 제외 회귀 검사
- 2026-10-27 docs/CodingRules.md "검증된 명령어"에 회귀 검사 2행과 위임 CLI 명령 2행 추가
- 2026-10-27 `.gitignore`에 `.artifacts/handoff/` 추가
- 2026-10-27 AGENTS.md "메인 세션과 서브에이전트 구분" 절 — 수행 주체 판정표(7행)와 단계별 적용 결과(인터뷰·기획/설계·구현·리뷰/QA/문서화)
- 2026-10-27 `.claude/hooks/test-contract-check.js`에 C5의 `.artifacts/` 제외 회귀 검사 추가
- 2026-10-27 docs/HarnessAudit.md "구성요소 유지·삭제 판정표"
- 2026-10-27 docs/CodingRules.md "검증된 명령어"에 Codex stdin 위임 명령(`-m`·`-o` 포함, 종료 코드 0 실측) 1행 추가
- 2026-10-27 AGENTS.md "사용자 화면 확인" 규칙 — 화면 확인은 사용자가 보는 Browser pane에서 하고 마지막 화면을 닫지 않고 남김, 리뷰·QA 통과 뒤 메인 세션이 `사용자 확인: 통과/보류/미요청 — 사유`를 기록
- 2026-10-27 AGENTS.md "앱 서브 세션 (Claude 데스크톱 앱)" 절 — 생성·보고·검증·제공·정리 5단계(정리는 보관이 기본, 영구 삭제는 명시 지시 시만)
- 2026-10-27 docs/DefinitionOfDone.md에 사용자 확인 기록 항목 추가(planner "완료" 전환 조건, 검증중 전환 조건 아님)
- 2026-10-27 implementer·QA 보고 템플릿에 "남긴 화면" 행 추가
- 2026-10-27 AGENTS.md 검증 루프에 "화면 흐름 회귀" 행 — 웹 UI의 PRD 핵심 사용자 흐름은 E2E 회귀 테스트를 Red-First로 두고, 세션 중 실물 확인과 서로 대신하지 않음(러너를 쓰지 않으면 사유를 Architecture에 기록)
- 2026-10-27 docs/DefinitionOfDone.md에 웹 UI E2E 회귀 항목 추가
- {{DATE}} 프로젝트 초기화 (start_coding 템플릿)

### Changed
- 2026-11-12 모션 강도 조정 (T-15, DECISIONS #19, 사용자 답 "더 눈에 띄게") — 이동 8px→20px, 기본 300ms→450ms, 차례 간격 80ms(최대 6단), 전체 상한 930ms. 대상은 `JachwiScreens.T`와 `demo/app.html` CSS
- 2026-11-12 README "현재 상태"를 "소스 코드 없음"에서 실제 데모 구현 상태로 고치고 단위 테스트 명령 추가
- 2026-11-12 테스트 256/256 통과 (`.artifacts/verification/T-14/` main 병합 후 실행)
- 2026-11-12 Architecture R3 문구 정리, Tasks T-09 완료 전환
- 2026-11-11 서류함을 `app.html#docs` 한 곳으로 통합 — `index.html#docs`는 서류함으로 가는 안내만 남김
- 2026-11-11 README 주요 기능의 타임라인을 실제 화면대로 7단계로 고침 (DECISIONS #8)
- 2026-10-27 역할 단일 원본을 `.agents/roles/*.role.md`로 통합 — `.claude/agents/*.md`와 `.codex/agents/*.toml`은 원본을 가리키는 연결 파일로 축소
- 2026-10-27 `.codex/EXECUTION.md`·`.agents/skills/vibe-mode/SKILL.md`·`docs/ToolPacks.md`·`docs/KitFeedback.md` 갱신, AGENTS.md 문서 소유권 표에 새 경로 반영
- 2026-10-27 `.claude/hooks/contract-check.js` C5 플레이스홀더 검사가 `.claude/worktrees/`를 제외
- 2026-10-27 `.claude/hooks/contract-check.js` C5 플레이스홀더 검사가 `.artifacts/`도 제외(Git 제외 증거·핸드오프 보관소)
- 2026-10-27 `.claude/hooks/README.md`·`test-guards.js` 헤더·AGENTS.md "강제 장치" 표에 `confirm-agy-delegate.js` 확인 훅 반영
- 2026-10-27 `.agents/skills/vibe-mode/SKILL.md` 완료 판정 상태값 `done` → `완료`(Tasks.md 상태값과 일치)
- 2026-10-27 `docs/UpdateRequests.md` 규칙 문장에서 AGENTS.md 문서 소유권 표와 모순되던 implementer 비교 구절 제거
- 2026-10-27 `.agents/skills/idea-interview/SKILL.md` 인터뷰 수행 주체를 Claude Code 메인 세션으로 명시
- 2026-10-27 AGENTS.md 핸드오프 "상태 전환" 행에 "받은 역할이 planner여도 같다" 보완
- 2026-10-27 `.claude/skills/cli-delegate/SKILL.md` Codex stdin·`-o` 조합 검증 상태를 실측됨으로 갱신
- 2026-10-27 README: 인터뷰 시작 주체를 Claude Code 메인 세션으로 정정, hooks 구조 설명에 확인 훅 반영, 수행 주체 절 참조 추가
- 2026-10-27 안티그래비티 가드(`scripts/agy-guard.js`, `.agents/hooks.json`): `read_file`/`write_file`/`edit_file` 도구와 `Path` 인자의 환경 파일 접근 차단, `-nm`·`-mn` 같은 `-n` 단축 플래그 묶음(커밋 명령 대상) 우회 차단. `scripts/test-agy-hook-cwd.js` 확장
- 2026-10-27 AGENTS.md 핸드오프 표 "리뷰·QA 통과" 행: planner(완료 전환) → docs 앞에 메인 세션의 사용자 확인 단계 추가
- 2026-10-27 AGENTS.md "고정 첫 작업"(T-01): 웹 UI 프로젝트면 dev 서버 실행 설정(Claude Code는 `.claude/launch.json`) 포함
- 2026-10-27 implementer·QA 역할 원본 화면 확인 단계: 사용자가 보는 브라우저 패널에서 확인하고 마지막 화면을 남김. `.claude/agents/implementer.md`·`quality-assurance.md`에 `.claude/launch.json` 이름으로 `preview_start` 안내 추가
- 2026-10-27 AGENTS.md "고정 첫 작업"(T-01): 웹 UI 프로젝트면 Architecture가 정한 E2E 러너 설정과 E2E 스모크 테스트 1개 포함
- 2026-10-27 implementer·QA 역할 원본 4단계와 보고 표에 E2E 회귀 확인 추가

### Fixed
- 2026-11-12 내 계약 첫 진입 시 QR 압축 완료 후 화면 전체가 다시 그려져 등장 모션이 끊기던 문제 수정 (T-17) — QR 자리만 교체, 공용 encoded·캘린더 폰 연동은 미수정. 테스트 263/263 (`.artifacts/verification/T-17/`), 커밋 82987f7

### Removed
- 2026-10-27 `scripts/pipeline.ps1`, `scripts/orchestrator.ps1`, `.agents/role-map.yaml` 삭제(자동 오케스트레이션 폐기, Claude 중심 + CLI 위임 방식으로 전환). 위임 CLI 명령은 docs/CodingRules.md로 이전
