import { redirect } from "next/navigation";
import { AnalyzingScreen } from "@/components/analyzing-screen";

export default async function AnalyzingPage({
  searchParams,
}: {
  searchParams: Promise<{ repoUrl?: string }>;
}) {
  const params = await searchParams;
  const repoUrl = params.repoUrl?.trim();

  if (!repoUrl) {
    redirect("/");
  }

  return <AnalyzingScreen repoUrl={repoUrl} />;
}
