import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { WeatherWidget } from "./results/WeatherWidget";
import { Flag, Trophy, ClipboardList, Award, BarChart2, ChevronRight } from "lucide-react";

export const metadata = { title: "KEY Golf" };

function avg(scores: number[]): number | null {
  return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
}

function fmt(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

const ENTER_CARD = { href: "/enter", icon: <Flag size={20} className="text-white" />, label: "Enter Score" };

const NAV_PILLS = [
  { href: "/results",      icon: <Trophy size={20} className="text-[#006747]" />,      label: "Standings"       },
  { href: "/scorecard",    icon: <ClipboardList size={20} className="text-gray-600" />, label: "Scorecard by Week" },
  { href: "/achievements", icon: <Award size={20} className="text-[#C9A84C]" />,        label: "Trophy Case"     },
  { href: "/stats",        icon: <BarChart2 size={20} className="text-gray-600" />,     label: "Hole Performance" },
];

export default async function HomePage() {
  const season = await db.season.findFirst({
    where: {
      start_date: { lte: new Date() },
      end_date: { gte: new Date() },
    },
  });

  // Nav is shown regardless
  const navGrid = (
    <div className="space-y-3">
      {/* Enter Score CTA */}
      <Link
        href={ENTER_CARD.href}
        className="col-span-2 flex items-center gap-4 rounded-xl bg-[#006747] text-white px-5 py-4 hover:bg-[#005236] transition-colors"
      >
        {ENTER_CARD.icon}
        <p className="flex-1 font-semibold text-lg">{ENTER_CARD.label}</p>
        <ChevronRight size={16} className="text-[#C9A84C]" />
      </Link>

      {/* Horizontal pill rows */}
      <div className="space-y-2">
        {NAV_PILLS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-center gap-4 px-4 py-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100">
              {card.icon}
            </span>
            <span className="flex-1 text-base font-semibold text-gray-900">{card.label}</span>
            <ChevronRight size={16} className="text-[#006747]" />
          </Link>
        ))}
      </div>
    </div>
  );

  if (!season) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">KEY Golf</p>
          <h1 className="text-3xl font-bold tracking-tight">KEY Golf</h1>
          <p className="text-sm text-gray-500 mt-1">Season starts soon</p>
        </div>
        {navGrid}
      </main>
    );
  }

  // Latest week
  const latestRound = await db.round.findFirst({
    where: { season_id: season.id },
    orderBy: { week_number: "desc" },
    select: { week_number: true },
  });
  const latestWeek = latestRound?.week_number ?? null;

  // All season rounds (for averages + submission count)
  const allSeasonRounds = await db.round.findMany({
    where: { season_id: season.id },
    select: { player_id: true, total_score: true, week_number: true },
  });

  // Count submissions this week
  const thisWeekCount =
    latestWeek !== null
      ? allSeasonRounds.filter((r) => r.week_number === latestWeek).length
      : 0;

  // Regular players with season averages (sub_order === null)
  const allPlayers = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const regulars = allPlayers.filter((p) => p.sub_order === null);

  // Per-player season averages
  const avgByPlayer = new Map<number, number | null>();
  for (const p of regulars) {
    const scores = allSeasonRounds
      .filter((r) => r.player_id === p.id)
      .map((r) => r.total_score);
    avgByPlayer.set(p.id, avg(scores));
  }

  // Sort regulars by avg asc, no-rounds last → top 5
  const sortedRegulars = [...regulars].sort((a, b) => {
    const aA = avgByPlayer.get(a.id) ?? null;
    const bA = avgByPlayer.get(b.id) ?? null;
    if (aA === null && bA === null) return a.name.localeCompare(b.name);
    if (aA === null) return 1;
    if (bA === null) return -1;
    return aA - bA;
  });

  // Assign dense ranks
  type RankedPlayer = { id: number; name: string; seasonAvg: number | null; rank: number | null };
  const rankedPlayers: RankedPlayer[] = sortedRegulars.map((player, i) => {
    const seasonAvg = avgByPlayer.get(player.id) ?? null;
    if (seasonAvg === null) return { id: player.id, name: player.name, seasonAvg: null, rank: null };
    const groupsAbove = new Set<number>();
    for (let j = 0; j < i; j++) {
      const prevAvg = avgByPlayer.get(sortedRegulars[j].id) ?? null;
      if (prevAvg !== null && prevAvg !== seasonAvg) groupsAbove.add(prevAvg);
    }
    return { id: player.id, name: player.name, seasonAvg, rank: groupsAbove.size + 1 };
  });

  const top5 = rankedPlayers.filter((p) => p.seasonAvg !== null).slice(0, 5);

  // Season field average (regulars only)
  const regularScores = allSeasonRounds
    .filter((r) => regulars.some((p) => p.id === r.player_id))
    .map((r) => r.total_score);
  const seasonFieldAvg = avg(regularScores);

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">2026 Season</p>
        <h1 className="text-3xl font-bold tracking-tight">KEY Golf</h1>
        <p className="text-sm text-gray-500 mt-1">
          {latestWeek !== null ? `Week ${latestWeek} of 13` : "Week 1 of 13"} · Thursdays in Saratoga Springs
        </p>
        {latestWeek !== null && thisWeekCount > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {thisWeekCount} score{thisWeekCount !== 1 ? "s" : ""} in for Week {latestWeek}
          </p>
        )}
      </div>

      {/* Weather */}
      <WeatherWidget />

      {/* Nav grid */}
      {navGrid}

      {/* Mini leaderboard */}
      {top5.length > 0 && (
        <section className="border-t border-[#006747] pt-6 mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
              Top Players
            </h2>
            {seasonFieldAvg !== null && (
              <span className="text-xs text-gray-400">
                Field avg <span className="font-semibold text-gray-600">{fmt(seasonFieldAvg)}</span>
              </span>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {top5.map(({ id, name, seasonAvg, rank }) => (
              <div
                key={id}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                <span className="text-sm font-bold text-gray-400 w-5 text-right shrink-0">
                  {rank ?? "—"}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">{name}</span>
                <span className="text-sm font-semibold text-gray-700">{fmt(seasonAvg)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
