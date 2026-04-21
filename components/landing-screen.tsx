import Link from "next/link";
import { RepoInputForm } from "@/components/repo-input-form";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
          RepoLens
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[520px]">
          <h1 className="text-center text-[28px] font-semibold tracking-[-0.02em] text-[var(--fg)] sm:text-[32px]">
            RepoLens
          </h1>
          <p className="mt-3 text-center text-[14px] leading-6 text-[var(--fg-muted)]">
            README를 읽기 전에 먼저 보세요.
            <br />
            처음 보는 레포도 30초면 구조가 잡힙니다.
          </p>

          <div className="mt-8">
            <RepoInputForm />
          </div>

          <PreviewHint />

          <p className="mt-6 text-center text-[11px] text-[var(--fg-dim)]">
            두 레포를 비교하고 싶다면?{" "}
            <Link
              href="/compare"
              className="text-[var(--fg-muted)] underline hover:text-[var(--fg)]"
            >
              두 레포 비교하기 →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

// "분석 시작"을 누르기 전에 "무엇이 나오는지" 감각을 잡아주는 3줄 힌트.
// 텍스트만으로 충분한 설득 — 실제 스크린샷은 네트워크 비용 + 번역 이슈로 배제.
function PreviewHint() {
  const items = [
    {
      head: "한 줄로 정체성",
      body: "이 레포가 뭐 하는 건지, 어떤 기술로 돌아가는지",
    },
    {
      head: "어디부터 읽을지",
      body: "시작 파일 · 읽는 순서 · 파일의 역할까지",
    },
    {
      head: "실행은 어떻게",
      body: "README 핵심 요약 · 필요한 서비스 · 실행 명령",
    },
  ];
  return (
    <ul className="mt-6 grid gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.head}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left"
        >
          <p className="text-[11.5px] font-semibold text-[var(--fg)]">
            {item.head}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--fg-muted)]">
            {item.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
