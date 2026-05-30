import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { triggerCalculation, setPuttOffWinner } from "@/app/admin/actions/games";

export const metadata = { title: "Game Detail — KEY Golf Admin" };

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdminAuth();

  const { id } = await params;
  const gameId = parseInt(id, 10);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      teams: {
        include: {
          members: { include: { player: true } },
        },
        orderBy: { id: "asc" },
      },
      putt_off_winner: true,
    },
  });

  if (!game) notFound();

  const isPending = game.status === "PENDING";
  const isComplete = game.status === "COMPLETE";

  // For PENDING: check which members have submitted complete scores
  const allMembers = game.teams.flatMap((t) => t.members);
  const completeRounds = isPending
    ? await db.round.findMany({
        where: {
          player_id: { in: allMembers.map((m) => m.player_id) },
          date: game.date,
          has_hole_scores: true,
        },
        select: { player_id: true },
      })
    : [];
  const completePlayerIds = new Set(completeRounds.map((r) => r.player_id));

  // For COMPLETE: detect tie
  const maxPoints = isComplete
    ? Math.max(...game.teams.map((t) => t.points ?? 0))
    : 0;
  const tiedTeams = isComplete
    ? game.teams.filter((t) => (t.points ?? 0) === maxPoints)
    : [];
  const isTied = tiedTeams.length > 1 && !game.putt_off_winner_id;

  // Players eligible for putt-off selection (from tied teams)
  const puttOffCandidates = isTied
    ? tiedTeams.flatMap((t) => t.members.map((m) => m.player))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/games"
            className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block"
          >
            ← Games
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {game.name}
            {game.is_major && (
              <span className="text-sm font-semibold text-[#C9A84C] bg-[#C9A84C]/15 px-2 py-0.5 rounded">
                MAJOR
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(game.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}{" "}
            ·{" "}
            {game.ruleset_type === "BEST_BALL" ? "Best Ball" : game.ruleset_type}
          </p>
        </div>
        <span
          className={`mt-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            isComplete
              ? "bg-[#006747]/10 text-[#006747]"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {game.status}
        </span>
      </div>

      {/* ── PENDING view ── */}
      {isPending && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Score Completion</h2>
              <span className="text-sm text-gray-500">
                {completePlayerIds.size} of {allMembers.length} players have submitted complete scores
              </span>
            </div>

            {game.teams.map((team) => (
              <div key={team.id}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  {team.name}
                </p>
                <div className="space-y-1">
                  {team.members.map((member) => {
                    const done = completePlayerIds.has(member.player_id);
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            done ? "bg-[#006747]" : "bg-gray-300"
                          }`}
                        />
                        <span className={done ? "text-gray-800" : "text-gray-400"}>
                          {member.player.name}
                          {member.is_sub && (
                            <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                              SUB
                            </span>
                          )}
                        </span>
                        {done && (
                          <span className="text-[10px] text-[#006747] font-medium">✓ Ready</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Calculate button */}
          <form
            action={async () => {
              "use server";
              await triggerCalculation(gameId);
            }}
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 mb-3">
                <strong>Manual trigger:</strong> Only use this when all scores are confirmed.
                The calculation will be automatic once everyone has submitted hole scores.
              </p>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#006747] text-white text-sm font-semibold hover:bg-[#005236] disabled:opacity-60"
                onClick={(e) => {
                  if (!confirm("Calculate Best Ball results now? This cannot be undone.")) {
                    e.preventDefault();
                  }
                }}
              >
                All Scores Are In — Calculate Results
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── COMPLETE view ── */}
      {isComplete && (
        <>
          {/* Tie warning + putt-off picker */}
          {isTied && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                Tie detected — select the putt-off winner below
              </p>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  const playerId = parseInt(formData.get("putt_off_winner_id") as string, 10);
                  await setPuttOffWinner(gameId, playerId);
                }}
                className="flex gap-3"
              >
                <select
                  name="putt_off_winner_id"
                  required
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">Select winner…</option>
                  {puttOffCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#006747] text-white text-sm font-medium hover:bg-[#005236]"
                >
                  Set Winner
                </button>
              </form>
            </div>
          )}

          {/* Calculated at */}
          {game.calculated_at && (
            <p className="text-xs text-gray-400">
              Calculated{" "}
              {new Date(game.calculated_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}

          {/* Teams + results */}
          <div className="space-y-3">
            {[...game.teams]
              .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
              .map((team) => (
                <div
                  key={team.id}
                  className={`rounded-xl border p-4 ${
                    team.is_winner
                      ? "border-[#006747]/40 bg-[#006747]/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{team.name}</span>
                      {team.is_winner && (
                        <span className="text-xs font-semibold text-[#006747] bg-[#006747]/10 px-2 py-0.5 rounded-full">
                          WINNER
                        </span>
                      )}
                      {game.putt_off_winner &&
                        team.members.some((m) => m.player_id === game.putt_off_winner_id) && (
                          <span className="text-xs text-gray-400">(putt-off)</span>
                        )}
                    </div>
                    <span className="text-2xl font-bold text-gray-900">
                      {team.points ?? "—"}
                      <span className="text-sm font-normal text-gray-400 ml-1">pts</span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                        {member.player.name}
                        {member.is_sub && (
                          <span className="text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                            SUB
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
