"use client";

import { useEffect, useRef } from "react";
import type { InspectorView, VisibleFileRow } from "@/components/result-view-model";

type InspectorOverlayProps = {
  view: InspectorView;
  onClose: () => void;
  onNavigate: (targetId: string) => void;
};

function ExtBadge({ ext }: { ext: string }) {
  if (!ext) return null;
  return (
    <span
      className="inline-flex h-[15px] min-w-[26px] items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--surface)] px-1 font-mono text-[9.5px] uppercase leading-none text-[var(--fg-dim)]"
      aria-hidden
    >
      {ext}
    </span>
  );
}

function StarPin() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M6 .75 7.45 4.2l3.55.35-2.7 2.5.8 3.45L6 8.8 2.9 10.5l.8-3.45L1 4.55l3.55-.35L6 .75Z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2M9 3h4v4M13 3L7 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileRow({
  row,
  onSelect,
}: {
  row: VisibleFileRow;
  onSelect?: (row: VisibleFileRow) => void;
}) {
  const Wrapper: "button" | "div" = row.isClickable ? "button" : "div";
  const commonProps = {
    className: `flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-left ${
      row.isClickable
        ? "hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] cursor-pointer"
        : "cursor-default"
    } ${row.isWeak ? "opacity-85" : ""}`,
    title: row.fullRole ? `${row.path} — ${row.fullRole}` : row.path,
  };

  const content = (
    <>
      {row.isStart ? (
        <span
          className="inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center text-[var(--accent)]"
          aria-label="여기부터 읽기"
        >
          <StarPin />
        </span>
      ) : (
        <ExtBadge ext={row.extension} />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--fg-muted)]">
        {row.display}
      </span>
      {row.role ? (
        <span className="shrink-0 max-w-[90px] truncate text-[10.5px] text-[var(--fg-dim)]">
          {row.role}
        </span>
      ) : null}
    </>
  );

  if (Wrapper === "button") {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(row)}
        {...commonProps}
      >
        {content}
      </button>
    );
  }

  return <div {...commonProps}>{content}</div>;
}

export function InspectorOverlay({ view, onClose, onNavigate }: InspectorOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 오버레이가 열리면 닫기 버튼을 우선 포커스 — Esc 외에 Enter로도 닫을 수 있고,
  // 스크린 리더가 dialog 진입을 먼저 알린다. view.title 바뀔 때마다 재포커스.
  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, [view.title]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/40 sm:absolute sm:z-10 sm:bg-transparent"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={view.title}
        onClick={(event) => event.stopPropagation()}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-lg border border-[var(--border)] bg-[var(--surface-strong)] shadow-[var(--shadow)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:z-20 sm:max-h-[calc(100%-1.5rem)] sm:w-[360px] sm:rounded-lg"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--border-strong)] sm:hidden" aria-hidden />
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            {view.breadcrumb ? (
              <nav
                aria-label="breadcrumb"
                className="mb-1 flex items-center gap-1 text-[11px] text-[var(--fg-dim)]"
              >
                <button
                  type="button"
                  onClick={() => onNavigate(view.breadcrumb!.targetId)}
                  className="truncate rounded hover:text-[var(--fg)] hover:underline"
                >
                  {view.breadcrumb.label}
                </button>
                <span aria-hidden>›</span>
                <span className="truncate text-[var(--fg-muted)]">{view.title}</span>
              </nav>
            ) : null}
            <h2 className="truncate text-[14px] font-semibold text-[var(--fg)]">
              {view.title}
            </h2>
            {view.subtitle ? (
              <p
                className="mt-0.5 truncate font-mono text-[11px] text-[var(--fg-muted)]"
                title={view.subtitleFull ?? view.subtitle}
              >
                {view.subtitle}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-md p-1 text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          <section className="space-y-3.5">
            {view.narrative.map((section) => (
              <div key={section.label}>
                <h3 className="text-[11px] font-medium text-[var(--fg-muted)]">
                  {section.label}
                </h3>
                <p
                  className={`mt-1 text-[12.5px] leading-6 ${
                    section.weak ? "text-[var(--fg-muted)]" : "text-[var(--fg)]/90"
                  }`}
                >
                  {section.body}
                </p>
              </div>
            ))}
          </section>

          {(view.kind === "layer" || view.kind === "file") && view.files.length > 0 ? (
            <section className="mt-5">
              <h3 className="text-[11px] font-medium text-[var(--fg-muted)]">
                관련 파일
              </h3>
              <ul className="mt-2 space-y-1">
                {view.files.map((row) => (
                  <li key={row.path}>
                    <FileRow
                      row={row}
                      onSelect={(fileRow) =>
                        onNavigate(fileRow.targetId ?? `file:${fileRow.path}`)
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {view.kind === "file" && view.editGuides.length > 0 ? (
            <details className="mt-5 border-t border-[var(--border)] pt-3">
              <summary className="cursor-pointer list-none text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                수정 포인트
              </summary>
              <ul className="mt-2.5 space-y-1.5">
                {view.editGuides.slice(0, 3).map((guide) => (
                  <li
                    key={guide.intent}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2"
                  >
                    <p className="text-[12.5px] font-medium text-[var(--fg)]">{guide.intent}</p>
                    <p className="mt-1 text-[11.5px] leading-5 text-[var(--fg-muted)]">
                      {guide.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {view.kind === "file" && view.githubUrl ? (
            <section className="mt-5">
              <a
                href={view.githubUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              >
                <ExternalLinkIcon />
                GitHub에서 보기
              </a>
            </section>
          ) : null}

          {view.kind === "layer" && view.focusLayer ? (
            <section className="mt-5">
              <button
                type="button"
                onClick={() => onNavigate(`focus:${view.focusLayer}`)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              >
                <span>이 레이어로 지도 좁히기</span>
                <span aria-hidden>→</span>
              </button>
            </section>
          ) : null}

          {view.evidence.length > 0 ? (
            <details className="mt-5 border-t border-[var(--border)] pt-3">
              <summary className="cursor-pointer list-none text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                근거 보기
              </summary>
              <ul className="mt-2.5 space-y-1">
                {view.evidence.slice(0, 5).map((item) => (
                  <li key={item} className="text-[11.5px] leading-5 text-[var(--fg-muted)]">
                    {item}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </aside>
    </>
  );
}
