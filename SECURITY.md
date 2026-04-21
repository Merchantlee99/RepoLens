# Security Policy

## Supported Versions

현재는 `main` 브랜치의 최신 상태만 지원합니다.

## Reporting a Vulnerability

- 보안 이슈는 공개 GitHub issue로 올리지 마세요.
- 가능하면 GitHub의 private vulnerability reporting 또는 저장소 관리자와의 비공개 채널을 사용하세요.
- 제보 시 재현 방법, 영향 범위, 필요한 환경변수를 함께 정리해 주세요.

## Publishing Checklist

공개 배포 전에는 아래 항목을 먼저 확인하세요.

- `pnpm security:check`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- GitHub 저장소 시크릿에만 `GITHUB_TOKEN`을 넣고, `.env.local`은 커밋하지 않기
