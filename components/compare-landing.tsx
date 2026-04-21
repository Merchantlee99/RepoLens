"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { validateCompareRepoInput } from "@/components/compare-view-model";

type FieldError = { a?: string; b?: string };

export function CompareLanding({
  initialA = "",
  initialB = "",
}: {
  initialA?: string;
  initialB?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [errors, setErrors] = useState<FieldError>({});
  const canSubmit = useMemo(() => a.trim().length > 0 && b.trim().length > 0, [a, b]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const nextErrors: FieldError = {};
    let validatedA: string | null = null;
    let validatedB: string | null = null;

    try {
      validatedA = validateCompareRepoInput(a).canonicalUrl;
    } catch (err) {
      nextErrors.a = err instanceof Error ? err.message : "올바른 레포 URL이 아닙니다.";
    }

    try {
      validatedB = validateCompareRepoInput(b).canonicalUrl;
    } catch (err) {
      nextErrors.b = err instanceof Error ? err.message : "올바른 레포 URL이 아닙니다.";
    }

    if (nextErrors.a || nextErrors.b || !validatedA || !validatedB) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    router.push(
      `/compare?a=${encodeURIComponent(validatedA)}&b=${encodeURIComponent(validatedB)}`
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 text-[13px] tracking-[-0.01em]">
          <Link
            href="/"
            className="font-semibold text-[var(--fg)] hover:underline"
          >
            RepoLens
          </Link>
          <span className="text-[var(--fg-dim)]">/</span>
          <span className="text-[var(--fg-muted)]">compare</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[560px]">
          <h1 className="text-center text-[24px] font-semibold tracking-[-0.02em] text-[var(--fg)] sm:text-[28px]">
            두 레포를 나란히 비교합니다
          </h1>
          <p className="mt-3 text-center text-[13px] leading-6 text-[var(--fg-muted)]">
            두 레포의 스택 · 구조 · 실행 환경을 나란히 보여드립니다.
            <br />
            어디가 같고 어디가 다른지 한눈에 확인할 수 있어요.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <CompareField
              label="레포 A"
              value={a}
              onChange={(value) => {
                setA(value);
                if (errors.a) setErrors((prev) => ({ ...prev, a: undefined }));
              }}
              error={errors.a}
              placeholder="예: https://github.com/facebook/react"
            />
            <CompareField
              label="레포 B"
              value={b}
              onChange={(value) => {
                setB(value);
                if (errors.b) setErrors((prev) => ({ ...prev, b: undefined }));
              }}
              error={errors.b}
              placeholder="예: https://github.com/vercel/next.js"
            />

            <ExamplePairs
              onPick={(exA, exB) => {
                setA(exA);
                setB(exB);
                setErrors({});
              }}
            />

            <div className="flex items-center justify-between gap-3 pt-1 text-[12px]">
              <span className="text-[var(--fg-dim)]">
                단일 레포 주소만 넣어주세요 (계정 주소 제외)
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                비교하기
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-[11.5px] text-[var(--fg-dim)]">
            한 레포만 보고 싶다면{" "}
            <Link href="/" className="underline hover:text-[var(--fg-muted)]">
              메인으로
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

// Compare는 "뭘 뭘이랑 비교하라는 거지?" 라는 초보 고민이 크다. 자주 비교할
// 만한 쌍을 미리 2~3개 제공해 "아, 이런 식으로 쓰면 되는구나" 감각을 준다.
const EXAMPLE_PAIRS: Array<{
  label: string;
  desc: string;
  a: string;
  b: string;
}> = [
  {
    label: "비슷한 주제 비교",
    desc: "두 개의 React 프레임워크",
    a: "https://github.com/vercel/next.js",
    b: "https://github.com/remix-run/remix",
  },
  {
    label: "전이 검토",
    desc: "쓰던 라이브러리 ↔ 대안 후보",
    a: "https://github.com/sindresorhus/camelcase",
    b: "https://github.com/sindresorhus/slugify",
  },
  {
    label: "AI 앱 구조 참고",
    desc: "OpenAI 예제 ↔ 내 AI 앱 후보",
    a: "https://github.com/openai/openai-quickstart-node",
    b: "https://github.com/ahmedkhaleel2004/gitdiagram",
  },
];

function ExamplePairs({
  onPick,
}: {
  onPick: (a: string, b: string) => void;
}) {
  return (
    <div className="pt-1">
      <p className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--fg-dim)]">
        어떤 상황에 쓰나요
      </p>
      <ul className="mt-1.5 space-y-1">
        {EXAMPLE_PAIRS.map((ex) => (
          <li key={ex.label}>
            <button
              type="button"
              onClick={() => onPick(ex.a, ex.b)}
              className="flex w-full items-baseline gap-2 rounded-md px-1 py-1 text-left text-[11.5px] leading-5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              <span className="font-medium text-[var(--fg)]">{ex.label}</span>
              <span className="text-[var(--fg-dim)]">·</span>
              <span className="truncate">{ex.desc}</span>
              <span aria-hidden className="ml-auto text-[10.5px] text-[var(--fg-dim)]">
                예시 채우기 →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareField({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] font-medium text-[var(--fg-dim)]">
        {label}
      </span>
      <div
        className={`rounded-lg border bg-[var(--surface)] p-1 focus-within:border-[var(--border-strong)] ${
          error ? "border-[var(--accent-warm)]" : "border-[var(--border)]"
        }`}
      >
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full rounded-md bg-transparent px-3 py-2 text-[13.5px] text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:outline-none"
        />
      </div>
      {error ? (
        <p className="mt-1 text-[11.5px] text-[var(--accent-warm)]">{error}</p>
      ) : null}
    </label>
  );
}
