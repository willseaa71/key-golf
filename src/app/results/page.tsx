import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { holePar } from "@/lib/course";
import { SeasonChart } from "./SeasonChart";
import { HoleScorecard } from "./HoleScorecard";
import { HoleProfileChart } from "./HoleProfileChart";
import { WeekPicker } from "./WeekPicker";

export const metadata = { title: "Results — KEY Golf" };

function avg(scores: number[]) {
  return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
}

function fmt(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

function diff(score: number, reference: number | null) {
  if (reference === null) return null;
  return score - reference;
}

function DiffBadge({ d }: { d: number | null }) {
  if (d === null) return <span className="text-gray-400 text-xs">—</span>;
  const better = d < 0;
  const same = d === 0;
  return (
    <span
      className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
        same
          ? "bg-gray-100 text-gray-600"
          : better
          ? "bg-[#006747]/10 text-[#006747]"
          : "bg-red-100 text-red-600"
      }`}
    >
      {better ? "" : "+"}
      {d.toFixed(1)}
    </span>
  );
}

function StatRow({
  label,
  reference,
  score,
}: {
  label: string;
  reference: number | null;
  score: number;
}) {
  const d = diff(score, reference);
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
      <span className="text-sm text-gray-600 min-w-0">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-medium text-gray-800">{fmt(reference)}</span>
        <DiffBadge d={d} />
      </div>
    </div>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string; week?: string }>;
}) {
  const { player: playerIdStr, week: weekStr } = await searchParams;
  const focusPlayerId = playerIdStr ? parseInt(playerIdStr, 10) : null;

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

  // Determine which week to display
  const latestRound = await db.round.findFirst({
    where: { season_id: season.id },
    orderBy: { week_number: "desc" },
    select: { week_number: true },
  });

  const weekNumber = weekStr
    ? parseInt(weekStr, 10)
    : latestRound?.week_number ?? null;

  // All active players with prior season averages
  const allPlayers = await db.player.findMany({
    where: { active: true },
    include: { prior_averages: { orderBy: { season_year: "desc" } } },
    orderBy: { name: "asc" },
  });

  // Rounds for the selected week
  const weekRounds =
    weekNumber !== null
      ? await db.round.findMany({
          where: { season_id: season.id, week_number: weekNumber },
          include: { player: true, hole_scores: { orderBy: { hole_number: "asc" } } },
          orderBy: { total_score: "asc" },
        })
      : [];

  // All season rounds (for computing season averages per player)
  const allSeasonRounds = await db.round.findMany({
    where: { season_id: season.id },
    select: { player_id: true, total_score: true, course_half: true, week_number: true },
  });

  // Weeks that have at least one round
  const availableWeeks = [...new Set(allSeasonRounds.map((r) => r.week_number))].sort((a, b) => a - b);

  // Build per-player season stats
  const seasonStatsByPlayer = new Map<
    number,
    { rounds: number[]; front9: number[]; back9: number[] }
  >();
  for (const r of allSeasonRounds) {
    if (!seasonStatsByPlayer.has(r.player_id)) {
      seasonStatsByPlayer.set(r.player_id, { rounds: [], front9: [], back9: [] });
    }
    const s = seasonStatsByPlayer.get(r.player_id)!;
    s.rounds.push(r.total_score);
    if (r.course_half === "front9") s.front9.push(r.total_score);
    if (r.course_half === "back9") s.back9.push(r.total_score);
  }

  // Focal player analysis
  let focal: {
    player: (typeof allPlayers)[0];
    thisRound: (typeof weekRounds)[0] | null;
    allRounds: { week: number; score: number; half: string }[];
    seasonAvg: number | null;
    front9Avg: number | null;
    back9Avg: number | null;
    avg2025: number | null;
    avg2024: number | null;
  } | null = null;

  if (focusPlayerId) {
    const player = allPlayers.find((p) => p.id === focusPlayerId) ?? null;
    if (player) {
      const stats = seasonStatsByPlayer.get(focusPlayerId);
      const playerSeasonRounds = allSeasonRounds
        .filter((r) => r.player_id === focusPlayerId)
        .map((r) => ({ week: r.week_number, score: r.total_score, half: r.course_half }));

      focal = {
        player,
        thisRound: weekRounds.find((r) => r.player_id === focusPlayerId) ?? null,
        allRounds: playerSeasonRounds,
        seasonAvg: stats ? avg(stats.rounds) : null,
        front9Avg: stats ? avg(stats.front9) : null,
        back9Avg: stats ? avg(stats.back9) : null,
        avg2025: player.prior_averages.find((a) => a.season_year === 2025)?.average ?? null,
        avg2024: player.prior_averages.find((a) => a.season_year === 2024)?.average ?? null,
      };
    }
  }

  // All rounds with hole data for focal player
  const focalHoleRounds = focusPlayerId
    ? await db.round.findMany({
        where: { season_id: season.id, player_id: focusPlayerId, has_hole_scores: true },
        include: { hole_scores: { orderBy: { hole_number: "asc" } } },
        orderBy: { week_number: "asc" },
      })
    : [];

  // Compute per-hole averages across all the focal player's rounds
  const holeAccum: Record<number, { sum: number; count: number }> = {};
  for (const round of focalHoleRounds) {
    for (const hs of round.hole_scores) {
      if (!holeAccum[hs.hole_number]) holeAccum[hs.hole_number] = { sum: 0, count: 0 };
      holeAccum[hs.hole_number].sum += hs.strokes;
      holeAccum[hs.hole_number].count++;
    }
  }
  const holeAvgs: Record<number, number> = Object.fromEntries(
    Object.entries(holeAccum).map(([h, { sum, count }]) => [Number(h), sum / count])
  );

  // Week date
  const weekDate = weekRounds[0]?.date ?? null;
  const weekLabel = weekDate
    ? new Date(weekDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  // Build week round lookup (for "this week" badge)
  const weekRoundByPlayer = new Map(weekRounds.map((r) => [r.player_id, r]));

  // Prior week score per player (for tiebreaker)
  const priorWeek = availableWeeks.filter((w) => w < (weekNumber ?? Infinity)).at(-1) ?? null;
  const priorWeekScoreByPlayer = new Map<number, number>();
  if (priorWeek !== null) {
    for (const r of allSeasonRounds) {
      if (r.week_number === priorWeek) priorWeekScoreByPlayer.set(r.player_id, r.total_score);
    }
  }

  // Field stats for the selected week
  const fieldStats = weekRounds.length > 0 ? (() => {
    const scores = weekRounds.map(r => r.total_score);
    const fieldAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const low = Math.min(...scores);
    const high = Math.max(...scores);
    const lowRound = weekRounds.find(r => r.total_score === low)!;
    const beatAvg = scores.filter(s => s < fieldAvg).length;
    return { count: scores.length, fieldAvg, low, high, lowPlayer: lowRound.player.name, beatAvg };
  })() : null;

  // Hole difficulty strip — needs ≥3 players with full hole scores this week
  const holeDifficultyRounds = weekRounds.filter(
    (r) => r.has_hole_scores && r.hole_scores.length === 9
  );
  const holeDifficulty: Array<{
    holeNum: number;
    avgVsPar: number;
    rank: number;
    bg: string;
    fg: string;
  }> | null =
    holeDifficultyRounds.length >= 3
      ? (() => {
          const accum: Record<number, { sum: number; count: number }> = {};
          for (const round of holeDifficultyRounds) {
            for (const hs of round.hole_scores) {
              const par = holePar(hs.hole_number, round.course_half);
              if (!accum[hs.hole_number]) accum[hs.hole_number] = { sum: 0, count: 0 };
              accum[hs.hole_number].sum += hs.strokes - par;
              accum[hs.hole_number].count++;
            }
          }
          const holeNums = Object.keys(accum).map(Number).sort((a, b) => a - b);
          const withAvg = holeNums.map((h) => ({
            holeNum: h,
            avgVsPar: accum[h].sum / accum[h].count,
          }));
          // Rank ascending: rank 1 = easiest (lowest avgVsPar), rank 9 = hardest
          const sorted = [...withAvg].sort((a, b) => a.avgVsPar - b.avgVsPar);
          const rankMap = new Map(sorted.map((h, i) => [h.holeNum, i + 1]));
          return withAvg.map(({ holeNum, avgVsPar }) => {
            const rank = rankMap.get(holeNum)!;
            let bg = "#E5E7EB";
            let fg = "#6B7280";
            if (rank === 1) { bg = "#C9A84C"; fg = "white"; }
            else if (rank <= 3) { bg = "#006747"; fg = "white"; }
            else if (rank >= 8) { bg = "#EF4444"; fg = "white"; }
            return { holeNum, avgVsPar, rank, bg, fg };
          });
        })()
      : null;

  // Leaderboard: sort by season avg asc, tiebreak by prior week score asc, no-rounds last
  const leaderboardSorted = [...allPlayers].sort((a, b) => {
    const aAvg = avg(seasonStatsByPlayer.get(a.id)?.rounds ?? []);
    const bAvg = avg(seasonStatsByPlayer.get(b.id)?.rounds ?? []);
    if (aAvg === null && bAvg === null) return a.name.localeCompare(b.name);
    if (aAvg === null) return 1;
    if (bAvg === null) return -1;
    if (aAvg !== bAvg) return aAvg - bAvg;
    // Tied on avg — tiebreak: prior week score asc (no prior score ranks lower)
    const aPrior = priorWeekScoreByPlayer.get(a.id) ?? null;
    const bPrior = priorWeekScoreByPlayer.get(b.id) ?? null;
    if (aPrior === null && bPrior === null) return a.name.localeCompare(b.name);
    if (aPrior === null) return 1;
    if (bPrior === null) return -1;
    return aPrior - bPrior;
  });

  // Compute prior-week cumulative ranks for movement arrows
  const priorRankByPlayer = new Map<number, number | null>();
  if (priorWeek !== null) {
    const priorRounds = allSeasonRounds.filter(r => r.week_number <= priorWeek);
    const priorStatsByPlayer = new Map<number, number[]>();
    for (const r of priorRounds) {
      if (!priorStatsByPlayer.has(r.player_id)) priorStatsByPlayer.set(r.player_id, []);
      priorStatsByPlayer.get(r.player_id)!.push(r.total_score);
    }
    const priorSorted = [...allPlayers]
      .filter(p => priorStatsByPlayer.has(p.id))
      .map(p => {
        const scores = priorStatsByPlayer.get(p.id)!;
        return { id: p.id, avg: scores.reduce((a, b) => a + b, 0) / scores.length };
      })
      .sort((a, b) => a.avg - b.avg);

    priorSorted.forEach((player, i) => {
      const currKey = `${player.avg}`;
      const groupsAbove = new Set<string>();
      for (let j = 0; j < i; j++) {
        const prevKey = `${priorSorted[j].avg}`;
        if (prevKey !== currKey) groupsAbove.add(prevKey);
      }
      priorRankByPlayer.set(player.id, groupsAbove.size + 1);
    });
  }

  // Assign golf-style dense ranks (1, 2, 2, 2, 3...)
  // Rank = number of distinct (avg, priorScore) groups that rank ABOVE this player
  const leaderboard = leaderboardSorted.map((player, i) => {
    const seasonAvgVal = avg(seasonStatsByPlayer.get(player.id)?.rounds ?? []);
    if (seasonAvgVal === null) return { player, rank: null, seasonAvgVal };
    const currKey = `${seasonAvgVal}|${priorWeekScoreByPlayer.get(player.id) ?? ""}`;
    const groupsAbove = new Set<string>();
    for (let j = 0; j < i; j++) {
      const prev = leaderboardSorted[j];
      const prevAvg = avg(seasonStatsByPlayer.get(prev.id)?.rounds ?? []);
      if (prevAvg === null) break;
      const prevKey = `${prevAvg}|${priorWeekScoreByPlayer.get(prev.id) ?? ""}`;
      if (prevKey !== currKey) groupsAbove.add(prevKey);
    }
    return { player, rank: groupsAbove.size + 1, seasonAvgVal };
  });

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
            {season.name}
          </p>
          <h1 className="text-2xl font-bold">
            {weekNumber !== null ? `Week ${weekNumber} Results` : "Results"}
          </h1>
          {weekLabel && <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>}
        </div>
        <div className="pt-1">
          <WeekPicker
            availableWeeks={availableWeeks}
            currentWeek={weekNumber}
            playerId={focusPlayerId}
          />
        </div>
      </div>

      {/* Field stats */}
      {fieldStats && (
        <>
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-4">
            <div className="flex gap-6 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Field avg</span>
                <span className="text-2xl font-bold">{fieldStats.fieldAvg.toFixed(1)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Low</span>
                <span className="text-2xl font-bold text-[#006747]">
                  {fieldStats.low}{" "}
                  <span className="text-gray-400 text-sm font-normal">{fieldStats.lowPlayer}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Beat avg</span>
                <span className="text-2xl font-bold">{fieldStats.beatAvg} of {fieldStats.count}</span>
              </div>
            </div>
            {holeDifficulty && (
              <div className="border-t border-gray-100 mt-4 pt-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Hole difficulty
                </p>
                <div className="flex gap-1">
                  {holeDifficulty.map(({ holeNum, bg, fg }) => (
                    <div
                      key={holeNum}
                      className="flex-1 flex flex-col items-center rounded py-1.5"
                      style={{ backgroundColor: bg }}
                    >
                      <span className="text-[9px] font-bold" style={{ color: fg }}>
                        H{holeNum}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-2 flex-wrap">
                  {[
                    { bg: "#C9A84C", fg: "white", label: "Easiest" },
                    { bg: "#006747", fg: "white", label: "Easy" },
                    { bg: "#E5E7EB", fg: "#6B7280", label: "Mid" },
                    { bg: "#EF4444", fg: "white", label: "Hardest" },
                  ].map(({ bg, fg, label }) => (
                    <div key={label} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: bg }} />
                      <span className="text-[10px] text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Focal player analysis ── */}
      {focal && focal.thisRound && (
        <section className="space-y-4">
          <h2 className="font-semibold text-lg">{focal.player.name}</h2>

          {/* Score hero */}
          <div className="flex items-center gap-4 bg-[#006747]/8 rounded-xl px-5 py-4">
            <span className="text-5xl font-bold text-[#006747]">
              {focal.thisRound.total_score}
            </span>
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-800">This round</p>
              <p>
                {focal.thisRound.course_half === "front9" ? "Front-9" : "Back-9"} ·{" "}
                Week {weekNumber}
              </p>
            </div>
          </div>

          {/* Comparison stats */}
          <div className="rounded-xl border border-gray-200 px-4 py-1">
            {focal.thisRound.course_half === "front9" ? (
              <StatRow
                label="vs your Front-9 avg (season)"
                reference={focal.front9Avg}
                score={focal.thisRound.total_score}
              />
            ) : (
              <StatRow
                label="vs your Back-9 avg (season)"
                reference={focal.back9Avg}
                score={focal.thisRound.total_score}
              />
            )}
            <StatRow
              label="vs your season avg (all)"
              reference={focal.seasonAvg}
              score={focal.thisRound.total_score}
            />
            <StatRow
              label="vs 2025 season avg"
              reference={focal.avg2025}
              score={focal.thisRound.total_score}
            />
            <StatRow
              label="vs 2024 season avg"
              reference={focal.avg2024}
              score={focal.thisRound.total_score}
            />
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
              My season
            </p>
            <SeasonChart
              weeklyScores={focal.allRounds}
              avg2025={focal.avg2025}
              avg2024={focal.avg2024}
            />
          </div>

          {/* Hole Scorecard — this week */}
          {focal.thisRound && focal.thisRound.has_hole_scores && (() => {
            const thisRoundFull = weekRounds.find((r) => r.player_id === focal!.player.id);
            const holeScores = thisRoundFull?.hole_scores ?? [];
            return holeScores.length > 0 ? (
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
                  Week {weekNumber}
                </p>
                <HoleScorecard
                  holes={holeScores}
                  courseHalf={focal.thisRound!.course_half}
                  holeAvgs={holeAvgs}
                  total={focal.thisRound!.total_score}
                />
              </div>
            ) : null;
          })()}

          {/* Hole Profile Chart */}
          {focalHoleRounds.length > 0 && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
                Hole profile
              </p>
              <HoleProfileChart
                rounds={focalHoleRounds.map((r) => ({
                  week: r.week_number,
                  half: r.course_half,
                  holes: r.hole_scores,
                }))}
              />
            </div>
          )}
        </section>
      )}

      {focal && !focal.thisRound && (
        <div className="rounded-xl border border-gray-200 p-5 text-center text-sm text-gray-500">
          {focal.player.name} hasn&apos;t submitted a score for Week {weekNumber} yet.
        </div>
      )}

      {/* ── Leaderboard ── */}
      <hr className="border-[#006747]" />
      <section>
        <h2 className="font-semibold text-lg mb-1">Season Standings</h2>
        <p className="text-xs text-gray-400 mb-3">Ranked by round average · lower is better</p>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Player</th>
                <th className="text-right px-3 py-2">2026</th>
                <th className="text-right px-3 py-2 border-l border-gray-200 hidden sm:table-cell">'25</th>
                <th className="text-right px-3 py-2 hidden sm:table-cell">'24</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                const regularRows = leaderboard.filter(({ player }) => player.sub_order === null);
                const subRows = leaderboard
                  .filter(({ player }) => player.sub_order !== null)
                  .sort((a, b) => (a.player.sub_order ?? 99) - (b.player.sub_order ?? 99));

                function PlayerRow({ player, rank, seasonAvgVal }: { player: typeof leaderboard[0]["player"]; rank: number | null; seasonAvgVal: number | null }) {
                  const weekRound = weekRoundByPlayer.get(player.id) ?? null;
                  const p2025 = player.prior_averages.find((a) => a.season_year === 2025)?.average ?? null;
                  const p2024 = player.prior_averages.find((a) => a.season_year === 2024)?.average ?? null;
                  const isFocal = player.id === focusPlayerId;
                  const hasRounds = seasonAvgVal !== null;
                  const playerHref = `/results?player=${player.id}${weekNumber !== null ? `&week=${weekNumber}` : ""}`;
                  return (
                    <tr
                      key={player.id}
                      className={`${isFocal ? "bg-[#006747]/6" : "hover:bg-gray-50"} ${!hasRounds ? "opacity-40" : ""} cursor-pointer transition-colors`}
                    >
                      <td className="px-3 py-2.5 text-gray-400 font-medium w-8">
                        <div className="flex flex-col items-center leading-tight">
                          <span>{rank !== null ? rank : "—"}</span>
                          {(() => {
                            if (rank === null) return null;
                            const prior = priorRankByPlayer.get(player.id) ?? null;
                            if (prior === null) return <span className="text-[9px] text-blue-400 font-medium">NEW</span>;
                            const delta = prior - rank;
                            if (delta === 0) return null;
                            return (
                              <span className={`text-[9px] font-bold ${delta > 0 ? "text-[#006747]" : "text-red-400"}`}>
                                {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={playerHref} className={isFocal ? "font-semibold text-[#006747]" : "hover:text-[#006747]"}>
                          {player.name}
                        </Link>
                        {player.sub_order !== null && (
                          <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                            SUB {player.sub_order}
                          </span>
                        )}
                        {weekRound && (
                          <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-100 px-1 rounded">
                            W{weekNumber} · {weekRound.total_score}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {fmt(seasonAvgVal)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500 border-l border-gray-200 hidden sm:table-cell">
                        {fmt(p2025)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                        {fmt(p2024)}
                      </td>
                      <td className="px-2 py-2.5">
                        <Link href={playerHref} className="flex items-center justify-center">
                          <ChevronRight size={16} className="text-[#006747]" />
                        </Link>
                      </td>
                    </tr>
                  );
                }

                return (
                  <>
                    {regularRows.map(({ player, rank, seasonAvgVal }) => (
                      <PlayerRow key={player.id} player={player} rank={rank} seasonAvgVal={seasonAvgVal} />
                    ))}
                    {subRows.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-1.5 text-[10px] font-semibold text-[#C9A84C] uppercase tracking-widest bg-[#C9A84C]/5 border-t border-b border-[#C9A84C]/20"
                          >
                            Substitutes
                          </td>
                        </tr>
                        {subRows.map(({ player, seasonAvgVal }) => (
                          <PlayerRow key={player.id} player={player} rank={null} seasonAvgVal={seasonAvgVal} />
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-right">
          2026 = season average &nbsp;·&nbsp; W# = this week's score
        </p>
      </section>

      {/* Nav */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/scorecard"
          className="flex-1 flex items-center justify-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50 text-center"
        >
          Season scorecard
        </Link>
        <Link
          href="/"
          className="flex-1 flex items-center justify-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50"
        >
          Home
        </Link>
        <Link
          href="/enter"
          className="flex-1 flex items-center justify-center py-3 rounded-xl bg-[#006747] text-white text-sm font-medium hover:bg-[#005236]"
        >
          Enter score
        </Link>
      </div>
    </main>
  );
}
