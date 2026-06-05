"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { holeHandicap } from "@/lib/course";

// ── Calculation ─────────────────────────────────────────────────────────────

export async function calculateBestBallResults(gameId: number): Promise<void> {
  const game = await db.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { teams: { include: { members: true } } },
  });

  const gameDate = game.date;

  type TeamResult = {
    teamId: number;
    courseHalf: string;
    holeScores: Map<number, number>; // stored hole_number (1–9) → best-ball stroke count
    total: number;                   // sum of best-ball scores = team's round score
  };

  const teamResults: TeamResult[] = [];

  for (const team of game.teams) {
    const holeMin = new Map<number, number>();
    let courseHalf = "front9";

    for (const member of team.members) {
      const round = await db.round.findFirst({
        where: { player_id: member.player_id, date: gameDate, has_hole_scores: true },
        include: { hole_scores: true },
      });
      if (!round) continue;
      courseHalf = round.course_half;
      for (const hs of round.hole_scores) {
        const cur = holeMin.get(hs.hole_number);
        if (cur === undefined || hs.strokes < cur) holeMin.set(hs.hole_number, hs.strokes);
      }
    }

    const total = Array.from(holeMin.values()).reduce((a, b) => a + b, 0);
    teamResults.push({ teamId: team.id, courseHalf, holeScores: holeMin, total });
  }

  // Winner = lowest best-ball total (stroke play)
  const minTotal = Math.min(...teamResults.map((t) => t.total));
  const tied = teamResults.filter((t) => t.total === minTotal);

  let winningTeamId: number | null = null;

  if (tied.length === 1) {
    winningTeamId = tied[0].teamId;
  } else if (tied.length > 1) {
    // Tiebreaker: compare hole by hole, hardest first (lowest handicap = hardest)
    const courseHalf = tied[0].courseHalf;
    const holesPlayed = [...tied[0].holeScores.keys()].sort(
      (a, b) => holeHandicap(a, courseHalf) - holeHandicap(b, courseHalf)
    );

    for (const hole of holesPlayed) {
      const scores = tied.map((t) => ({
        teamId: t.teamId,
        score: t.holeScores.get(hole) ?? Infinity,
      }));
      const best = Math.min(...scores.map((s) => s.score));
      const holeWinners = scores.filter((s) => s.score === best);
      if (holeWinners.length === 1) {
        winningTeamId = holeWinners[0].teamId;
        break;
      }
      // Still tied on this hole → check next hardest
    }
  }

  // Persist: points = team's best-ball total (lower is better); is_winner = computed above
  await db.$transaction(async (tx) => {
    for (const t of teamResults) {
      await tx.gameTeam.update({
        where: { id: t.teamId },
        data: { points: t.total, is_winner: t.teamId === winningTeamId },
      });
    }
    await tx.game.update({
      where: { id: gameId },
      data: { status: "COMPLETE", calculated_at: new Date() },
    });
  });
}

// Called after a score submission — auto-calculates if all members have scores
export async function checkAndAutoCalculate(date: Date): Promise<void> {
  const pendingGames = await db.game.findMany({
    where: { status: "PENDING", date },
    include: {
      teams: {
        include: { members: true },
      },
    },
  });

  for (const game of pendingGames) {
    const allMembers = game.teams.flatMap((t) => t.members);
    if (allMembers.length === 0) continue;

    const completeCount = await db.round.count({
      where: {
        player_id: { in: allMembers.map((m) => m.player_id) },
        date: game.date,
        has_hole_scores: true,
      },
    });

    if (completeCount >= allMembers.length) {
      await calculateBestBallResults(game.id);
    }
  }
}

// ── Admin: Create game ───────────────────────────────────────────────────────

export type CreateGameState = { error?: string };

export async function createGame(
  _prev: CreateGameState,
  formData: FormData
): Promise<CreateGameState> {
  await checkAdminAuth();

  const name = (formData.get("name") as string).trim();
  const dateStr = formData.get("date") as string;
  const rulesetType = formData.get("ruleset_type") as string;
  const isMajor = formData.get("is_major") === "on";
  const betAmountRaw = formData.get("bet_amount") as string | null;
  const betAmount = betAmountRaw && betAmountRaw.trim() !== "" ? parseFloat(betAmountRaw) : null;

  if (!name) return { error: "Game name is required." };
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return { error: "Invalid date." };
  if (rulesetType !== "BEST_BALL") return { error: "Invalid ruleset." };
  if (betAmount !== null && (isNaN(betAmount) || betAmount < 0)) return { error: "Bet amount must be a positive number." };

  // Parse teams from formData: teams[0][name], teams[0][members][0][player_id], etc.
  // Encoded as JSON string for simplicity from the client form
  const teamsJson = formData.get("teams") as string;
  let teams: { name: string; members: { player_id: number; is_sub: boolean }[] }[];
  try {
    teams = JSON.parse(teamsJson);
  } catch {
    return { error: "Invalid team data." };
  }

  if (!teams || teams.length < 2) return { error: "At least 2 teams are required." };
  for (const t of teams) {
    if (!t.name?.trim()) return { error: "All teams must have a name." };
  }

  // Validate no player appears on more than one team
  const allPlayerIds = teams.flatMap((t) => t.members.map((m) => m.player_id));
  const uniqueIds = new Set(allPlayerIds);
  if (uniqueIds.size !== allPlayerIds.length) {
    return { error: "A player cannot appear on more than one team." };
  }

  await db.game.create({
    data: {
      name,
      date: new Date(dateStr + "T12:00:00Z"),
      ruleset_type: rulesetType,
      is_major: isMajor,
      bet_amount: isMajor ? betAmount : null,
      teams: {
        create: teams.map((t) => ({
          name: t.name.trim(),
          members: {
            create: t.members.map((m) => ({
              player_id: m.player_id,
              is_sub: m.is_sub,
            })),
          },
        })),
      },
    },
  });

  revalidatePath("/admin/games");
  revalidatePath("/enter");
  redirect("/admin/games");
}

// ── Admin: Trigger calculation ───────────────────────────────────────────────

export async function triggerCalculation(gameId: number): Promise<void> {
  await checkAdminAuth();
  await calculateBestBallResults(gameId);
  revalidatePath(`/admin/games/${gameId}`);
}

// ── Admin: Delete game ───────────────────────────────────────────────────────

export async function deleteGame(gameId: number): Promise<void> {
  await checkAdminAuth();
  // GameTeam and GameTeamMember cascade via onDelete: Cascade in schema
  await db.game.delete({ where: { id: gameId } });
  revalidatePath("/admin/games");
  redirect("/admin/games");
}

// ── Admin: Update game (metadata + teams rebuilt) ────────────────────────────

export type UpdateGameState = { error?: string };

export async function updateGame(
  gameId: number,
  _prev: UpdateGameState,
  formData: FormData
): Promise<UpdateGameState> {
  await checkAdminAuth();

  const name = (formData.get("name") as string).trim();
  const dateStr = formData.get("date") as string;
  const rulesetType = formData.get("ruleset_type") as string;
  const isMajor = formData.get("is_major") === "on";
  const betAmountRaw = formData.get("bet_amount") as string | null;
  const betAmount = betAmountRaw && betAmountRaw.trim() !== "" ? parseFloat(betAmountRaw) : null;

  if (!name) return { error: "Game name is required." };
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return { error: "Invalid date." };
  if (rulesetType !== "BEST_BALL") return { error: "Invalid ruleset." };
  if (betAmount !== null && (isNaN(betAmount) || betAmount < 0)) return { error: "Bet amount must be a positive number." };

  const teamsJson = formData.get("teams") as string;
  let teams: { name: string; members: { player_id: number; is_sub: boolean }[] }[];
  try {
    teams = JSON.parse(teamsJson);
  } catch {
    return { error: "Invalid team data." };
  }

  if (!teams || teams.length < 2) return { error: "At least 2 teams are required." };
  for (const t of teams) {
    if (!t.name?.trim()) return { error: "All teams must have a name." };
  }

  const allPlayerIds = teams.flatMap((t) => t.members.map((m) => m.player_id));
  if (new Set(allPlayerIds).size !== allPlayerIds.length) {
    return { error: "A player cannot appear on more than one team." };
  }

  // Rebuild teams in a transaction: delete all existing teams (cascades members), recreate
  await db.$transaction(async (tx) => {
    await tx.gameTeam.deleteMany({ where: { game_id: gameId } });
    await tx.game.update({
      where: { id: gameId },
      data: {
        name,
        date: new Date(dateStr + "T12:00:00Z"),
        ruleset_type: rulesetType,
        is_major: isMajor,
        bet_amount: isMajor ? betAmount : null,
        // Reset result state when game is edited
        status: "PENDING",
        calculated_at: null,
        putt_off_winner_id: null,
        teams: {
          create: teams.map((t) => ({
            name: t.name.trim(),
            members: {
              create: t.members.map((m) => ({
                player_id: m.player_id,
                is_sub: m.is_sub,
              })),
            },
          })),
        },
      },
    });
  });

  revalidatePath("/admin/games");
  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/enter");
  redirect(`/admin/games/${gameId}`);
}
