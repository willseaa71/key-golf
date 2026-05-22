import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "Season Scorecard — KEY Golf" };

function fmt(n: number | null, decimals = 1) {
  return n === null ? "—" : n.toFixed(decimals);
}

function cellStyle(score: number, seasonAvg: number | null): string {
  if (seasonAvg === null) return "";
  const diff = score - seasonAvg;
  if (diff < -0.5) return "text-[#006747] font-semibold";
  if (diff > 0.5) return "text-red-500";
  return "";
}

export default async function ScorecardPage() {
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

  const allPlayers = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const allRounds = await db.round.findMany({
    where: { season_id: season.id },
    select: {
      player_id: true,
      week_number: true,
      total_score: true,
      date: true,
    },
  });

  // Weeks in play
  const weeks = [...new Set(allRounds.map((r) => r.week_number))].sort((a, b) => a - b);

  // Week dates for column headers
  const weekDates = new Map<number, Date>();
  for (const r of allRounds) {
    if (!weekDates.has(r.week_number)) weekDates.set(r.week_number, new Date(r.date));
  }

  // Score grid: player_id → week → score
  const scoreGrid = new Map<number, Map<number, number>>();
  for (const r of allRounds) {
    if (!scoreGrid.has(r.player_id)) scoreGrid.set(r.player_id, new Map());
    scoreGrid.get(r.player_id)!.set(r.week_number, r.total_score);
  }

  // Season avg per player
  function playerAvg(playerId: number): number | null {
    const scores = [...(scoreGrid.get(playerId)?.values() ?? [])];
    return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // Best score per week (for column highlight)
  const weekBest = new Map<number, number>();
  for (const week of weeks) {
    let best = Infinity;
    for (const p of allPlayers) {
      const s = scoreGrid.get(p.id)?.get(week);
      if (s !== undefined && s < best) best = s;
    }
    if (isFinite(best)) weekBest.set(week, best);
  }

  // Sorted player groups
  const regulars = allPlayers
    .filter((p) => p.sub_order === null)
    .sort((a, b) => {
      const aA = playerAvg(a.id);
      const bA = playerAvg(b.id);
      if (aA === null && bA === null) return a.name.localeCompare(b.name);
      if (aA === null) return 1;
      if (bA === null) return -1;
      return aA - bA;
    });

  const subs = allPlayers
    .filter((p) => p.sub_order !== null)
    .sort((a, b) => (a.sub_order ?? 99) - (b.sub_order ?? 99));

  function PlayerRow({ player }: { player: (typeof allPlayers)[0] }) {
    const grid = scoreGrid.get(player.id);
    const seasonAvg = playerAvg(player.id);
    const roundCount = grid?.size ?? 0;

    return (
      <tr className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
        {/* Sticky player name */}
        <td className="sticky left-0 z-10 bg-white px-3 py-2.5 whitespace-nowrap border-r border-gray-100">
          <span className="font-medium text-sm">{player.name}</span>
          {player.sub_order !== null && (
            <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
              SUB {player.sub_order}
            </span>
          )}
        </td>

        {/* Week score cells */}
        {weeks.map((week) => {
          const score = grid?.get(week);
          const isWeekBest = score !== undefined && score === weekBest.get(week);
          return (
            <td key={week} className="px-2 py-2.5 text-center text-sm">
              {score === undefined ? (
                <span className="text-gray-300">—</span>
              ) : isWeekBest ? (
                <span className="inline-flex items-center justify-center w-8 h-7 rounded-md bg-[#006747] text-white text-xs font-bold">
                  {score}
                </span>
              ) : (
                <span className={cellStyle(score, seasonAvg)}>{score}</span>
              )}
            </td>
          );
        })}

        {/* Summary columns */}
        <td className="px-3 py-2.5 text-center text-xs text-gray-400 border-l border-gray-100">
          {roundCount}
        </td>
        <td className="px-3 py-2.5 text-right text-sm font-semibold border-l border-gray-100">
          {fmt(seasonAvg)}
        </td>
      </tr>
    );
  }

  return (
    <main className="px-4 py-8 max-w-[100vw]">
      {/* Header */}
      <div className="max-w-lg mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{season.name}</p>
        <h1 className="text-2xl font-bold">Season Scorecard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {weeks.length === 0
            ? "No rounds recorded yet."
            : `${weeks.length} of 13 weeks played`}
        </p>
      </div>

      {weeks.length === 0 ? null : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Player header — sticky */}
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">
                  Player
                </th>

                {/* Week headers */}
                {weeks.map((week) => {
                  const date = weekDates.get(week);
                  const dateStr = date
                    ? date.toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        timeZone: "UTC",
                      })
                    : "";
                  return (
                    <th
                      key={week}
                      className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-12"
                    >
                      <div>W{week}</div>
                      {dateStr && (
                        <div className="text-[10px] text-gray-400 font-normal normal-case tracking-normal">
                          {dateStr}
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Summary headers */}
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">
                  Rds
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">
                  Avg
                </th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {/* Regular players */}
              {regulars.map((p) => (
                <PlayerRow key={p.id} player={p} />
              ))}

              {/* Subs divider + rows */}
              {subs.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={weeks.length + 3}
                      className="px-3 py-1.5 text-[10px] font-semibold text-[#C9A84C] uppercase tracking-widest bg-[#C9A84C]/5 border-t border-b border-[#C9A84C]/20"
                    >
                      Substitutes
                    </td>
                  </tr>
                  {subs.map((p) => (
                    <PlayerRow key={p.id} player={p} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {weeks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400 max-w-lg">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-[#006747] text-white text-[10px] font-bold">
              40
            </span>
            Week low score
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#006747] font-semibold">42</span>
            Below your season avg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-red-500">46</span>
            Above your season avg
          </span>
        </div>
      )}

      {/* Nav */}
      <div className="mt-8 flex gap-3 max-w-lg">
        <Link
          href="/results"
          className="flex-1 text-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50"
        >
          Standings
        </Link>
        <Link
          href="/enter"
          className="flex-1 text-center py-3 rounded-xl bg-[#006747] text-white text-sm font-medium hover:bg-[#005236]"
        >
          Enter score
        </Link>
      </div>
    </main>
  );
}
