// app/src/components/trend-chart.tsx
// Server-rendered SVG grouped bar chart for weekly attendance trends.
// Lime bar = total check-ins, deep-green bar = FTV count.
// Colors come from theme tokens so the chart follows light/dark mode.
import type { WeeklyBucket } from "@/lib/attendance-trends";

const WIDTH = 800;
const HEIGHT = 220;
const PAD_X = 8;
const PAD_TOP = 18;
const PAD_BOTTOM = 28;

export default function TrendChart({ buckets }: { buckets: WeeklyBucket[] }) {
  if (buckets.length === 0) return null;

  const max = Math.max(...buckets.map((b) => b.checkIns), 1);
  const innerWidth = WIDTH - PAD_X * 2;
  const slot = innerWidth / buckets.length;
  const barWidth = Math.min(28, slot * 0.5);
  const ftvWidth = Math.max(3, barWidth * 0.4);
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  // Show at most ~12 x-axis labels so the year view stays legible.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 12));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Weekly attendance trend"
    >
      {/* Baseline */}
      <line
        x1={PAD_X}
        y1={PAD_TOP + chartHeight}
        x2={WIDTH - PAD_X}
        y2={PAD_TOP + chartHeight}
        stroke="var(--chart-grid)"
        strokeWidth={1}
      />
      {buckets.map((b, i) => {
        const cx = PAD_X + i * slot + slot / 2;
        const barH = (b.checkIns / max) * chartHeight;
        const ftvH = (b.ftv / max) * chartHeight;
        const barY = PAD_TOP + chartHeight - barH;
        const ftvY = PAD_TOP + chartHeight - ftvH;
        const delay = `${Math.min(i * 0.04, 0.6)}s`;
        return (
          <g key={b.week}>
            <rect
              x={cx - barWidth / 2}
              y={barY}
              width={barWidth}
              height={barH}
              rx={4}
              fill="var(--chart-1)"
              className="bar-animate"
              style={{ animationDelay: delay, transformBox: "fill-box" }}
            />
            <rect
              x={cx + barWidth / 2 + 2}
              y={ftvY}
              width={ftvWidth}
              height={ftvH}
              rx={2}
              fill="var(--chart-2)"
              className="bar-animate"
              style={{ animationDelay: delay, transformBox: "fill-box" }}
            />
            {i % labelEvery === 0 && (
              <text
                x={cx}
                y={barY - 4}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize={10}
                fontWeight={600}
              >
                {b.checkIns}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text
                x={cx}
                y={HEIGHT - 8}
                textAnchor="middle"
                fill="var(--chart-label)"
                fontSize={9}
              >
                {b.week.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
