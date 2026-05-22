"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export type RoundEditState = { error?: string };

export async function updateRound(
  id: number,
  _prev: RoundEditState,
  formData: FormData
): Promise<RoundEditState> {
  await checkAdminAuth();

  const totalScore = parseInt(formData.get("total_score") as string, 10);
  const courseHalf = formData.get("course_half") as string;
  const dateStr = formData.get("date") as string;
  const weekNumber = parseInt(formData.get("week_number") as string, 10);

  if (isNaN(totalScore) || totalScore < 9 || totalScore > 99)
    return { error: "Score must be between 9 and 99." };
  if (courseHalf !== "front9" && courseHalf !== "back9")
    return { error: "Select Front-9 or Back-9." };
  if (!dateStr || isNaN(new Date(dateStr).getTime()))
    return { error: "Invalid date." };
  if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 13)
    return { error: "Week must be between 1 and 13." };

  const existing = await db.round.findUnique({ where: { id } });
  if (!existing) return { error: "Round not found." };

  const conflict = await db.round.findFirst({
    where: {
      player_id: existing.player_id,
      season_id: existing.season_id,
      week_number: weekNumber,
      NOT: { id },
    },
  });
  if (conflict) return { error: "That player already has a round for that week." };

  await db.round.update({
    where: { id },
    data: {
      total_score: totalScore,
      course_half: courseHalf,
      date: new Date(dateStr + "T12:00:00Z"),
      week_number: weekNumber,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/results");
  redirect("/admin");
}

export async function deleteRound(id: number) {
  await checkAdminAuth();
  await db.round.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/results");
}
