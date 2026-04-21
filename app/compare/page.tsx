import type { Metadata } from "next";
import { CompareScreen } from "@/components/compare-screen";

export const metadata: Metadata = {
  title: "두 레포 비교 · RepoLens",
  description:
    "GitHub 레포 두 개의 스택 · 구조 · 실행 환경을 나란히 비교합니다.",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const a = params.a?.trim() ?? "";
  const b = params.b?.trim() ?? "";

  return <CompareScreen a={a} b={b} />;
}
