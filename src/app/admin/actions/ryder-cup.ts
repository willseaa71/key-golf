"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function setupTeams(seasonId: number, formData: FormData) {
  await checkAdminAuth();

  const teamAId = formData.get("team_a_id") as string;
  const teamBId = formData.get("team_b_id") as string;
  const teamAName = (formData.get("team_a_name") as string)?.trim();
  const teamBName = (formData.get("team_b_name") as string)?.trim();
  const teamAPlayerIds = formData.getAll("team_a_players").map((v) => Number(v));
  let teamBPlayerIds = formData.getAll("team_b_players").map((v) => Number(v));

  if (!teamAName || !teamBName) return;

  // Safety net: a player can't be on both teams — Team A wins any overlap
  teamBPlayerIds = teamBPlayerIds.filter((id) => !teamAPlayerIds.includes(id));

  await db.$transaction(async (tx) => {
    const slots: [string, string, number[]][] = [
      [teamAId, teamAName, teamAPlayerIds],
      [teamBId, teamBName, teamBPlayerIds],
    ];
    for (const [existingId, name, playerIds] of slots) {
      let teamRecordId: number;
      if (existingId) {
        teamRecordId = Number(existingId);
        await tx.ryderCupTeam.update({ where: { id: teamRecordId }, data: { name } });
        await tx.ryderCupTeamMember.deleteMany({ where: { team_id: teamRecordId } });
      } else {
        const created = await tx.ryderCupTeam.create({ data: { season_id: seasonId, name } });
        teamRecordId = created.id;
      }
      if (playerIds.length > 0) {
        await tx.ryderCupTeamMember.createMany({
          data: playerIds.map((player_id) => ({ team_id: teamRecordId, player_id })),
        });
      }
    }
  });

  revalidatePath("/admin/ryder-cup");
  revalidatePath("/admin/ryder-cup/teams");
  revalidatePath("/results");
  redirect("/admin/ryder-cup");
}

export async function createMatch(seasonId: number, formData: FormData) {
  await checkAdminAuth();
  const weekNumber = parseInt(formData.get("week_number") as string, 10);
  const format = (formData.get("format") as string)?.trim();
  const teamAId = parseInt(formData.get("team_a_id") as string, 10);
  const teamBId = parseInt(formData.get("team_b_id") as string, 10);
  const teamAPoints = parseFloat(formData.get("team_a_points") as string);
  const teamBPoints = parseFloat(formData.get("team_b_points") as string);
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!format || isNaN(weekNumber) || isNaN(teamAPoints) || isNaN(teamBPoints)) return;

  await db.ryderCupMatch.create({
    data: {
      season_id: seasonId,
      week_number: weekNumber,
      format,
      team_a_id: teamAId,
      team_b_id: teamBId,
      team_a_points: teamAPoints,
      team_b_points: teamBPoints,
      notes,
    },
  });

  revalidatePath("/admin/ryder-cup");
  revalidatePath("/results");
  redirect("/admin/ryder-cup");
}

export async function updateMatch(matchId: number, formData: FormData) {
  await checkAdminAuth();
  const weekNumber = parseInt(formData.get("week_number") as string, 10);
  const format = (formData.get("format") as string)?.trim();
  const teamAPoints = parseFloat(formData.get("team_a_points") as string);
  const teamBPoints = parseFloat(formData.get("team_b_points") as string);
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!format || isNaN(weekNumber) || isNaN(teamAPoints) || isNaN(teamBPoints)) return;

  await db.ryderCupMatch.update({
    where: { id: matchId },
    data: { week_number: weekNumber, format, team_a_points: teamAPoints, team_b_points: teamBPoints, notes },
  });

  revalidatePath("/admin/ryder-cup");
  revalidatePath("/results");
  redirect("/admin/ryder-cup");
}

export async function deleteMatch(matchId: number) {
  await checkAdminAuth();
  await db.ryderCupMatch.delete({ where: { id: matchId } });
  revalidatePath("/admin/ryder-cup");
  revalidatePath("/results");
}
