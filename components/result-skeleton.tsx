// Result 레이아웃을 흉내내는 placeholder. analyzing 화면에서 "무엇이 나올지"
// 미리 예측되도록 Identity Bar + 좌측 panel + 본문 플레이스홀더 순서로 구성.
// 기존 CanvasSkeleton(구조 보기 canvas 모양)은 Result의 주인공이 아니라
// 기대 불일치를 만들었음.
export function ResultSkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-[1040px] animate-[repolens-skel-pulse_1800ms_ease-in-out_infinite]"
    >
      {/* Identity Bar placeholder */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        {/* caption bar */}
        <div className="flex items-center gap-2">
          <SkelLine width={180} height={10} />
          <SkelLine width={100} height={10} />
          <SkelLine width={90} height={14} rounded="sm" />
        </div>
        {/* plainTitle */}
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <SkelLine width={"65%"} height={18} />
            <SkelLine width={"80%"} height={12} />
          </div>
          <SkelLine width={140} height={28} rounded="md" />
        </div>
        {/* 2 points */}
        <div className="mt-3 space-y-1.5">
          <SkelLine width={"70%"} height={10} />
          <SkelLine width={"60%"} height={10} />
        </div>
        {/* badges */}
        <div className="mt-3 flex gap-1.5">
          <SkelLine width={92} height={22} rounded="sm" />
          <SkelLine width={80} height={22} rounded="sm" />
          <SkelLine width={104} height={22} rounded="sm" />
          <SkelLine width={88} height={22} rounded="sm" />
        </div>
      </div>

      {/* Tab + main content placeholder */}
      <div className="mt-3 flex gap-3">
        <div className="hidden w-[140px] shrink-0 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 md:block">
          <SkelLine width={"80%"} height={12} />
          <SkelLine width={"60%"} height={12} />
          <SkelLine width={"70%"} height={12} />
          <SkelLine width={"50%"} height={12} />
        </div>
        <div className="flex-1 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <SkelLine width={"40%"} height={14} />
          <SkelLine width={"90%"} height={10} />
          <SkelLine width={"85%"} height={10} />
          <SkelLine width={"72%"} height={10} />
          <div className="h-4" />
          <SkelLine width={"30%"} height={14} />
          <SkelLine width={"95%"} height={10} />
          <SkelLine width={"80%"} height={10} />
        </div>
      </div>

      <style>{`
        @keyframes repolens-skel-pulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SkelLine({
  width,
  height,
  rounded = "full",
}: {
  width: number | string;
  height: number;
  rounded?: "full" | "sm" | "md";
}) {
  const radius =
    rounded === "md" ? "rounded-md" : rounded === "sm" ? "rounded-sm" : "rounded-full";
  return (
    <span
      className={`inline-block bg-[var(--surface-strong)] ${radius}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
      }}
    />
  );
}
