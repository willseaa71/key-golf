import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { holePar } from "@/lib/course";
import { CollapsibleAchievementCard } from "./CollapsibleCard";
import {
  Trophy, Medal, TrendingDown, CalendarCheck, Flame, Flag,
  Sun, Beer, RefreshCw, Skull, Ghost, ThumbsDown,
  Moon, Dumbbell, Target, Hammer, Wind, Zap, CircleDot, CheckCircle,
} from "lucide-react";

export const metadata = { title: "Trophy Case — KEY Golf" };

// ── helpers ────────────────────────────────────────────────────────────────

function playerAvg(scores: number[]): number | null {
  return scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
}

function fmt1(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── sub-components ─────────────────────────────────────────────────────────

function AchievementCard({
  icon,
  title,
  description,
  earners,
  accent,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  earners: { name: string; detail?: string }[];
  accent: "gold" | "green" | "blue" | "slate";
}) {
  const border = {
    gold: "border-[#C9A84C]/40 bg-[#C9A84C]/5",
    green: "border-[#006747]/30 bg-[#006747]/5",
    blue: "border-blue-200 bg-blue-50/50",
    slate: "border-gray-200 bg-gray-50/50",
  }[accent];

  const iconBg = {
    gold: "bg-[#C9A84C]/15 text-[#C9A84C]",
    green: "bg-[#006747]/10 text-[#006747]",
    blue: "bg-blue-100 text-blue-600",
    slate: "bg-gray-100 text-gray-500",
  }[accent];

  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 flex items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          <div className="mt-2 space-y-0.5">
            {earners.map((e, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-gray-800">{e.name}</span>
                {e.detail && (
                  <span className="text-xs text-gray-400">{e.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4 opacity-50">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 shrink-0 grayscale">
          {icon}
        </span>
        <div>
          <p className="font-semibold text-sm text-gray-400">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function AchievementsPage() {
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
    include: { prior_averages: true },
    orderBy: { name: "asc" },
  });

  // ── Major Winners ─────────────────────────────────────────────────────────

  const completedMajors = await db.game.findMany({
    where: { is_major: true, status: "COMPLETE" },
    include: {
      teams: {
        include: { members: { include: { player: true } } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  const majorWinsByPlayer = new Map<number, { name: string; wins: number }>();
  for (const g of completedMajors) {
    const winningTeam = g.teams.find((t) => t.is_winner);
    if (!winningTeam) continue;
    for (const m of winningTeam.members) {
      const entry = majorWinsByPlayer.get(m.player_id);
      if (entry) {
        entry.wins++;
      } else {
        majorWinsByPlayer.set(m.player_id, { name: m.player.name, wins: 1 });
      }
    }
  }
  const majorChampions = [...majorWinsByPlayer.values()].sort((a, b) => b.wins - a.wins);

  const allRounds = await db.round.findMany({
    where: { season_id: season.id },
    include: { player: true },
    orderBy: { week_number: "asc" },
  });

  if (allRounds.length === 0) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{season.name}</p>
          <h1 className="text-2xl font-bold">Trophy Case</h1>
          <p className="text-gray-400 text-sm mt-2">No rounds yet — check back after the first week.</p>
        </div>
        <Link href="/results" className="inline-block text-sm text-[#006747] font-medium hover:underline">
          ← Standings
        </Link>
      </main>
    );
  }

  // ── Build lookup structures ─────────────────────────────────────────────

  const weeks = [...new Set(allRounds.map((r) => r.week_number))].sort((a, b) => a - b);
  const weeksPlayed = weeks.length;

  // Rounds grouped by player
  const byPlayer = new Map<number, typeof allRounds>();
  for (const r of allRounds) {
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
    byPlayer.get(r.player_id)!.push(r);
  }

  // Scores grouped by player
  function scores(playerId: number) {
    return (byPlayer.get(playerId) ?? []).map((r) => r.total_score);
  }

  // Prior avg helpers
  function prior2025(playerId: number) {
    return allPlayers.find((p) => p.id === playerId)?.prior_averages.find((a) => a.season_year === 2025)?.average ?? null;
  }

  // ── Season Low ──────────────────────────────────────────────────────────

  const seasonLow = allRounds.reduce(
    (best, r) => (r.total_score < best.score ? { score: r.total_score, round: r } : best),
    { score: Infinity, round: allRounds[0] }
  );
  const seasonLowTied = allRounds.filter((r) => r.total_score === seasonLow.score);

  // ── Week Winners ────────────────────────────────────────────────────────

  const weekWinners = new Map<number, { score: number; players: typeof allRounds }>();
  for (const week of weeks) {
    const weekRounds = allRounds.filter((r) => r.week_number === week);
    const low = Math.min(...weekRounds.map((r) => r.total_score));
    weekWinners.set(week, {
      score: low,
      players: weekRounds.filter((r) => r.total_score === low),
    });
  }

  // ── Most Improved ───────────────────────────────────────────────────────

  const improvements = allPlayers
    .filter((p) => {
      const avg25 = prior2025(p.id);
      const seasonAvg = playerAvg(scores(p.id));
      return avg25 !== null && seasonAvg !== null;
    })
    .map((p) => ({
      player: p,
      diff: playerAvg(scores(p.id))! - prior2025(p.id)!,
      seasonAvg: playerAvg(scores(p.id))!,
      avg25: prior2025(p.id)!,
    }))
    .sort((a, b) => a.diff - b.diff);

  const topImprovement = improvements[0] ?? null;
  const mostImproved = topImprovement
    ? improvements.filter((x) => Math.abs(x.diff - topImprovement.diff) < 0.05)
    : [];

  // ── Perfect Attendance ──────────────────────────────────────────────────

  const perfectAttendance = allPlayers.filter(
    (p) => (byPlayer.get(p.id)?.length ?? 0) === weeksPlayed
  );

  // ── Hot Streak (3+ consecutive weeks beating running season avg) ─────────

  const hotStreakers: { player: (typeof allPlayers)[0]; streak: number; weeks: number[] }[] = [];
  if (weeksPlayed >= 3) {
    for (const player of allPlayers) {
      const playerRounds = (byPlayer.get(player.id) ?? []).sort((a, b) => a.week_number - b.week_number);
      if (playerRounds.length < 3) continue;

      let bestStreak = 0;
      let bestStreakWeeks: number[] = [];
      let currentStreak = 0;
      let currentWeeks: number[] = [];
      let runningSum = 0;

      for (let i = 0; i < playerRounds.length; i++) {
        const r = playerRounds[i];
        const runningAvg = i === 0 ? Infinity : runningSum / i;
        if (r.total_score < runningAvg) {
          currentStreak++;
          currentWeeks.push(r.week_number);
        } else {
          if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
            bestStreakWeeks = [...currentWeeks];
          }
          currentStreak = 1;
          currentWeeks = [r.week_number];
        }
        runningSum += r.total_score;
      }
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
        bestStreakWeeks = [...currentWeeks];
      }
      if (bestStreak >= 3) {
        hotStreakers.push({ player, streak: bestStreak, weeks: bestStreakWeeks });
      }
    }
  }

  // ── Hole Scores (for milestones) ─────────────────────────────────────────

  const hasAnyHoleScores = allRounds.some((r) => r.has_hole_scores);
  const allHoleScores = hasAnyHoleScores
    ? await db.holeScore.findMany({
        where: { round: { season_id: season.id } },
        include: { round: { include: { player: true } } },
      })
    : [];

  // ── Milestones ───────────────────────────────────────────────────────────

  type MilestoneEarner = { name: string; detail: string };

  let holeInOne: MilestoneEarner | null = null;
  let eagle: MilestoneEarner | null = null;
  let birdieMachineEarners: MilestoneEarner[] = [];
  let cleanCard: MilestoneEarner | null = null;

  if (allHoleScores.length > 0) {
    // Hole in One
    const hoio = allHoleScores.find((hs) => hs.strokes === 1);
    if (hoio) {
      holeInOne = {
        name: hoio.round.player.name,
        detail: `Hole ${hoio.hole_number} · W${hoio.round.week_number}`,
      };
    }

    // Eagle (2+ under par on a hole)
    const eagleHs = allHoleScores.find(
      (hs) => hs.strokes <= holePar(hs.hole_number, hs.round.course_half) - 2
    );
    if (eagleHs) {
      eagle = {
        name: eagleHs.round.player.name,
        detail: `Hole ${eagleHs.hole_number} · W${eagleHs.round.week_number}`,
      };
    }

    // Birdie Machine: all players with birdies this season, sorted by total count
    const birdiesByPlayer = new Map<number, { count: number; name: string }>();
    for (const hs of allHoleScores) {
      const par = holePar(hs.hole_number, hs.round.course_half);
      if (hs.strokes === par - 1) {
        const pid = hs.round.player_id;
        const existing = birdiesByPlayer.get(pid);
        if (existing) {
          existing.count++;
        } else {
          birdiesByPlayer.set(pid, { count: 1, name: hs.round.player.name });
        }
      }
    }
    birdieMachineEarners = [...birdiesByPlayer.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ name, count }) => ({
        name,
        detail: `${count} birdie${count !== 1 ? "s" : ""} this season`,
      }));

    // Clean Card: every hole at or under par in a round (9 holes recorded)
    const hsByRound = new Map<number, (typeof allHoleScores)>();
    for (const hs of allHoleScores) {
      if (!hsByRound.has(hs.round_id)) hsByRound.set(hs.round_id, []);
      hsByRound.get(hs.round_id)!.push(hs);
    }
    for (const hss of hsByRound.values()) {
      if (hss.length < 9) continue;
      const isClean = hss.every(
        (hs) => hs.strokes <= holePar(hs.hole_number, hs.round.course_half)
      );
      if (isClean) {
        const r = hss[0].round;
        cleanCard = {
          name: r.player.name,
          detail: `${r.total_score} · W${r.week_number}`,
        };
        break;
      }
    }
  }

  const anyMilestoneFired =
    holeInOne !== null || eagle !== null || birdieMachineEarners.length > 0 || cleanCard !== null;

  // ── Weekly Callouts ──────────────────────────────────────────────────────

  type CalloutCard = {
    icon: ReactNode;
    title: string;
    description: string;
    accent: "gold" | "green" | "blue" | "slate";
    earners: { name: string; detail?: string }[];
  };

  const weeklyCallouts: CalloutCard[] = [];

  if (weeksPlayed >= 1) {
    const currentWeek = weeks[weeks.length - 1];
    const prevWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
    const currentWeekRounds = allRounds.filter((r) => r.week_number === currentWeek);

    // Field avg this week
    const fieldAvgThisWeek =
      currentWeekRounds.reduce((s, r) => s + r.total_score, 0) /
      currentWeekRounds.length;

    // -- Icarus (must compute first for priority rule) --
    const icarusPlayerIds = new Set<number>();
    const icarusEarners: { name: string; detail?: string }[] = [];

    for (const r of currentWeekRounds) {
      const priorScores = (byPlayer.get(r.player_id) ?? [])
        .filter((x) => x.week_number !== currentWeek)
        .map((x) => x.total_score);
      const priorAvg = playerAvg(priorScores);
      if (priorAvg !== null && r.total_score >= priorAvg + 10) {
        icarusPlayerIds.add(r.player_id);
        icarusEarners.push({
          name: r.player.name,
          detail: `${r.total_score} (avg ${fmt1(priorAvg)} prior)`,
        });
      }
    }
    if (icarusEarners.length > 0) {
      weeklyCallouts.push({ icon: <Sun size={18} className="text-gray-500" />, title: "Icarus", description: "Scored 10+ strokes above their prior season average", accent: "slate", earners: icarusEarners });
    }

    // -- Hungover (skip if Icarus) --
    if (prevWeek !== null) {
      const hungoverEarners: { name: string; detail?: string }[] = [];
      for (const r of currentWeekRounds) {
        if (icarusPlayerIds.has(r.player_id)) continue;
        const prevRound = (byPlayer.get(r.player_id) ?? []).find(
          (x) => x.week_number === prevWeek
        );
        if (prevRound && r.total_score >= prevRound.total_score + 5) {
          hungoverEarners.push({
            name: r.player.name,
            detail: `${prevRound.total_score} → ${r.total_score} (+${r.total_score - prevRound.total_score})`,
          });
        }
      }
      if (hungoverEarners.length > 0) {
        weeklyCallouts.push({ icon: <Beer size={18} className="text-gray-500" />, title: "Hungover", description: "Scored 5+ strokes worse than the previous week", accent: "slate", earners: hungoverEarners });
      }
    }

    // -- Redemption Arc --
    if (prevWeek !== null) {
      const redemptionEarners: { name: string; detail?: string }[] = [];
      for (const r of currentWeekRounds) {
        const prevRound = (byPlayer.get(r.player_id) ?? []).find(
          (x) => x.week_number === prevWeek
        );
        if (prevRound && prevRound.total_score >= r.total_score + 5) {
          redemptionEarners.push({
            name: r.player.name,
            detail: `${prevRound.total_score} → ${r.total_score} (−${prevRound.total_score - r.total_score})`,
          });
        }
      }
      if (redemptionEarners.length > 0) {
        weeklyCallouts.push({ icon: <Flag size={18} className="text-[#006747]" />, title: "Redemption Arc", description: "Bounced back 5+ strokes better than the previous week", accent: "green", earners: redemptionEarners });
      }
    }

    // -- Groundhog Day (same score 3+ consecutive weeks, ending on currentWeek) --
    const groundhogEarners: { name: string; detail?: string }[] = [];
    for (const r of currentWeekRounds) {
      const playerRounds = (byPlayer.get(r.player_id) ?? []).sort(
        (a, b) => a.week_number - b.week_number
      );
      if (playerRounds.length < 3) continue;
      const last3 = playerRounds.slice(-3);
      // Must end on current week
      if (last3[2].week_number !== currentWeek) continue;
      // Must be consecutive week numbers
      if (
        last3[1].week_number !== last3[0].week_number + 1 ||
        last3[2].week_number !== last3[1].week_number + 1
      ) continue;
      if (last3.every((x) => x.total_score === r.total_score)) {
        groundhogEarners.push({
          name: r.player.name,
          detail: `${r.total_score} three weeks running`,
        });
      }
    }
    if (groundhogEarners.length > 0) {
      weeklyCallouts.push({ icon: <RefreshCw size={18} className="text-blue-500" />, title: "Groundhog Day", description: "Posted the exact same score three weeks in a row", accent: "blue", earners: groundhogEarners });
    }

    // -- The Undertaker (beat field avg by 5+) --
    const undertakerEarners: { name: string; detail?: string }[] = [];
    for (const r of currentWeekRounds) {
      if (r.total_score <= fieldAvgThisWeek - 5) {
        undertakerEarners.push({
          name: r.player.name,
          detail: `${r.total_score} (field avg ${fmt1(fieldAvgThisWeek)})`,
        });
      }
    }
    if (undertakerEarners.length > 0) {
      weeklyCallouts.push({ icon: <Skull size={18} className="text-[#C9A84C]" />, title: "The Undertaker", description: "Buried the field — scored 5+ below the week's average", accent: "gold", earners: undertakerEarners });
    }


    // -- Déjà Vu (matched personal season low exactly, 2+ rounds) --
    const dejavuEarners: { name: string; detail?: string }[] = [];
    for (const r of currentWeekRounds) {
      const allPlayerRounds = byPlayer.get(r.player_id) ?? [];
      if (allPlayerRounds.length < 2) continue;
      const priorMin = Math.min(
        ...allPlayerRounds
          .filter((x) => x.week_number !== currentWeek)
          .map((x) => x.total_score)
      );
      if (r.total_score === priorMin) {
        dejavuEarners.push({
          name: r.player.name,
          detail: `${r.total_score} — matched season low`,
        });
      }
    }
    if (dejavuEarners.length > 0) {
      weeklyCallouts.push({ icon: <Ghost size={18} className="text-blue-500" />, title: "Déjà Vu", description: "Matched their personal season low exactly", accent: "blue", earners: dejavuEarners });
    }

    // -- Tough Crowd (new personal best but finished last) --
    const weekHighScore = Math.max(...currentWeekRounds.map((r) => r.total_score));
    const toughCrowdEarners: { name: string; detail?: string }[] = [];
    for (const r of currentWeekRounds) {
      if (r.total_score !== weekHighScore) continue;
      const priorScores2 = (byPlayer.get(r.player_id) ?? [])
        .filter((x) => x.week_number !== currentWeek)
        .map((x) => x.total_score);
      if (priorScores2.length === 0) continue;
      const priorMin = Math.min(...priorScores2);
      if (r.total_score < priorMin) {
        toughCrowdEarners.push({
          name: r.player.name,
          detail: `${r.total_score} (personal best, still last)`,
        });
      }
    }
    if (toughCrowdEarners.length > 0) {
      weeklyCallouts.push({ icon: <ThumbsDown size={18} className="text-gray-500" />, title: "Tough Crowd", description: "Personal best score — but still finished last this week", accent: "slate", earners: toughCrowdEarners });
    }

    // -- Sleeper (first week beating 2025 avg, after 2+ prior weeks above it) --
    if (prevWeek !== null) {
      const sleeperEarners: { name: string; detail?: string }[] = [];
      for (const r of currentWeekRounds) {
        const avg25 = prior2025(r.player_id);
        if (avg25 === null) continue;
        if (r.total_score >= avg25) continue; // didn't beat it this week
        const priorRoundsForPlayer = (byPlayer.get(r.player_id) ?? []).filter(
          (x) => x.week_number !== currentWeek
        );
        if (priorRoundsForPlayer.length < 2) continue; // need at least 2 prior weeks
        if (priorRoundsForPlayer.some((x) => x.total_score < avg25)) continue; // already beat it before
        sleeperEarners.push({
          name: r.player.name,
          detail: `${r.total_score} (book: ${fmt1(avg25)})`,
        });
      }
      if (sleeperEarners.length > 0) {
        weeklyCallouts.push({ icon: <Moon size={18} className="text-[#006747]" />, title: "Sleeper", description: "First week beating their 2025 average after 2+ weeks above it", accent: "green", earners: sleeperEarners });
      }
    }
  }

  // ── End of Season ────────────────────────────────────────────────────────

  const endOfSeasonUnlocked = weeksPlayed >= 13;
  let ironManEarners: { name: string }[] = [];
  let mostConsistentEarner: { name: string; detail: string } | null = null;
  let grinderEarner: { name: string; detail: string } | null = null;

  if (endOfSeasonUnlocked) {
    ironManEarners = allPlayers
      .filter((p) => (byPlayer.get(p.id)?.length ?? 0) === 13)
      .map((p) => ({ name: p.name }));

    const fullSeasonPlayers = allPlayers
      .filter((p) => (byPlayer.get(p.id)?.length ?? 0) >= 1)
      .map((p) => {
        const s = scores(p.id);
        return { player: p, range: Math.max(...s) - Math.min(...s) };
      })
      .sort((a, b) => a.range - b.range);
    if (fullSeasonPlayers.length > 0) {
      mostConsistentEarner = {
        name: fullSeasonPlayers[0].player.name,
        detail: `Range: ${fullSeasonPlayers[0].range}`,
      };
    }

    const weekWinnerIds = new Set<number>();
    for (const w of weekWinners.values()) {
      w.players.forEach((p) => weekWinnerIds.add(p.player_id));
    }
    const grinderCandidates = allPlayers
      .filter((p) => !weekWinnerIds.has(p.id) && (byPlayer.get(p.id)?.length ?? 0) > 0)
      .map((p) => ({ player: p, rounds: byPlayer.get(p.id)!.length }))
      .sort((a, b) => b.rounds - a.rounds);
    if (grinderCandidates.length > 0) {
      grinderEarner = {
        name: grinderCandidates[0].player.name,
        detail: `${grinderCandidates[0].rounds} rounds, 0 wins`,
      };
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{season.name}</p>
        <h1 className="text-2xl font-bold">Trophy Case</h1>
        <p className="text-sm text-gray-500 mt-1">
          {weeksPlayed} of 13 weeks played
        </p>
      </div>

      {/* ── Major Winners ── */}
      {completedMajors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Major Winners
          </h2>

          {/* Per-major result cards */}
          {completedMajors.map((game) => {
            const winningTeam = game.teams.find((t) => t.is_winner);
            return (
              <div
                key={game.id}
                className="rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#C9A84C]/15 shrink-0">
                    <Trophy size={18} className="text-[#C9A84C]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900">{game.name}</p>
                      <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                        MAJOR
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(game.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </p>
                    {winningTeam ? (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Winners — {winningTeam.name}</p>
                        <div className="space-y-0.5">
                          {winningTeam.members.map((m) => (
                            <p key={m.player_id} className="text-sm font-medium text-gray-800">
                              {m.player.name}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2 italic">Result pending</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Major Champions leaderboard */}
          {majorChampions.length > 0 && (
            <div className="rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/5 p-4">
              <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-3">
                Major Champions
              </p>
              <div className="space-y-2.5">
                {majorChampions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm font-medium text-gray-800">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      {c.wins >= 5 && (
                        <span className="text-[11px] font-bold text-white bg-[#7B3F00] px-2 py-0.5 rounded-full">
                          Legend
                        </span>
                      )}
                      {c.wins >= 3 && c.wins < 5 && (
                        <span className="text-[11px] font-bold text-white bg-[#C9A84C] px-2 py-0.5 rounded-full">
                          Champion
                        </span>
                      )}
                      <span className="text-base">{"🏆".repeat(Math.min(c.wins, 5))}</span>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {c.wins} {c.wins === 1 ? "win" : "wins"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Season Low Hero ── */}
      <div className="rounded-2xl border-2 border-[#C9A84C]/50 bg-gradient-to-br from-[#C9A84C]/10 to-[#C9A84C]/5 p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 flex items-center justify-center rounded-xl bg-[#C9A84C]/20">
            <Trophy size={24} className="text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-widest mb-0.5">Season Low</p>
            <p className="text-4xl font-bold text-gray-900">{seasonLow.score}</p>
            <div className="mt-1 space-y-0.5">
              {seasonLowTied.map((r) => (
                <p key={r.id} className="text-sm text-gray-700 font-medium">
                  {r.player.name}
                  <span className="text-gray-400 font-normal">
                    {" "}· W{r.week_number} · {r.course_half === "front9" ? "Front-9" : "Back-9"}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hot Hand (Weekly Champions) ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Hot Hand
        </h2>
        <div className="space-y-2">
          {weeks.map((week) => {
            const w = weekWinners.get(week)!;
            return (
              <div key={week} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <span className="text-sm font-bold text-[#C9A84C] w-8">W{week}</span>
                <Medal size={18} className="text-[#C9A84C]" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">
                    {w.players.map((p) => p.player.name).join(" & ")}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-700 shrink-0">{w.score}</span>
              </div>
            );
          })}
          {weeks.length < 13 && (
            <div className="px-4 py-2.5">
              <span className="text-sm text-gray-300">· W{weeks.length + 1}–W13 not yet played</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Player Awards ── */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Player Awards
        </h2>

        {/* Perfect Attendance */}
        {perfectAttendance.length > 0 && (
          perfectAttendance.length > 3 ? (
            <CollapsibleAchievementCard
              icon={<CalendarCheck size={18} className="text-blue-500" />}
              title="Perfect Attendance"
              description={`Played every week so far (${weeksPlayed} of 13)`}
              accent="blue"
              earners={perfectAttendance.map((p) => ({ name: p.name }))}
              collapseAfter={3}
            />
          ) : (
            <AchievementCard
              icon={<CalendarCheck size={18} className="text-blue-500" />}
              title="Perfect Attendance"
              description={`Played every week so far (${weeksPlayed} of 13)`}
              accent="blue"
              earners={perfectAttendance.map((p) => ({ name: p.name }))}
            />
          )
        )}

        {/* Hot Streak (when fired) */}
        {hotStreakers.length > 0 && (
          <AchievementCard
            icon="🔥"
            title="Hot Streak"
            description="Beat their running season avg 3+ weeks in a row"
            accent="gold"
            earners={hotStreakers.map((h) => ({
              name: h.player.name,
              detail: `${h.streak} consecutive weeks (W${h.weeks[0]}–W${h.weeks[h.weeks.length - 1]})`,
            }))}
          />
        )}
      </section>

      {/* ── Section 1: Milestones ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Milestones
        </h2>
        {anyMilestoneFired ? (
          <div className="space-y-3">
            {holeInOne && (
              <AchievementCard
                icon={<CircleDot size={18} className="text-[#C9A84C]" />}
                title="Hole in One"
                description="Aced a hole"
                accent="gold"
                earners={[holeInOne]}
              />
            )}
            {eagle && (
              <AchievementCard
                icon={<Zap size={18} className="text-[#C9A84C]" />}
                title="Eagle"
                description="2 under par on a single hole"
                accent="gold"
                earners={[eagle]}
              />
            )}
            {birdieMachineEarners.length > 0 && (
              <AchievementCard
                icon={<Wind size={18} className="text-[#006747]" />}
                title="Birdie Machine"
                description="Players with birdies this season · most first"
                accent="green"
                earners={birdieMachineEarners}
              />
            )}
            {cleanCard && (
              <AchievementCard
                icon={<CheckCircle size={18} className="text-[#006747]" />}
                title="Clean Card"
                description="Every hole at or under par"
                accent="green"
                earners={[cleanCard]}
              />
            )}
            {/* Show locked cards for milestones not yet fired */}
            {!holeInOne && (
              <LockedCard icon="🎱" title="Hole in One" description="Ace a hole" />
            )}
            {!eagle && (
              <LockedCard icon="🦅" title="Eagle" description="2 under par on a single hole" />
            )}
            {birdieMachineEarners.length === 0 && (
              <LockedCard icon={<Wind size={18} className="text-gray-400" />} title="Birdie Machine" description="Players with birdies this season" />
            )}
            {!cleanCard && (
              <LockedCard icon="✅" title="Clean Card" description="Every hole at or under par" />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <LockedCard icon="🎱" title="Hole in One" description="Ace a hole" />
            <LockedCard icon="🦅" title="Eagle" description="2 under par on a single hole" />
            <LockedCard icon={<Wind size={18} className="text-gray-400" />} title="Birdie Machine" description="Players with birdies this season" />
            <LockedCard icon="✅" title="Clean Card" description="Every hole at or under par" />
          </div>
        )}
      </section>

      {/* ── Section 3: Weekly Callouts ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Week {weeksPlayed} Callouts
        </h2>
        {weeklyCallouts.length > 0 ? (
          <div className="space-y-3">
            {weeklyCallouts.map((c, i) => (
              <AchievementCard
                key={i}
                icon={c.icon}
                title={c.title}
                description={c.description}
                accent={c.accent}
                earners={c.earners}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No callouts this week.</p>
        )}
      </section>

      {/* ── Section 4: End of Season ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          End of Season
        </h2>
        {endOfSeasonUnlocked ? (
          <div className="space-y-3">
            {ironManEarners.length > 0 && (
              <AchievementCard
                icon={<Dumbbell size={18} className="text-gray-400" />}
                title="Iron Man"
                description="Perfect attendance — played all 13 weeks"
                accent="gold"
                earners={ironManEarners}
              />
            )}
            {mostConsistentEarner && (
              <AchievementCard
                icon={<Target size={18} className="text-gray-400" />}
                title="Most Consistent"
                description="Tightest score range across the full season"
                accent="blue"
                earners={[mostConsistentEarner]}
              />
            )}
            {grinderEarner && (
              <AchievementCard
                icon={<Hammer size={18} className="text-gray-400" />}
                title="The Grinder"
                description="Most rounds played without winning a week"
                accent="slate"
                earners={[grinderEarner]}
              />
            )}
            {mostImproved.length > 0 && (
              <AchievementCard
                icon={<TrendingDown size={18} className="text-[#006747]" />}
                title="Most Improved"
                description="Biggest drop in season avg vs 2025"
                accent="green"
                earners={mostImproved.map((x) => ({
                  name: x.player.name,
                  detail: `${fmt1(x.seasonAvg)} avg (was ${fmt1(x.avg25)} in '25)`,
                }))}
              />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <LockedCard
              icon={<Dumbbell size={18} className="text-gray-400" />}
              title="Iron Man"
              description="Perfect attendance all 13 weeks"
            />
            <LockedCard
              icon={<Target size={18} className="text-gray-400" />}
              title="Most Consistent"
              description="Tightest score range across the full season"
            />
            <LockedCard
              icon={<Hammer size={18} className="text-gray-400" />}
              title="The Grinder"
              description="Most rounds played without winning a week"
            />
            <LockedCard
              icon={<TrendingDown size={18} className="text-[#006747]" />}
              title="Most Improved"
              description="Biggest drop in season avg vs 2025"
            />
          </div>
        )}
      </section>

      {/* ── Coming This Season (Hot Streak if not yet fired) ── */}
      {hotStreakers.length === 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Coming This Season
          </h2>
          <div className="space-y-3">
            <LockedCard
              icon={<Flame size={18} className="text-amber-500" />}
              title="Hot Streak"
              description="Beat your running season avg 3 weeks in a row"
            />
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
