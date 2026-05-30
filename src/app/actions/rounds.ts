"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkAndAutoCalculate } from "@/app/admin/actions/games";

export type RoundFormState = {
  error?: string;
};

export async function submitRound(
  prevState: RoundFormState,
  formData: FormData
): Promise<RoundFormState> {
  const playerId = parseInt(formData.get("player_id") as string, 10);
  const seasonId = parseInt(formData.get("season_id") as string, 10);
  const weekNumber = parseInt(formData.get("week_number") as string, 10);
  const dateStr = formData.get("date") as string;
  const mode = formData.get("mode") as "hole" | "total";
  const courseHalf = formData.get("course_half") as string;

  if (!playerId || !seasonId || !weekNumber || !dateStr || !mode) {
    return { error: "Please fill in all required fields." };
  }
  if (courseHalf !== "front9" && courseHalf !== "back9") {
    return { error: "Please select Front-9 or Back-9." };
  }

  const date = new Date(dateStr + "T12:00:00Z");
  if (isNaN(date.getTime())) {
    return { error: "Invalid date." };
  }

  const existing = await db.round.findFirst({
    where: { player_id: playerId, season_id: seasonId, week_number: weekNumber },
    select: { id: true },
  });
  if (existing) {
    return { error: "A score for this player and week already exists." };
  }

  if (mode === "hole") {
    const holes: number[] = [];
    for (let i = 1; i <= 9; i++) {
      const raw = formData.get(`hole_${i}`) as string;
      const val = parseInt(raw, 10);
      if (isNaN(val) || val < 1 || val > 20) {
        return { error: `Invalid score for hole ${i}.` };
      }
      holes.push(val);
    }
    const total = holes.reduce((a, b) => a + b, 0);

    const round = await db.round.create({
      data: { player_id: playerId, season_id: seasonId, week_number: weekNumber, date, course_half: courseHalf, total_score: total, has_hole_scores: true },
    });
    await db.holeScore.createMany({
      data: holes.map((strokes, i) => ({ round_id: round.id, hole_number: i + 1, strokes })),
    });
    // Auto-calculate any Best Ball games on this date if all members are now ready
    await checkAndAutoCalculate(date);
  } else {
    const total = parseInt(formData.get("total_score") as string, 10);
    if (isNaN(total) || total < 9 || total > 99) {
      return { error: "Total score must be between 9 and 99." };
    }
    await db.round.create({
      data: { player_id: playerId, season_id: seasonId, week_number: weekNumber, date, course_half: courseHalf, total_score: total, has_hole_scores: false },
    });
  }

  // If the player flagged themselves as putt-off winner, record it on the game
  const gameIdRaw = formData.get("game_id") as string | null;
  const puttOffWinnerFlag = formData.get("putt_off_winner") as string | null;
  if (gameIdRaw && puttOffWinnerFlag === "true") {
    const gameId = parseInt(gameIdRaw, 10);
    if (!isNaN(gameId)) {
      await db.game.update({
        where: { id: gameId },
        data: { putt_off_winner_id: playerId },
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/results");
  redirect(`/results?player=${playerId}&week=${weekNumber}`);
}
