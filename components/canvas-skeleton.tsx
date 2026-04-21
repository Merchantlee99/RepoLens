type SkeletonFrame = { x: number; y: number; w: number; h: number };

const SKELETON_W = 720;
const SKELETON_H = 280;
const BOX_W = 128;
const BOX_H = 88;

const FRAMES: SkeletonFrame[] = [
  { x: 16,  y: 96,  w: BOX_W, h: BOX_H }, // UI
  { x: 168, y: 96,  w: BOX_W, h: BOX_H }, // Logic
  { x: 320, y: 96,  w: BOX_W, h: BOX_H }, // API
  { x: 472, y: 24,  w: BOX_W, h: BOX_H }, // DB
  { x: 472, y: 168, w: BOX_W, h: BOX_H }, // External
];

const EDGES: Array<[number, number]> = [
  [0, 1], // UI -> Logic
  [1, 2], // Logic -> API
  [2, 3], // API -> DB
  [2, 4], // API -> External
];

function edgePath(from: SkeletonFrame, to: SkeletonFrame) {
  const startX = from.x + from.w;
  const startY = from.y + from.h / 2;
  const endX = to.x;
  const endY = to.y + to.h / 2;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

export function CanvasSkeleton() {
  return (
    <div
      aria-hidden
      className="relative mx-auto overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
      style={{
        width: "100%",
        maxWidth: SKELETON_W,
        aspectRatio: `${SKELETON_W} / ${SKELETON_H}`,
        backgroundImage:
          "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "24px 24px, 24px 24px",
      }}
    >
      <svg
        viewBox={`0 0 ${SKELETON_W} ${SKELETON_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {EDGES.map(([a, b]) => (
          <path
            key={`${a}-${b}`}
            d={edgePath(FRAMES[a], FRAMES[b])}
            fill="none"
            stroke="var(--fg-dim)"
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {FRAMES.map((frame, index) => (
          <g
            key={index}
            className="skeleton-box"
            style={{ animationDelay: `${index * 180}ms` }}
          >
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.w}
              height={frame.h}
              rx="6"
              fill="var(--surface-strong)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <rect
              x={frame.x + 12}
              y={frame.y + 14}
              width="16"
              height="8"
              rx="2"
              fill="var(--fg-dim)"
              opacity="0.35"
            />
            <rect
              x={frame.x + 12}
              y={frame.y + 34}
              width={frame.w - 24}
              height="6"
              rx="2"
              fill="var(--fg-dim)"
              opacity="0.22"
            />
            <rect
              x={frame.x + 12}
              y={frame.y + 48}
              width={frame.w - 48}
              height="6"
              rx="2"
              fill="var(--fg-dim)"
              opacity="0.22"
            />
            <rect
              x={frame.x + 12}
              y={frame.y + 62}
              width={frame.w - 36}
              height="6"
              rx="2"
              fill="var(--fg-dim)"
              opacity="0.22"
            />
          </g>
        ))}
      </svg>

      <style>{`
        .skeleton-box {
          animation: repolens-skel-pulse 1600ms ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes repolens-skel-pulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
