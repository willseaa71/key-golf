// Server Component — pure SVG, no "use client" needed
import { HOLE_PARS } from "@/lib/course";

const W = 520;
const H = 200;
const ML = 40;
const MR = 24;
const MT = 20;
const MB = 28;
const PW = W - ML - MR;
const PH = H - MT - MB;
const HOLES = 9;

type HoleEntry = { hole_number: number; strokes: number };

type RoundData = {
  week: number;
  half: string;
  holes: HoleEntry[];
};

type HoleProfileChartProps = {
  rounds: RoundData[];
};

function xOf(holeIndex: number /* 0-based */): number {
  // 9 holes spread evenly
  return ML + (holeIndex / (HOLES - 1)) * PW;
}

function yOf(strokes: number, min: number, max: number): number {
  return MT + ((max - strokes) / (max - min)) * PH;
}

function buildPath(
  holes: HoleEntry[],
  min: number,
  max: number,
  offset: number
): string {
  const sorted = [...holes].sort((a, b) => a.hole_number - b.hole_number);
  return sorted
    .map((h, i) => {
      const x = xOf(i).toFixed(1);
      const y = yOf(h.strokes, min, max).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

// Interpolate opacity for older rounds: oldest = 0.2, newest = 1.0
function roundOpacity(index: number, total: number): number {
  if (total === 1) return 1;
  // index 0 = oldest, index total-1 = newest
  return 0.2 + (0.8 * index) / (total - 1);
}

function SingleHalfChart({
  rounds,
  label,
}: {
  rounds: RoundData[];
  label: string | null;
}) {
  if (rounds.length === 0) return null;

  const isBack9 = rounds[0].half === "back9";
  const holeOffset = isBack9 ? 9 : 0;

  // Collect all strokes to determine Y scale (include par values so line stays in range)
  const parValues = [1,2,3,4,5,6,7,8,9].map((n) => HOLE_PARS[n + holeOffset] ?? 4);

  const allStrokes = rounds.flatMap((r) => r.holes.map((h) => h.strokes));
  if (allStrokes.length === 0) return null;

  const rawMin = Math.min(...allStrokes, ...parValues);
  const rawMax = Math.max(...allStrokes, ...parValues);
  const yMin = rawMin - 1;
  const yMax = rawMax + 1;

  // Integer Y-axis ticks
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v++) {
    ticks.push(v);
  }

  const mostRecentRound = rounds[rounds.length - 1];
  const mostRecentSorted = [...mostRecentRound.holes].sort(
    (a, b) => a.hole_number - b.hole_number
  );

  // Per-hole averages (only useful if 2+ rounds)
  const showAvg = rounds.length >= 2;
  const holeAvgPath: string | null = (() => {
    if (!showAvg) return null;
    // Assume all rounds have holes 1-9
    const holeNums = [...new Set(rounds.flatMap((r) => r.holes.map((h) => h.hole_number)))].sort(
      (a, b) => a - b
    );
    const pts = holeNums.map((hn, i) => {
      const vals = rounds
        .flatMap((r) => r.holes.filter((h) => h.hole_number === hn).map((h) => h.strokes));
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const x = xOf(i).toFixed(1);
      const y = yOf(avg, yMin, yMax).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    });
    return pts.join(" ");
  })();

  // X-axis labels
  const holeLabels = mostRecentSorted.map((h, i) => ({
    label: `H${h.hole_number + holeOffset}`,
    x: xOf(i),
  }));

  const chartId = label ? label.replace(/\s+/g, "-") : "chart";

  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
          {label}
        </p>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label={`Hole profile chart${label ? ` — ${label}` : ""}`}
      >
        {/* Gridlines + Y-axis labels */}
        {ticks.map((tick) => {
          const y = yOf(tick, yMin, yMax);
          return (
            <g key={tick}>
              <line
                x1={ML}
                y1={y}
                x2={W - MR}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={ML - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="#374151"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis — hole labels */}
        {holeLabels.map(({ label: hl, x }) => (
          <text
            key={hl}
            x={x}
            y={H - MB + 14}
            textAnchor="middle"
            fontSize="10"
            fill="#374151"
          >
            {hl}
          </text>
        ))}

        {/* Older round lines (faded) */}
        {rounds.slice(0, -1).map((r, i) => {
          const path = buildPath(r.holes, yMin, yMax, holeOffset);
          const opacity = roundOpacity(i, rounds.length);
          return (
            <path
              key={`line-${r.week}`}
              d={path}
              fill="none"
              stroke="#006747"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={opacity}
            />
          );
        })}

        {/* Par reference line — dashed gold */}
        {(() => {
          const parPath = [1,2,3,4,5,6,7,8,9].map((n, i) => {
            const par = HOLE_PARS[n + holeOffset] ?? 4;
            return `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(par, yMin, yMax).toFixed(1)}`;
          }).join(" ");
          return (
            <path
              d={parPath}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              strokeLinejoin="round"
              opacity="0.8"
            />
          );
        })()}

        {/* Average dashed line */}
        {holeAvgPath && (
          <path
            d={holeAvgPath}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeDasharray="4,3"
            strokeLinejoin="round"
          />
        )}

        {/* Most recent round — full opacity green */}
        {(() => {
          const path = buildPath(mostRecentRound.holes, yMin, yMax, holeOffset);
          return (
            <path
              d={path}
              fill="none"
              stroke="#006747"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })()}

        {/* Dots + labels on most recent round */}
        {mostRecentSorted.map((h, i) => {
          const cx = xOf(i);
          const cy = yOf(h.strokes, yMin, yMax);
          const labelY = cy < MT + 14 ? cy + 16 : cy - 10;
          return (
            <g key={`dot-${h.hole_number}`}>
              <circle
                cx={cx}
                cy={cy}
                r="9"
                fill="#006747"
                fillOpacity="0.12"
              />
              <circle
                cx={cx}
                cy={cy}
                r="5"
                fill="#006747"
                stroke="white"
                strokeWidth="1.5"
              />
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#006747"
              >
                {h.strokes}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend — always show Par; week lines + avg only if 2+ rounds */}
      {(
        <div className="flex gap-4 flex-wrap justify-end text-xs text-gray-500 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5" style={{ height: "0px", borderTop: "1.5px dashed #C9A84C" }} />
            Par
          </span>
        </div>
      )}
      {showAvg && (
        <div className="flex gap-4 flex-wrap justify-end text-xs text-gray-500 mt-2">
          {rounds.map((r, i) => {
            const opacity = roundOpacity(i, rounds.length);
            const isLatest = i === rounds.length - 1;
            return (
              <span key={r.week} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-5 h-0.5 rounded"
                  style={{
                    backgroundColor: "#006747",
                    opacity,
                    ...(isLatest ? {} : {}),
                    height: isLatest ? "2.5px" : "1.5px",
                  }}
                />
                <span style={{ opacity }}>W{r.week}</span>
              </span>
            );
          })}
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-5"
              style={{ height: "0px", borderTop: "1.5px dashed #C9A84C" }}
            />
            Par
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-5"
              style={{ height: "0px", borderTop: "1.5px dashed #9ca3af" }}
            />
            Avg
          </span>
        </div>
      )}
    </div>
  );
}

export function HoleProfileChart({ rounds }: HoleProfileChartProps) {
  if (rounds.length === 0) return null;

  // Group by half
  const front9 = rounds.filter((r) => r.half === "front9");
  const back9 = rounds.filter((r) => r.half === "back9");

  const hasBoth = front9.length > 0 && back9.length > 0;

  return (
    <div className="space-y-6">
      {front9.length > 0 && (
        <SingleHalfChart
          rounds={front9}
          label={hasBoth ? "Front-9" : null}
        />
      )}
      {back9.length > 0 && (
        <SingleHalfChart
          rounds={back9}
          label={hasBoth ? "Back-9" : null}
        />
      )}
    </div>
  );
}
