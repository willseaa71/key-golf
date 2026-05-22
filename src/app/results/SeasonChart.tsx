// Server Component — pure SVG, no JS required, responsive via viewBox

const TOTAL_WEEKS = 13;
const W = 520;
const H = 220;
const ML = 44;
const MR = 20;
const MT = 24;
const MB = 32;
const PW = W - ML - MR;
const PH = H - MT - MB;

type WeekScore = { week: number; score: number; half: string };

function xOf(week: number) {
  return ML + ((week - 1) / (TOTAL_WEEKS - 1)) * PW;
}

function yOf(score: number, min: number, max: number) {
  // Axis ascends: lower score (better) sits lower on the chart
  return MT + ((max - score) / (max - min)) * PH;
}

function niceYTicks(min: number, max: number, count = 4) {
  const step = Math.ceil((max - min) / count / 2) * 2;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step; v += step) {
    if (v >= min - 1 && v <= max + 1) ticks.push(v);
  }
  return ticks;
}

function dotColor(score: number, avg2025: number | null): { fill: string; stroke: string } {
  if (avg2025 === null) return { fill: "#006747", stroke: "#006747" };
  if (score < avg2025)  return { fill: "#006747", stroke: "#004f37" }; // beat avg — green
  if (score > avg2025)  return { fill: "#dc2626", stroke: "#b91c1c" }; // above avg — red
  return { fill: "#6b7280", stroke: "#4b5563" };                        // exactly equal
}

export function SeasonChart({
  weeklyScores,
  avg2025,
  avg2024,
}: {
  weeklyScores: WeekScore[];
  avg2025: number | null;
  avg2024: number | null;
}) {
  const allValues = [
    ...weeklyScores.map((s) => s.score),
    avg2025,
    avg2024,
  ].filter((v): v is number => v !== null);

  if (allValues.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        No data to chart yet.
      </p>
    );
  }

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = Math.max(2, Math.round((rawMax - rawMin) * 0.2));
  const min = rawMin - pad;
  const max = rawMax + pad;

  const ticks = niceYTicks(min, max);
  const sorted = [...weeklyScores].sort((a, b) => a.week - b.week);

  // Line path
  const linePath =
    sorted.length > 1
      ? sorted
          .map((s, i) => `${i === 0 ? "M" : "L"}${xOf(s.week).toFixed(1)},${yOf(s.score, min, max).toFixed(1)}`)
          .join(" ")
      : null;

  // Area path — line + down to baseline + back to start
  const baseline = (MT + PH).toFixed(1);
  const areaPath = linePath
    ? linePath
        + ` L${xOf(sorted[sorted.length - 1].week).toFixed(1)},${baseline}`
        + ` L${xOf(sorted[0].week).toFixed(1)},${baseline}`
        + " Z"
    : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="Season score chart"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#006747" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#006747" stopOpacity="0.02" />
          </linearGradient>
          {/* Clip to plot area so fills don't bleed into margins */}
          <clipPath id="plotClip">
            <rect x={ML} y={MT} width={PW} height={PH} />
          </clipPath>
        </defs>

        {/* Gridlines + Y axis labels */}
        {ticks.map((tick) => {
          const y = yOf(tick, min, max);
          return (
            <g key={tick}>
              <line
                x1={ML} y1={y} x2={W - MR} y2={y}
                stroke="#e5e7eb" strokeWidth="1"
              />
              <text
                x={ML - 6} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize="10" fill="#374151"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X axis — week labels */}
        {[1, 3, 5, 7, 9, 11, 13].map((w) => (
          <text
            key={w}
            x={xOf(w)} y={H - MB + 14}
            textAnchor="middle" fontSize="10" fill="#374151"
          >
            W{w}
          </text>
        ))}

        {/* 2024 avg reference line */}
        {avg2024 !== null && (
          <g clipPath="url(#plotClip)">
            <line
              x1={ML} y1={yOf(avg2024, min, max)}
              x2={W - MR} y2={yOf(avg2024, min, max)}
              stroke="#374151" strokeWidth="1" strokeDasharray="4,3"
            />
          </g>
        )}
        {avg2024 !== null && (
          <text
            x={W - MR - 2} y={yOf(avg2024, min, max) - 4}
            textAnchor="end" fontSize="9" fill="#374151"
          >
            '24 avg {avg2024}
          </text>
        )}

        {/* 2025 avg reference line */}
        {avg2025 !== null && (
          <g clipPath="url(#plotClip)">
            <line
              x1={ML} y1={yOf(avg2025, min, max)}
              x2={W - MR} y2={yOf(avg2025, min, max)}
              stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,3"
            />
          </g>
        )}
        {avg2025 !== null && (
          <text
            x={W - MR - 2} y={yOf(avg2025, min, max) - 4}
            textAnchor="end" fontSize="9" fill="#d97706"
          >
            '25 avg {avg2025}
          </text>
        )}

        {/* Area fill */}
        {areaPath && (
          <path
            d={areaPath}
            fill="url(#areaGradient)"
            clipPath="url(#plotClip)"
          />
        )}

        {/* Score line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#006747"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath="url(#plotClip)"
          />
        )}

        {/* Score dots + labels */}
        {sorted.map((s) => {
          const cx = xOf(s.week);
          const cy = yOf(s.score, min, max);
          const { fill, stroke } = dotColor(s.score, avg2025);
          // Push label above or below depending on proximity to top edge
          const labelY = cy < MT + 14 ? cy + 16 : cy - 10;
          return (
            <g key={s.week}>
              {/* Soft glow ring */}
              <circle cx={cx} cy={cy} r="9" fill={fill} fillOpacity="0.15" />
              <circle cx={cx} cy={cy} r="5.5" fill={fill} stroke="white" strokeWidth="2" />
              <text
                x={cx} y={labelY}
                textAnchor="middle"
                fontSize="10" fontWeight="700"
                fill={fill}
              >
                {s.score}
              </text>
              <title>
                Week {s.week} · {s.score} strokes ({s.half === "front9" ? "Front-9" : "Back-9"})
              </title>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 justify-end text-xs text-gray-500 mt-2 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-[#006747]" />
          Beat 2025 avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-red-600" />
          Above 2025 avg
        </span>
        {avg2025 !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-amber-600" />
            2025 avg
          </span>
        )}
        {avg2024 !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-gray-600" />
            2024 avg
          </span>
        )}
      </div>
    </div>
  );
}
