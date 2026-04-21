# RepoLens

> You built it. Now understand it.

RepoLens는 GitHub 공개 레포를 초보자도 이해할 수 있는 구조도와 쉬운 설명으로 바꾸는 학습형 인터페이스다.

## Current Scope

현재 저장소는 아래 두 축으로 구성된다.

- 제품 문서: RepoLens 1단계 MVP 요구사항과 설계
- 운영 하네스: Codex 전용 vibecoding harness

## MVP Goal

사용자가 GitHub 공개 레포 URL을 입력하면 RepoLens는 아래 네 질문에 답한다.

1. 이 프로젝트는 무엇인가
2. 어떻게 구성되어 있는가
3. 어디부터 보면 되는가
4. 무엇을 바꾸려면 어디를 봐야 하는가

## MVP Deliverables

- Landing: 레포 입력과 제품 설명
- Analyzing: 단계형 분석 진행 상태
- Result Workspace
  - Overview
  - Architecture
  - Key Files
  - Edit Guide Lite

## Harness Commands

```bash
python3 scripts/harness/bootstrap.py --skip-self-test
python3 scripts/harness/self_test.py
python3 -m unittest discover -s tests -q
```

프로젝트 인스턴스로 채택하고 git 초기화까지 한 상태를 다시 맞추려면:

```bash
python3 scripts/harness/bootstrap.py --adopt-project --init-git --seed-empty-commit
```

## App Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm test:unit
pnpm test:regression:live
```

분석 API는 `POST /api/analyze` 이고, body는 `{ "repoUrl": "https://github.com/owner/repo" }` 형식이다.
응답은 성공 시 분석 JSON, 실패 시 `code + message + retryable` 구조를 반환한다.

## Environment

- 선택: `GITHUB_TOKEN`
- 공개 API rate limit이 자주 걸리면 personal access token을 넣고 실행한다.
- 로컬 세팅 파일은 `.env.local` 이고, 기본 템플릿은 `.env.example` 에 있다.
- 시작 예시:

```bash
cp .env.example .env.local

# Optional
GITHUB_TOKEN=your_github_personal_access_token
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- 값 입력 후에는 `pnpm dev`를 다시 시작해야 반영된다.
- live 회귀 스크립트는 `ANALYZE_BASE_URL`로 대상 서버를 바꿀 수 있다.
- 지정하지 않으면 `http://localhost:3000` 과 `http://localhost:3001` 을 순서대로 확인한다.
- live 회귀 스크립트는 `forceRefresh: true`로 캐시를 우회해 현재 휴리스틱 기준 결과를 검사한다.

## Publishing Checklist

- `.env.local`, `.claude/`, `.codex/context/`, `.codex/reviews/`, `.codex/qa/` 는 공개 저장소에 올리지 않는다.
- 퍼블리싱 전 `pnpm security:check` 를 실행해 토큰 문자열, 로컬 절대경로, 로컬 런타임 산출물이 커밋 대상에 섞이지 않았는지 확인한다.
- 공개 배포 시에는 GitHub 토큰을 서버 환경변수로만 주입하고, 저장소 파일에는 넣지 않는다.

## Route Map

- `/`: Landing
- `/analyzing?repoUrl=...`: 분석 진행 화면
- `/result?repoUrl=...`: 결과 워크스페이스

`result` 라우트는 session cache가 있으면 즉시 결과를 복원하고, 없으면 같은 repo를 다시 분석한다.

## Notes

- 1단계 MVP는 AI 없이도 성립해야 한다.
- 분석 엔진은 GitHub metadata/tree/contents API 기반의 사실 분석이 우선이다.
- 대형 레포는 `limited analysis` 모드로 핵심 코드/설정 파일만 축약 분석한다.
- archive fallback은 MVP 1단계 범위에서 보류하고, tree API + 제한 분석 전략으로 먼저 닫는다.
- AI는 이후 설명 보강 계층으로 선택적으로 추가한다.
