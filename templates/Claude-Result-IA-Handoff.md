# Claude Handoff — Result IA / Canvas Phase A

## 목적

RepoLens Result 화면을 "분석 결과 대시보드"가 아니라, 초보자가 공개 GitHub 레포를 30초 안에 이해하는 학습 화면으로 다시 정리한다.

북극성은 하나다.

> README보다 빨리, 코드보다 친절하게  
> 처음 보는 공개 레포를 30초 안에 이해하는 화면

## 이번 단계에서 답해야 하는 4질문

1. 이 레포는 뭐야?
2. 어떻게 생겼어?
3. 어디부터 봐?
4. 어디를 고쳐?

Result 첫 화면은 이 4질문이 즉시 읽히게 만들어야 한다.

## Source Of Truth

반드시 먼저 읽을 것:

- [Result-Contract.md](Result-Contract.md)
- [scripts/result-qa-corpus.json](scripts/result-qa-corpus.json)

Backend field는 이미 충분하다. 이번 작업에서는 frontend가 임의 추론을 늘리지 말고, 기존 field를 재배치해서 위계를 정리하는 데 집중한다.

## 이번 작업 목표

### 1. Result IA 최종 정리

- 첫 시선에서 4질문이 읽히는 구조로 재배치
- 상단 정체성 블록, 메인 캔버스, 보조 inspector의 역할을 명확히 분리
- Overview/Architecture/Key Files/Edit Guide Lite의 의미가 화면 위계로 읽히게 만들기

### 2. 메인 캔버스 시각 정돈

- 지금 화면은 "분석 결과를 그려놓은 느낌"이 남아 있다
- 목표는 GitDiagram clone이 아니라 "질서 있는 구조 지도"
- 박스 정렬, 간격, 크기, 연결선, 정보 밀도를 줄이고 초보자 시선 흐름을 정리

### 3. summary / strip / canvas / inspector 중복 제거

- 같은 의미가 여러 영역에 반복되지 않게 정리
- strip은 요약
- canvas는 구조
- inspector는 세부

## 절대 하지 말 것

- backend field shape 변경
- `lib/analysis/**`, `app/api/**`, `scripts/**`, `tests/**` 수정
- compare / owner / env-match 로직 건드리기
- Result를 power-user 대시보드처럼 정보 밀도 높게 만들기

## 수정 가능 파일

- `components/result-workspace.tsx`
- `components/result-view-model.ts`
- `components/result-workspace-model.ts`
- `components/result-identity-bar.tsx`
- `components/summary-strip.tsx`
- `components/architecture-canvas.tsx`
- `components/repo-diagram-view.tsx`
- `components/inspector-overlay.tsx`
- `components/left-panel.tsx`
- `components/result-learning-panel.tsx`
- 필요 시 Result 화면 전용 보조 컴포넌트 추가 가능

## 디자인 원칙

- Linear 톤 유지
- 정보 추가보다 삭제 우선
- 초보자 화면은 "풍부함"보다 "한 번에 이해됨"
- 캔버스가 화면의 중심이지만, 캔버스 alone이 모든 질문에 답하려고 하면 안 된다
- partial/limited 상태는 크게 불안하게 만들지 말고, 조용하지만 명확하게

## 인터랙션 원칙

- strip / canvas / inspector가 같은 내용을 반복하지 않는다
- 시작점은 한 군데에서 강하게만 보인다
- Inspector는 선택 요소의 세부 설명만 담당한다
- Left panel은 설명 패널이 아니라 네비게이션이다

## 우선순위

1. Result IA 재배치
2. 캔버스 시각 정돈
3. 중복 제거
4. partial/limited 상태 표현 다듬기

## QA 대상

아래 repo는 최소 smoke QA 대상이다.

- `https://github.com/ahmedkhaleel2004/gitdiagram`
- `https://github.com/n8n-io/n8n`
- `https://github.com/calcom/cal.com`
- `https://github.com/vercel/ai`
- `https://github.com/openai/openai-python`
- `https://github.com/tailwindlabs`

## 완료 기준

- Result 화면 한 장만 봐도 4질문 중 3개 이상이 즉시 답된다
- 캔버스가 질서 있게 보인다
- strip / canvas / inspector의 의미 중복이 크게 줄어든다
- owner 화면은 repo Result와 다른 역할로 보인다

## 작업 후 보고 형식

1. 수정한 파일 목록
2. 어떤 질문을 어느 UI 영역이 담당하도록 재정리했는지
3. 제거한 중복 신호 목록
4. 캔버스에서 바뀐 시각 규칙
5. partial/limited 상태를 어떻게 표현했는지
6. QA repo별 간단한 결과
