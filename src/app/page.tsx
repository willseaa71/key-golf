import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { WeatherWidget } from "./results/WeatherWidget";
import { Flag, Trophy, ClipboardList, Award, BarChart2, ChevronRight } from "lucide-react";

export const metadata = { title: "KEY Golf League" };

function avg(scores: number[]): number | null {
  return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
}

function fmt(n: number | null) {
  return n === null ? "—" : n.toFixed(1);
}

const NAV_PILLS = [
  { href: "/results",      icon: <Trophy size={20} className="text-[#006747]" />,      label: "Standings"        },
  { href: "/scorecard",    icon: <ClipboardList size={20} className="text-gray-600" />, label: "Scorecard by Week" },
  { href: "/achievements", icon: <Award size={20} className="text-[#C9A84C]" />,        label: "Trophy Case"      },
  { href: "/stats",        icon: <BarChart2 size={20} className="text-gray-600" />,     label: "Hole Performance" },
];

function NavPills() {
  return (
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
  );
}

export default async function HomePage() {
  const season = await db.season.findFirst({
    where: {
      start_date: { lte: new Date() },
      end_date: { gte: new Date() },
    },
  });

  if (!season) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">KEY Golf</p>
          <h1 className="text-3xl font-bold tracking-tight">KEY Golf League</h1>
          <p className="text-sm text-gray-500 mt-1">Season starts soon</p>
        </div>
        <div className="space-y-3">
          <Link
            href="/enter"
            className="flex items-center gap-4 rounded-xl bg-[#006747] text-white px-5 py-4 hover:bg-[#005236] transition-colors"
          >
            <Flag size={20} className="text-white" />
            <p className="flex-1 font-semibold text-lg">Enter Score</p>
            <ChevronRight size={16} className="text-[#C9A84C]" />
          </Link>
          <NavPills />
        </div>
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

  // Next Thursday + round number (computed in UTC to stay consistent with stored dates)
  const nowUTC = new Date();
  const dayOfWeekUTC = nowUTC.getUTCDay();
  const daysAhead = dayOfWeekUTC === 4 ? 0 : (4 - dayOfWeekUTC + 7) % 7;
  const nextThursdayUTC = new Date(Date.UTC(
    nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate() + daysAhead
  ));
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // Normalize season start to midnight UTC so fractional-hour offsets don't skew integer division
  const seasonStartMidnight = new Date(Date.UTC(
    season.start_date.getUTCFullYear(), season.start_date.getUTCMonth(), season.start_date.getUTCDate()
  ));
  const nextRound = Math.min(13, Math.max(1,
    Math.floor((nextThursdayUTC.getTime() - seasonStartMidnight.getTime()) / msPerWeek) + 1
  ));
  const nextRoundDate = nextThursdayUTC.toLocaleDateString("en-US", {
    month: "long", day: "numeric", timeZone: "UTC",
  });

  // All season rounds (for averages + submission count)
  const allSeasonRounds = await db.round.findMany({
    where: { season_id: season.id },
    select: { player_id: true, total_score: true, week_number: true },
  });

  // Regular players with season averages (sub_order === null)
  const allPlayers = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const regulars = allPlayers.filter((p) => p.sub_order === null);

  // Score submission counter — on Thursdays reset to the current round (even at 0 scores),
  // otherwise show the most recent week that has scores.
  const isThursdayUTC = dayOfWeekUTC === 4;
  const displayWeek = isThursdayUTC ? nextRound : (latestWeek ?? nextRound);
  const thisWeekRegularCount = allSeasonRounds.filter((r) => r.week_number === displayWeek).length;
  const regularCount = regulars.length;

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
        <h1 className="text-3xl font-bold tracking-tight">KEY Golf League</h1>
      </div>

      {/* Next round callout + weather grouped together */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Next Round (R{nextRound}) — Thursday, {nextRoundDate}
        </p>
        <WeatherWidget />
      </div>

      {/* Nav grid */}
      <div className="space-y-3">
        {/* Enter Score CTA with submission counter */}
        <Link
          href="/enter"
          className="flex items-center gap-4 rounded-xl bg-[#006747] text-white px-5 py-4 hover:bg-[#005236] transition-colors"
        >
          <Flag size={20} className="text-white" />
          <p className="flex-1 font-semibold text-lg">Enter Score</p>
          <span className="text-sm font-semibold text-white/70 tabular-nums">
            {thisWeekRegularCount}/{regularCount} (R{displayWeek})
          </span>
          <ChevronRight size={16} className="text-[#C9A84C]" />
        </Link>
        <NavPills />
      </div>

      {/* Mini leaderboard */}
      {top5.length > 0 && (
        <section className="border-t border-[#006747] pt-6 mt-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest">
                Top Players
              </h2>
              {latestWeek !== null && (
                <p className="text-xs text-gray-400 mt-0.5">Through R{latestWeek} of 13</p>
              )}
            </div>
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
