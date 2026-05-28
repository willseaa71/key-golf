import Link from "next/link";
import { db } from "@/lib/db";
import { HOLE_PARS } from "@/lib/course";

export const metadata = { title: "Stats — KEY Golf" };

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}


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

function HoleRow({ stat }: { stat: HoleStat }) {
  const total = stat.count;

  // Percentages that always sum to 100 (remainder absorbed by par)
  const birdieOrBetterPct = Math.round((stat.birdies / total) * 100);
  const bogeyPct = Math.round((stat.bogeys / total) * 100);
  const doublePlusPct = Math.round((stat.doublesPlus / total) * 100);
  const parPct = 100 - birdieOrBetterPct - bogeyPct - doublePlusPct;

  const avgColor =
    stat.avgVsPar <= 0 ? "#006747" : stat.avgVsPar > 1 ? "#EF4444" : "#D97706";

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-2">
      {/* Row 1: Hole number, par, avg score */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">H{stat.holeNumber}</span>
          <span className="text-xs text-gray-400">par {stat.par}</span>
        </div>
        <span className="text-lg font-bold" style={{ color: avgColor }}>
          {stat.avgVsPar > 0
            ? `+${stat.avgVsPar.toFixed(2)}`
            : stat.avgVsPar.toFixed(2)}
        </span>
      </div>

      {/* Row 2: Stacked distribution bar */}
      <div className="flex rounded-full overflow-hidden h-4 w-full">
        {birdieOrBetterPct > 0 && (
          <div className="h-full bg-[#006747]" style={{ width: `${birdieOrBetterPct}%` }} />
        )}
        {parPct > 0 && (
          <div className="h-full bg-gray-200" style={{ width: `${parPct}%` }} />
        )}
        {bogeyPct > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${bogeyPct}%` }} />
        )}
        {doublePlusPct > 0 && (
          <div className="h-full bg-red-400" style={{ width: `${doublePlusPct}%` }} />
        )}
      </div>

      {/* Row 3: Legend with percentages */}
      <div className="flex gap-3 flex-wrap">
        {birdieOrBetterPct > 0 && (
          <span className="text-xs text-[#006747] font-medium">
            🐦 Birdie+ {birdieOrBetterPct}%
          </span>
        )}
        <span className="text-xs text-gray-400">Par {parPct}%</span>
        <span className="text-xs text-amber-500">Bogey {bogeyPct}%</span>
        <span className="text-xs text-red-400">Dbl+ {doublePlusPct}%</span>
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
            <div className="space-y-3">
              {stats
                .filter((s) => s.courseHalf === "front9")
                .map((stat) => (
                  <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} />
                ))}
            </div>
          </section>

          {/* Back 9 */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Back 9 — hardest to easiest
            </h2>
            <div className="space-y-3">
              {stats
                .filter((s) => s.courseHalf === "back9")
                .map((stat) => (
                  <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} />
                ))}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            {singleHalf} — hardest to easiest
          </h2>
          <div className="space-y-3">
            {stats.map((stat) => (
              <HoleRow key={`${stat.courseHalf}:${stat.storedHoleNumber}`} stat={stat} />
            ))}
          </div>
        </section>
      )}

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
        <Link
          href="/"
          className="flex-1 text-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
