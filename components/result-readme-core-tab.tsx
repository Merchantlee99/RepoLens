"use client";

import { safeExternalHref } from "@/components/safe-href";
import type { RepoAnalysis, RepoReadmeLink } from "@/lib/analysis/types";

// README Core 탭 — `analysis.learning.readmeCore`를 "README 원문 재생"이 아닌
// "README 핵심 번역본"으로 보여준다.
//
// 배치 원칙:
//  - README 원문 스크롤을 흉내내지 말 것. 섹션 제목은 질문형/작업형.
//  - 비어 있는 필드는 조용히 숨긴다 (keyPoints/audience/architectureNotes
//    는 현재 백엔드에서 비어 있을 수 있음).
//  - 링크는 종류별로 라벨링하고 새 탭에서 열리게 한다.
export function ResultReadmeCoreTab({
  analysis,
}: {
  analysis: RepoAnalysis;
}) {
  const readme = analysis.learning?.readmeCore;

  if (!readme) {
    return <EmptyState />;
  }

  const summary = readme.summary?.trim() || null;
  const audience = readme.audience?.trim() || null;
  const keyPoints = (readme.keyPoints ?? []).filter((item) => item.trim().length > 0);
  const quickstart = (readme.quickstart ?? []).filter((item) => item.trim().length > 0);
  const architectureNotes = (readme.architectureNotes ?? []).filter(
    (item) => item.trim().length > 0
  );
  // 백엔드가 README에서 같은 URL을 여러 섹션에서 뽑아올 때가 있다. 사용자에게
  // 동일 링크가 두 번 보이면 "뭐가 다른가" 고민하게 되므로 URL 기준으로 dedup.
  // 먼저 등장한 kind/label을 유지해 분류가 완전히 비어버리지 않게 한다.
  const links = dedupeLinks(readme.links ?? []);

  const hasAnything =
    summary ||
    audience ||
    keyPoints.length > 0 ||
    quickstart.length > 0 ||
    architectureNotes.length > 0 ||
    links.length > 0;

  if (!hasAnything) {
    return <EmptyState />;
  }

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-3 px-4 py-4 lg:px-6 lg:py-5">
        {/* Trust 가드레일은 ResultWorkspace 최상단에서 한 번만 렌더된다. */}
        <header className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)] p-3">
          <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
            README 핵심 요약
          </p>
          {summary ? (
            <p className="mt-1.5 text-[13px] leading-6 text-[var(--fg)]">
              {summary}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-5 text-[var(--fg-muted)]">
              README 요약 문장은 아직 추출되지 않았습니다.
            </p>
          )}
          {audience ? (
            <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--fg-muted)]">
              <span className="text-[var(--fg-dim)]">대상 · </span>
              {audience}
            </p>
          ) : null}
        </header>

        {keyPoints.length > 0 ? (
          <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <h3 className="text-[12px] font-semibold text-[var(--fg)]">핵심 포인트</h3>
            <ul className="mt-2 space-y-1">
              {keyPoints.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-[11.5px] leading-5 text-[var(--fg)]"
                >
                  <span
                    aria-hidden
                    className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]/70"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {quickstart.length > 0 ? (
          <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <h3 className="text-[12px] font-semibold text-[var(--fg)]">빠르게 시작하기</h3>
            <p className="mt-1 text-[11px] text-[var(--fg-dim)]">
              README에서 추출한 실행 절차입니다. 터미널에 한 줄씩 복사해 실행합니다.
            </p>
            <ol className="mt-2 space-y-1.5">
              {quickstart.map((step, idx) => (
                <li
                  key={`${step}:${idx}`}
                  className="flex gap-2"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[10.5px] font-semibold text-[var(--fg-muted)]"
                  >
                    {idx + 1}
                  </span>
                  <code className="min-w-0 flex-1 break-words rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1 font-mono text-[11px] text-[var(--fg)]">
                    {step}
                  </code>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {architectureNotes.length > 0 ? (
          <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <h3 className="text-[12px] font-semibold text-[var(--fg)]">구조 관련 메모</h3>
            <ul className="mt-2 space-y-1">
              {architectureNotes.map((note) => (
                <li
                  key={note}
                  className="flex gap-2 text-[11.5px] leading-5 text-[var(--fg-muted)]"
                >
                  <span
                    aria-hidden
                    className="mt-[6px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--fg-dim)]"
                  />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {links.length > 0 ? (
          <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <h3 className="text-[12px] font-semibold text-[var(--fg)]">바깥 링크</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {links.map((link) => (
                <li key={`${link.kind}:${link.url}`}>
                  <LinkChip link={link} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <p className="max-w-[360px] text-center text-[12px] leading-6 text-[var(--fg-muted)]">
        이 레포의 README에서는 핵심 요약을 추출하기에 신호가 충분치 않습니다.
        먼저 이해하기 탭 또는 구조 보기 탭에서 직접 살펴보세요.
      </p>
    </div>
  );
}

function dedupeLinks(links: RepoReadmeLink[]): RepoReadmeLink[] {
  // 백엔드가 README에서 같은 호스트의 이미지/문서 URL을 각각 분리해 보낼 때가
  // 있다. 사용자 관점에서는 "데모 · assets.vercel.com" chip이 두 번 보이는
  // 셈이므로, 완전히 동일한 full URL은 물론이고 (kind + label) 조합까지
  // 같은 경우도 한 번만 노출한다. 어차피 chip에서 보이는 텍스트가 label이라
  // 같은 label이면 사용자 입장에선 구별이 안 된다.
  const seenUrl = new Set<string>();
  const seenDisplay = new Set<string>();
  const out: RepoReadmeLink[] = [];
  for (const link of links) {
    const urlKey = (link.url ?? "").trim().toLowerCase();
    const displayKey = `${link.kind}::${(link.label ?? "").trim().toLowerCase()}`;
    if (!urlKey) continue;
    if (seenUrl.has(urlKey) || seenDisplay.has(displayKey)) continue;
    seenUrl.add(urlKey);
    seenDisplay.add(displayKey);
    out.push(link);
  }
  return out;
}

const LINK_KIND_LABEL: Record<RepoReadmeLink["kind"], string> = {
  demo: "데모",
  deploy: "배포",
  docs: "문서",
  reference: "참고",
};

function LinkChip({ link }: { link: RepoReadmeLink }) {
  // 공격자가 README에 javascript:/data: 스킴 링크를 넣어도 href가 렌더되지
  // 않도록 safeExternalHref로 필터. 위험 스킴이면 비클릭 텍스트로 대체.
  const href = safeExternalHref(link.url);
  if (!href) {
    return (
      <span
        title={link.url}
        className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1 text-[11.5px] text-[var(--fg-dim)]"
      >
        <span className="text-[10px] uppercase tracking-[0.04em]">
          {LINK_KIND_LABEL[link.kind]}
        </span>
        <span className="truncate">{link.label}</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border)] bg-[var(--surface-strong)] px-2 py-1 text-[11.5px] text-[var(--fg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
      title={href}
    >
      <span className="text-[10px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        {LINK_KIND_LABEL[link.kind]}
      </span>
      <span className="truncate">{link.label}</span>
      <span aria-hidden className="text-[10px] text-[var(--fg-dim)]">↗</span>
    </a>
  );
}
