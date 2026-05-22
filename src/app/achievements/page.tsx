import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "Achievements — KEY Golf" };

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
  icon: string;
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
        <span className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
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

function LockedCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4 opacity-50">
      <div className="flex items-start gap-3">
        <span className="text-xl w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 shrink-0 grayscale">
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
          <h1 className="text-2xl font-bold">Achievements</h1>
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

  // ── 1. Season Low ───────────────────────────────────────────────────────

  const seasonLow = allRounds.reduce(
    (best, r) => (r.total_score < best.score ? { score: r.total_score, round: r } : best),
    { score: Infinity, round: allRounds[0] }
  );
  // Tied season lows
  const seasonLowTied = allRounds.filter((r) => r.total_score === seasonLow.score);

  // ── 2. Week Winners ────────────────────────────────────────────────────

  const weekWinners = new Map<number, { score: number; players: typeof allRounds }>();
  for (const week of weeks) {
    const weekRounds = allRounds.filter((r) => r.week_number === week);
    const low = Math.min(...weekRounds.map((r) => r.total_score));
    weekWinners.set(week, {
      score: low,
      players: weekRounds.filter((r) => r.total_score === low),
    });
  }

  // ── 3. Most Improved (season avg vs 2025 avg) ───────────────────────────

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
  // Include all players tied for most improved (within 0.1)
  const mostImproved = topImprovement
    ? improvements.filter((x) => Math.abs(x.diff - topImprovement.diff) < 0.05)
    : [];

  // ── 4. Beat the Book (beat 2025 avg in any round) ──────────────────────

  const beatTheBook = allPlayers.filter((p) => {
    const avg25 = prior2025(p.id);
    if (avg25 === null) return false;
    return (byPlayer.get(p.id) ?? []).some((r) => r.total_score < avg25);
  });

  // ── 5. Perfect Attendance ──────────────────────────────────────────────

  const perfectAttendance = allPlayers.filter(
    (p) => (byPlayer.get(p.id)?.length ?? 0) === weeksPlayed
  );

  // ── 6. Hot Streak (3+ consecutive weeks beating running season avg) ─────

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

  // ── 7. Steady Eddie (smallest score range, 2+ rounds) ──────────────────

  const steadyEddie: { player: (typeof allPlayers)[0]; range: number; min: number; max: number }[] = [];
  if (weeksPlayed >= 2) {
    const candidates = allPlayers
      .filter((p) => scores(p.id).length >= 2)
      .map((p) => {
        const s = scores(p.id);
        return { player: p, range: Math.max(...s) - Math.min(...s), min: Math.min(...s), max: Math.max(...s) };
      })
      .sort((a, b) => a.range - b.range);
    if (candidates.length > 0) {
      const minRange = candidates[0].range;
      steadyEddie.push(...candidates.filter((c) => c.range === minRange));
    }
  }

  // ── 8. Comeback Kid (biggest week-over-week improvement) ───────────────

  type Comeback = { player: (typeof allPlayers)[0]; improvement: number; fromWeek: number; toWeek: number; from: number; to: number };
  let topComeback: Comeback | null = null;
  if (weeksPlayed >= 2) {
    const comebacks: Comeback[] = [];
    for (const player of allPlayers) {
      const playerRounds = (byPlayer.get(player.id) ?? []).sort((a, b) => a.week_number - b.week_number);
      for (let i = 1; i < playerRounds.length; i++) {
        const prev = playerRounds[i - 1];
        const curr = playerRounds[i];
        const improvement = prev.total_score - curr.total_score;
        if (improvement > 0) {
          comebacks.push({ player, improvement, fromWeek: prev.week_number, toWeek: curr.week_number, from: prev.total_score, to: curr.total_score });
        }
      }
    }
    comebacks.sort((a, b) => b.improvement - a.improvement);
    topComeback = comebacks[0] ?? null;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const lockedCount = [
    hotStreakers.length === 0,
    steadyEddie.length === 0,
    topComeback === null,
  ].filter(Boolean).length;

  return (
    <main className="max-w-lg mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{season.name}</p>
        <h1 className="text-2xl font-bold">Achievements</h1>
        <p className="text-sm text-gray-500 mt-1">
          {weeksPlayed} of 13 weeks played · {lockedCount > 0 ? `${lockedCount} unlocking as the season progresses` : "All achievements unlocked"}
        </p>
      </div>

      {/* ── Season Low Hero ── */}
      <div className="rounded-2xl border-2 border-[#C9A84C]/50 bg-gradient-to-br from-[#C9A84C]/10 to-[#C9A84C]/5 p-5">
        <div className="flex items-start gap-4">
          <div className="text-3xl w-14 h-14 flex items-center justify-center rounded-xl bg-[#C9A84C]/20">
            🏆
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

      {/* ── Week Champions ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Weekly Champions
        </h2>
        <div className="space-y-2">
          {weeks.map((week) => {
            const w = weekWinners.get(week)!;
            return (
              <div key={week} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <span className="text-sm font-bold text-[#C9A84C] w-8">W{week}</span>
                <span className="text-xl">🥇</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">
                    {w.players.map((p) => p.player.name).join(" & ")}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-700 shrink-0">{w.score}</span>
              </div>
            );
          })}
          {/* Placeholder future weeks */}
          {Array.from({ length: Math.max(0, 13 - weeks.length) }, (_, i) => weeks.length + i + 1).map((w) => (
            <div key={w} className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 opacity-30">
              <span className="text-sm font-bold text-gray-400 w-8">W{w}</span>
              <span className="text-xl grayscale">🥇</span>
              <span className="text-sm text-gray-400">—</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Player Achievements ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Player Awards
        </h2>
        <div className="space-y-3">
          {/* Most Improved */}
          {mostImproved.length > 0 && (
            <AchievementCard
              icon="📈"
              title="Most Improved"
              description="Biggest drop in avg vs 2025 season"
              accent="green"
              earners={mostImproved.map((x) => ({
                name: x.player.name,
                detail: `${fmt1(x.seasonAvg)} avg (was ${fmt1(x.avg25)} in '25)`,
              }))}
            />
          )}

          {/* Beat the Book */}
          {beatTheBook.length > 0 && (
            <AchievementCard
              icon="🎯"
              title="Beat the Book"
              description="Beat their 2025 season average in a round"
              accent="green"
              earners={beatTheBook.map((p) => {
                const avg25 = prior2025(p.id)!;
                const best = Math.min(...scores(p.id));
                return { name: p.name, detail: `${best} (book: ${fmt1(avg25)})` };
              })}
            />
          )}

          {/* Perfect Attendance */}
          {perfectAttendance.length > 0 && weeksPlayed >= 1 && (
            <AchievementCard
              icon="📅"
              title="Perfect Attendance"
              description={`Played every week so far (${weeksPlayed} of 13)`}
              accent="blue"
              earners={perfectAttendance.map((p) => ({ name: p.name }))}
            />
          )}

          {/* Hot Streak */}
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

          {/* Steady Eddie */}
          {steadyEddie.length > 0 && (
            <AchievementCard
              icon="🤝"
              title="Steady Eddie"
              description="Most consistent scorer — tightest score range this season"
              accent="blue"
              earners={steadyEddie.map((s) => ({
                name: s.player.name,
                detail: `${s.min}–${s.max} (range: ${s.range})`,
              }))}
            />
          )}

          {/* Comeback Kid */}
          {topComeback && (
            <AchievementCard
              icon="⛳"
              title="Comeback Kid"
              description="Biggest single-week score improvement"
              accent="green"
              earners={[{
                name: topComeback.player.name,
                detail: `W${topComeback.fromWeek} ${topComeback.from} → W${topComeback.toWeek} ${topComeback.to} (−${topComeback.improvement})`,
              }]}
            />
          )}
        </div>
      </section>

      {/* ── Locked ── */}
      {lockedCount > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Coming this season
          </h2>
          <div className="space-y-3">
            {hotStreakers.length === 0 && (
              <LockedCard
                icon="🔥"
                title="Hot Streak"
                description="Beat your running season avg 3 weeks in a row"
              />
            )}
            {steadyEddie.length === 0 && (
              <LockedCard
                icon="🤝"
                title="Steady Eddie"
                description="Most consistent scorer across all rounds"
              />
            )}
            {topComeback === null && (
              <LockedCard
                icon="⛳"
                title="Comeback Kid"
                description="Biggest single-week score improvement"
              />
            )}
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
      </div>
    </main>
  );
}
