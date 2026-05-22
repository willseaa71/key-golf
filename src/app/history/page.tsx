import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "History — KEY Golf" };

const TOTAL_WEEKS = 13;

// SVG layout constants
const LEFT = 100;   // left margin for rank labels + plot origin
const RIGHT = 140;  // right margin for player name labels
const PLOT_W = 400; // width of the actual plot area
const ROW_H = 28;
const TOP_PAD = 32;
const BOT_PAD = 24;

function xOfWeek(w: number): number {
  return LEFT + ((w - 1) / (TOTAL_WEEKS - 1)) * PLOT_W;
}

function yOfRank(r: number): number {
  return TOP_PAD + (r - 1) * ROW_H + ROW_H / 2;
}

function playerColor(rankAtLatest: number | null, maxRank: number): string {
  if (rankAtLatest === null) return "#9ca3af";
  if (rankAtLatest <= 3) return "#C9A84C";
  if (rankAtLatest <= 8) return "#006747";
  return "#9ca3af";
}

type PlayerWeekData = { rank: number; position: number }; // rank = dense rank, position = ordinal (1-based, unique)
type WeeklyRankMap = Map<number, Map<number, PlayerWeekData>>; // week -> player_id -> data

function computeWeeklyRanks(
  allRounds: { player_id: number; total_score: number; week_number: number }[],
  availableWeeks: number[]
): WeeklyRankMap {
  const result: WeeklyRankMap = new Map();

  for (const w of availableWeeks) {
    // All rounds up to and including week w
    const upTo = allRounds.filter((r) => r.week_number <= w);

    // Per-player averages
    const byPlayer = new Map<number, number[]>();
    for (const r of upTo) {
      if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
      byPlayer.get(r.player_id)!.push(r.total_score);
    }

    const playerAvgs: { playerId: number; avg: number }[] = [];
    for (const [pid, scores] of byPlayer) {
      playerAvgs.push({ playerId: pid, avg: scores.reduce((a, b) => a + b, 0) / scores.length });
    }

    // Sort by avg asc, then by playerId for stable tie-breaking
    playerAvgs.sort((a, b) => a.avg - b.avg || a.playerId - b.playerId);

    // Dense rank + ordinal position (position is always unique)
    const weekMap = new Map<number, PlayerWeekData>();
    for (let i = 0; i < playerAvgs.length; i++) {
      const { playerId, avg } = playerAvgs[i];
      const distinctBelow = new Set(playerAvgs.slice(0, i).map((x) => x.avg)).size;
      weekMap.set(playerId, { rank: distinctBelow + 1, position: i + 1 });
    }

    result.set(w, weekMap);
  }

  return result;
}

function fmt(n: number | null): string {
  return n === null ? "—" : String(n);
}

export default async function HistoryPage() {
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

  const allSeasonRounds = await db.round.findMany({
    where: { season_id: season.id },
    select: { player_id: true, total_score: true, week_number: true },
  });

  const availableWeeks = [...new Set(allSeasonRounds.map((r) => r.week_number))].sort((a, b) => a - b);

  if (availableWeeks.length === 0) {
    return (
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">2026 Season</p>
          <h1 className="text-2xl font-bold">Season History</h1>
          <p className="text-sm text-gray-400 mt-2">No rounds recorded yet — check back after the first week.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/results" className="text-sm text-[#006747] font-medium hover:underline">← Standings</Link>
          <Link href="/scorecard" className="text-sm text-[#006747] font-medium hover:underline">Scorecard →</Link>
        </div>
      </main>
    );
  }

  const weeklyRanks = computeWeeklyRanks(allSeasonRounds, availableWeeks);

  // All player IDs that appear in any week
  const activePlayerIds = new Set<number>();
  for (const [, wMap] of weeklyRanks) {
    for (const pid of wMap.keys()) activePlayerIds.add(pid);
  }

  // Latest week ranks (for coloring + sorting table)
  const latestWeek = availableWeeks[availableWeeks.length - 1];
  const latestRankMap = weeklyRanks.get(latestWeek) ?? new Map<number, PlayerWeekData>();

  // Players sorted by current position (then name for stability)
  const activePlayers = allPlayers
    .filter((p) => activePlayerIds.has(p.id))
    .sort((a, b) => {
      const ra = latestRankMap.get(a.id)?.position ?? 999;
      const rb = latestRankMap.get(b.id)?.position ?? 999;
      return ra - rb;
    });

  const maxRank = activePlayers.length;

  // Build polyline data per player
  type PolylineData = {
    playerId: number;
    name: string;
    points: { week: number; rank: number; position: number }[];
    latestRank: number | null;
  };

  const polylines: PolylineData[] = activePlayers.map((p) => {
    const points = availableWeeks
      .map((w) => {
        const d = weeklyRanks.get(w)?.get(p.id) ?? null;
        return d !== null ? { week: w, rank: d.rank, position: d.position } : null;
      })
      .filter((x): x is { week: number; rank: number; position: number } => x !== null);

    return {
      playerId: p.id,
      name: p.name,
      points,
      latestRank: latestRankMap.get(p.id)?.rank ?? null,
    };
  });

  const svgH = TOP_PAD + maxRank * ROW_H + BOT_PAD;
  const svgW = LEFT + PLOT_W + RIGHT;

  const showChart = availableWeeks.length >= 2;

  // Table cell color
  function cellStyle(rank: number | null, total: number): string {
    if (rank === null) return "text-gray-300";
    if (rank === 1) return "bg-[#C9A84C]/20 text-[#C9A84C] font-bold";
    if (rank <= 5) return "bg-[#006747]/10 text-[#006747] font-semibold";
    if (rank === total) return "bg-red-50 text-red-500";
    return "text-gray-600";
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">2026 Season</p>
        <h1 className="text-2xl font-bold">Season History</h1>
        <p className="text-sm text-gray-500 mt-1">
          Rankings after each week · lower is better
        </p>
      </div>

      {/* Bump chart or message */}
      {!showChart ? (
        <div className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
          Rankings history will build as more weeks are played.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            width={svgW}
            height={svgH}
            className="block min-w-full"
            style={{ minWidth: svgW }}
            aria-label="Bump chart of season rankings by week"
          >
            {/* Horizontal gridlines */}
            {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => (
              <line
                key={rank}
                x1={LEFT}
                x2={LEFT + PLOT_W}
                y1={yOfRank(rank)}
                y2={yOfRank(rank)}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
            ))}

            {/* Week column headers */}
            {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
              const hasData = availableWeeks.includes(w);
              return (
                <text
                  key={w}
                  x={xOfWeek(w)}
                  y={TOP_PAD - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill={hasData ? "#6b7280" : "#d1d5db"}
                  fontFamily="sans-serif"
                  fontWeight={hasData ? "600" : "400"}
                >
                  W{w}
                </text>
              );
            })}

            {/* Rank Y-axis labels */}
            {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => (
              <text
                key={rank}
                x={LEFT - 8}
                y={yOfRank(rank) + 4}
                textAnchor="end"
                fontSize={10}
                fill="#9ca3af"
                fontFamily="sans-serif"
              >
                {rank}
              </text>
            ))}

            {/* Player polylines */}
            {polylines.map((pl) => {
              const color = playerColor(pl.latestRank, maxRank);
              if (pl.points.length === 0) return null;

              // Build segments between consecutive data points (use position for Y)
              const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
              for (let i = 1; i < pl.points.length; i++) {
                const prev = pl.points[i - 1];
                const curr = pl.points[i];
                segments.push({
                  x1: xOfWeek(prev.week),
                  y1: yOfRank(prev.position),
                  x2: xOfWeek(curr.week),
                  y2: yOfRank(curr.position),
                });
              }

              const lastPoint = pl.points[pl.points.length - 1];
              const nameX = LEFT + PLOT_W + 12;
              const nameY = yOfRank(lastPoint.position) + 4;

              return (
                <g key={pl.playerId}>
                  {/* Line segments */}
                  {segments.map((seg, i) => (
                    <line
                      key={i}
                      x1={seg.x1}
                      y1={seg.y1}
                      x2={seg.x2}
                      y2={seg.y2}
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.85}
                      strokeLinejoin="round"
                    />
                  ))}

                  {/* Dots */}
                  {pl.points.map((pt) => (
                    <circle
                      key={pt.week}
                      cx={xOfWeek(pt.week)}
                      cy={yOfRank(pt.position)}
                      r={4}
                      fill={color}
                      fillOpacity={0.9}
                    />
                  ))}

                  {/* Name label at rightmost point */}
                  <text
                    x={nameX}
                    y={nameY}
                    fontSize={11}
                    fill={color}
                    fontFamily="sans-serif"
                    fontWeight="600"
                  >
                    {pl.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Rank table */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Rank by week
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="text-sm border-collapse" style={{ minWidth: "max-content" }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-r border-gray-200">
                  Player
                </th>
                {availableWeeks.map((w) => (
                  <th
                    key={w}
                    className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-10 whitespace-nowrap"
                  >
                    W{w}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">
                  Now
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {activePlayers.map((p) => {
                const currentRank = latestRankMap.get(p.id)?.rank ?? null;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5 whitespace-nowrap border-r border-gray-100">
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      {p.sub_order !== null && (
                        <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                          SUB
                        </span>
                      )}
                    </td>
                    {availableWeeks.map((w) => {
                      const rank = weeklyRanks.get(w)?.get(p.id)?.rank ?? null;
                      return (
                        <td key={w} className={`px-3 py-2.5 text-center text-xs ${cellStyle(rank, activePlayers.length)}`}>
                          {fmt(rank)}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2.5 text-center text-sm font-bold border-l border-gray-100 ${cellStyle(currentRank, activePlayers.length)}`}>
                      {fmt(currentRank)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex w-5 h-4 rounded bg-[#C9A84C]/20 items-center justify-center text-[#C9A84C] font-bold text-[10px]">1</span>
            #1 ranked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex w-5 h-4 rounded bg-[#006747]/10 items-center justify-center text-[#006747] font-semibold text-[10px]">3</span>
            Top 5
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex w-5 h-4 rounded bg-red-50 items-center justify-center text-red-500 text-[10px]">8</span>
            Last place
          </span>
        </div>
      </section>

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
