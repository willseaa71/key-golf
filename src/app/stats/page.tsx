import Link from "next/link";
import { db } from "@/lib/db";
import { HOLE_PARS } from "@/lib/course";

export const metadata = { title: "Stats — KEY Golf" };

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}

function signedFmt(n: number) {
  if (Math.abs(n) < 0.05) return "E";
  return (n > 0 ? "+" : "") + n.toFixed(2);
}

// Bar chart constants
const BAR_MAX_STROKES = 2; // ±2 strokes = max bar extent
const BAR_SCALE = 24; // px per stroke
const BAR_CENTER = 60;  // px from left edge to par baseline
const BAR_TOTAL_W = 140; // total SVG width for the bar

type HoleStat = {
  holeNumber: number; // real course hole number (1–18)
  storedHoleNumber: number; // 1–9 as stored in DB
  courseHalf: string;
  par: number;
  count: number;
  avgStrokes: number;
  avgVsPar: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublesPlus: number;
};

function DiffBar({ avgVsPar }: { avgVsPar: number }) {
  const clamped = Math.max(-BAR_MAX_STROKES, Math.min(BAR_MAX_STROKES, avgVsPar));
  const barPx = Math.abs(clamped) * BAR_SCALE;
  const overPar = clamped >= 0;

  // baseline x in SVG coords
  const baseX = BAR_CENTER;
  const barX = overPar ? baseX : baseX - barPx;
  const barColor = overPar ? "#ef4444" : "#006747";

  return (
    <svg
      width={BAR_TOTAL_W}
      height={20}
      viewBox={`0 0 ${BAR_TOTAL_W} 20`}
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* Track */}
      <rect x={0} y={8} width={BAR_TOTAL_W} height={4} rx={2} fill="#f3f4f6" />
      {/* Bar */}
      {barPx > 0 && (
        <rect x={barX} y={6} width={barPx} height={8} rx={2} fill={barColor} opacity={0.8} />
      )}
      {/* Baseline */}
      <rect x={baseX - 1} y={4} width={2} height={12} rx={1} fill="#9ca3af" />
    </svg>
  );
}

function HoleRow({ stat, rankLabel }: { stat: HoleStat; rankLabel: string }) {
  const diffPositive = stat.avgVsPar > 0;
  const diffNeutral = Math.abs(stat.avgVsPar) < 0.05;
  const diffClass = diffNeutral
    ? "bg-gray-100 text-gray-600"
    : diffPositive
    ? "bg-red-100 text-red-600"
    : "bg-[#006747]/10 text-[#006747]";

  const holeLabel = `H${stat.holeNumber}`;

  // Score breakdown as % of rounds
  const total = stat.count;
  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="flex flex-col py-3 border-b border-gray-100 last:border-0 gap-2">
      {/* Top row: rank · hole · bar · avg */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-gray-400 w-6 text-right shrink-0">{rankLabel}</span>

        <div className="w-16 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{holeLabel}</span>
          <span className="ml-1 text-xs text-gray-400">par {stat.par}</span>
        </div>

        <DiffBar avgVsPar={stat.avgVsPar} />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{fmt(stat.avgStrokes)}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${diffClass}`}>
            {signedFmt(stat.avgVsPar)}
          </span>
        </div>
      </div>

      {/* Score breakdown row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-9 text-[11px]">
        <span className="text-gray-400 shrink-0">{total} rounds ·</span>
        {stat.birdies > 0 && (
          <span className="text-[#006747] font-medium whitespace-nowrap">
            🐦 {stat.birdies} birdie{stat.birdies !== 1 ? "s" : ""} ({pct(stat.birdies)}%)
          </span>
        )}
        {stat.pars > 0 && (
          <span className="text-gray-500 font-medium whitespace-nowrap">
            {stat.pars} par ({pct(stat.pars)}%)
          </span>
        )}
        {stat.bogeys > 0 && (
          <span className="text-red-500 font-medium whitespace-nowrap">
            {stat.bogeys} bogey{stat.bogeys !== 1 ? "s" : ""} ({pct(stat.bogeys)}%)
          </span>
        )}
        {stat.doublesPlus > 0 && (
          <span className="text-red-700 font-medium whitespace-nowrap">
            {stat.doublesPlus} dbl+ ({pct(stat.doublesPlus)}%)
          </span>
        )}
      </div>
    </div>
  );
}

export default async function StatsPage() {
  const season = await db.season.findFirst({
    where: {
      start_date: { lte: new Date() },
      end_date: { gte: new Date() },
    },
  });

  if (!season) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <p className="text-gray-500">No active season.</p>
      </main>
    );
  }

  // All rounds with hole scores for the active season
  const rounds = await db.round.findMany({
    where: { season_id: season.id, has_hole_scores: true },
    select: {
      course_half: true,
      hole_scores: { select: { hole_number: true, strokes: true } },
    },
  });

  if (rounds.length === 0) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">2026 Season</p>
          <h1 className="text-2xl font-bold">Hole Difficulty</h1>
          <p className="text-sm text-gray-400 mt-2">No hole-by-hole data yet.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/results" className="text-sm text-[#006747] font-medium hover:underline">
            ← Standings
          </Link>
          <Link href="/scorecard" className="text-sm text-[#006747] font-medium hover:underline">
            Scorecard →
          </Link>
        </div>
      </main>
    );
  }

  // Accumulate per-hole stats
  type HoleAccum = {
    storedHoleNumber: number;
    courseHalf: string;
    par: number;
    holeNumber: number; // real course number
    sum: number;
    count: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doublesPlus: number;
  };

  const holeMap = new Map<string, HoleAccum>();

  for (const round of rounds) {
    for (const hs of round.hole_scores) {
      const realHole = hs.hole_number + (round.course_half === "back9" ? 9 : 0);
      const par = HOLE_PARS[realHole] ?? 4;
      const key = `${round.course_half}:${hs.hole_number}`;

      if (!holeMap.has(key)) {
        holeMap.set(key, {
          storedHoleNumber: hs.hole_number,
          courseHalf: round.course_half,
          par,
          holeNumber: realHole,
          sum: 0,
          count: 0,
          birdies: 0,
          pars: 0,
          bogeys: 0,
          doublesPlus: 0,
        });
      }

      const entry = holeMap.get(key)!;
      entry.sum += hs.strokes;
      entry.count++;
      const diff = hs.strokes - par;
      if (diff <= -1) entry.birdies++;
      else if (diff === 0) entry.pars++;
      else if (diff === 1) entry.bogeys++;
      else entry.doublesPlus++;
    }
  }

  // Build stats array
  const stats: HoleStat[] = Array.from(holeMap.values()).map((entry) => ({
    holeNumber: entry.holeNumber,
    storedHoleNumber: entry.storedHoleNumber,
    courseHalf: entry.courseHalf,
    par: entry.par,
    count: entry.count,
    avgStrokes: entry.sum / entry.count,
    avgVsPar: entry.sum / entry.count - entry.par,
    birdies: entry.birdies,
    pars: entry.pars,
    bogeys: entry.bogeys,
    doublesPlus: entry.doublesPlus,
  }));

  // Sort hardest to easiest (highest avgVsPar first)
  stats.sort((a, b) => {
    if (Math.abs(b.avgVsPar - a.avgVsPar) > 0.001) return b.avgVsPar - a.avgVsPar;
    return a.holeNumber - b.holeNumber;
  });

  // Determine if we have both halves
  const hasFront = stats.some((s) => s.courseHalf === "front9");
  const hasBack = stats.some((s) => s.courseHalf === "back9");
  const hasBoth = hasFront && hasBack;

  const roundCount = rounds.length;
  const holeRoundCounts = stats.map((s) => s.count);
  const minHoleRounds = Math.min(...holeRoundCounts);
  const maxHoleRounds = Math.max(...holeRoundCounts);
  const roundLabel =
    minHoleRounds === maxHoleRounds
      ? `${minHoleRounds} round${minHoleRounds !== 1 ? "s" : ""} with hole data`
      : `${minHoleRounds}–${maxHoleRounds} rounds with hole data`;

  // Determine which half label to show when only one is present
  const singleHalf = !hasBoth
    ? hasFront
      ? "Front-9"
      : "Back-9"
    : null;

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">2026 Season</p>
        <h1 className="text-2xl font-bold">Hole Difficulty</h1>
        <p className="text-sm text-gray-500 mt-1">
          {singleHalf ? `${singleHalf} · ` : ""}
          {roundLabel}
        </p>
      </div>

      {/* Ranked list */}
      {hasBoth ? (
        <>
          {/* Front 9 */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Front 9 — hardest to easiest
            </h2>
            <div className="rounded-xl border border-gray-200 px-4 py-1">
              {stats
                .filter((s) => s.courseHalf === "front9")
                .map((stat, i) => (
                  <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} rankLabel={`#${i + 1}`} />
                ))}
            </div>
          </section>

          {/* Back 9 */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Back 9 — hardest to easiest
            </h2>
            <div className="rounded-xl border border-gray-200 px-4 py-1">
              {stats
                .filter((s) => s.courseHalf === "back9")
                .map((stat, i) => (
                  <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} rankLabel={`#${i + 1}`} />
                ))}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            {singleHalf} — hardest to easiest
          </h2>
          <div className="rounded-xl border border-gray-200 px-4 py-1">
            {stats.map((stat, i) => (
              <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} rankLabel={`#${i + 1}`} />
            ))}
          </div>
        </section>
      )}

      {/* Legend */}
      <div className="text-xs text-gray-400 space-y-1">
        <p>Bar extends right (red) for over-par, left (green) for under-par. Scale: ±{BAR_MAX_STROKES} strokes.</p>
        <p>{roundCount} round{roundCount !== 1 ? "s" : ""} with hole data this season.</p>
      </div>

      {/* Nav */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/results"
          className="flex-1 text-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50"
        >
          Standings
        </Link>
        <Link
          href="/scorecard"
          className="flex-1 text-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50"
        >
          Scorecard
        </Link>
      </div>
    </main>
  );
}
