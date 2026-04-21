"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXAMPLE_REPO } from "@/lib/app-constants";
import { validateGitHubTargetUrlInput } from "@/lib/analysis/validators";

export function RepoInputForm({ initialValue = "" }: { initialValue?: string }) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState(initialValue);
  const [error, setError] = useState("");
  const canSubmit = useMemo(() => repoUrl.trim().length > 0, [repoUrl]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    try {
      const validated = validateGitHubTargetUrlInput(repoUrl);
      setError("");
      router.push(`/analyzing?repoUrl=${encodeURIComponent(validated.canonicalUrl)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "GitHub 공개 레포 URL을 다시 확인해 주세요."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-stretch gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 focus-within:border-[var(--border-strong)]">
        <input
          value={repoUrl}
          onChange={(event) => {
            setRepoUrl(event.target.value);
            if (error) {
              setError("");
            }
          }}
          placeholder="예: https://github.com/facebook/react"
          aria-label="GitHub 레포 또는 owner URL"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 min-w-0 rounded-md bg-transparent px-3 py-2 text-[13.5px] text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="shrink-0 rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          분석 시작
        </button>
      </div>

      <div className="mt-2 flex min-h-[20px] items-center justify-between gap-3 text-[12px]">
        {error ? (
          <p className="text-[var(--accent-warm)]">{error}</p>
        ) : (
          <span className="text-[var(--fg-dim)]">레포 주소면 코드 한눈에, 계정 주소면 그 사람의 여러 레포가 한 번에 나와요</span>
        )}
        <button
          type="button"
          onClick={() => {
            setRepoUrl(EXAMPLE_REPO);
            setError("");
          }}
          className="shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline"
        >
          예시 레포 사용
        </button>
      </div>
    </form>
  );
}
