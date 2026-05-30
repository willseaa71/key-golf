"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

// ── Calculation ─────────────────────────────────────────────────────────────

export async function calculateBestBallResults(gameId: number): Promise<void> {
  const game = await db.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      teams: {
        include: {
          members: { include: { player: true } },
        },
      },
    },
  });

  const gameDate = game.date;

  // For each team, fetch each member's round (with hole scores) on the game date
  type TeamScores = {
    teamId: number;
    holeScores: Map<number, number>; // hole_number → best ball stroke count
  };

  const teamResults: TeamScores[] = [];

  for (const team of game.teams) {
    const holeMin = new Map<number, number>();

    for (const member of team.members) {
      const round = await db.round.findFirst({
        where: {
          player_id: member.player_id,
          date: gameDate,
          has_hole_scores: true,
        },
        include: { hole_scores: true },
      });

      if (!round) continue;

      for (const hs of round.hole_scores) {
        const current = holeMin.get(hs.hole_number);
        if (current === undefined || hs.strokes < current) {
          holeMin.set(hs.hole_number, hs.strokes);
        }
      }
    }

    teamResults.push({ teamId: team.id, holeScores: holeMin });
  }

  // Collect all hole numbers present across any team
  const allHoles = new Set<number>();
  for (const t of teamResults) {
    for (const h of t.holeScores.keys()) allHoles.add(h);
  }

  // Tally points per team (1 point per hole won; ties = 0 points)
  const pointsByTeam = new Map<number, number>(teamResults.map((t) => [t.teamId, 0]));

  for (const hole of allHoles) {
    const scores = teamResults
      .map((t) => ({ teamId: t.teamId, score: t.holeScores.get(hole) }))
      .filter((t): t is { teamId: number; score: number } => t.score !== undefined);

    if (scores.length === 0) continue;
    const minScore = Math.min(...scores.map((s) => s.score));
    const winners = scores.filter((s) => s.score === minScore);

    if (winners.length === 1) {
      pointsByTeam.set(winners[0].teamId, (pointsByTeam.get(winners[0].teamId) ?? 0) + 1);
    }
    // ties: 0 points, no carryover
  }

  // Determine winner — if tied, don't auto-resolve (putt-off needed)
  const maxPoints = Math.max(...pointsByTeam.values());
  const topTeams = teamResults.filter((t) => (pointsByTeam.get(t.teamId) ?? 0) === maxPoints);
  const isTied = topTeams.length > 1;

  // Write results in a transaction
  await db.$transaction(async (tx) => {
    for (const [teamId, points] of pointsByTeam) {
      await tx.gameTeam.update({
        where: { id: teamId },
        data: {
          points,
          is_winner: !isTied && points === maxPoints,
        },
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

  if (!name) return { error: "Game name is required." };
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return { error: "Invalid date." };
  if (rulesetType !== "BEST_BALL") return { error: "Invalid ruleset." };

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
  redirect("/admin/games");
}

// ── Admin: Trigger calculation ───────────────────────────────────────────────

export async function triggerCalculation(gameId: number): Promise<void> {
  await checkAdminAuth();
  await calculateBestBallResults(gameId);
  revalidatePath(`/admin/games/${gameId}`);
}

// ── Admin: Set putt-off winner ───────────────────────────────────────────────

export async function setPuttOffWinner(gameId: number, playerId: number): Promise<void> {
  await checkAdminAuth();

  // Find which team the player is on
  const member = await db.gameTeamMember.findFirst({
    where: { player_id: playerId, team: { game_id: gameId } },
    include: { team: true },
  });

  if (!member) return;

  const winningTeamId = member.team.id;

  await db.$transaction(async (tx) => {
    // Clear all winners on this game's teams
    await tx.gameTeam.updateMany({
      where: { game_id: gameId },
      data: { is_winner: false },
    });
    // Set the winning team
    await tx.gameTeam.update({
      where: { id: winningTeamId },
      data: { is_winner: true },
    });
    // Record the putt-off winner on the game
    await tx.game.update({
      where: { id: gameId },
      data: { putt_off_winner_id: playerId },
    });
  });

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

  if (!name) return { error: "Game name is required." };
  if (!dateStr || isNaN(new Date(dateStr).getTime())) return { error: "Invalid date." };
  if (rulesetType !== "BEST_BALL") return { error: "Invalid ruleset." };

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
  redirect(`/admin/games/${gameId}`);
}
