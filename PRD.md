# PRD.md — RepoLens MVP

## 1. Product Summary

RepoLens는 GitHub 공개 레포 또는 GitHub owner profile을 초보자도 이해할 수 있는 구조도, 읽기 순서, 수정 시작점으로 바꾸는 학습형 인터페이스다.

핵심은 코드를 많이 보여주는 것이 아니라, 사용자가 자기 레포를 설명하고 수정할 수 있게 만드는 것이다.

## 2. Problem

AI 기반 코딩과 바이브코딩으로 누구나 빠르게 제품을 만들 수 있게 되었지만, 많은 사용자가 아래 상태에 머문다.

- 내가 만든 코드인데 구조를 설명하지 못한다
- AI가 무엇을 만들었는지 모른다
- 어디를 수정해야 하는지 찾지 못한다
- 파일이 많아질수록 읽기 시작점을 잃는다

문제의 본질은 다음과 같다.

> 구현은 했지만 이해는 못하는 상태

## 3. Users

### Primary Users

- 바이브코딩으로 프로젝트를 만든 사용자
- AI 도움으로 앱을 만든 초보 개발자
- 공개 GitHub 레포를 빠르게 이해하고 싶은 학습자

### User Characteristics

- 완전한 코드 독해 경험이 부족함
- 프로젝트 전체보다 시작점과 구조 요약이 필요함
- 파일명보다 역할, 흐름, 수정 포인트를 더 쉽게 이해함

## 4. Product Goal

사용자가 GitHub 공개 레포 URL 또는 owner URL 하나만 넣어도 아래 질문에 답할 수 있어야 한다.

1. 이 프로젝트는 무엇인가
2. 어떻게 구성되어 있는가
3. 어디부터 보면 되는가
4. 무엇을 바꾸려면 어디를 봐야 하는가
5. 이 owner는 주로 무엇을 만들고, 어떤 레포부터 보면 되는가

## 5. MVP Scope

### In Scope

- GitHub 공개 레포 URL 입력
- GitHub 공개 owner URL 입력
- 기본 브랜치 기준 분석
- commit SHA 기준 분석 결과 고정
- 파일 트리 및 설정 파일 분석
- 주요 스택 감지
- 라우트, API, DB, 외부 연동 흔적 탐지
- 레이어 구조화
- 핵심 파일 선정
- 수정 포인트 Lite 추천
- 결과 화면 렌더링

### Out of Scope

- Private repo
- 사용자 인증
- owner 전체를 하나의 코드베이스처럼 합쳐 설명하는 가짜 전역 구조도
- commit history 기반 해설
- 정교한 버튼 단위 행동 흐름 추론
- AI 기반 채팅 인터페이스
- archive fallback 기반 대용량 레포 완전 분석
- 범용 monorepo 심층 지원
- 정확한 영향도 분석

## 6. Supported Stacks For MVP

우선 지원 범위는 아래로 제한한다.

- Next.js
- React
- Node.js
- Supabase/Firebase는 탐지 및 Lite 설명 수준만 지원

이 범위를 넘어가는 레포는 실패가 아니라 `제한된 분석`으로 표시한다.

## 7. Core User Jobs

### Job 1. 프로젝트 정체성 파악

사용자는 “이 레포가 무슨 앱인지”를 빠르게 알고 싶다.

### Job 2. 전체 구조 이해

사용자는 “어떤 부분이 화면이고 어떤 부분이 서버/DB인지”를 보고 싶다.

### Job 3. 읽기 시작점 확보

사용자는 “어디부터 읽어야 하는지”를 알고 싶다.

### Job 4. 수정 시작점 확보

사용자는 “텍스트/UI/API/DB를 바꾸려면 어디를 봐야 하는지”를 알고 싶다.

## 8. Functional Requirements

### 8.1 Target Input

사용자는 GitHub 공개 레포 URL 또는 owner URL을 입력할 수 있어야 한다.

요구사항:
- URL 유효성 검사
- owner/repo 또는 owner-only 추출
- 기본 브랜치 조회
- 예시 repo 빠른 실행 버튼
- 별도 모드 토글 없이 URL 형태로 자동 분기

### 8.2 Analysis Pipeline

시스템은 레포를 사실 기반으로 분석해야 한다.

요구사항:
- repo 메타데이터 조회
- commit SHA 고정
- GitHub metadata/tree/contents API 기반 분석
- archive fallback은 MVP 1단계에서 보류
- 파일 트리 생성
- 주요 설정 파일 파싱
- 스택 감지
- 라우트/API/DB/외부 연동 탐지
- 레이어 분류
- 핵심 파일 점수화
- 수정 포인트 Lite 생성
- 내부 공통 JSON 스키마 생성

owner URL인 경우 요구사항:
- owner profile 메타데이터 조회
- public repos 목록 조회
- 대표 repo 선정
- 카테고리 분포 계산
- 많이 보이는 스택/언어 요약
- 입문용 repo 추천
- repo 상세 drill-down 링크 생성

### 8.3 Result Workspace

결과 화면은 학습형 워크스페이스여야 하며 아래 섹션을 포함해야 한다.

#### Overview
- 한 줄 설명
- 프로젝트 유형
- 기술 스택
- 핵심 기능
- 난이도
- 추천 시작 파일

#### Architecture
- 레이어 구조도
- UI / Logic / API / DB / External 구분
- 핵심 연결만 표시
- 요소 선택 시 설명 패널 업데이트

#### Key Files
- 핵심 파일 5~10개
- 읽는 순서
- 파일 역할
- 왜 중요한지

#### Edit Guide Lite
- 수정 의도별 시작점 제공
- 최소 항목:
  - 화면 문구 수정
  - UI 수정
  - API 응답 수정
  - DB 관련 수정
- 각 항목에 관련 파일과 이유 표시

### 8.4 Owner Workspace

owner 결과 화면은 “조직 전체 코드 구조”가 아니라 “공개 포트폴리오 이해 화면”이어야 한다.

구성:
- owner 한 줄 설명
- public repo 수와 샘플링 범위
- 대표 repo 목록
- 입문용 repo 추천
- 카테고리 분포
- 많이 보이는 스택/언어
- 각 repo에서 기존 repo 결과 화면으로 drill-down

## 9. Non-Functional Requirements

- 분석은 재현 가능해야 한다
- 같은 commit SHA는 같은 사실 결과를 내야 한다
- 분석 결과는 단계형 상태로 보여야 한다
- 대형 레포는 제한 분석 또는 실패 이유를 명확히 표시해야 한다
- UI는 초보자 기준으로 낮은 복잡도를 유지해야 한다
- 설명은 사실과 추론을 구분해서 보여줄 수 있어야 한다

## 10. UX Principles

### 10.1 질문 중심

정보 구조는 파일 탐색이 아니라 질문 응답 구조여야 한다.

- 이 프로젝트는 뭐야?
- 어떻게 구성돼?
- 어디부터 봐야 해?
- 어디를 수정해야 해?

### 10.2 단계적 공개

초기에는 전체 구조와 핵심 포인트만 보여주고, 세부는 클릭 후 노출한다.

### 10.3 구조 + 설명 결합

시각화만 보여주지 않고, 항상 쉬운 설명 패널을 함께 보여준다.

### 10.4 초보자 기준 언어

전문 용어를 앞세우지 말고 역할과 목적부터 설명한다.

## 11. Information Architecture

### Product-Level IA

- Landing
- Analyzing
- Result Workspace

### Result Workspace IA

- Overview
- Architecture
- Key Files
- Edit Guide Lite

### Reading Order

1. Overview
2. Architecture
3. Key Files
4. Edit Guide Lite

## 12. Screen Requirements

### 12.1 Landing

목표: 제품 이해와 레포 입력

구성:
- 제품 한 줄 설명
- GitHub URL 입력창
- 예시 repo 버튼
- 지원 범위 안내
- 결과로 무엇을 얻는지 요약 카드

### 12.2 Analyzing

목표: 분석 진행 상태를 이해 가능하게 표시

구성:
- 레포 이름
- 현재 단계
- 단계 목록
  - 파일 구조 읽는 중
  - 기술 스택 파악 중
  - 핵심 구조 정리 중
  - 결과 생성 중

### 12.3 Result Workspace

목표: 결과를 탐색이 아닌 학습 순서로 제공

구성:
- 상단 헤더: repo, branch, commit SHA, 재분석
- 좌측 내비게이션: `보기 / 레이어 / 범위 / 상태` 섹션형 패널
- 중앙 메인 콘텐츠: summary strip 아래에 이해 화면 또는 구조도를 크게 보여주는 스크롤형 워크스페이스
- 우측 패널: 선택 요소 설명, 관련 파일, 근거
- 부분 분석/경고는 배너 대신 작은 상태 chip으로만 노출
- 모바일에서는 좌측 패널을 상단 가로 strip 또는 토글 패널로 축약하고, Inspector는 bottom sheet로 내려온다

## 13. Visual And UI Direction

- 개발자 IDE보다 학습 보드에 가깝게 설계한다
- 과도한 차트/패널 밀도를 피한다
- 메인 콘텐츠는 문서형이며, Architecture 섹션에서만 제한된 구조 그래프를 사용한다
- 색상은 의미 고정형이어야 한다
  - UI: 파랑
  - Logic: 초록
  - API: 주황
  - DB: 빨강
  - External: 회색

## 14. Technical Architecture

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- Mermaid for MVP diagrams

### Backend
- Next.js Route Handlers
- Node.js 기반 분석 모듈

### Repository Ingest
- GitHub REST API
- commit SHA 기준 archive 다운로드

### Storage
- 분석 결과 캐시를 위한 DB 또는 JSON persistence layer
- MVP에서는 단순 persistence부터 시작 가능

## 15. Analysis Model

### Fact Layer

AI 없이 처리한다.

포함:
- 파일 트리
- 설정 파일 파싱
- 스택 감지
- 라우트/API 탐지
- DB/외부 연동 흔적 탐지
- import 관계 기반 점수화

### Structure Layer

규칙 기반 정리.

포함:
- 레이어 분류
- 프로젝트 유형 추정
- 핵심 파일 정리
- 수정 포인트 Lite 생성

### Explanation Layer

MVP에서는 템플릿 기반 문장으로 충분하다.
AI는 필수가 아니다.

## 16. Internal Output Schema

시스템은 최소한 아래 구조의 내부 분석 결과를 생성해야 한다.

```ts
type RepoAnalysis = {
  repo: {
    owner: string
    name: string
    branch: string
    sha: string
    url: string
  }
  summary: {
    oneLiner: string
    projectType: string
    stack: string[]
    difficulty: 'easy' | 'medium' | 'hard'
    keyFeatures: string[]
    recommendedStartFile?: string
  }
  layers: Array<{
    name: 'UI' | 'Logic' | 'API' | 'DB' | 'External'
    description: string
    files: string[]
  }>
  keyFiles: Array<{
    path: string
    role: string
    whyImportant: string
    readOrder: number
  }>
  editGuides: Array<{
    intent: string
    files: string[]
    reason: string
  }>
}
```

## 17. Acceptance Criteria

### Product Acceptance

- 사용자는 public GitHub repo URL을 제출할 수 있다
- 시스템은 repo를 특정 commit SHA 기준으로 분석한다
- 결과 화면에 Overview, Architecture, Key Files, Edit Guide Lite가 보인다
- Architecture는 레이어 기준 구조를 보여준다
- Key Files는 읽기 순서를 제공한다
- Edit Guide Lite는 적어도 4개 수정 의도에 대해 시작 파일을 제안한다

### Quality Acceptance

- 분석은 AI 없이도 동작한다
- 지원 스택 범위 내 대표 repo에서 구조 추출이 가능하다
- 분석 실패 시 이유가 사용자에게 보인다
- 같은 SHA에 대해 사실 데이터가 흔들리지 않는다

## 18. Risks

### Risk 1. 구조 분류 오판
규칙 기반 분류는 애매한 폴더 구조에서 오류 가능성이 있다.

대응:
- 사실과 추정을 분리 표기
- 지원 스택 범위를 좁게 시작

### Risk 2. 대형 레포 처리 부담
대형 레포는 분석 시간이 길어지고 결과도 복잡해진다.

대응:
- 파일 수/크기 제한
- 제한 분석 모드

### Risk 3. 구조도 과복잡화
너무 많은 노드와 선은 초보자 UX를 망친다.

대응:
- 핵심 연결만 표시
- 그룹 단위 먼저 노출

## 19. Success Metrics

MVP 단계에서 확인할 지표:
- 분석 성공률
- 평균 분석 시간
- 결과 페이지 이탈률
- Key Files 클릭률
- Edit Guide 항목 클릭률
- 사용자가 “어디부터 봐야 할지 알겠다”고 응답하는 비율

## 20. Milestones

### M1. Analysis Skeleton
- repo ingest
- stack detection
- key structure extraction

### M2. Result Workspace
- Overview
- Architecture
- Key Files
- Edit Guide Lite UI

### M3. Validation
- 대표 repo 샘플 검증
- 실패 유형 정리
- 지원 범위 명시

## 21. Next-Phase Extensions

MVP 이후 확장 후보:
- Flows
- Learn glossary
- AI 설명 보강
- commit 기반 해설
- 대화형 질의응답
