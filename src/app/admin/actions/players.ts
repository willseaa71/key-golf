"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

function revalidateAll() {
  revalidatePath("/admin/players");
  revalidatePath("/results");
  revalidatePath("/scorecard");
  revalidatePath("/history");
}

export async function togglePlayerActive(id: number, currentActive: boolean) {
  await checkAdminAuth();
  await db.player.update({ where: { id }, data: { active: !currentActive } });
  revalidateAll();
}

export async function addPlayer(formData: FormData) {
  await checkAdminAuth();
  const name = (formData.get("name") as string).trim();
  const type = formData.get("type") as string; // "regular" | "sub"
  const subOrder = type === "sub" ? parseInt(formData.get("sub_order") as string, 10) : null;

  if (!name) return;
  if (type === "sub" && (isNaN(subOrder!) || subOrder! < 1)) return;

  await db.player.create({
    data: { name, active: true, sub_order: subOrder ?? null },
  });
  revalidateAll();
}

export async function deletePlayer(id: number) {
  await checkAdminAuth();
  const count = await db.round.count({ where: { player_id: id } });
  if (count > 0) return; // Safety: never delete a player with rounds
  await db.player.delete({ where: { id } });
  revalidateAll();
}

export async function updatePlayer(id: number, formData: FormData) {
  await checkAdminAuth();
  const name = (formData.get("name") as string).trim();
  const type = formData.get("type") as string;
  const subOrder = type === "sub" ? parseInt(formData.get("sub_order") as string, 10) : null;

  if (!name) return;

  await db.player.update({
    where: { id },
    data: { name, sub_order: subOrder ?? null },
  });
  revalidateAll();
  redirect("/admin/players");
}

export async function upsertPriorAverage(playerId: number, formData: FormData) {
  await checkAdminAuth();
  const year = parseInt(formData.get("year") as string, 10);
  const avg = parseFloat(formData.get("average") as string);
  if (isNaN(year) || isNaN(avg)) return;

  await db.priorSeasonAverage.upsert({
    where: { player_id_season_year: { player_id: playerId, season_year: year } },
    update: { average: avg },
    create: { player_id: playerId, season_year: year, average: avg },
  });
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/results");
}

export async function deletePriorAverage(playerId: number, year: number) {
  await checkAdminAuth();
  await db.priorSeasonAverage.deleteMany({
    where: { player_id: playerId, season_year: year },
  });
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/results");
}
