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
  return ML + (holeIndex / (HOLES - 1)) * PW;
}

function buildPath(points: { x: number; y: number }[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
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
  const holeNums = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const parValues = holeNums.map((n) => HOLE_PARS[n + holeOffset] ?? 4);

  // Per-hole averages across all rounds (all rounds equally weighted)
  const holeAvgs = holeNums.map((hn) => {
    const vals = rounds.flatMap((r) =>
      r.holes.filter((h) => h.hole_number === hn).map((h) => h.strokes)
    );
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  // Most recent round
  const mostRecentRound = rounds[rounds.length - 1];
  const mostRecentByHole = new Map(mostRecentRound.holes.map((h) => [h.hole_number, h.strokes]));
  const mostRecentValues = holeNums.map((hn) => mostRecentByHole.get(hn) ?? null);

  // Y-scale: include par, recent, and avg in range
  const allValues = [
    ...parValues,
    ...mostRecentValues.filter((v): v is number => v !== null),
    ...holeAvgs.filter((v): v is number => v !== null),
  ];
  if (allValues.length === 0) return null;

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const yMin = rawMin - 1;
  const yMax = rawMax + 1;

  function yOf(v: number): number {
    return MT + ((yMax - v) / (yMax - yMin)) * PH;
  }

  // Integer Y-axis ticks
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin); v <= Math.floor(yMax); v++) ticks.push(v);

  // Build SVG point arrays
  const parPoints = holeNums.map((_, i) => ({ x: xOf(i), y: yOf(parValues[i]) }));
  const recentPoints = holeNums.map((_, i) => {
    const v = mostRecentValues[i];
    return v !== null ? { x: xOf(i), y: yOf(v) } : null;
  }).filter((p): p is { x: number; y: number } => p !== null);
  const avgPoints = holeNums.map((_, i) => {
    const v = holeAvgs[i];
    return v !== null ? { x: xOf(i), y: yOf(v) } : null;
  }).filter((p): p is { x: number; y: number } => p !== null);

  const showAvg = rounds.length >= 2;

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
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line x1={ML} y1={y} x2={W - MR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={ML - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#374151">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis — hole labels */}
        {holeNums.map((hn, i) => (
          <text
            key={hn}
            x={xOf(i)}
            y={H - MB + 14}
            textAnchor="middle"
            fontSize="10"
            fill="#374151"
          >
            H{hn + holeOffset}
          </text>
        ))}

        {/* Par — dashed gold (drawn first, behind other lines) */}
        <path
          d={buildPath(parPoints)}
          fill="none"
          stroke="#C9A84C"
          strokeWidth="1.5"
          strokeDasharray="4,3"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Hole avg — dashed gray (behind most recent) */}
        {showAvg && avgPoints.length > 0 && (
          <path
            d={buildPath(avgPoints)}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeDasharray="4,3"
            strokeLinejoin="round"
          />
        )}

        {/* Most recent round — solid green */}
        {recentPoints.length > 0 && (
          <path
            d={buildPath(recentPoints)}
            fill="none"
            stroke="#006747"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots + score labels on most recent round */}
        {holeNums.map((hn, i) => {
          const v = mostRecentValues[i];
          if (v === null) return null;
          const cx = xOf(i);
          const cy = yOf(v);
          const labelY = cy < MT + 14 ? cy + 16 : cy - 10;
          return (
            <g key={`dot-${hn}`}>
              <circle cx={cx} cy={cy} r="9" fill="#006747" fillOpacity="0.12" />
              <circle cx={cx} cy={cy} r="5" fill="#006747" stroke="white" strokeWidth="1.5" />
              <text x={cx} y={labelY} textAnchor="middle" fontSize="10" fontWeight="700" fill="#006747">
                {v}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap justify-end text-xs text-gray-500 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 rounded" style={{ height: "2.5px", backgroundColor: "#006747" }} />
          Most recent
        </span>
        {showAvg && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5" style={{ height: "0px", borderTop: "1.5px dashed #9ca3af" }} />
            Avg
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5" style={{ height: "0px", borderTop: "1.5px dashed #C9A84C" }} />
          Par
        </span>
      </div>
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
