# Documentation.md — RepoLens MVP

## Status

가장 최근 publish-hardening slice에서는 “로컬에서 잘 돈다”와 “공개 저장소로 안전하게 밀 수 있다”를 분리해서 닫았다. `.gitignore`는 `.env.example`만 예외로 남기고 `.claude/`, `.codex/context/**`, `.codex/reviews/**`, `.codex/qa/**`, `.codex/telemetry/**`, local dev log를 기본 차단하도록 정리했다. 동시에 새 [prepublish-security-check.mjs](scripts/prepublish-security-check.mjs) 를 추가해, 실제 커밋 후보(`git ls-files -co --exclude-standard`) 기준으로 토큰 문자열, 로컬 절대경로, `.env*`, 로컬 런타임 산출물이 섞이면 실패하게 만들었다. package script는 `pnpm security:check` 이고, GitHub Actions workflow [security-hygiene.yml](.github/workflows/security-hygiene.yml) 에도 같은 검사를 넣었다. 이 slice에서 README env 예시는 안전한 placeholder로 교체했고, `.env.example` 과 [SECURITY.md](SECURITY.md) 를 추가했다.

같은 slice에서 `/api/analyze` 는 same-origin browser guard와 `Cache-Control: no-store` 를 갖도록 바뀌었다. `Origin` 이 있으면 request origin과 정확히 일치해야 하고, `Origin` 이 비어 있어도 `Sec-Fetch-Site: cross-site` 는 차단한다. 그래서 외부 사이트가 브라우저를 통해 RepoLens 서버의 GitHub quota를 소모시키는 경로를 줄였다. route regression은 [tests/analyze-route.test.ts](tests/analyze-route.test.ts) 에서 cross-origin 403, `Retry-After`, no-store header까지 같이 잠갔다. 이번 검증 과정에서 compare client가 mocked fetch의 `headers.get()` 존재를 가정하던 취약점도 발견되어 [lib/analysis/client.ts](lib/analysis/client.ts) 에 optional guard를 넣었고, 결과적으로 `pnpm security:check`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec vitest run tests/analyze-route.test.ts`, `pnpm test:unit`, `pnpm build` 가 모두 다시 초록으로 돌아왔다.

가장 최근 backend rate-limit observation slice에서는 남아 있던 마지막 actionable candidate를 “기다리기만 하는 메모”가 아니라 실제 운영 루프로 바꿨다. 새 [observe-rate-limit-candidate.mjs](scripts/observe-rate-limit-candidate.mjs) 는 local `/api/analyze`를 호출해 실제 429를 관측하면 [analysis-regression-candidates.json](scripts/analysis-regression-candidates.json) 의 `rate-limit-long-countdown-observation` 후보를 자동 갱신한다. `retryAfterSeconds < 3600`이면 `observing`, `>= 3600`이면 `ready-for-regression`으로 올린다. no-429 상황에서는 file write 없이 `NOT_RATE_LIMITED` 결과만 출력한다. 이 스크립트는 `RATE_LIMIT_REPO_URL`, `RATE_LIMIT_THRESHOLD_SECONDS`, `RATE_LIMIT_WRITE_BACK`, `ANALYZE_BASE_URL` 같은 env override를 지원하므로, alpha 운영 중 실제 차단이 보인 repo로 바로 대상을 바꿔 dry-run 또는 write-back을 할 수 있다. helper 로직은 [regression-candidate-utils.mjs](scripts/regression-candidate-utils.mjs) 로 분리돼 있고, mock 429 기준 `5400s -> ready-for-regression` 전이는 test로 잠겨 있다.

가장 최근 backend live-regression promotion slice에서는 backlog를 실제 공개 케이스 기준으로 정리했다. `sindresorhus/meta`를 새 low-signal public repo case로 승격해, 이제 backend는 synthetic fixture가 아니라 실공개 레포에서 `README 중심 시작 구조` fallback이 제대로 남는지 잠근다. 같은 slice에서 기존 public coverage도 filter-friendly id/alias로 정리했다. `supabase/supabase-js`는 `repo-sdk-demo-supabase-js`, `n8n-io/n8n`은 `repo-trust-density-n8n`, `https://github.com/supabase` owner 케이스는 `owner-theme-supabase`로 식별 가능하다. 그래서 alpha에서 특정 regression만 다시 보고 싶을 때 전체 corpus 대신 `ANALYSIS_REGRESSION_CASE_FILTER`로 해당 public case만 좁혀 돌릴 수 있다. candidate backlog 기준으로도 `repo-low-signal-public`, `repo-sdk-demo-boundary-public`, `repo-large-partial-trust-density`, `owner-theme-noise-public`는 모두 `landed`가 됐고, 지금 남은 actionable candidate는 실제 `retryAfterSeconds >= 3600` 관측 1건뿐이다.

가장 최근 backend low-signal / regression-runner slice에서는 두 가지를 보강했다. 첫째, `identity.header.points` minimum guard만으로는 Result 상단이 항상 충분하지 않아서, `summary.keyFeatures`가 완전히 비는 repo에도 아주 보수적인 구조 fallback을 추가했다. README가 있으면 `README 중심 시작 구조`, README는 없고 manifest만 있으면 `설정 파일 중심 시작 구조`를 넣는다. 이 fallback은 `buildKeyFeatures(...)`의 마지막 단계에서만 적용되므로, 기존 product-facing feature(`페이지 기반 진입 구조`, `라이브러리 진입점`, `Prisma 연결 확인` 등)가 하나라도 있으면 개입하지 않는다. 둘째, live regression runner는 `ANALYSIS_REGRESSION_CASE_FILTER`를 지원하게 바뀌었다. 이제 alpha에서 들어온 repo/owner URL 하나만 case id 또는 repoUrl substring으로 좁혀 재검증할 수 있고, filter 적용 후 선택 case가 0개면 local server discovery 전에 종료하므로 quota가 막힌 날에도 네트워크를 타지 않고 selection 자체를 검증할 수 있다. runner output에는 `caseFilters`와 `blockedCases[{ repoUrl, retryAfterSeconds }]`도 함께 들어간다.

가장 최근 backend execution slice에서는 “남은 Codex 일감”을 실제 운영 루프로 바꾸는 작업을 먼저 넣었다. 새 [analysis-regression-candidates.json](scripts/analysis-regression-candidates.json) 은 아직 live regression으로 승격하지 않은 drift 후보를 backlog로 관리하고, [check-analysis-regression-candidates.mjs](scripts/check-analysis-regression-candidates.mjs) 는 이 파일의 상태/우선순위/프로브 정책을 검증한다. 즉, quota가 막힌 날에도 candidate를 잃지 않고 `awaiting-url -> ready-for-probe -> ready-for-regression -> landed` 흐름으로 넘길 수 있다. 같은 slice에서 `consumptionMode`도 더 보수적으로 바꿨다. 이제 웹앱/모노레포 앱/API 서비스 같은 app-shaped repo는 root `package.json.exports`만 있다고 곧바로 `hybrid`로 올라가지 않는다. README의 실제 import 사용 예시나 focus workspace 자체의 export surface가 있을 때만 hybrid로 보고, 그렇지 않으면 `run-as-app`을 유지한다. 그래서 `exports`를 incidental metadata처럼 쓰는 Next.js app이나 app-focused monorepo가 라이브러리처럼 보이는 오탐을 줄였다.

가장 최근 backend follow-up slice에서는 alpha 운영 후보 중 실제로 backend가 책임져야 할 경계만 더 잠갔다. 첫째, `coverage.trustSummary.reasons`는 여전히 최대 3개지만 이제 단순 등장 순서가 아니라 사용자 설명력 우선순위로 고른다. `LIMITED_ANALYSIS_MODE`가 있으면 `TREE_TRUNCATED`는 `basedOn`에만 남기고, 상단 reason 슬롯은 `제한 분석`, `지원 스택 갭`, `레이어 분류 갭`처럼 더 직접적인 이유에 우선 배정한다. 둘째, 저신호 레포에서도 `identity.header.points`가 완전히 비지 않도록 마지막 보장 point를 남긴다. 셋째, 실제 rate-limit 관측에서는 authenticated GitHub quota가 잠겨 `retryAfterSeconds=289`가 확인됐고, 긴 값도 raw seconds 그대로 보존된다는 계약만 유지했다. 아직 1시간 이상 countdown은 실데이터에서 관측되지 않았으므로, 시간 단위 카피 분기는 프론트에서 운영 데이터를 보고 판단하면 된다.

가장 최근 backend alpha-drift hardening에서는 프론트 관점에서 드러난 세 가지 운영 후보를 backend 계약 기준으로 정리했다. 첫째, `identity.header.points`와 `summary.keyFeatures`가 모두 약한 저신호 레포에서도 초보자용 bullet 섹션이 통째로 사라지지 않도록 identity header 쪽 최소 point 보장 경로를 추가했다. 둘째, `coverage.trustSummary.reasons`는 backend 계약상 최대 3개만 내려오도록 다시 테스트로 잠가, 프론트가 3개만 보여줄 때 정보가 뒤에서 잘리는 상황이 생기지 않게 했다. 셋째, `retryAfterSeconds`는 긴 대기 시간도 raw 초 단위 그대로 유지한다. 즉, 5400초 같은 값도 `/api/analyze`의 `Retry-After` 헤더와 error details에 그대로 남고, “시간 단위 카피로 바꿀지”는 이후 실제 운영 데이터가 쌓인 뒤 프론트에서 결정하면 된다.

가장 최근 backend hardening slice에서는 owner/theme drift와 library-style repo의 generic feature drift를 실제 공개 레포 기준으로 한 번 더 줄였다. owner 쪽은 raw topic token이 그대로 `keyThemes`에 섞여 `postgres`, `postgresql`, `database` 같은 저장소 기술 키워드가 포트폴리오 테마처럼 보이던 문제를 막기 위해, canonical stack/service/vendor topic을 theme signal에서 제외했다. 동시에 `tailwindlabs/tailwindcss` 같은 library/design-system 레포는 self-branded signal이 없어도 generic `외부 서비스 연동`이 상단 key feature로 올라오지 않도록 정리했다. live regression corpus도 다시 넓혀 현재 기준 `repo=18 cases`, `owner=5 cases`가 `blockedCount=0`으로 통과하며, 새 케이스는 `tailwindlabs/tailwindcss`와 `supabase` owner다. owner 회귀는 heuristic 변경 직후 stale owner cache 영향을 피하려고 `ANALYSIS_REGRESSION_FORCE_REFRESH=owner-only`로 확인하는 운영 메모까지 함께 남겼다.

가장 최근 backend 운영 slice에서는 live regression과 GitHub quota 정책을 다시 정리했다. `scripts/check-analysis-regression.mjs`는 이제 `repo`와 `owner`를 같은 강도로 때리지 않는다. 기본값 기준으로 repo 케이스는 fresh-first(`forceRefresh=true`)를 유지하고, owner 케이스는 cache-friendly(`forceRefresh=false`)로 바뀌었다. 여기에 `ANALYSIS_REGRESSION_RATE_LIMIT_MODE=owner-soft`가 기본으로 들어가 owner만 GitHub quota에 막힐 때는 repo heuristic 회귀를 같이 붉게 죽이지 않는다. 동시에 GitHub rate-limit error details에는 `retryAfterSeconds`가 추가됐고, `/api/analyze`는 가능할 때 `Retry-After` 헤더까지 내려 프론트와 스크립트가 같은 근거로 재시도/안내를 할 수 있게 됐다. 이어서 owner sampling variability 보강으로 `analyzeOwnerSnapshot(...)` 결과뿐 아니라 `selectOwnerEnrichmentCandidates(...)` 선택 단계도 fixture로 잠갔다. 현재 live regression은 `repo=17 cases`, `owner=4 cases`, 둘 다 `blockedCount=0`으로 다시 통과한다.

가장 최근 backend 마감 slice에서는 남아 있던 Codex 범위의 출시 블로커를 정리했다. 첫째, repo 결과는 이제 `analysis.coverage.trustSummary`를 함께 내려 `limited/partial` 상태를 짧은 headline/detail/reasons/omissions/basedOn/approximate 계약으로 바로 설명할 수 있다. 둘째, representative selection은 UI 외 레이어까지 bucket 우선순위를 갖게 돼 `API(route -> middleware -> controller)`, `DB(schema -> client -> migration)`, `External(provider -> auth -> storage)` 같은 초보자용 대표 surface가 더 질서 있게 잡힌다. 셋째, `/api/analyze` 응답은 additive `meta.policy/meta.delivery`를 내려 tokenless/authenticated 모드, 서버 캐시 TTL, inflight dedupe, 이번 응답이 fresh/cache/inflight 어디서 왔는지까지 프론트가 추론 없이 사용할 수 있게 됐다. 넷째, live regression corpus는 trust summary/start-file/owner 포트폴리오 expectation까지 포함해 실제 공개 URL 19건(Repo 16, Owner 3)을 통과한다.
RepoLens 저장소는 Codex-native harness 이식이 끝났고, Next.js 16 기반 앱 셸과 public GitHub repo 분석 경로가 구현된 상태다. 현재는 `Landing -> Analyzing -> Result` 라우트 구조로 분리됐고, 분석기는 코드/설정 파일 필터링과 신호 기반 분류를 사용한다. 최근에는 library/dev-tool 저장소에 대한 Quick Start, Edit Guide, layer 감지를 보강했고, `Merchantlee99/Vibebuilder` 같은 multi-pack tooling repo에서 대표 root를 `vb-pack-codex-harness`로 고정할 수 있게 만들었다. 이어서 tutorial/example/monorepo 계열에서는 `starter`보다 `solution/final/complete`를 우선하는 대표 루트 선택과 scope-preserving Key Files 구성을 추가했고, server/client cache stale issue도 각각 정리했다.
가장 최근 Result-oriented backend slice에서는 `summary.recommendedStartFile`을 초보자용 시작점 기준으로 다시 정렬했다. 이전에는 웹앱/모노레포 앱에서도 `keyFiles[0]`을 그대로 따라 `package.json`이 시작 파일로 뜨는 경우가 있었는데, 현재는 project type별로 분기한다. `풀스택 웹앱/프론트엔드 웹앱/모노레포 웹 플랫폼`은 `UI -> README -> package`, `API 서버/백엔드 API 서비스`는 `API -> README -> package`, `라이브러리/예제/개발 도구`는 `README 우선`이다. 실제 공개 레포 smoke에서도 `gitdiagram -> src/app/page.tsx`, `cal.com -> apps/web/app/page.tsx`, `n8n -> README.md`, `openai/openai-python -> README.md`로 정리된다. 이 변경은 아직 일부 Result view-model이 `summary.recommendedStartFile`을 직접 읽는 현 상태에서, Claude가 UI를 정리하기 전에도 시작점 앵커가 더 자연스럽게 보이게 만드는 backend-side 정합화다.
가장 최근 backend slice에서는 Result IA의 실제 입력 품질을 직접 손봤다. 실레포 `openai/openai-python`가 `types/model.py`, `resources/models.py`, `cli/_api/models.py` 때문에 `DB` 레이어처럼 보이던 문제를 기준 케이스로 삼아, Python SDK model/resource 경로 false positive를 제거하고 `src/<package>/**/*.py` 계열을 library logic로 분류하도록 heuristics를 보정했다. 그 결과 공개 SDK 레포는 `README -> library entry -> 핵심 로직` 흐름으로 읽히고, 캔버스에서도 가짜 `DB` 박스 대신 `Logic` 중심 구조를 보여줄 수 있게 됐다. 동시에 live regression script는 `layerNamesContain/layerNamesAbsent` expectation도 읽도록 확장돼 Result 화면의 구조 신호를 projectType 외에 layer 구성까지 잠글 수 있게 됐다.
가장 최근 backend 마감 작업에서는 `내 환경 7축` 계약이 실제 분석 파이프라인까지 모두 연결됐는지 다시 점검하고, compare / user-env 판정이 직접 의존하는 환경 휴리스틱을 튜닝했다. 현재 `buildEnvironmentGuide`는 `hardware.acceleratorPreference`, `hardware.cpuArch`, `hardware.minVramGb`, `cloud.deployTargets`, `cloud.deployTargetRequired`, `runtimeMode`, `costEstimate`를 모두 실제 helper 호출 결과로 채운다. 여기에 더해 서비스 env key 감지는 `NEXT_PUBLIC_`, `PUBLIC_`, `VITE_` prefix를 벗긴 뒤 canonical service로 매핑하도록 보강돼 `Supabase` 같은 frontend env 기반 서비스도 `servicesRequiredDetails`에 안정적으로 들어간다. 비용 tier는 `Supabase/Firebase` 단독 신호만으로 올라가지 않게 조정해 `free-tier Vercel + Supabase` 케이스를 보수적으로 `free`로 유지한다.
가장 최근 regression hardening에서는 실제 공개 SDK monorepo 경계도 다시 조정했다. `vercel/ai`처럼 root package명이 publishable package명과 다르고 root README가 package README로 redirect되는 저장소는 기존 `strong library text` 조건만으로는 `packages/ai` 대신 다른 sibling package를 focus root로 고를 수 있었다. 현재는 `repo name == workspace leaf`와 `root README -> workspace README`를 library-focus 직접 신호로 승격해 이런 케이스를 보정한다. 동시에 live regression set도 넓혀 `cal.com`, `n8n`, `supabase`, `clerk/javascript`에서 서비스/배포/비용 expectation을 함께 잠가, projectType뿐 아니라 environment heuristic drift도 public repo 기준으로 바로 잡히게 했다.
가장 최근 planning slice에서는 "알파 출시 전 무엇을 먼저 잠가야 하는가"도 문서로 고정했다. 핵심은 backend와 frontend의 책임 분리다. Codex는 `Result-Contract.md`와 `scripts/result-qa-corpus.json`을 기준으로 source-of-truth, representative graph 품질, coverage/rate-limit 정책, regression corpus를 먼저 잠그고, Claude는 그 위에서 Result IA, 캔버스 시각 정돈, 중복 제거, partial 상태 표현을 정리한다. 이 순서는 제품 전달력을 먼저 잠그고, 그 다음 신뢰도/운영성, 마지막으로 실브라우저 QA를 닫는 흐름이다.
테스트 계층도 이번 slice에서 environment/compare용 케이스를 더 촘촘하게 고정했다. `tests/environment-requirements.test.ts`에는 `free-tier Vercel + Supabase`와 `CLI-only -> local-only`를 추가했고, `tests/analyzer-fixtures.test.ts`에는 `import-as-library / run-as-app / hybrid / unknown` consumptionMode 분기와 `Upstash Redis/OpenAI/Anthropic/Supabase/Stripe/Clerk/Postgres` canonicalId 매핑을 직접 검증하는 fixture를 넣었다. 현재 기준 전체 단위테스트는 `200/200`, `pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`까지 모두 통과한다.
가장 최근 follow-up에서는 남아 있던 app-vs-library와 docker-role 정밀도를 다시 보강했다. 최소 Vite/React SPA에서 `src/main.tsx`, `src/App.tsx`를 기존 `library entry` 규칙과 같은 레벨로 보면 UI 레이어가 사라지고 `라이브러리 또는 개발 도구`로 내려갈 수 있기 때문에, 이 경로들을 별도 UI surface로 승격하고 UI representative score도 component 급으로 올렸다. 그 결과 component 디렉터리가 없는 최소 SPA도 `프론트엔드 웹앱`과 `UI` 레이어를 유지한다. Docker 쪽도 exact filename(`Dockerfile`, `compose.yaml`)만 보던 한계를 넘겨 `docker-compose.dev.yml`, `Dockerfile.prod` 같은 variant basename을 함께 수집하고, `dockerRole`은 `recommended` 하나로 뭉개지지 않게 `optional-dev` / `optional-deploy`를 다시 구분한다. 현재 기준 전체 단위테스트는 `198/198`, 관련 lint와 `pnpm build`까지 모두 통과한다.
이번 follow-up에서는 남아 있던 3개 backend 우선순위를 닫았다. 첫째, large monorepo에서 root `package.json` runtime dependency가 현재 focus app을 오염시키지 않도록 service promotion을 다시 좁혔다. 이제 nested workspace가 보이면 root dependency는 ambient/optional 쪽으로 더 가깝게 다루고, required 승격은 focus package, schema/path/readme/compose, 그리고 그와 교차 검증된 semantic 신호를 우선 사용한다. 둘째, `deployTargetRequired`는 더 보수적으로 바뀌었다. `Vercel`/`Railway`/`Fly.io`/`Render`/`Netlify`는 설정 파일이 있어도 기본적으로 “가능한 배포처”로만 남고, `AWS/GCP/Azure` 같은 infra-cloud만 hard-required 후보로 본다. 셋째, analysis live regression이 summary-only가 아니라 environment까지 잠그도록 확장됐다. 현재 repo live regression은 `next-learn`의 `Vercel but not required`, `gitdiagram`의 `Cloudflare R2/OpenAI/Upstash Redis + llm/storage cost drivers`를 실제 공개 레포 기준으로 확인한다.
관련 회귀도 보강됐다. `tests/environment-requirements.test.ts`에는 `focus workspace service signals over unrelated root monorepo dependencies`와 `does not force Vercel as a required deploy target` 케이스가 추가됐고, `scripts/check-analysis-regression.mjs`는 `envRuntimeMode`, `envDeployTargets`, `envDeployTargetRequired`, `envServicesRequired/Optional`, `envCostTier`, `envCostDriverKinds` expectation을 읽을 수 있게 됐다. 현재 기준 `pnpm test:unit`은 `195/195`, `pnpm build`, `pnpm lint`, `pnpm exec tsc --noEmit`, repo live regression까지 모두 통과한다.
가장 최근 backend refinement에서는 초보자용 상단 정체성 문장을 한 번 더 압축했다. README에서 잡힌 subtitle 후보는 먼저 짧은 한국어 설명으로 줄이고, 그 문장이 현재 `projectType/plainTitle`과 충돌하면 버린 뒤 더 안전한 fallback으로 교체한다. 그래서 `gitdiagram`은 `GitHub 레포 구조를 빠르게 파악하게 돕습니다.`, `openai/openai-quickstart-node`는 `다른 코드에서 어떤 기능을 가져다 쓰는지 중심으로 읽으면 됩니다.`처럼 레포 성격과 맞는 문장으로 정리된다. 동시에 `컴포넌트 라이브러리 또는 디자인 시스템` 계열은 `recommendedStartFile`을 README 우선으로 다시 맞췄고, live regression runner도 `repo`와 `owner` scope를 분리해 repo heuristic 검증이 owner sampling/rate-limit 이슈에 막히지 않게 했다. 현재 live regression은 `repo=14 cases`, `owner=2 cases`로 각각 독립 통과한 상태다.
현재는 여기에 더해 content-aware analysis의 Phase A 기반 작업으로, 최종 분석 범위 안에서 대표 파일 본문을 제한 예산으로 수집하는 레이어가 추가됐다. 또 Result 캔버스가 실제로 보는 `analysis.layers`는 저장소 전체 신호와 분리해, monorepo / tutorial / library focus repo에서 `focusRoot` 기준의 표시용 레이어로 재구성하도록 바뀌었다. 이제 그 다음 단계로 representative contents에서 `fetch`, route handler, DB client, external SDK 같은 shallow semantic 신호를 추출해 one-liner, key features, facts, inferences, key file 설명에 주입하도록 확장했다. 최근 UI는 다시 한 번 정리돼, Result 화면이 구조도만 보여주는 대시보드가 아니라 `README보다 먼저 읽는 이해 화면`처럼 보이도록 summary strip, 학습 중심 Inspector, 레이어 기술 힌트, 일관된 Landing/Analyzing 카피를 갖추게 됐다. 여기에 더해 이제 Result 본문은 `이해 화면 | 구조도` 보기 전환을 갖고, 좌측 패널은 분석된 레이어만 노출하며, 의미 레이어로 들어가지 못한 파일은 `Code` fallback과 상태 패널로 드러낸다. `Code`를 누르면 전용 inspector가 열리고, graph에 없는 샘플 파일도 `file-fallback:*` pseudo target을 통해 개별 파일 inspector까지 내려갈 수 있다. 최근에는 analyzer가 `unclassified_code_preview`, `unclassified_code_reasons`, `unclassified_code_semantic_hints`, `unclassified_code_content_coverage` fact를 함께 만들도록 바뀌어서, `Code` inspector가 sample 3개 대신 더 넓은 preview, 경로 유형 요약, 대표 본문 기반의 의미 힌트를 같이 보여준다. live 분석에서도 미분류 경로 일부를 representative-content fetch에 우선 시드해, fallback 설명에 필요한 본문 근거가 더 자주 확보되도록 바뀌었다. 구조도 탭은 기존 graph model을 재사용해 `repo -> cluster -> focus scope -> layer -> key file` 흐름을 시각적으로 보여준다. 최근 slice에서는 여기에 더해 diagram 입력 품질을 손봐, generic entry/util 파일이 레이어 대표 파일을 차지하지 않도록 하고, `src/index.ts` 같은 entry-only Logic buckets는 `Code` fallback으로 내려 partial 상태로 처리하도록 조정했다. `graph` 모델은 이제 같은 점수 함수를 사용해 layer 대표 파일과 sample path를 정렬하며, 각 layer card에 confidence를 함께 붙인다. 이어서 representative file contents에서 internal import edge를 해석해 `UI -> Logic`, `API -> Logic` 연결을 별도 fact/inference로 만들고, focus root 바깥에 있더라도 대표 흐름에서 직접 import된 Logic 파일은 key file 목록에 보강해 읽기 순서가 실제 코드 흐름과 더 가깝게 맞췄다. 그 semantic score는 `readOrder`와 `editGuides`에도 직접 적용돼 첫 수정 포인트와 파일 순서가 대표 흐름 기준으로 더 일관되게 정렬된다. 이번 slice에서는 한 단계 더 나아가 `API -> Logic -> DB/External` 2단 흐름을 추론해 `api_logic_integration_flow` inference와 `연결 후 연동` / `하위 연동` evidence를 만들도록 확장했다. 여기에 더해 새 `analysis.learning` 블록이 추가되어, 프론트가 초보자용 기술 설명, 판단 근거, 사용법, 미리보기 데이터를 별도 파싱 없이 바로 쓸 수 있게 됐다. 이어진 hardening slice에서는 focus workspace의 `package.json/README`도 대표 본문으로 시드해 monorepo의 사용법과 미리보기 정확도를 높였고, `analysis.coverage`를 별도 구조로 내려서 프론트가 partial/limited 상태를 facts 파싱 없이 바로 사용할 수 있게 했다. 이번 추가 refinement에서는 root `package.json`의 workspace-runner script(`turbo`, `pnpm --filter`, `nx`, `yarn workspace`)를 실제 실행 명령으로 유지하고, app homepage vs storybook/docs 링크 사이에서 더 canonical한 preview URL을 고르도록 scoring을 조정했다. 이어서 README 링크 추출도 section heading 문맥을 포함하도록 바꿔 `Getting Started / Learn More / Security / Deployment` 안의 vendor/docs/tutorial 링크 false positive를 줄였고, repo identity boost도 generic token 하나가 아니라 full slug/의미 있는 token 조합 기준으로만 주도록 좁혔다. live regression 기준 `openai/openai-quickstart-node`, `calcom/cal.com`, `sourcewizard-ai/react-ai-agent-chat-sdk`의 preview 오탐은 사라졌고, `next-learn`, `headlessui`, `supabase` 같은 positive 케이스는 유지된다. 이제 여기에 더해 입력창은 그대로 둔 채 URL 모양만 보고 `repo`와 `owner`를 자동 분기한다. owner URL이면 `organization/user 전체 구조도`가 아니라 `공개 포트폴리오 이해 화면`을 만들고, 거기서 대표 repo를 선택해 기존 repo 분석 화면으로 drill-down하는 2층 구조로 확장됐다. 가장 최근 backend slice에서는 여기에 더해 `focusRoot`가 있는 결과의 `summary.stack`을 glossary evidence 기준으로 한 번 더 정제해, sibling workspace 기술이 보이는 문제를 줄였다. 동시에 `analysis.learning.identity`에 `stackNarrative`와 `stackHighlights`를 추가해, 프론트가 glossary 전체를 다시 분석하지 않고도 상단 IA에서 `이 레포의 핵심 기술이 이 저장소에서 무슨 역할을 하는지` 바로 표현할 수 있게 됐다. 이어서 `analysis.learning.identity.header.subtitle`와 `analysis.learning.identity.header.points`를 추가해, README 핵심 문장과 코드 기반 feature를 헤더 전용 계약으로 압축했다. 이 header 계약은 README marketing copy를 그대로 복제하지 않고, colon-label형 홍보 문구와 과도한 promotional wording을 걸러낸 뒤 필요하면 `summary.keyFeatures` 기반 포인트로 fallback한다. 이번 추가 refinement에서는 subtitle 자체도 다시 정리했다. raw 영어 README 문장을 그대로 넘기지 않고, `readme summary -> 안전한 한국어 패턴 치환 -> plainTitle/stackSummary/outputType 기반 fallback` 순서로 한국어 one-liner를 만든다. 그래서 `gitdiagram`은 `공개 GitHub 레포를 구조와 설명 중심으로 빠르게 이해하게 돕는 도구입니다.`, `n8n`은 `자동화 흐름과 여러 연동 작업을 관리하는 서비스입니다.`, `next-learn`은 `예제 앱과 참고 코드를 함께 모아 둔 학습용 저장소입니다.`처럼 상단 설명을 읽자마자 방향을 잡을 수 있다. 이번 slice에서는 여기에 더해 `projectType`과 `stackSummary` 오판을 다시 보정했다. 핵심 변경은 세 가지다. 첫째, `packages/frontend/editor-ui`처럼 package 트리 안에 있는 실제 product app root도 `primary app workspace`로 본다. 둘째, `모노레포 웹 플랫폼` 판정은 library 판정보다 먼저 서게 해 service-style monorepo가 SDK로 떨어지지 않게 했다. 셋째, `학습용 예제 저장소` 판정의 tutorial/example 텍스트는 `.env.example`, `steps below` 같은 운영 문구를 덜 건드리도록 좁혔다. 결과적으로 live smoke에서 `n8n`은 `projectType=모노레포 웹 플랫폼`, `stackSummary=여러 앱과 공용 패키지를 함께 운영하는 서비스 플랫폼`으로 바뀌었고, `gitdiagram`은 `projectType=풀스택 웹앱`, `stackSummary=AI 기능이 들어간 풀스택 웹앱`으로 정상화됐다. `next-learn`은 기존 `학습용 예제 저장소` 분류를 유지해 regression도 없다. 이어진 slice에서 `header.points` fallback도 정리했다. 이제 README key point가 비어 있으면 `summary.keyFeatures`를 그대로 재사용하지 않고, `페이지 기반 진입 구조 -> 주요 화면에서 어떤 동작이 시작되는지 먼저 볼 수 있습니다`, `공용 패키지 + 앱 분리 구조 -> 앱 코드와 공용 패키지가 어떻게 나뉘는지 바로 파악할 수 있습니다`처럼 초보자용 입문 문장으로 다시 매핑한다. 가장 최근 slice에서는 여기서 한 단계 더 나아가, README-derived point도 `header.points`에서는 raw English로 두지 않도록 바꿨다. 지금 규칙은 `프로젝트 구조 설명`, `핵심 파일/읽는 순서`, `코드 보기 전 미리보기`, `레이어로 보기`, `수정 전 먼저 볼 파일`, `아키텍처 다이어그램 변환`, `Mermaid/PNG 내보내기`, `오픈소스 일정 관리 플랫폼` 같은 안전한 패턴만 한국어 입문 문장으로 바꾸고, 약한 영어 bullet은 노출하지 않고 fallback 포인트로 채운다. 그래서 live smoke 기준 `cal.com`은 `커뮤니티 중심으로 운영되는 오픈소스 일정 관리 플랫폼입니다.`, `gitdiagram`은 `생성된 다이어그램을 Mermaid 코드나 PNG로 내보낼 수 있습니다.` 같은 제품 설명 포인트를 한국어로 보여주고, `next-learn`처럼 README point가 약한 레포는 code-derived fallback 포인트로 채운다. 지난 slice에서는 `summary.oneLiner` 밀도도 한 번 더 줄였다. 이제 구조 문장과 semantic 근거 문장이 함께 있을 때는 별도 3문장으로 두지 않고, `... 기준으로 구조를 정리했고, 대표 코드에서는 ...` 형태로 병합한다. API-flow addon도 `app/page.tsx에서 /api/analyze 요청을 보내고 ...` 같은 로그형 문장을 그대로 쓰지 않고, `대표 코드에서는 /api/analyze 요청 뒤 Prisma 연결과 OpenAI 연동이 확인됩니다.`처럼 상단 카피에 맞는 문장으로 압축한다. 그래서 live smoke 기준 `cal.com`, `n8n`, `gitdiagram`은 모두 2문장 one-liner로 내려온다. 이번 slice에서는 semantic signal을 한 번 더 분리했다. 이제 top-level `summary.keyFeatures`에는 `Prisma 연결 확인`, `Stripe 연동 확인`, `OpenAI 연동 확인`, `TypeORM 연결 확인`처럼 제품 이해에 직접 닿는 integration 신호만 남기고, `대표 API 흐름 감지`, `화면-로직 연결 확인`, `API 내부 로직 연결 확인` 같은 흐름/배선 detail은 `oneLiner`, `facts`, `inferences`, file evidence 쪽에만 남긴다. 외부 연동도 one-liner와 같은 우선순위를 따라 `Sentry` 같은 observability-only 이름은 stronger signal이 있으면 상단 key feature에서 빠진다. 그래서 live smoke 기준 `cal.com`의 상단 key features는 `Prisma + Stripe`, `n8n`은 `TypeORM 연결 확인`만 남고, API 흐름은 상단 key feature가 아니라 설명 문장과 근거 레이어에서만 보인다. 현재 남은 리스크는 어떤 semantic integration을 top summary에 남기고 어떤 것은 inspector/facts로 더 내릴지의 세밀한 경계다.

## Decisions

- 1단계 MVP는 AI 없이도 동작해야 한다.
- MVP 결과 화면은 `Overview`, `Architecture`, `Key Files`, `Edit Guide Lite`만 포함한다.
- 중앙 메인 콘텐츠는 무한 캔버스가 아니라 스크롤형 학습 워크스페이스다.
- 분석은 fact-first static analysis로 설계한다.
- 초기 지원 스택은 Next.js, React, Node.js 중심으로 제한한다.
- 구조도는 파일 트리 시각화가 아니라 레이어 구조 시각화여야 한다.
- Codex-native harness를 프로젝트 운영 골격으로 채택한다.
- 앱 셸은 Next.js App Router, TypeScript, Tailwind 4 조합으로 간다.
- 초기 repo 분석은 GitHub REST API를 통해 repo 메타데이터, branch SHA, recursive tree, package.json을 읽는 방식으로 시작한다.
- 설명 계층은 아직 템플릿 기반 문장 생성으로 유지하고, AI는 도입하지 않는다.
- UI 흐름은 `app/page.tsx`, `app/analyzing/page.tsx`, `app/result/page.tsx` 세 라우트로 분리한다.
- `result` 라우트는 세션 캐시가 있으면 즉시 결과를 복원하고, 없으면 같은 repo를 다시 분석해 복구한다.
- 분석기는 노이즈 파일을 제외하고 route, api, component, db, cli, library 신호를 계산한 뒤 프로젝트 유형과 edit guide를 결정한다.
- tooling/harness 저장소는 운영 문서, hook/script, template 경로를 별도 신호로 다뤄 `라이브러리 또는 개발 도구` 유형에서 README 과밀도를 줄인다.
- `.py` 파일도 분석 가능 경로에 포함해서 tooling repo의 stack과 Logic 레이어를 놓치지 않도록 한다.
- 아키텍처 인스펙터에서 focus root가 없을 때는 `root app` 대신 `repo root`로 표현한다.
- multi-pack tooling repo에서는 top-level file count 대신 root-level operation docs, scripts, templates 밀도를 함께 점수화해 대표 tooling root를 고른다.
- 클라이언트 `sessionStorage` 캐시는 versioned envelope를 사용하고, 예전 raw-cache 포맷은 읽는 즉시 폐기한다.
- tooling root가 감지되면 결과 화면의 focus rail에 `tooling` 항목을 추가하고, 메인 캔버스에 `Focus Scope` 카드로 보여준다.
- tutorial/example 저장소에서는 `solution`, `complete`, `final`, `reference` 같은 루트를 `starter/template/boilerplate`보다 대표 예제로 우선한다.
- example collection의 Key Files는 선택된 대표 루트의 route/layout/api/component/config에 최대한 고정하고, 다른 예제 폴더의 config 파일은 섞지 않는다.
- server-side in-memory analysis cache key는 schema version 외에 heuristic version도 포함해, 분석 규칙 변경 후 stale 결과가 남지 않게 한다.
- 그래프 모델의 `tooling` rail은 실제 개발도구 저장소에서만 활성화하고, 일반 예제 저장소의 대표 루트는 `대표 범위`로 표시한다.
- content-aware analysis는 전체 파일을 무차별적으로 읽지 않고, 현재 분석 모드에 맞는 대표 파일만 제한적으로 읽는 방식으로 확장한다.
- representative content fetch의 초기 예산은 full mode 12개, limited mode 6개, 파일당 64KB 상한으로 둔다.
- tutorial/example 저장소에서 focus root가 정해진 경우, 그 바깥의 `starter/example/template` 경로는 representative content 후보에서 강하게 배제한다.
- tooling 저장소의 representative content는 route/page보다 운영 문서, harness script, template를 우선 포함할 수 있어야 한다.
- project type / difficulty / key features는 저장소 전체 신호로 판단하고, Result canvas에 들어가는 `layers`만 focus root 기준으로 다시 좁힌다.
- 새 Result inspector는 `result-view-model`을 통해 narrative/view 모델을 만들고, `InspectorOverlay`는 그 가공된 모델만 렌더링하는 구조로 간다.
- semantic 신호는 별도 `lib/analysis/semantics.ts`에서 추출하고, 기존 스키마를 유지한 채 summary/facts/inferences/keyFiles에 주입한다.
- semantic 추출은 README 같은 narrative 문서보다 코드/설정 파일을 우선 근거로 삼아 과장된 runtime 추론을 줄인다.
- Result 화면의 첫 블록은 repo명 아래 긴 텍스트가 아니라 stack chips + one-liner + 핵심 포인트 + 규모 감각 + 시작 CTA를 묶은 intro card로 간다.
- 다음 refinement에서는 intro card를 더 낮은 높이의 summary strip으로 압축하고, 상태 노출은 별도 chip으로 분리한다.
- 파일 Inspector는 편집 가이드보다 학습 맥락을 우선하며, 기본 3문단은 `이 파일은 뭐야? / 왜 중요해? / 어디서 쓰여?` 구조를 사용한다.
- 수정 가이드는 여전히 유지하되 기본 접힘 보조 정보로 강등한다.
- 레이어 기술 힌트는 분석기 신규 필드 없이 `summary.stack`, semantic facts, 레이어 파일 패턴으로만 보수적으로 추론하고, 근거가 약하면 숨긴다.
- Result 메인 뷰는 `이해 화면`과 `구조도` 두 보기로 유지하되, 전환 컨트롤은 상단 탭이 아니라 좌측 패널의 `보기` 섹션으로 이동한다.
- 구조도 탭은 새로운 분석 필드 없이 `ArchitectureGraphModel`의 기존 `repoCard`, `groupCards`, `focusWorkspace`, `layerCards`, `connections`를 재배열해 만든다.
- 좌측 패널은 `보기 / 레이어 / 범위 / 상태` 섹션을 갖고, 값이 없는 섹션은 heading까지 완전히 숨긴다.
- 구조도는 기본적으로 `repo -> scope -> layer` 3단 중심으로 읽히게 단순화하고, cluster/workspace 정보는 있을 때만 보조 문맥으로 남긴다.
- floating Inspector는 데스크톱에서는 우측 overlay, 작은 화면에서는 bottom sheet로 전환한다.
- Result 좌측 패널의 레이어 섹션은 고정 목록이 아니라 실제 감지된 레이어만 보여주고, 미분류 코드가 있을 때만 `Code` 항목을 추가한다.
- 부분 분석/제한 분석 판단은 `warnings`, `limitations`, `unclassified_code_* facts`를 묶은 별도 workspace status view-model로 계산하고, chip/패널/inspector가 같은 판정을 재사용한다.
- stale `.next` 타입 산출물이 현재 소스보다 오래된 컴포넌트를 참조할 수 있으므로, 삭제/이동 이후의 검증은 필요 시 `.next`를 정리한 뒤 다시 실행한다.
- `Code` fallback의 샘플 파일은 기존 graph inspectable이 있으면 `file:{path}`로, 없으면 `file-fallback:{path}` pseudo target으로 연결해 개별 파일 inspector를 연다.
- analyzer는 `LayerCoverageSummary.uncoveredReasons`를 통해 미분류 파일을 스크립트/도구, CLI, 엔트리 코드 같은 경로 유형으로 묶고, 그 요약을 fact/warning detail로 같이 내보낸다.
- analyzer는 미분류 파일에 대해서도 representative contents를 바탕으로 `DB 사용`, `내부 API 호출`, `CLI 실행`, `백그라운드 실행` 같은 얕은 의미 힌트를 별도 fact/warning detail로 내보낸다.
- live representative-content selection은 기존 핵심 경로 우선 규칙을 유지하되, 미분류 경로 일부를 seed로 섞어 fallback 설명 품질을 높인다.
- 레이어 대표 파일 선정은 이제 `짧은 경로`보다 `역할이 드러나는 파일명`을 우선한다. `route.ts`, `schema.prisma`, `repo-service.ts`, `useDiagram.ts`가 `index.ts`, `utils.ts`, 일반 config보다 먼저 대표 카드에 노출된다.
- weak layer demotion은 현재 전 레이어 공통 규칙이 아니라, 특히 Logic에서 `entry-only / generic-only` 조합을 우선 겨냥한다. 이렇게 해야 단일 `src/index.ts` 때문에 구조도에 의미 없는 Logic 박스가 생기지 않는다.
- `ArchitectureGraphModel`의 `keyFiles`, `samplePaths`는 이제 같은 representative ranking helper를 공유해 diagram/canvas 간 파일 순서가 덜 어긋난다.
- semantic import 추출은 relative import와 `@/`, `~/` alias import만 내부 링크 후보로 해석하고, 실제 snapshot path와 매칭되는 repo 내부 파일만 근거로 사용한다.
- 대표 UI/API 파일이 직접 import한 Logic 파일은 기존 focus-root keyFiles에 없더라도 최대 10개 한도 안에서 key file 목록에 보강해, 읽기 시작 파일에서 연결 로직으로 내려가는 흐름이 끊기지 않게 한다.
- semantic path score는 UI 시작 파일, UI가 직접 쓰는 Logic, 대표 API route, API 뒤의 Logic, DB/External 연결 파일 순으로 가중치를 주고, keyFiles와 editGuides가 같은 점수 체계를 공유하도록 한다.
- edit guide는 기존 intent taxonomy를 유지하고, semantic 신호는 파일 정렬과 reason/evidence 보강에만 사용한다. 이렇게 해야 UI copy를 흔들지 않고도 추천 우선순위를 더 실제 흐름에 가깝게 바꿀 수 있다.
- representative import graph는 최대 2 depth까지만 따라가며, `Logic`, `DB`, `External` 레이어로 향하는 내부 import만 second-order integration surface 근거로 사용한다.
- second-order flow는 analyzer 스키마를 바꾸지 않고 `inferences`와 `keyFiles[*].evidence`에 투영한다. 즉, 프론트는 새 API 계약 없이 기존 evidence/narrative 재구성만으로 후속 반영이 가능하다.
- 미분류 `Code` fallback도 이제 representative contents 안에서 내부 import를 따라간다. 즉, 파일 자체에 DB/OpenAI import가 없어도 `jobs/reconcile.ts -> services/reconcile-service.ts -> Prisma/OpenAI` 같은 간접 연동은 `간접 DB 사용 신호`, `간접 외부 SDK 사용 신호`로 fact/warning 요약에 드러낼 수 있다.
- Logic 대표 파일 tie-break는 단순 경로 길이보다 `services/hooks/actions/store/features` 같은 역할 디렉터리와 `service/repository/query/worker` 같은 basename 신호를 더 강하게 본다. 그래서 diagram/canvas 대표 파일이 `core/lib/utils`보다 실제 처리 로직 쪽으로 더 안정적으로 고정된다.
- live regression 스크립트는 이제 `inferenceIdsContain` expectation을 지원한다. 현재는 `sourcewizard-ai/react-ai-agent-chat-sdk`를 추가해 공개 레포 기준 `api_logic_flow`가 계속 유지되는지 검증한다.
- `analysis.learning.stackGlossary`는 기존 `summary.stack`을 초보자용 설명 데이터로 다시 풀어낸 블록이다. 각 항목은 쉬운 설명과 함께 `왜 이렇게 판단했는지` reasons 배열을 가진다.
- `analysis.learning.stackGlossary`는 `summary.stack`만 복사하지 않고, dependency/semantic 신호가 강한 기술(OpenAI, Zod, Express 등)을 보조 glossary 항목으로 덧붙일 수 있다. 대신 상위 8개까지만 내려 과밀해지지 않게 제한한다.
- `analysis.learning.usage`는 README의 fenced code block과 package scripts를 합쳐 `install/run/build/test/example` 명령으로 나눈다. focus workspace의 `package.json/README`가 있으면 루트보다 우선 사용하고, workspace script는 `cd <focusRoot> && ...` 형태로 scope를 명시한다.
- `analysis.learning.usage.details[*]`는 같은 명령을 프론트가 다시 해석하지 않도록 `kind/source/scope/explanation`을 함께 내려준다. 그래서 UI는 `루트 runner 명령`, `focus workspace 명령`, `README 예시 명령`을 바로 구분할 수 있다.
- focus workspace에 동일한 `dev/build/test/start` script가 있으면 루트 monorepo script보다 그것을 우선한다. 반대로 focus workspace script가 없고 루트 script가 `turbo`, `pnpm --filter`, `nx`, `yarn workspace` 같은 명시적 workspace-runner면, wrapper(`pnpm dev`) 대신 그 script body를 그대로 사용한다.
- `analysis.learning.preview`는 코드 실행이 아니라 증거 기반 preview다. 우선순위는 `README 이미지 -> deploy URL -> none`이며, README 상대 이미지 경로는 pinned SHA raw URL로 정규화한다. focus workspace README 이미지와 homepage도 루트보다 우선 후보로 본다.
- deploy preview scoring은 `app/demo/preview/live` 성격의 canonical homepage를 storybook/docs 링크보다 우선하도록 조정한다. 단, app homepage가 없으면 storybook/playground도 fallback candidate로 남길 수 있다.
- README preview 링크는 section heading 문맥까지 포함해 점수화한다. 그래서 `Getting Started`, `Learn More`, `Security`, `Deployment` 안의 vendor/docs/tutorial 링크는 같은 URL이라도 preview 점수를 강하게 깎는다.
- repo identity boost는 generic token 하나만으로 주지 않는다. repo full slug 일치나 의미 있는 token 조합이 있을 때만 공식 사이트/preview 후보에 추가 점수를 준다.
- `learning.preview.images[*]`는 `kind(ui/diagram/generic)`와 `confidence(high/medium)`를 함께 내려 프론트가 screenshot 중심으로 정리하거나 약한 이미지를 숨기기 쉽게 한다.
- `learning.preview.deployConfidence`와 `learning.preview.deployRationale`도 함께 내려, deploy URL이 package homepage 기반인지 README 링크 기반인지, 어느 정도 자신 있게 추천하는지 프론트가 바로 배지/문장으로 바꿀 수 있게 한다.
- `analysis.learning.environment`는 preview와 별개의 learning 블록으로 둔다. 초보자 질문인 “내 환경에서 돌아가나?”에 답하기 위해 `런타임 / Docker 여부 / 하드웨어 / 외부 서비스 / 배포 타깃`을 deterministic하게 묶어 내려준다.
- environment runtime source는 실제 파일 출처를 그대로 보존해야 한다. 그래서 `.node-version`, `Pipfile`, `rust-toolchain`, `deno.json`은 별도 source 값으로 유지한다.
- 환경 파일 탐색은 root/focus root exact match만으로 끝내지 않는다. `n8n` 같은 모노레포는 Docker/compose를 nested path에 두기 때문에, basename 기준 nested candidate를 소수만 추가 fetch하는 방식으로 넓힌다.
- environment support fetch는 `.env.example/.env.sample/.env.template/.env.local.example`와 compose override 파일까지 포함한다. 이 범위는 “실행 힌트는 잡되, 실제 secret file은 긁지 않는다”는 선에서 멈춘다.
- path-based 서비스 추론은 인프라/설정 맥락에서만 허용한다. 그렇지 않으면 `gitignore` 같은 템플릿 저장소에서도 `Redis 필요` 같은 false positive가 생긴다.
- environment 외부 서비스는 `cloud.servicesRequired`와 `cloud.servicesOptional`로 나눈다. `required`는 schema provider, direct compose, 대표 semantic usage 같이 실행에 직접 닿는 신호만 허용하고, dependency-only/nested compose/observability는 `optional`로 내려 UI가 과장 없이 약하게 표현할 수 있게 한다.
- representative Dockerfile/compose는 하나를 점수화해 고른다. focus scope, `docker/`/`infra/`, repo 이름 매치, EXPOSE/CMD/ports`는 가산하고, `.devcontainer`, `.github`, `base/runner/distroless`, test/example 경로는 감점한다.
- direct env example에서 읽힌 DB/cache 서비스는 required 후보에 올리고, provider 서비스(OpenAI/Anthropic/Stripe/Supabase/Firebase)는 semantic/dependency corroboration이 있을 때만 required로 승격한다.
- README hardware notes는 concrete requirement 우선으로 정렬한다. `CUDA/GPU`, `8GB RAM`, `minimum/recommended/권장`이 있는 문장을 올리고, install/setup 잡음은 감점한다.
- usage explanation은 command wrapper가 아니라 script body까지 본다. 그래서 `npm run dev`라도 내부가 `docker compose up`이면 그 의미를 설명 문장에 반영할 수 있다.
- preview deploy rationale은 URL provider와 deploy config(`vercel.json`, `fly.toml` 등)가 맞아떨어질 때 “같은 배포 대상 설정 파일이 있다”는 근거를 추가한다.
- 현재 environment confidence는 `README only -> low`, `non-README source 1개 -> medium`, `non-README source 2개 이상 -> high` 규칙으로 계산한다.
- `analysis.coverage`는 partial/limited 판단을 프론트 view-model이 아니라 백엔드 결과에 고정한다. 여기에는 `level`, `chipLabel`, `summary`, `details`, 미분류 코드 수/샘플, 미분류 사유 그룹, semantic 그룹, 지원 스택 gap 메시지가 포함된다.
- landing 입력은 별도 `repo / organization` 버튼 없이 유지한다. URL shape만으로 `owner/repo`와 `owner`를 자동 분기하는 편이 초보자 UX에 더 낫다.
- owner-level 분석은 repo 분석의 상위 진입점이다. 즉, owner 화면은 포트폴리오/대표 repo 추천에 집중하고, 실제 코드 구조 이해는 repo drill-down 뒤의 기존 Result 화면이 담당한다.
- owner 포트폴리오 결과는 기본적으로 metadata-first지만, 대표 후보 품질을 높이기 위해 상위 일부 repo에 한해 README/package.json을 얕게 샘플링한다. 이 샘플링은 owner당 제한된 fetch budget 안에서 category/stack/theme를 보정하는 용도이며, 깊은 코드 분석은 여전히 사용자가 클릭한 repo에 대해서만 수행한다.
- owner 샘플링 fetch budget은 인증 유무에 따라 달라진다. 현재는 `GITHUB_TOKEN`이 있으면 최대 8개 repo, 없으면 최대 3개 repo만 enrichment 대상으로 잡아 unauthenticated rate-limit 압박을 낮춘다.
- `summary.sampledRepoCount`는 owner 요약에 포함된 metadata repo 수이고, `summary.enrichedRepoCount`는 그중 README/package.json을 얕게 읽은 repo 수다. 프론트가 둘을 같은 의미로 섞어 쓰면 안 된다.
- owner featured/beginner 추천은 단일 `featuredReason` 문자열만이 아니라 `featuredReasonDetails`, `beginnerReasonDetails`, `sampling` 구조도 함께 내려 프론트가 이유를 badge/list/tooltip 형태로 재배치할 수 있게 한다.

## Known Gaps

- 레이어 분류는 경로 패턴 기반이라 일부 레포에서 UI/Logic 판정 정밀도가 낮을 수 있다.
- 현재는 분석 결과 persistence가 없다.
- 지원 repo 크기 제한과 reduced-analysis 정책은 아직 수치가 없다.
- tutorial repo, example collection, monorepo-adjacent repo에서는 어떤 앱이 대표 엔트리인지 판단이 아직 완벽하지 않다.
- tooling root 선택은 현재 path-shape 기준이라, 실제 사용자 트래픽이나 pack 사용 빈도 같은 외부 신호는 아직 반영하지 않는다.
- representative file contents는 아직 수집만 하고 있으며, one-liner, flow, edit guide에 semantic 신호로 반영되지는 않았다.
- 추가 파일 fetch가 들어갔기 때문에 unauthenticated GitHub rate limit 환경에서는 이후 Phase B/C를 진행하기 전에 fetch budget과 graceful degradation을 계속 점검해야 한다.
- focus-scoped layer 출력은 해결됐지만, layer 판정 자체는 아직 경로 패턴 기반이라 shared utility나 domain 폴더의 실제 역할을 semantic하게 재분류하지는 못한다.
- 현재 semantic 신호는 2단 import chain까지는 반영하지만, 여전히 component tree, symbol-level usage, runtime execution frequency까지는 반영하지 못한다.
- edit guide ranking과 read order는 이제 representative semantic score를 일부 반영하지만, 여전히 symbol-level call graph나 실제 runtime frequency는 반영하지 못한다.
- 현재 stack chip과 layer tech hint에 전문용어 설명(glossary/tooltip)은 붙어 있지 않다.
- intro card를 summary strip으로 더 압축한 뒤에는 작은 화면에서 stack chip 수와 CTA 밀도를 다시 조정해야 한다.
- 구조도 탭은 현재 actual import graph가 아니라 high-level structure map이므로, gitdiagram류의 깊은 파일 dependency graph를 기대하면 아직 부족하다.
- 구조도 레이아웃은 현재 고정 프레임 기반이라, 레이어 수나 workspace cluster 수가 크게 달라지는 대형 repo에서는 추가 조정이 필요할 수 있다.
- diagram 탭이 더 정렬돼 보이려면 프론트 레이아웃뿐 아니라 edge 강도와 node 배치에 쓸 rank/confidence를 더 노출해야 한다. 현재는 layer card confidence만 있고, edge-level importance는 아직 별도 모델이 없다.
- `Code` fallback은 이제 inspector와 fallback-file drill-down까지는 지원하지만, 아직 캔버스 안에서 별도 cluster/node로 시각화되지는 않는다.
- `unclassified_code_preview`는 현재 최대 8개만 노출하므로, 미분류 파일이 더 많을 때 전체 리스트 탐색 UI는 아직 없다.
- 미분류 코드 semantic summary는 representative contents에 포함된 파일만 근거로 삼기 때문에, coverage가 낮은 큰 저장소에서는 `X/Y`로 부분 근거임을 계속 드러내야 한다.
- second-order `api_logic_integration_flow`까지 안정적으로 드러나는 공개 서비스-hop 레포는 아직 regression set에 충분하지 않다. 현재 live set은 `api_logic_flow` 공개 케이스 + 로컬 fixture 기반 indirect DB/External hop 검증 조합으로 유지한다.
- README 이미지 기반 preview는 이제 focus workspace README까지 보지만, 자동 브라우저 캡처나 실제 코드 실행 미리보기는 아직 없다.
- deploy preview confidence는 이제 내려주지만, 실제 브라우저 렌더 성공 여부까지 확인하는 것은 아니다. 즉, `confidence=high`도 어디까지나 링크/문서 증거 기반이다.
- environment 서비스 추론은 이전보다 보수적으로 바뀌었지만, 아직 일부 monorepo에서는 대표 semantic file가 부족하거나 `.env.example`가 optional 기능만 담고 있어서 `required`가 비어 있고 `optional`만 채워질 수 있다. `n8n`처럼 이 상태가 실제로 더 안전한 레포도 있으므로, false negative와 false positive를 계속 균형 잡아야 한다.
- nested Dockerfile이 여러 개인 저장소는 어떤 이미지가 “대표 실행 이미지”인지 완벽히 고르지 못할 수 있다. 현재는 root/focus 우선, 그다음 `docker/`, `deploy/`, `infra/` 계열을 점수화해 상위 후보를 쓴다.
- owner 분석은 이제 상위 repo README/package 샘플링까지 쓰지만, 여전히 repo tree/file 구조를 owner 단계에서 읽지는 않는다. 따라서 owner 포트폴리오 화면은 구조도보다 포트폴리오 지도에 가깝다.
- owner 결과 UI는 현재 기능 검증용 임시 구조다. IA 자체는 맞지만, 최종 시각 정보 밀도와 상호작용은 Claude 쪽 리파인이 필요하다.
- usage 추출은 이제 explanation까지 내려주지만, workspace runner 명령이 정확히 어떤 URL/페이지를 띄우는지까지는 모른다. 즉, `web 워크스페이스를 실행합니다` 수준의 설명이지 실제 runtime preview와 연결되지는 않는다.
- `summary.oneLiner`는 이제 `plainTitle/header.subtitle`과 같은 초보자 계약을 공유한다. analyzer는 learning guide를 먼저 만든 뒤 그 값을 재사용해 one-liner를 조립하므로, raw 영어 description이 상단 설명으로 바로 새지 않는다.
- `summary.oneLiner`는 현재 최대 3문장으로 압축하되, `구조 안내 + semantic addon`이 함께 있으면 두 문장을 병합해 2문장으로 먼저 줄인다. 제한 안내는 semantic 근거가 있을 때 계속 뒤로 밀린다.
- `plainTitle`는 이제 `repoName + repoDescription + readmeIntro + useCase`를 함께 본다. 그래서 `repository browsing`, `diagram`, `calendar/booking` 같은 제품 유형을 generic `웹앱/도구` 대신 더 직접적인 한국어 제목으로 바꿀 수 있다.
- one-liner 첫 문장은 `identitySubtitle`이 항상 우선이 아니다. subtitle이 `구조를 먼저 보면...` 같은 구조 안내형 문장이면, 더 구체적인 `plainTitle`을 first sentence로 올린다. `cal.com` live smoke가 이 규칙을 검증한다.
- `header.subtitle`도 이제 같은 방향으로 조정됐다. `stackSummary`보다 `plainTitle` 기반 fallback을 먼저 보고, README summary 번역도 `scheduling/booking`, `diagram`, `repository browsing` 같은 제품 유형을 직접 번역한다.
- semantic one-liner addon은 provider 나열보다 제품 설명력을 우선한다. 현재 규칙은:
  - 흐름 문장이 있으면 그 문장을 우선
  - observability-only 이름(`Sentry`)은 stronger signal이 있을 때 제거
  - DB와 외부 연동이 같이 있으면 `DB 1개 + 핵심 외부 연동 1개`를 우선
- semantic addon 문장 템플릿도 한 단계 더 정리됐다. 현재는 `Prisma 연결과 Stripe 연동`, `TypeORM 연결`, `OpenAI 연동`처럼 DB/외부 연동 역할을 문장 안에서 분리해 읽게 한다.
- live smoke 기준 현재 identity 계약은 다음 세 케이스에서 안정적이다.
  - `vercel/next-learn`: `학습용 예제 저장소` 성격이 `plainTitle`과 `oneLiner` 모두에 반영된다.
  - `n8n-io/n8n`: 모노레포 플랫폼 분류와 별개로 사용자 관점 설명은 `자동화 흐름을 만들고 실행하는 서비스`로 압축된다.
  - `ahmedkhaleel2004/gitdiagram`: product description의 영어 marketing copy를 쓰지 않고, `GitHub 레포를 이해하기 쉽게 보여주는 도구`로 정리된다.
- `cal.com` live smoke 기준 subtitle은 이제 `일정 선택, 예약 생성, 관리 흐름을 서비스 관점에서 따라가며 읽을 수 있습니다.`로 내려오고, one-liner addon은 `Prisma, Stripe`를 우선한다.
- `cal.com` live smoke 기준 one-liner addon은 이제 `Prisma 연결과 Stripe 연동이 확인됩니다.`로, `n8n`은 `TypeORM 연결이 확인됩니다.`로 정리된다.
- `header.points` fallback 중복도와 raw English README bullet 노출은 이전 slice에서 줄였고, 지난 slice에서는 one-liner 문장 밀도도 줄였다. 이번 slice에서는 top-level semantic key feature에서 `대표 API 흐름 감지`까지 내려 product-facing integration signal만 남기도록 좁혔다. 현재 남은 아이덴티티 리스크는 어떤 integration 이름을 상단에 남길지의 세밀한 경계다.

## Restart Point

1. Claude는 repo Result IA 최종 정리에 집중한다. 우선순위는 `summary/trust strip -> main canvas -> inspector` 정보 위계 고정, 중복 라벨 제거, partial/limited 상태의 가벼운 신뢰도 표현이다.
2. Claude는 메인 캔버스의 질서감을 더 끌어올린다. 현재 backend representative ordering은 잠겼으므로, 다음 단계는 좌측 패널 IA, 캔버스 그룹핑, Code fallback의 시각 표현, owner 화면과의 정보 위계 일치다.
3. Codex는 environment guide의 false positive / false negative 균형을 계속 보정한다. 특히 monorepo optional integrations, nested Dockerfile 대표 선택, RAM/GPU README quote 품질, semantic representative file 부족으로 `required=[]`가 되는 케이스를 실제 공개 레포 smoke로 계속 조정해야 한다.
4. Codex는 compare/user-env 판정이 바로 의존하는 backend 계약을 추가로 다듬는다. 우선순위는 `servicesRequired vs servicesOptional` 분리 정밀도, `deployTargetRequired` 강도 판정, `costEstimate.drivers`의 vector/object-storage 세분화, 대형 앱 레포의 서비스 canonicalization 안정화다.
5. Codex는 `consumptionMode`와 `projectType`의 경계를 계속 다듬는다. 특히 `SDK + CLI`, `library + demo app`, `Next.js app with exports`, `monorepo root` 같은 경계 케이스를 공개 레포 smoke로 더 잠가야 한다.
6. Claude는 owner 결과 화면 IA를 정식으로 정리한다. 핵심은 `owner overview -> featured repos -> repo drill-down` 위계를 현재 임시 카드 UI보다 더 명확하게 만드는 것이다.
7. landing/help copy를 `repo / owner 둘 다 입력 가능` 문맥으로 다듬되, 버튼 추가 없이 단일 입력 UX를 유지한다.
8. Claude는 `analysis.learning`과 `analysis.coverage`를 같이 소비해 `기술 설명 / 판단 근거 / 사용법 / 미리보기 / 부분 분석 경고` UI를 Result에 붙인다.
9. Claude는 `analysis.learning.environment`를 `먼저 이해하기` 패널에 붙일 때 `servicesRequired`와 `servicesOptional`을 시각적으로 분리한다. 필수 서비스는 기본 노출, 옵션 연동은 더 약한 톤이나 접힘으로 내려야 과장이 줄어든다.
10. Claude는 preview/usage 리파인에서 새 explanation/rationale를 그대로 노출하지 말고, `docker compose로 실행`, `Next.js 개발 서버`, `배포 설정 파일 확인됨` 같은 짧은 UI 카피로 재구성한다.
11. diagram 전용 rank/confidence를 edge 및 column 배치 힌트까지 확장할지 여부를 판단한다. 현재 backend 대표 node ordering은 충분히 안정적이므로, 다음 변경은 프론트 layout 필요가 먼저다.

Harness 검증 명령:

```bash
python3 scripts/harness/self_test.py
python3 -m unittest discover -s tests -q
pnpm lint
pnpm build
```
- prompt ② backend quality fixes are now in place. Python runtime detection in `learning.environment` covers `requirements.txt`, `setup.py`, `setup.cfg`, and `environment.yml`, README environment scans always inspect the first 10KB, README storage/service notes are routed to `cloud.servicesRequired`, and deploy-target mentions like `Deploy on Vercel/Railway` or `Or deploy with Docker` are preserved even for large READMEs.
- prompt ②'s reported `servicesOptional` missing-emission error was not reproducible in the current tree. The active `RepoEnvCloud` emission site already initializes `servicesOptional`, and `pnpm exec tsc --noEmit` stays clean after the new heuristics.
- owner repo summaries now include an additive `environment` snapshot for card-level triage: `runtimeLabel`, `needsDocker`, `gpuRequired`, `gpuHint`, `servicesRequired`, `deployTargets`, `pillSummary`, `confidence`.
- owner environment snapshots deliberately stay shallow-budget. Only enrichment candidates fetch README/package.json plus one Python manifest and root Docker/compose signals; non-sampled repos fall back to low-confidence language/runtime hints or stay empty. This keeps owner analysis cheap enough for list pages while still giving featured/beginner cards actionable blockers.
- owner confidence rule is intentionally simple: repo-language fallback only => `low`; one sampled source (`package_json`, `readme`, `python_manifest`, or `docker`) => `medium`; three or more sampled source kinds => `high`.
- owner featured ranking now combines star/fork volume with official-entry heuristics and stale penalties. Strong positive signals are `repo name aligned with owner`, `official SDK/client/API wording`, scoped package names like `@owner/...`, homepage+README corroboration, and recent updates. Strong negative signals are very old inactivity plus versioned snapshot naming such as `foo-2` with no homepage/package corroboration.
- owner enrichment now samples root deploy-config files (`vercel.json`, `netlify.toml`, `fly.toml`, `render.yaml|yml`, `railway.json`) for enrichment candidates. These flow into `OwnerRepositorySummary.environment.deployTargets` without changing the frontend contract.
- README service-note extraction is now stricter. A line must look like an actual requirement/integration note (`Storage`, `Database`, `uses`, `requires`, etc.) to become `servicesRequired`; docs/tutorial-only mentions are ignored. `OpenAI Gym` is explicitly excluded from the `OpenAI` service heuristic.
- client-side cached repo analyses are now normalized before use so older payloads missing `environment.cloud.servicesOptional` do not crash the learning panel. The session cache version was bumped to invalidate stale envelopes at load time.
- compare mode backend logic is now defined in `components/compare-view-model.ts` as a pure contract, separate from any route/UI implementation. It exports:
  - `validateCompareRepoInput(input)` for repo-only canonical URL validation
  - `buildCompareWarnings(aUrl, bUrl)` for same-URL warnings
  - `buildCompareDiff(a, b)` for fact-only stack/layer/environment diffs between two `RepoAnalysis` objects
- `CompareDiff.layers.rows` uses the fixed order `UI -> Logic -> API -> DB -> External -> Code`, and the synthetic `Code` row comes from `coverage.unclassifiedCodeFileCount` when either repo has unclassified code-like files.
- runtime diff matching is intentionally conservative: both runtimes present with equal normalized versions => `both`; both present but conflicting explicit versions => `different`; present on only one side => `onlyA/onlyB`; both present with one side missing version still counts as `both`.
- service comparison is based only on `learning.environment.cloud.servicesRequired`. Optional services stay out of compare to avoid noisy false positives in the first compare iteration.
- compare UI and routes are still pending. Claude should consume the pure contract directly and keep `/result` untouched.
- compare logic now lives in two layers:
  - `lib/analysis/compare.ts`: pure repo-only validation, warning generation, and `CompareDiff` construction
  - `lib/analysis/compare-client.ts`: client-side pair orchestration over existing cache + `/api/analyze`, including canonical URL handling, partial failure per slot, repo-only enforcement, and force-refresh support
- `requestTargetAnalysis(repoUrl, { forceRefresh })` is now the reusable lower-level client fetch entrypoint. `requestRepoAnalysis(repoUrl)` remains as the no-options wrapper used by the existing single-repo flow.
- `loadCachedCompareRepoPair(pair)` and `requestCompareRepoPair(pair, { forceRefresh })` are the intended primitives for Claude's `/compare` screen. They return per-slot `{ analysis, error }` states instead of failing the whole pair at once, which matches the compare UI requirement of showing one side even if the other side fails.
- a temporary `components/compare-screen.tsx` shim exists only to keep the already-added `/compare` route compiling. It currently forwards to `CompareLanding` with prefilled query values and should be replaced by Claude's real compare screen/workspace implementation.
- compare diagnostics now have a dedicated pure helper at `lib/analysis/compare-diagnostics.ts`. It derives compact telemetry-friendly facts from `CompareDiff`: stack/layer/runtime/service counts, docker/deploy modes, small preview arrays, and a formatted trace-line array for logs or debug panels.
- live compare regression coverage now exists at:
  - `scripts/compare-regression-cases.json`
  - `scripts/check-compare-regression.mjs`
  - `package.json#scripts.test:compare:live`
  The script hits the running local `/api/analyze` endpoint with `forceRefresh: true`, rebuilds a lightweight compare summary in plain Node.js, and asserts repo-only eligibility, warnings, stack overlaps, layer overlaps, runtime differences, docker/deploy modes, and service-set diffs across real public repositories.
- current restart point for compare mode:
  - backend facts are ready: `compare.ts`, `compare-client.ts`, `compare-diagnostics.ts`, and live regression cases
  - `/compare` route compiles, but the screen is still a shim
  - Claude should implement only the compare UI layer on top of these helpers; no further analysis-schema changes are required for Phase 1 repo-vs-repo compare
  - specifically, backend-side environment compatibility summary should stay out of cached analysis payloads. Compatibility depends on user-provided local/cloud env state, so the right boundary remains:
    - cached repo facts -> `compare.ts`
    - user env input -> `env-match`
    - UI synthesis -> Claude layer
- repo learning payloads now expose two new backend-owned contracts for the single-repo Result IA v2:
  - `analysis.learning.identity`
    - `plainTitle`, `projectKind`, `useCase`, `audience`, `outputType`
    - `coreStack`
    - `startHere`
    - `readOrder`
    - `trust`
  - `analysis.learning.readmeCore`
    - current phase is README-structure-aware: `summary`, `keyPoints`, `audience`, `quickstart`, filtered external `links`, and `architectureNotes`
- `analysis.learning.stackGlossary[*]` is no longer just a glossary row. Each item can now carry:
  - `usedFor`: what the technology appears to do in this repo
  - `examplePaths`: up to 2 representative paths that justify that story
- stack glossary usage context is intentionally deterministic and shallow:
  - `keyFiles` and scoped `paths` are the first source of examples
  - `semanticSignals.routeHandlers / dbClients / externalServices` are only used when they provide stronger role evidence
  - cache normalization backfills missing `usedFor/examplePaths` on old session payloads so additive frontend use is safe
- on monorepos, stack glossary should follow `focusRoot` rather than the whole repo tree. This avoids sibling workspaces leaking unrelated technologies into the currently explained result.
- when `focusRoot` is present, glossary rows with zero scoped evidence (`reasons.length === 0 && examplePaths.length === 0`) are suppressed. This keeps the learning panel aligned with the visible scope even if `summary.stack` still contains a broader repo-level signal.
- identity extraction is README+code based, not README-only:
  - README intro paragraphs and focus README precedence feed `plainTitle`/`useCase`
  - project type, semantic DB/AI signals, preview mode, and key files feed `outputType`, `coreStack`, and `startHere`
  - web-like repos intentionally bias `startHere` toward a UI entry file instead of blindly following the strongest semantic route-handler signal, because the Result header should orient the user around the product surface first
- README-core extraction currently excludes GitHub/raw links and reduces quickstart to the smallest beginner-useful pair (`install` + primary `run`). This is deliberate: the dedicated README tab should read like a distilled “first look”, not a full markdown mirror.
- README-core extraction is now more conservative about noise:
  - `Architecture Overview` is classified as `architecture` before `features`
  - admonitions, blockquotes, package-label-only lines, and internal-package disclaimers are ignored for summary selection
  - `quickstart/docs/architecture` sections do not feed `keyPoints`
  - setup/API-key/dashboard noise is filtered out instead of being forced into beginner bullets
  - architecture notes keep whole bullet lines, not sentence fragments
- client cache normalization now backfills missing `learning.identity` and `learning.readmeCore` when older session payloads are loaded. The fallback is intentionally generic; semantic-quality identity comes only from fresh analyzer results.
- top-level semantic integration promotion is now flow-linked by default. When representative code contains side integrations that are not connected to the primary request flow, `summary.keyFeatures` prefers the primary-flow surface and leaves side integrations in facts/evidence only.
- observability-only external signals such as `Sentry` no longer promote into `summary.keyFeatures` or the one-liner surface when they are the only detected external signal. They remain available as low-level semantic evidence if representative code captured them.
- `buildOneLiner(...)` now suppresses plain single-service semantic addons when the first sentence already states the same brand or service. Flow-specific addons that add request-path context are still kept.
- borderline external integrations are now split by promotion confidence:
  - repo-wide fallback promotion: `OpenAI`, `Anthropic`, `Stripe`, `Clerk`
  - flow-linked-only promotion: `GitHub`, `Slack`, `Resend`
  - low-signal/non-promoted: `Sentry`
  This means `GitHub/Slack/Resend` can still appear in top summary when the representative request flow actually reaches them, but they no longer rise from incidental SDK usage in unrelated files.
- generic top-summary heuristics are now de-duplicated against semantic integrations:
  - when a specific `X 연동 확인` exists, `외부 서비스 연동` is removed from `summary.keyFeatures`
  - when a specific `Y 연결 확인` exists, `데이터 저장/조회` is removed from `summary.keyFeatures`
  This preserves more room for structural signals such as `페이지 기반 진입 구조` or `공용 패키지 + 앱 분리 구조`.
- live repo regression coverage now checks semantic summary content, not just project shape. `scripts/check-analysis-regression.mjs` understands `keyFeaturesContain`, `keyFeaturesAbsent`, `oneLinerContain`, and `oneLinerAbsent`, and the case set now covers `cal.com`, `n8n`, `gitdiagram`, and `openai-quickstart-node` for semantic summary drift.
- component-library / library monorepo heuristics are now stricter about what counts as a “real app” workspace:
  - `packages/app`, `packages/web` 같은 이름만으로 app root로 보지 않고, 실제 route/UI/API 표면이 있을 때만 primary app root로 취급한다.
  - nested library workspaces (`packages/expo/web`, `packages/react/portal`) are de-prioritized when a parent library workspace also exists, so focus roots land closer to the public package surface.
  - component-library preference no longer triggers just because a repo has one `packages/ui` root. It now requires strong component-library text or enough component package dominance to beat app roots.
- self-branded semantic promotion is now suppressed for selected library/example families:
  - `Clerk`, `Firebase`, `Supabase` no longer rise into `summary.keyFeatures` / one-liner when the repo itself is that SDK/example family.
  - low-level semantic facts still keep those names, so evidence is preserved without turning the top summary into tautology.
- library stack scoping is now narrower for `packages/*` focus roots:
  - root-level web configs (`next.config`, `tailwind.config`, etc.) do not leak into package-focused library summaries
  - nested `example/`, `demo/`, `playground/`, `docs/`, `website/` subtrees under the focused package are excluded from stack narration
  This is what removed `Next.js` / `Tailwind CSS` leakage from `supabase/supabase-js`.
- live regression coverage now also checks `summary.stack` with `stackContain` / `stackAbsent`, and the case set includes `clerk/javascript`, `firebase/firebase-js-sdk`, and `supabase/supabase-js`.
- current restart point for the single-repo understanding flow:
  - backend fields for Result IA v2 are ready
  - Claude can now build the top identity bar and README-core tab against stable data
  - Claude can also upgrade the stack glossary UI from “정의 + 감지 사유” to “정의 + 이 레포에서의 역할 + 대표 파일”
  - README-core deepening is implemented and live-regression-backed
  - the next Codex backend slice should target remaining summary drift around structural feature promotion inside SDK repos, not the Firebase boundary anymore
- follow-up closure after the latest regression pass:
  - `firebase/firebase-js-sdk` project-type boundary is now fixed to `라이브러리 또는 SDK` in live regression, and the regression case was tightened accordingly.
  - self-branded SDK/example repos now suppress generic `데이터 저장/조회` / `외부 서비스 연동` when those rows would just restate the brand family (`Firebase`, `Supabase`, `Clerk`).
  - live regression now passes with the stricter Firebase expectation:
    - `clerk/javascript` => `라이브러리 또는 SDK`, no `Clerk 연동 확인`
    - `firebase/firebase-js-sdk` => `라이브러리 또는 SDK`, no `Firebase 연결 확인`
    - `supabase/supabase-js` => `라이브러리 또는 SDK`, stack stays `TypeScript/Node.js/Vite`
  - validation was re-run end-to-end after the heuristic change:
    - `pnpm exec vitest run tests/semantic-analysis.test.ts tests/analyzer-fixtures.test.ts tests/analysis-quality-guards.test.ts`
    - `pnpm lint`
    - `ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `pnpm build`
    - standalone `pnpm exec tsc --noEmit`
  - a compare-route compile blocker was also cleared while closing validation:
    - `/compare` no longer passes an unused `mine` prop from `app/compare/page.tsx`
    - `components/compare-screen.tsx` no longer imports a missing `MineSide` type
    - this was a type-only unblock to keep build green; compare UI ownership still belongs to Claude
- latest follow-up after that closure:
  - top-summary structural features now use scoped signal paths when building `summary.keyFeatures`.
  - for package-focused library/design-system repos, nested `example/`, `demo/`, `playground/`, `docs/`, `website/` trees inside the focused package no longer inject `페이지 기반 진입 구조` / `재사용 컴포넌트 구조` into the beginner summary.
  - this keeps the summary aligned with the already-scoped stack narration instead of letting bundled sample apps speak for the SDK itself.
  - live regression now confirms:
    - `supabase/supabase-js` => `keyFeatures = ["라이브러리 진입점"]`
    - `firebase/firebase-js-sdk` => still `["라이브러리 진입점", "서버 요청 처리"]`
    - `headlessui` / `radix-ui` keep package-centric summaries without page-entry noise from support apps
  - compare UI cleanup also finished so validation is clean again:
    - `components/compare-screen.tsx` no longer carries dead `mine` state / URL sync props
    - `components/compare-workspace.tsx` no longer keeps unused local `mine` state
  - validation for this follow-up passed:
    - `pnpm exec vitest run tests/semantic-analysis.test.ts tests/analyzer-fixtures.test.ts tests/analysis-quality-guards.test.ts`
    - `pnpm lint`
    - `ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `pnpm build`
    - standalone `pnpm exec tsc --noEmit`
- latest follow-up after that:
  - library/design-system false positives were reduced again, this time around DB, support-gap, and plain-title drift.
  - `DB_PATTERN` is no longer broad enough to mistake code migrations or generic `schema.ts` files for a real data layer. The practical effect is that CLI-oriented component packages like `shadcn-ui/ui` stop surfacing a fake `DB` layer and stop promoting `데이터 저장/조회` into the beginner summary.
  - coverage-gap suppression for library/component repos now treats `cli` leftovers as benign alongside `entry/other/root-file` leftovers. This removes noisy `LAYER_CLASSIFICATION_GAP` warnings from package-focused design-system CLIs while keeping the warning for real app repos where the gap still matters.
  - the partial-coverage copy for that benign case now says `보조 코드 ... Code 범위` rather than pretending every leftover file is generic shared code.
  - `SUPPORTED_STACK_MARKERS` now includes `Vue`, and `detectStack(...)` also explicitly emits `Vue` when the repo actually carries Vue markers. This removes the false `SUPPORTED_STACK_GAP` warning from repositories such as `tailwindlabs/headlessui`.
  - `plainTitleFromSignals(...)` now prioritizes component-library/design-system wording before generic `web app` wording. This fixes repos like `radix-ui/primitives`, whose README mentions “web apps” even though the product is clearly a component library.
  - live results after this slice:
    - `tailwindlabs/headlessui` => stack `Vue, TypeScript`, no warnings, plain title `재사용 UI 컴포넌트를 모아 둔 디자인 시스템`
    - `radix-ui/primitives` => plain title `재사용 UI 컴포넌트를 모아 둔 디자인 시스템`
    - `shadcn-ui/ui` => no `DB` layer, no `데이터 저장/조회`, no `LAYER_CLASSIFICATION_GAP`
  - validation for this slice passed:
    - `pnpm exec vitest run tests/analyzer-fixtures.test.ts tests/analysis-quality-guards.test.ts tests/semantic-analysis.test.ts`
    - `ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `pnpm lint`
    - `pnpm build`
    - standalone `pnpm exec tsc --noEmit`
  - current backend restart point:
    - real app monorepos still need one more pass on limited-mode coverage noise, with `n8n` as the clearest live target
    - package-focused component-library focus-root choice still deserves normalization when a repo exposes multiple public package flavors (`headlessui` Vue vs React package choice)
- latest follow-up after that:
  - limited-mode frontend-workspace warning noise was reduced for real app monorepos.
  - `SUPPORT_LOGIC_PATTERN` now catches frontend bootstrap/support files such as `app/init.ts`, `app/router.ts`, `app/polyfills.ts`, and `app/types/*`, moving them out of raw `Code` when they are clearly part of the app’s internal support logic.
  - `.d.ts` files are no longer counted as code-like coverage targets. They were mostly structural noise for beginner understanding and inflated `Code` residue without helping the user.
  - `LAYER_CLASSIFICATION_GAP` suppression is now slightly broader but still conservative:
    - all uncovered reasons must be benign
    - semantic hint groups must be empty
    - the result must already have a substantial classified surface (`classified > uncovered`, at least 24 classified paths)
    This is what removed the warning from `n8n` without also silencing true partial-understanding cases like `gitdiagram` or `sourcewizard-ai/react-ai-agent-chat-sdk`.
  - regression coverage was strengthened at the live-script level:
    - `scripts/check-analysis-regression.mjs` now supports `warningsAbsent`
    - cases now lock `n8n` warning absence, `headlessui` Vue support and design-system title, `radix-ui/primitives` design-system title, and `shadcn-ui/ui` warning absence plus no fake DB feature
  - preview canonicalization was tightened again:
    - badge, coverage, status, and image URLs are no longer allowed to become `learning.preview.deployUrl`
    - hosts such as `coveralls.io`, `codecov.io`, `img.shields.io`, and `shields.io` are rejected early
    - live effect: `firebase/firebase-js-sdk` now returns `preview.mode=none`, `deployUrl=null`
  - validation for this slice passed:
    - `pnpm exec vitest run tests/analyzer-fixtures.test.ts tests/analysis-quality-guards.test.ts tests/semantic-analysis.test.ts`
    - `ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `pnpm lint`
    - `pnpm build`
    - standalone `pnpm exec tsc --noEmit`
  - current backend restart point:
    - keep trimming limited-mode frontend `Code` residue without over-promoting generic support files into fake product layers
    - decide whether multi-flavor component-library focus roots should remain README-led or whether RepoLens should normalize them to a framework-neutral representative when one exists
- latest backend note after that:
  - coverage-layer alignment was corrected. Before this slice, `layersForPath(...)` and `summarizeLayerCoverage(...)` did not agree on some Logic-like files:
    - `layersForPath(...)` already treated library/CLI entrypoints such as `src/index.ts`, `src/main.ts`, and `index.js` as Logic
    - `summarizeLayerCoverage(...)` did not, because its `logicBucket` only used `signals.logicFiles`
    - result: residue lists overstated `Code` even when the path was already conceptually classified elsewhere
  - the fix was to let coverage use the same conceptual surface:
    - `logicBucket = logicFiles + cliFiles + libraryEntryFiles`
    - this keeps the coverage summary consistent with graph/inspector layer assignment
  - safe support-path coverage was broadened for real frontend apps and component libraries:
    - added support for `app/constants/*`, `app/plugins/*`, `app/workers/*`, `app/dev/*`, `app/event-bus/*`
    - added support for `src/internal/*` and `src/experiments/*`
    - added plural `stores/` to Logic detection
  - non-user-facing noise was reduced further:
    - `test-utils/` directories are excluded from coverage analysis
    - `jest.config.*`, `vitest.config.*`, `playwright.config.*` are treated as config files
  - practical effects confirmed live:
    - `n8n-io/n8n`
      - before: 38 uncovered, then 7 uncovered after the prior slice
      - now: `unclassifiedCodeFileCount = 0`
      - `LAYER_CLASSIFICATION_GAP` stays absent
    - `tailwindlabs/headlessui`
      - focus root remains `packages/@headlessui-vue`
      - `src/index.ts` and `src/internal/*` are no longer residue
      - only two root helpers remain uncovered: `src/keyboard.ts`, `src/mouse.ts`
  - focus-root decision for now:
    - keep the current README-led / representative-package selection
    - reason: after residue cleanup, the remaining `headlessui` gap is too small to justify changing workspace selection behavior across all multi-flavor design-system repos
    - if a later real repo shows README-led selection harming beginner understanding, revisit this with a focused heuristic rather than a global normalization
  - validation state for this slice:
    - backend-targeted tests and targeted lint passed
    - `pnpm build` passed
    - standalone `pnpm exec tsc --noEmit` passed when run after build generation
    - full `pnpm lint` remains blocked by pre-existing frontend React-hook lint errors in Claude-owned files
    - full live regression remains externally flaky because the `developit` owner case can exhaust authenticated GitHub rate limits even when repo-target regressions are clean
- latest backend note after that:
  - package-focused library/SDK coverage is now stricter about what counts as meaningful residue.
  - two categories were cleaned up:
    1. support modules that are clearly internal logic but previously sat outside the old `lib/utils/hooks/...` naming conventions
    2. bundled demo/example trees inside focused SDK packages that distort beginner understanding of the package itself
  - support-module classification now additionally covers:
    - root support files such as `errors`, `internal`, `legacy`, `constants`, `experimental`, `keyboard`, `mouse`, `webhooks`
    - support folders such as `server`, `mfa`, `client-boundary`, `app-router`, `runtime`, `platform_*`
    - split entry helpers like `components.client.ts` / `components.server.ts`
  - `tsup.config.*` is now treated as config noise rather than coverage residue.
  - scoped library/design-system coverage now excludes nested `demo/`, `examples/`, `playground/`, `sandbox/`, `website/`, and `docs/` trees under the focused package root.
    - important: this exclusion is only active in the second, project-typed scoped pass for `라이브러리 또는 SDK` and `컴포넌트 라이브러리 또는 디자인 시스템`
    - first-pass topology detection stays unchanged
  - practical live effects:
    - `tailwindlabs/headlessui`: residue went from 2 (`src/keyboard.ts`, `src/mouse.ts`) to 0
    - `clerk/javascript`: residue went from support modules + `tsup.config.ts` to 0
    - `firebase/firebase-js-sdk`: residue went from `mfa/*`, `platform_*/*`, and demo worker files to 0
  - this moves RepoLens closer to the intended beginner contract:
    - package-focused SDK results now describe the package itself rather than its bundled demos or internal build support
    - `Code` residue becomes a stronger signal again, because obvious package support code is no longer mixed into it
  - current backend recommendation:
    - the next valuable slice is no longer structural residue; it is summary quality
    - specifically, compressing README/description signals into a shorter, more beginner-safe repo identity/header summary is likely to yield more user-visible value than further layer heuristics right now
- latest backend note after that:
  - summary-quality hardening moved from sentence compression into sentence selection.
  - README-first understanding now actively drops several classes of non-explanatory text before it can become `learning.readmeCore.summary` or `learning.readmeCore.keyPoints`:
    - licensing-only lines such as `You can find the license information here`
    - framework boilerplate such as `This is a Next.js project...`, `create-next-app`, `next/font`, and `You can start editing the page ...`
    - promotional bullets such as `Active Community`, `Enterprise-Ready`, `Full Control`
    - oversized count-marketing such as `400+ integrations`, `900+ templates`
  - extraction now prefers a meaningful intro sentence over the literal first sentence. Practically, `readmeLeadParagraph(...)`, intro fallback selection, and feature-point extraction all run through the same `meaningfulReadmeSentence(...)` guard, so license/setup/boilerplate lines no longer win just because they appear first.
  - live effect confirmed on `n8n-io/n8n`:
    - before: `readmeSummary = "You can find the license information here"`
    - now: `readmeSummary = "n8n is a workflow automation platform that gives technical teams the flexibility of code with the speed of no-code."`
    - header points also stabilized to structure-first beginner copy:
      - `앱 코드와 공용 패키지가 어떻게 나뉘는지 바로 파악할 수 있습니다.`
      - `요청이 어디로 들어와 처리되는지 빠르게 찾을 수 있습니다.`
  - owner beginner ranking was rebalanced around setup friction instead of popularity alone.
    - new positive reason: `light_setup`
    - new penalties:
      - GPU required => strongest beginner penalty
      - Docker required => medium penalty
      - multiple required services => additional penalty
    - practical effect: lightweight starter repos now surface ahead of GPU/Docker/multi-service repos in owner `beginnerRepositories`, which is closer to the actual "지금 바로 훑어볼 수 있는가" question.
  - regression coverage also moved up a level:
    - `scripts/check-analysis-regression.mjs` now validates `identityPointsContain`, `identityPointsAbsent`, and `readmeKeyPointsAbsent`
    - repo live cases now lock beginner-header behavior for `n8n` and `gitdiagram`, not just project type / stack / start file
  - validation for this slice passed:
    - `pnpm exec vitest run tests/analysis-quality-guards.test.ts tests/analyzer-fixtures.test.ts tests/owner-analysis.test.ts tests/semantic-analysis.test.ts`
    - backend-targeted eslint on changed files
    - `ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `ANALYSIS_REGRESSION_SCOPE=owner ANALYZE_BASE_URL=http://localhost:3000 node scripts/check-analysis-regression.mjs`
    - `pnpm build`
    - standalone `pnpm exec tsc --noEmit`
  - current backend recommendation:
    - the next valuable slice is README-core interpretation quality, not more structural heuristics
    - specifically:
      1. suppress list-intro / collection-summary lines that still slip into SDK `readmeSummary`
      2. reduce raw English marketing bullets that remain in `readmeCore.keyPoints` for some large repos
      3. tighten owner beginner ranking with additional environment barrier evidence only if it improves real featured/beginner list outcomes, not just scores
- latest backend note after that:
  - one hidden summary-quality bug was still left in the README parser: runtime prose containing `Node.js` or `Python` was being rejected as if it were a shell command.
  - root cause:
    - `looksLikeNarrativeSentence(...)` still had an older inline regex that rejected any sentence containing `node` / `python`
    - even after `looksLikeCommandLine(...)` was narrowed, that duplicate regex kept SDK/quickstart prose from becoming the README summary
  - fix:
    - `looksLikeNarrativeSentence(...)` now delegates command-line rejection to `looksLikeCommandLine(...)`
    - `looksLikeCommandLine(...)` is now conservative:
      - still catches real commands like `node script.js`, `python app.py`, `pnpm dev`, `docker compose up`
      - does not reject narrative sentences like `... use the OpenAI APIs with the Node.js SDK`
  - practical live effect:
    - `openai/openai-quickstart-node`
      - before: `readmeSummary = "The examples are organized by API, with each folder dedicated to a specific API:"`
      - after `forceRefresh`: `readmeSummary = "This repository provides a collection of examples demonstrating how to use the OpenAI APIs with the Node.js SDK."`
    - repo live regression now locks this with `readmeSummaryContains: ["collection of examples"]`
  - current backend recommendation:
    - keep pushing README-core interpretation quality, but the next concrete target has shifted:
      1. suppress requirement-only summaries such as `Node.js >=20 ... existing Clerk application`
      2. reduce raw English marketing bullets that remain in `readmeCore.keyPoints` for some large repos
      3. only then revisit additional owner beginner-ranking penalties if real owner lists still look too heavy
- latest backend note after that:
  - compare mode precision is now backed by explicit environment metadata instead of frontend-only string heuristics.
  - important contract decision:
    - to avoid breaking existing frontend consumers, string arrays were preserved:
      - `learning.environment.cloud.servicesRequired`
      - `learning.environment.cloud.servicesOptional`
    - structured service data was added alongside them:
      - `servicesRequiredDetails`
      - `servicesOptionalDetails`
    - this lets compare/user-env matching move to canonical ids later without forcing an immediate UI migration
  - practical behavior changes:
    - runtime requirements now expose coarse major-version ranges
      - enough for compare/user-env compatibility checks
      - intentionally not a full semver engine
    - Docker is no longer just a boolean presence signal internally; it now carries a role:
      - `required`
      - `optional-dev`
      - `optional-deploy`
      - `none`
    - repo identity now exposes `consumptionMode`
      - `import-as-library`
      - `run-as-app`
      - `hybrid`
      - `unknown`
  - notable backend caution discovered and fixed:
    - exact version files (`.nvmrc`, `.python-version`, etc.) can over-narrow compatibility if they overwrite broader manifest ranges
    - runtime merge logic now preserves broader known constraints when both signals share the same floor
    - example avoided:
      - `engines.node: >=20` being overwritten by `.nvmrc: 20`
  - compare-specific regression tooling was updated to reflect the real backend contract:
    - service comparisons now honor canonical ids, not just visible labels
    - runtime comparisons now use normalized range metadata, not raw string equality
  - live sanity after this slice:
    - `vercel/next.js`
      - `consumptionMode=hybrid`
      - Node `>=20.9.0` -> `minMajor=20`, `range="gte"`
    - `supabase/supabase-js`
      - `consumptionMode=import-as-library`
      - service details include `PostgreSQL(postgres)` and `Supabase(supabase)`
    - `openai/openai-python`
      - Python runtime detected from `pyproject`
      - OpenAI remains optional service, not required
    - `n8n-io/n8n`
      - Node `>=22.16`
      - Docker deploy hint present
      - multiple integrations remain optional-only under current heuristics
    - `ahmedkhaleel2004/gitdiagram`
      - required service details include:
        - `Cloudflare R2`
        - `OpenAI`
        - `Upstash Redis`
      - Python range `>=3.14,<3.15` normalizes to `between` on major 3
  - current backend recommendation:
    - the next highest-value backend slice is not more compare math; it is better required-vs-optional service separation for large production repos
    - frontend should now consume the new metadata rather than continuing major-only regex parsing and label-only service matching
- latest backend note after that:
  - RepoLens는 이제 단순한 runtime/Docker/service 수준을 넘어, 사용자 환경 판정을 위한 7축 환경 요구사항을 backend에서 직접 제공합니다.
  - 중요한 계약 원칙:
    - 기존 필드 삭제/rename 없음
    - 새 필드는 additive only
    - 프론트가 아직 미마이그레이션이어도 기존 소비는 유지
  - 환경 요구사항에서 새로 믿을 수 있게 된 축:
    - hardware
      - RAM / disk 외에 VRAM, CPU arch, accelerator preference
    - container
      - compose 규모와 multi-container 여부
    - cloud
      - 권장 배포 대상뿐 아니라 required target
      - 기존 servicesRequired/servicesOptional과 별도로 apiServicesRequired/apiServicesOptional
    - runtime mode
      - local-only / local-or-cloud / cloud-required
    - cost estimate
      - 아주 거친 tier + driver explanation만 제공
  - 과장 방지 원칙 유지:
    - 신호가 약하면 `null` / `false`
    - 비용도 정확 수치가 아니라 bucket과 넓은 범위만 사용
    - `cpu-ok` 같은 긍정 신호도 너무 약한 문구에는 반응하지 않게 좁혔음
  - 새 `env-match`는 backend shared rule source 역할을 함:
    - 프론트 로컬 훅 안의 단순 regex matcher 대신, 이후 Claude가 이 유틸을 기준으로 UI를 붙이면 Result/Compare 판정 기준이 일관됨
  - current live sanity:
    - `gitdiagram`
      - `runtimeMode=local-or-cloud`
      - `dockerRole=recommended`
      - `apiServicesRequired=[Cloudflare R2, OpenAI, Upstash Redis]`
      - `costEstimate.tier=under_50`
    - `n8n`
      - `runtimeMode=cloud-required`
      - `composeServiceCount=11`, `needsMultiContainer=true`
      - `costEstimate.tier=prod`
  - current backend recommendation:
    - 다음으로 가장 가치 있는 개선은 detection breadth가 아니라 classification precision
    - 특히 `required vs optional service`, `provider-required` 강도, `cost driver` 세분화가 프론트 UX 체감에 직접 연결됨
- latest backend refinement after that:
  - `SDK vs CLI` 경계에서 실제 버그를 하나 잡았습니다.
    - 기존 `detectProjectType`는 text signal에 `text.includes("cli")`를 써서 `client`, `clients` 같은 일반 library 문구도 CLI로 잘못 올렸습니다.
    - 지금은 word-boundary 기반 CLI 신호만 인정하고, library-first boundary helper가 공식 SDK repo를 다시 가져갑니다.
    - live sanity:
      - `openai/openai-python` => `projectType=라이브러리 또는 SDK`, `consumptionMode=hybrid`
  - `.env.example` optional block handling이 추가됐습니다.
    - `# Optional integrations` 아래의 연속 env key는 optional로 유지합니다.
    - 그래서 대형 앱이 여러 integration key를 한 파일에 몰아 둬도 required가 과하게 부풀지 않습니다.
  - required promotion은 더 좁게, 하지만 더 설명 가능하게 바꿨습니다.
    - dependency-only는 계속 optional
    - `runtime dependency + infra path/readme/compose`처럼 서로 다른 약한 신호가 겹칠 때만 core infra를 required로 올립니다.
  - canonical service breadth가 넓어졌습니다.
    - object storage:
      - `Cloudflare R2`
      - `Amazon S3`
      - `Google Cloud Storage`
      - `Azure Blob Storage`
      - `MinIO`
    - vector/search infra:
      - `Pinecone`
      - `Weaviate`
      - `Qdrant`
      - `Milvus`
      - `Chroma`
  - `apiServicesRequired/apiServicesOptional`는 이제 전체 서비스 목록의 복제가 아닙니다.
    - 남기는 것:
      - AI / auth / payment / email
      - managed storage
      - managed vector DB
      - Supabase / Firebase
      - Upstash Redis
    - 제외하는 것:
      - plain `PostgreSQL`
      - plain `MySQL`
      - plain `MongoDB`
      - plain `Redis`
    - 이유:
      - compare/user-env에서 “계정/API 성격의 외부 서비스”와 “직접 띄울 수 있는 core infra”를 분리해 보여주기 위함
  - `deployTargetRequired`는 provider score 기반으로 다시 계산합니다.
    - generic hosting config만 있다고 required가 되지 않습니다.
    - vendor-specific runtime/infrastructure coupling이 겹쳐야 required가 됩니다.
    - 그래서 `vercel.json` + README deploy mention 정도는 required가 아니고, AWS Lambda/DynamoDB 조합처럼 coupling이 강한 경우만 required가 됩니다.
  - `costEstimate.drivers`는 이제 provider 종류를 조금 더 설명합니다.
    - 새 note:
      - `벡터 DB 또는 검색 인프라 비용이 들어갈 수 있습니다.`
      - `오브젝트 스토리지 비용이 들어갈 수 있습니다.`
  - compare backend-side compatibility summary는 analysis payload에 넣지 않기로 결정했습니다.
    - 이유:
      - user-env 의존이어서 캐시 분석 결과에 섞으면 stale risk가 커지고
      - 이미 `lib/analysis/env-match.ts`가 pure shared backend rule source라서, compare/result UI가 여기서 summary를 만들면 충분하기 때문
  - current live sanity after this slice:
    - `openai/openai-python`
      - SDK 분류 유지
      - OpenAI는 optional service
    - `ahmedkhaleel2004/gitdiagram`
      - required:
        - `Cloudflare R2`
        - `OpenAI`
        - `Upstash Redis`
      - optional:
        - `Amazon S3`
      - API-facing split도 같은 방향으로 유지
    - `n8n-io/n8n`
      - `Anthropic/OpenAI`는 API-facing optional
      - `MySQL/PostgreSQL/Redis`는 optional-only
      - 이 값은 current conservative intent와 맞음: multi-backend large repo에서 false-positive required promotion을 피하는 쪽을 우선
- latest backend refinement after that:
  - representative key file ordering을 semantic score만으로 두면, 앱 레포에서도 `package.json`이 첫 key file로 올라오는 왜곡이 남았습니다.
  - 이 문제는 start file만으로는 해결되지 않습니다.
    - Result/Canvas/Inspector/learning panel이 `analysis.keyFiles`도 함께 소비하기 때문입니다.
  - 현재 결정:
    - 앱형 project type에서는 context/manifests/config만 조심스럽게 내립니다.
    - UI/API/Logic 파일끼리는 강제로 재정렬하지 않습니다.
    - 이유:
      - 한 번 structural priority를 크게 줬더니 semantic-analysis fixture에서 logic 파일이 API보다 뒤로 밀리는 부작용이 즉시 나타났습니다.
      - 따라서 “manifest만 누르고, 실제 구조 파일끼리는 원래 semantic order를 존중”하는 쪽이 더 안전합니다.
  - 실제 적용 규칙:
    - app-like project type:
      - `풀스택 웹앱`
      - `프론트엔드 웹앱`
      - `모노레포 웹 플랫폼`
      - `백엔드 API 서비스`
      - `API 서버`
    - demote 대상:
      - `README`
      - `package.json`
      - `tsconfig`
      - workspace/build config (`pnpm-workspace`, `turbo`, `nx`)
      - framework/tooling config (`next`, `tailwind`, `vite`, `eslint`)
  - 결과:
    - `gitdiagram`
      - first key file가 `package.json`에서 `src/app/page.tsx`로 안정화
    - `cal.com`
      - limited 모드에서도 first key file / start file 모두 `apps/web/app/page.tsx`
    - `n8n`
      - first key file는 실제 앱 표면(`favorites.ts`)로 유지
      - start file은 문맥상 `README.md` 유지
    - `openai/openai-python`
      - library repo이므로 README-first 유지
  - regression contract 확장:
    - live regression에 `firstKeyFileIn` expectation을 추가했습니다.
    - 즉 앞으로는 “recommendedStartFile만 맞는지”가 아니라 “대표 key file head도 맞는지”를 함께 잠급니다.
  - current backend recommendation:
    - 다음 backend 우선순위는 더 많은 breadth가 아니라, UI가 실제 질서감을 느끼게 할 representative node quality입니다.
    - 구체적으로는:
      - layer별 representative node 선택
      - limited/partial analysis 신뢰도 설명에 들어갈 compact backend summary
- latest backend refinement after that:
  - representative node quality의 첫 실질 보정은 “같은 종류 상위 파일 3개”를 버리고 “역할이 다른 대표 surface 3개”를 뽑는 것입니다.
  - 기존 문제:
    - UI 레이어에서 `page.tsx`, `browse/page.tsx`, `settings/page.tsx` 같이 route family가 상단을 독점할 수 있었습니다.
    - 동시에 `components/loading.tsx`, nested `components/App.tsx` 같은 support/generic surface가 scoring bug 때문에 page/layout보다 앞서기도 했습니다.
    - graph layer card는 explicit key files 수가 많으면 layer-level fallback을 거의 보지 않아, diversity source가 있어도 카드에 반영되지 않았습니다.
  - 현재 결정:
    - representative selection은 이제 두 단계입니다.
      - path scoring으로 후보 순서를 만든다
      - 그 위에서 layer-specific bucket(`route/layout/component`, `service/hook/state`, `schema/client/migration` 등)을 보고 먼저 서로 다른 역할을 하나씩 고른다
    - 부족한 slot만 기존 score order로 채운다.
  - 추가 보정:
    - `SPA_ENTRY_PATTERN`은 root `App.tsx` / `src/App.tsx`만 entry로 본다.
      - nested component `components/App.tsx`는 더 이상 SPA root처럼 과대평가하지 않는다.
    - `loading/error/not-found/default/template`는 이미 `APP_SUPPORT_PATTERN`으로 잡히므로 별도 bonus를 중복 적용하지 않는다.
    - `app` basename도 generic representative name으로 취급한다.
  - 결과:
    - `gitdiagram`
      - `UI.files` 선두가 `page -> layout -> hero`로 안정화
    - `cal.com`
      - `UI.files` 선두가 `page -> layout -> PageWrapper`로 정리
    - 이 변화는 canvas/diagram/card가 모두 같은 backend representative set을 받게 만든다는 점이 중요합니다.
  - current backend recommendation:
    - representative node selection의 다음 단계는 신뢰도 설명입니다.
    - 이제 프론트가 보여줄 레이어 대표 surface는 한 단계 정리됐고, 다음 병목은 `limited/partial analysis`를 사용자에게 가볍고 정확하게 설명할 compact backend summary입니다.
- latest backend refinement after that:
  - environment / compare-env / projectType boundary를 다시 조였습니다.
  - 핵심 결정:
    - `torch`만 있다고 GPU 필수로 올리지 않습니다.
    - single-package library가 `website/docs/ecosystem-tests` 같은 support root 때문에 app처럼 읽히면, 실제 library entry(`src/index.*`) 기준으로 focus root를 다시 잡습니다.
    - user-env runtime 비교는 raw version string을 다시 파싱해서 `>=3.14,<3.19` 같은 lower/upper bound를 major-only보다 정확하게 비교합니다.
  - why:
    - 초보자 관점에서 가장 해로운 오류는 “돌아가는데 안 된다고 말하는 것”과 “라이브러리인데 앱처럼 설명하는 것”입니다.
    - 따라서 이번 slice는 breadth보다 false positive 축소에 우선순위를 뒀습니다.
  - notable backend effects:
    - requirements-only Python repo:
      - runtime은 Python으로 잡되 GPU는 기본 false
    - single-package SDK + demo website:
      - `projectType=라이브러리 또는 SDK`
      - `consumptionMode=hybrid`
    - `openai/openai-node`:
      - direct repo regression 추가
      - focus root가 `ecosystem-tests/...`가 아니라 `src`로 교정
  - validation snapshot:
    - green:
      - `pnpm exec tsc --noEmit`
      - `pnpm lint`
      - `pnpm test:unit`
      - `pnpm build`
    - targeted tests:
      - env-match / analyzer-fixtures / environment-requirements / semantic-analysis 모두 통과
    - live regression:
      - logic expectation은 통과
      - 마지막 owner case(`developit`)는 GitHub API `429 RATE_LIMITED`로 중단
  - restart point:
    - backend는 기능 추가보다 운영/신뢰도 정리 단계입니다.
    - 다음에 손볼 후보:
      - owner regression을 quota 친화적으로 재시도/분리 실행하는 전략
      - trust summary가 프론트 IA에 실제로 충분한지 다시 점검
