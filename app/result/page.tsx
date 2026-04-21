import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResultScreen } from "@/components/result-screen";
import { validateGitHubTargetUrlInput } from "@/lib/analysis/validators";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ repoUrl?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const repoUrl = params.repoUrl?.trim();

  if (!repoUrl) {
    return {
      title: "분석 결과",
      description:
        "GitHub 레포의 정체성 · 기술 스택 · 시작 파일 · 구조를 한 화면에서 봅니다.",
    };
  }

  try {
    const validated = validateGitHubTargetUrlInput(repoUrl);
    const label =
      validated.kind === "repo"
        ? `${validated.owner}/${validated.repo}`
        : validated.owner;
    return {
      title: `${label} 분석`,
      description: `${label} 레포를 RepoLens로 훑어본 결과. 정체성, 기술 스택, 시작 파일, 구조를 한눈에.`,
      openGraph: {
        title: `${label} · RepoLens`,
        description: `${label} 레포를 RepoLens로 훑어본 결과입니다.`,
      },
      twitter: {
        title: `${label} · RepoLens`,
        description: `${label} 레포를 RepoLens로 훑어본 결과입니다.`,
      },
    };
  } catch {
    return { title: "분석 결과" };
  }
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ repoUrl?: string }>;
}) {
  const params = await searchParams;
  const repoUrl = params.repoUrl?.trim();

  if (!repoUrl) {
    redirect("/");
  }

  return <ResultScreen repoUrl={repoUrl} />;
}
