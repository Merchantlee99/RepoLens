# Plan.md — RepoLens MVP

## Milestones

### M1: Harness and project grounding

- Goal: RepoLens 프로젝트에 Codex-native harness를 이식하고 제품 문서를 현재 범위에 맞게 고정한다
- In scope: root docs, `.codex/**`, `scripts/harness/**`, `templates/**`, `tests/**`
- Out of scope: app UI 구현, repo analyzer 구현
- Validation: harness self-test, unit tests, bootstrap adopt-project
- Done-when: RepoLens 저장소가 Codex harness project profile로 동작한다

### M2: Analysis engine v0

- Goal: public repo에 대해 사실 기반 분석 파이프라인을 만든다
- In scope: repo resolve, SHA lock, archive fetch, file tree parsing, stack detection, layer grouping, key file ranking, edit guide lite generation
- Out of scope: AI 설명, precise flow analysis, monorepo deep support
- Validation: sample repos against expected structured output
- Done-when: `RepoAnalysis` JSON을 생성할 수 있다

### M3: Result workspace v0

- Goal: 분석 결과를 초보자용 학습 화면으로 렌더링한다
- In scope: Landing, Analyzing, Result Workspace, Overview, Architecture, Key Files, Edit Guide Lite
- Out of scope: AI chat, advanced node editor UX, collaborative features
- Validation: manual UX walkthrough with sample analyses
- Done-when: 핵심 네 질문에 답하는 화면 흐름이 완성된다

## Ordered Slices

| # | Slice | Owner | Paths | Validation |
|---|-------|-------|-------|------------|
| 1 | Harness adoption and doc seeding | main | root docs, `.codex/**`, `scripts/harness/**`, `tests/**` | self-test + unittest |
| 2 | Repo analysis schema and ingest layer | main | future app/backend analyzer paths | schema review + fixture validation |
| 3 | Result workspace UI shell | main | future app/frontend paths | manual walkthrough |
| 4 | Analyzer-to-UI integration | main | future app shared paths | end-to-end sample repo test |
| 5 | Content-aware analysis Phase A foundation | main | `lib/analysis/**`, `tests/**`, root docs | selector tests + analyzer build validation |
| 6 | Focus-scoped layer output for Result canvas | main | `lib/analysis/**`, `tests/**`, root docs | layer regressions + live analyze validation |
| 7 | Semantic signal extraction from representative files | main | `lib/analysis/**`, `tests/**`, root docs | semantic tests + live regression validation |
| 8 | README-first Result UI realignment | main | `components/**`, `tests/**`, root docs | view-model tests + lint/build validation |
| 9 | Tabbed Result views with structure diagram MVP | main | `components/**`, `tests/**`, root docs | diagram view-model tests + lint/build validation |
| 10 | Left-panel Result navigation and summary-strip refinement | main | `components/**`, `tests/**`, root docs | view-model tests + lint/build/dev QA |
| 11 | Dynamic layer/status navigation and unclassified-code fallback | main | `components/**`, `lib/analysis/**`, `tests/**`, root docs | analyzer/view-model tests + lint/tsc/build |
| 12 | Inspectable Code fallback and fallback-file drill-down | main | `components/**`, `tests/**`, root docs | result view-model tests + lint/build |
| 13 | Unclassified-code semantic hints and broader fallback evidence | main | `lib/analysis/**`, `components/**`, `tests/**`, root docs | tsc + analyzer/view-model tests + lint/build |
| 14 | Diagram-input quality: representative files, weak-layer demotion, graph ranking | main | `lib/analysis/**`, `tests/**`, root docs | tsc + quality guards + lint/build |
| 15 | Import-link semantics: UI/API-to-Logic linkage and linked key-file promotion | main | `lib/analysis/**`, `tests/**`, root docs | tsc + semantic/diagram tests + lint/build |
| 16 | Semantic ranking: read order and edit-guide priority from representative flow signals | main | `lib/analysis/**`, `tests/**`, root docs | tsc + semantic/analyzer tests + lint/build |
| 17 | Second-order flow semantics: API->Logic->DB/External inference for explanations | main | `lib/analysis/**`, `tests/**`, root docs | tsc + semantic/analyzer tests + lint/build |
| 18 | Unclassified code second-order hints, tighter Logic tie-breaks, and live semantic regression coverage | main | `lib/analysis/**`, `scripts/**`, `tests/**`, root docs | tsc + unit + lint/build + live regression |
| 19 | Learning-first backend output: stack glossary, usage guide, and preview signals | main | `lib/analysis/**`, `tests/**`, root docs | tsc + unit + lint/build |
| 20 | Learning payload hardening: focus-aware usage/preview, preview filtering, and structured coverage status | main | `lib/analysis/**`, `tests/**`, root docs | tsc + unit + lint/build |
| 21 | Workspace-runner usage commands and canonical deploy preview scoring | main | `lib/analysis/**`, `tests/**`, root docs | tsc + unit + lint/build |
| 22 | Section-aware README preview filtering and live regression hardening | main | `lib/analysis/**`, `scripts/**`, `tests/**`, root docs | tsc + unit + lint/build + live regression |
| 23 | Owner-level analysis entry: owner URL parsing, portfolio summary, and repo drill-down | main | `app/**`, `components/**`, `lib/analysis/**`, `tests/**`, root docs | tsc + unit + lint/build + live API |
| 24 | Owner portfolio enrichment from shallow README/package sampling | main | `lib/analysis/**`, `tests/**`, root docs | tsc + owner/unit tests + live owner API |
| 25 | Owner live regression smoke and structured recommendation reasons | main | `lib/analysis/**`, `scripts/**`, `tests/**`, root docs | tsc + unit + live regression |
| 26 | Learning contract refinement for usage explanations and preview confidence | main | `lib/analysis/**`, `tests/**`, root docs | tsc + unit + lint/build |

## Alpha Readiness Phases

### Phase A — Result Meaning First

- Goal: Result 화면이 초보자의 4질문에 즉시 답하는 구조가 되도록 계약과 IA를 고정한다
- Codex first:
  - `Result-Contract.md` 기준으로 source-of-truth field와 duplication guard를 정리
  - representative graph / layer / start-file ranking audit
  - QA corpus 고정
- Claude second:
  - Result IA 재배치
  - 메인 캔버스 시각 정돈
  - summary / canvas / inspector 중복 제거
- Exit:
  - Result 첫 화면에서 `이게 뭐야 / 어떻게 생겼어 / 어디부터 봐 / 어디를 고쳐`가 읽힌다

### Phase B — Trust And Ops

- Goal: partial/limited/rate-limit 상태가 제품 신뢰를 깎지 않게 정리한다
- Codex first:
  - `coverage`, `warnings`, `limitations`, rate-limit / tokenless 정책 정리
  - 요청 dedupe / cache / retry 동작 고정
- Claude second:
  - partial/limited 상태 표현
  - rate-limit / retry / tokenless error UX 정리
- Exit:
  - 제한 분석과 API 실패가 “망가진 결과”처럼 보이지 않는다

### Phase C — Browser QA Lock

- Goal: 대표 repo 유형별 실제 화면 회귀를 잠근다
- Codex first:
  - QA corpus와 stable expectations 유지
  - smoke / regression 진입점 유지
- Claude second:
  - repo 유형별 실브라우저 QA
  - owner 화면 큐레이션/시각 마감
- Exit:
  - 단일 앱 / 대형 모노레포 / SDK / SDK+demo / Python / owner 케이스가 모두 무너지지 않는다

### Phase D — Post-Alpha Expansion

- Goal: 핵심 가치선이 잠긴 뒤 비교/환경/미리보기/스택 확장을 진행한다
- Codex first:
  - monorepo focus 정밀화
  - compare / env-match / preview metadata / stack support 확장
- Claude second:
  - compare IA
  - env UX
  - preview UI
- Exit:
  - 1단계 핵심 가치와 충돌하지 않는 확장 기능으로 이어진다

## Rollback

- If harness adoption causes friction: keep advisory mode and use docs-only flow temporarily
- If analyzer scope balloons: cut back to Next.js-first detection and reduce outputs to summary/layers/keyFiles/editGuides
- If UI becomes too graph-heavy: fall back to static cards + Mermaid-only architecture view

## Tier

- tier: normal
- complexity: medium
- reason: this phase sets the operating framework and MVP scope but does not yet touch production app logic
