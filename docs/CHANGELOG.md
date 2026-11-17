# CHANGELOG — {{PROJECT_NAME}}

> 소유자: docs | 형식: [Keep a Changelog](https://keepachangelog.com/ko/) 축약. 최신이 위.

## [Unreleased]

### Added
- 2026-11-17 QR 받기(`#import=`) 계약 값 형식 검사 (T-25, PRD F-13, DECISIONS #32) — `demo/screens-core.js` `checkImport`가 값 형식을 검사해 하나라도 틀리면 받지 않고 'QR 정보를 읽지 못했어요.'만 보임(기존 값·저장 불변). 통과하면 덮어쓴 뒤 `migrate(S)`. `demo/app.html` `boot()`, `tests/t25-import-check.test.js`. 미검증 수용: 정상 QR '바꾼다' 승낙 후 덮어쓰기 실물(Browser pane이 confirm 창을 막는 환경 제약, 단위 테스트로 확인) 등 — Tasks.md T-25 행 기준
- 2026-11-17 조건 입력 금액 단위 안내 (T-26, PRD F-14, DECISIONS #33) — 보증금 20억 원(200000만 원) 초과·월세 1000만 원 초과면 입력 칸 아래 '만 원 단위가 맞나요?' 안내(`amountUnitWarn`). `demo/screens-core.js`, `demo/app.html` `viewInput`, `tests/t26-amount-unit.test.js`. 미검증 수용: 390×844 레이아웃·가로 넘침 — Tasks.md T-26 행 기준
- 2026-11-17 로그인한 PC는 내 계약 '휴대폰으로 이어서 보기'에 QR 대신 계정 안내 (T-28, PRD F-15) — 로그인 상태에서 '휴대폰에서 같은 계정으로 로그인하면 그대로 이어져요.'만 보이고 QR을 만들지 않음. 로그인 꺼짐·미로그인·휴대폰은 기존과 같음. `demo/app.html` `deviceCards`, `tests/t28-contract-login-qr.test.js`. 미검증 수용: 로그인 상태 실물 화면·로그인/로그아웃 직후 재그리기(로컬에 로그인 설정 없음, 단위 테스트로 갈래 확인) — Tasks.md T-28 행 기준
- 2026-11-16 자취 계약 화면 PR #66 리뷰 반영 5건 (T-24, DECISIONS #29~#31) — R1 금액을 못 읽는 동안 조건 입력 '판정 보기' 비활성·자격 판정 직접 이동 차단·첫 실행 길잡이 2단계 '다음' 차단, R2 자격 판정에서도 입주일이 계약일보다 앞서면 차단, R3 길잡이 완료 때 미래 출생연월 차단, R4 예시 값 되돌리기·예시 데이터·새로 시작·파일 불러오기 때 금액 안내 초기화, R5 못 읽은 금액은 칸에 입력한 글자 그대로 표시. 변경 파일 `demo/app.html`, `tests/t23-bugfix.test.js`, `tests/t24-review.test.js`(신규) (커밋 d82569a·82e2159·5de968f)
- 2026-11-16 자취 계약 화면 버그 10건 수정 (T-23, 팀 단톡방 지적 + 배포 사이트 점검, DECISIONS #24~#28) — B1 길잡이 기본 지역 '관악구' 제거, B2 2단계 신고 안내가 지역 미선택이면 '확인 필요', B3 신고 대상이 아니면 확정일자·신고 확인 할 일에서 과태료 문구 제거, B4 QR 이어 보기에 sido·zip·sgg·birth·homeless·dup 포함, B5 조건 입력 입주일이 계약일보다 앞서면 안내, B6 금액 '1억 2천'을 12000(만 원)으로 환산하고 해석 불가면 저장 없이 안내(#7 대체, #24), B7 입주일이 지나면 입주 준비 할 일을 홈 '다음 할 일'에서 제외(#25), B8 자격 판정 머리 줄 지역이 없으면 구분점 생략, B9 미래 출생연월은 안내하고 판정 안 함(#27), B10 퇴거 준비·타임라인에서 올해가 아닌 미래 날짜에 연도 표시(#28). 변경 파일 `demo/app.html`, `demo/screens-core.js`, `tests/t23-bugfix.test.js`(51개 추가), `tests/screen-timeline.test.js` (커밋 dfdab60, d5155d9)
- 2026-11-16 내 계약 '집' 칸 빈 구분점 제거 (T-22, PRD F-11 범위 안 결함 수정, 사용자 답 "네, 고쳐") — 시·도만 고르면 "내 자취방 · "처럼 점 뒤가 비던 표시를 시·군·구 > 시·도 > 없음 순으로 지역을 보이고 지역이 비면 " · "를 붙이지 않게 고침. `demo/screens-core.js` 순수 함수 `homeLabel` 추가, `demo/app.html` viewContract '집' 칸이 이를 사용(screens-core.js를 못 불러오면 집 이름만 표시), `tests/screen-input-contract.test.js` 테스트 7개 추가
- 2026-11-13 PRD F-09 ① 예외 추가 — '지금' 단계는 할 일을 다 끝내도 펼친 채 둠 (사용자 답 "지금처럼 펼침 유지"). 조건 입력 빈 값·첫 실행 길잡이 날짜 빈 값은 관찰 메모로만 기록 (`docs/PRD.md`)
- 2026-11-12 조건 입력 지역 선택을 서울 25개 구에서 전국 시·도/시·군·구로 확장 (T-20, PRD F-01, 사용자 원문 "내 작업이면 하고 아니면 하지마") — `demo/app.html` 조건 입력의 시·군·구 칸을 공용 `regionFields()` 호출로 교체, `tests/screen-input-contract.test.js`
- 2026-11-12 전월세 신고 지역 판정 보완 (T-21, PR #37 리뷰 반영, PRD F-02, DECISIONS #23, ADR-0004 승인 — 사용자 답 "승인 (Recommended)") — `demo/engine.js` `reportArea`에 7개 도(충북·충남·경북·경남·강원·전북·전남광주) 시·군·구 이름 표 136개 추가(`reportAreaSgg`로 노출, `demo/data/regions.js`와 일치하는지 테스트), 시·군·구 미선택·시·도 불일치는 '확인 필요'(null). `demo/app.html`: 지역 선택에서 시·도만 바꾸면 `S.gu`를 비움, 내 계약 '전월세 신고' 칸을 기한/대상 아님/확인 필요로 구분, `qaAnswer`의 신고·확정일자 답을 false(이유는 `rep.reason`)/null로 구분. `tests/report-area.test.js`, `tests/screen-input-contract.test.js`
- 2026-11-12 전월세 신고 대상 지역 전국 판정 (T-18, PRD F-02, DECISIONS #21, 팀원 요청 "수홍님: 지역이 전국으로 바뀌었는데 전월세 신고 판정이 서울만 돼요. 부산 같은 광역시도 대상 지역이라 엔진에서 같이 봐 주시면 좋겠어요") — `demo/engine.js` `reportArea(sido, gu)` 추가(시행령 제4조의3 기준: 광역시·경기·세종·제주 전역, 일반 도는 시·구만 대상이고 군은 제외, 강원·전북·전남광주의 군은 '확인 필요'(null)), `deadlines`가 이를 사용. `demo/app.html` 자격 판정 카드·타임라인·첫 실행 길잡이 2단계에 '확인 필요' 안내 추가(사용자 답 "확인 필요로 (Recommended)"), 리뷰 권고에 따라 reason을 `esc` 처리. `tests/report-area.test.js`·`screen-timeline.test.js` 등
- 2026-11-12 첫 실행 길잡이(`app.html#start`) 단계 등장 모션 (T-16, PRD F-12, DECISIONS #20, ADR-0003 승인 2026-11-12) — 담당 편입 후 `viewStart()` 단계 카드가 차례로 등장, `tests/screen-start.test.js`
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
- 2026-11-17 테스트 474/474 통과 (T-25~T-28, 이전 423/423, QA 증거 `.artifacts/verification/T-25/qa-20261117-1/`), 사용자 화면 확인 T-26·T-27·T-28 통과 기록(Tasks.md)
- 2026-11-17 홈 '남은 납부' 카드 납부 항목 이름을 `esc`로 이스케이프 (T-27, 보안 결함 수정 — `<b>` 같은 이름이 태그로 그려지던 문제). `demo/app.html` `payH`, `tests/t27-home-pay-escape.test.js`. 미검증 수용: 390×844 레이아웃 — Tasks.md T-27 행 기준
- 2026-11-16 테스트 423/423 통과 (T-24, 이전 398/398), 사용자 화면 확인 통과("통과, push까지")
- 2026-11-16 테스트 398/398 통과 (T-23, origin/main #64 병합분 포함, 이전 345/345), 사용자 화면 확인 통과("통과, PR까지")
- 2026-11-16 테스트 312/312 통과 (T-22, `.artifacts/verification/T-22/20261114-regress2/`, QA `20261114-qa` 311/311), 사용자 화면 확인 통과("통과, PR까지")
- 2026-11-13 T-05(서류함 통합)·T-08('답하면 판정') 현 main 기준 재검증·완료 (리뷰 치명 0, QA 통과, 사용자 답 "통과, T-14 진행")
- 2026-11-13 T-14 통합 검증 완료 — 내 화면 7개를 휴대폰 390·PC 1280에서 확인(움직임 줄이기, 모션 길이, T-17 회귀, 서류 올림·지움, 지역 선택 포함), 테스트 300/300·정답표 30/30, 코드 변경 없음, 증거 `.artifacts/verification/T-14/` (사용자 답 "통과, PR까지")
- 2026-11-12 테스트 300/300 통과 (T-20·T-21, `.artifacts/verification/T-21/20261112-164428-green`, QA `20261112-1700-qa`), 사용자 화면 확인 통과("통과, PR에 올려")
- 2026-11-12 퇴거 준비 '나가기 전 할 일'에서 '입주 사진과 비교하며 집 점검'(o2)도 날짜 숨김 (T-19, PRD F-10 ①, DECISIONS #22, 사용자 답 "같이 없애기 (Recommended)") — 날짜는 '중요한 날짜'에만 표시. `demo/app.html`, `tests/screen-moveout-docs.test.js`
- 2026-11-12 테스트 287/287 통과 (T-18·T-19, `.artifacts/verification/T-18/20261112-161909-green4`), 사용자 화면 확인 통과("통과, PR까지")
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
