"use client";

import type { LeftPanelItem, LeftPanelSection } from "@/components/result-view-model";

// ─── Icon set ───────────────────────────────────────────────────────────────
// Reusing the simple monoline signage from the earlier Claude iteration so the
// panel reads as a tiny toolbar rather than a text menu.

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function CanvasIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.5h12" />
    </svg>
  );
}

function LearningIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M2.5 3.5h6.5a1.5 1.5 0 011.5 1.5v8M2.5 3.5v8a1.5 1.5 0 001.5 1.5h6.5a1.5 1.5 0 011.5 1.5M2.5 3.5a1.5 1.5 0 000 3h6" />
      <path d="M10.5 5h3" />
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="2.5" width="4.5" height="4" rx="0.8" />
      <rect x="9.5" y="2.5" width="4.5" height="4" rx="0.8" />
      <rect x="9.5" y="9.5" width="4.5" height="4" rx="0.8" />
      <path d="M4.25 6.5v3h7.75M11.75 6.5v3" />
    </svg>
  );
}

function ReadmeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 2.5h7.5L13 5v8.5H3z" />
      <path d="M10 2.5V5h3M5 7.5h6M5 9.5h6M5 11.5h4" />
    </svg>
  );
}

function EnvironmentIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <path d="M2 7h12M4.5 9.5h2M8 9.5h1" />
    </svg>
  );
}

function AllIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function UIIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 6.5h12" />
    </svg>
  );
}

function LogicIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M5.5 3l-3 5 3 5M10.5 3l3 5-3 5" />
    </svg>
  );
}

function DbIcon() {
  return (
    <svg {...ICON_PROPS}>
      <ellipse cx="8" cy="3.5" rx="5" ry="1.8" />
      <path d="M3 3.5v9c0 1 2.3 1.8 5 1.8s5-.8 5-1.8v-9M3 8c0 1 2.3 1.8 5 1.8S13 9 13 8" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M2.2 8h11.6M8 2.2a9 9 0 010 11.6M8 2.2a9 9 0 000 11.6" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 4L2 8l4 4M10 4l4 4-4 4" />
    </svg>
  );
}

function ScopeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M1.5 4.5a1 1 0 011-1h3.2l1.3 1.4h6a1 1 0 011 1V12a1 1 0 01-1 1h-11a1 1 0 01-1-1z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5M8 11v.5" />
    </svg>
  );
}

function iconFor(item: LeftPanelItem) {
  if (item.id.startsWith("view:")) {
    if (item.id === "view:diagram") return <DiagramIcon />;
    if (item.id === "view:learning") return <LearningIcon />;
    if (item.id === "view:readme") return <ReadmeIcon />;
    if (item.id === "view:environment") return <EnvironmentIcon />;
    return <CanvasIcon />;
  }
  if (item.id === "layer:all") return <AllIcon />;
  if (item.id === "layer:UI") return <UIIcon />;
  if (item.id === "layer:Logic") return <LogicIcon />;
  if (item.id === "layer:API") return <ApiIcon />;
  if (item.id === "layer:DB") return <DbIcon />;
  if (item.id === "layer:External") return <ExternalIcon />;
  if (item.id === "layer:Code") return <CodeIcon />;
  if (item.id.startsWith("scope:")) return <ScopeIcon />;
  if (item.id.startsWith("status:")) return <StatusIcon />;
  return null;
}

// ─── Row ────────────────────────────────────────────────────────────────────

function PanelItem({
  item,
  onSelect,
}: {
  item: LeftPanelItem;
  onSelect: (item: LeftPanelItem) => void;
}) {
  const icon = iconFor(item);

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => !item.disabled && onSelect(item)}
      title={item.label}
      className={`relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-3 text-left text-[12px] transition-colors before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[2px] before:rounded-full ${
        item.active
          ? "bg-[var(--surface-hover)] text-[var(--fg)] before:bg-[var(--accent)]"
          : item.disabled
            ? "text-[var(--fg-dim)] before:bg-transparent opacity-45"
            : "text-[var(--fg-muted)] before:bg-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
      }`}
    >
      {icon ? (
        <span
          aria-hidden
          className={`inline-flex shrink-0 items-center justify-center ${
            item.active ? "text-[var(--fg)]" : "text-[var(--fg-dim)]"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.statusDot ? (
        <span
          title={item.statusHint}
          aria-label={item.statusHint}
          className={`inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ${
            item.statusDot === "blocker"
              ? "bg-[var(--accent-warm)] text-[var(--accent-fg)] ring-1 ring-[var(--accent-warm)]/40"
              : item.statusDot === "warning"
                ? "bg-[var(--accent-warm)]/25 text-[var(--accent-warm)] ring-1 ring-[var(--accent-warm)]/30"
                : "bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
          }`}
        >
          <span aria-hidden>
            {item.statusDot === "blocker"
              ? "!"
              : item.statusDot === "warning"
                ? "!"
                : "✓"}
          </span>
        </span>
      ) : null}
      {typeof item.count === "number" ? (
        <span className="shrink-0 text-[10.5px] text-[var(--fg-dim)]">{item.count}</span>
      ) : null}
    </button>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export function LeftPanel({
  sections,
  onSelect,
  className = "",
}: {
  sections: LeftPanelSection[];
  onSelect: (item: LeftPanelItem) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="결과 탐색"
      className={`left-panel rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 ${className}`.trim()}
    >
      <div className="flex flex-col">
        {sections.map((section, index) => {
          const isView = section.id === "view";
          const isLast = index === sections.length - 1;
          return (
            <section key={section.id} className="py-1.5 first:pt-0.5 last:pb-0.5">
              {!isView ? (
                <p className="px-1.5 pb-1 text-[10.5px] font-medium text-[var(--fg-dim)]">
                  {section.title}
                </p>
              ) : null}
              <div className="space-y-[2px]">
                {section.items.map((item) => (
                  <PanelItem key={item.id} item={item} onSelect={onSelect} />
                ))}
              </div>
              {!isLast ? (
                <div
                  aria-hidden
                  className="mx-1 mt-1.5 border-t border-[var(--border)]"
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </nav>
  );
}
