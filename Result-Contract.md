# Result-Contract.md — RepoLens Result Alpha Contract

## Purpose

Result 화면은 "분석 결과를 많이 보여주는 대시보드"가 아니라, 초보자가 공개 GitHub 레포를 빠르게 이해하게 만드는 학습 화면이다.

이 문서는 다음 두 가지를 고정한다.

- Result 화면이 반드시 답해야 하는 4개의 질문
- 각 질문에 대해 backend field와 UI region이 무엇을 담당하는지

이 계약이 있어야 Claude는 화면을 정리할 때 데이터를 임의 해석하지 않고, Codex는 backend를 어디까지 보강해야 하는지 경계를 유지할 수 있다.

## North Star

> README보다 빨리, 코드보다 친절하게  
> 처음 보는 공개 레포를 30초 안에 이해하는 화면

## Four Questions

### 1. 이 레포는 뭐야?

가장 먼저 보여야 하는 질문이다. 제품/도구/라이브러리의 정체성을 짧게 잡아줘야 한다.

Primary fields

- `analysis.learning.identity.plainTitle`
- `analysis.learning.identity.header.subtitle`
- `analysis.summary.oneLiner`
- `analysis.learning.identity.projectKind`

Secondary evidence

- `analysis.learning.identity.stackNarrative`
- `analysis.learning.identity.header.points`
- `analysis.learning.identity.trust`

Current UI owners

- [components/result-identity-bar.tsx](components/result-identity-bar.tsx)
- [components/result-view-model.ts](components/result-view-model.ts)

Rules

- `plainTitle`가 1순위다.
- `subtitle`은 `plainTitle`과 거의 같은 문장을 반복하면 안 된다.
- `summary.oneLiner`는 보조 설명이어야 하며, 동일 의미를 strip과 header에서 반복하지 않는다.
- `projectKind`는 badge/보조 메타 역할만 한다.

### 2. 어떻게 생겼어?

두 번째 질문이다. 레포의 구조를 레이어/흐름/대표 범위 관점에서 보여줘야 한다.

Primary fields

- `analysis.layers`
- `buildArchitectureModel(analysis)` 결과
- `analysis.summary.stack`
- `analysis.learning.identity.stackHighlights`

Secondary evidence

- `analysis.facts`
- `analysis.inferences`
- `analysis.topology.focusRoot`
- `analysis.coverage`

Current UI owners

- [components/architecture-canvas.tsx](components/architecture-canvas.tsx)
- [components/repo-diagram-view.tsx](components/repo-diagram-view.tsx)
- [components/left-panel.tsx](components/left-panel.tsx)

Rules

- Canvas는 "구조"를 설명하고, Inspector는 "선택한 부분"을 설명한다.
- 구조 이해에 직접 도움이 안 되는 파일 row/list는 메인 카드보다 뒤로 밀린다.
- layer 설명과 file 설명은 같은 문장을 반복하지 않는다.
- `Code` fallback은 숨기지 않고, "의미 레이어 바깥에 남은 코드"라는 사실을 솔직하게 드러낸다.

### 3. 어디부터 봐?

세 번째 질문이다. 초보자에게는 읽기 시작점이 가장 중요하다.

Primary fields

- `analysis.learning.identity.startHere`
- `analysis.summary.recommendedStartFile`
- `analysis.summary.recommendedStartReason`
- `analysis.learning.identity.readOrder`

Secondary evidence

- `analysis.keyFiles`
- layer/file inspector의 evidence

Current UI owners

- [components/result-identity-bar.tsx](components/result-identity-bar.tsx)
- [components/result-learning-panel.tsx](components/result-learning-panel.tsx)
- [components/inspector-overlay.tsx](components/inspector-overlay.tsx)

Rules

- 시작점은 한 군데에서 강하게 보여준다.
- 같은 시작 파일을 strip, canvas, inspector에서 모두 큰 신호로 반복하지 않는다.
- Inspector의 `뭐부터 봐야 해?`는 레이어 내부 시작점 설명이고, 전체 레포의 대표 시작점과는 역할을 구분한다.

### 4. 어디를 고쳐?

네 번째 질문이다. 1단계 MVP에서는 "정확한 영향도 분석"이 아니라 "수정 시작점 Lite"를 주는 것이 목표다.

Primary fields

- `analysis.editGuides`
- `analysis.keyFiles[*].whyImportant`
- `analysis.keyFiles[*].evidence`

Secondary evidence

- file inspector의 `어디서 쓰여?`
- `analysis.inferences`

Current UI owners

- [components/result-learning-panel.tsx](components/result-learning-panel.tsx)
- [components/result-view-model.ts](components/result-view-model.ts)
- [components/inspector-overlay.tsx](components/inspector-overlay.tsx)

Rules

- `Edit Guide Lite`는 "수정 위치 안내"이지 "정확한 영향도 보장"이 아니다.
- 초보자에게는 파일명보다 intent와 이유가 먼저여야 한다.
- 수정 포인트는 기본적으로 보조 정보이며, 구조 이해보다 앞서면 안 된다.

## Supporting Question

### 이 결과를 얼마나 믿어도 돼?

이 질문은 주 메시지가 아니라 신뢰도 가드레일이다.

Primary fields

- `analysis.coverage`
- `analysis.learning.identity.trust`
- `analysis.warnings`
- `analysis.limitations`

Current UI owners

- [components/status-chip.tsx](components/status-chip.tsx)
- [components/result-workspace-model.ts](components/result-workspace-model.ts)

Rules

- `coverage.level === "ok"`이면 조용해야 한다.
- partial/limited는 "실패"가 아니라 "어디까지 볼 수 있는가"를 알려주는 상태다.
- 경고는 메인 콘텐츠를 덮지 말고, 필요한 순간에만 읽히게 해야 한다.

## Region Ownership

| Region | Primary job | Must not do |
|---|---|---|
| Header / Identity bar | `이 레포는 뭐야?`와 전체 시작점 제시 | 구조 상세, 파일 리스트, 경고 장문 반복 |
| Summary strip | stack / 규모 / 한 줄 컨텍스트 압축 | header subtitle 반복 |
| Main canvas | `어떻게 생겼어?`를 한 번에 보여주기 | 파일 설명 장문, 상태/경고 남발 |
| Inspector | 선택 요소의 맥락과 다음 읽을 파일 설명 | 글로벌 요약 반복 |
| Left panel | 보기 전환 / 레이어 / 범위 / 상태 네비게이션 | 제품 설명 본문 역할 |
| Learning panel | `어디부터 봐 / 어디를 고쳐 / 어떻게 실행해` 보조 설명 | 메인 캔버스 역할 대체 |

## Duplication Guard

- `plainTitle`와 같은 의미의 문장을 summary strip에서 반복하지 않는다.
- 전체 시작점은 강한 CTA 하나만 둔다.
- layer caption과 inspector 첫 문장은 같은 문장을 반복하지 않는다.
- coverage/status는 정상일 때 숨긴다.
- strip은 구조를 설명하지 않고, canvas는 개요 문장을 길게 설명하지 않는다.

## Current Component Ownership

- Identity / summary source assembly
  - [components/result-view-model.ts](components/result-view-model.ts)
- Sidebar / status assembly
  - [components/result-workspace-model.ts](components/result-workspace-model.ts)
- Result orchestration
  - [components/result-workspace.tsx](components/result-workspace.tsx)

## Immediate Codex Tasks

1. Result 화면의 primary / secondary field 계약을 계속 additive 방식으로 유지
2. graph representative node / edge ranking을 repo 유형별로 계속 보정
3. partial / limited / rate-limit 상태 payload를 프론트 친화적으로 유지
4. QA corpus 기준 repo regression을 확대

## Immediate Claude Tasks

1. 4질문이 첫 시선에 바로 읽히는 IA로 Result 재정리
2. summary strip / canvas / inspector의 중복 제거
3. 메인 캔버스를 "정리된 구조 지도"처럼 보이게 시각 정돈
4. partial / limited 상태를 신뢰 손실 없이 가볍게 표현
