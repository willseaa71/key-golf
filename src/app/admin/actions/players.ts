"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function togglePlayerActive(id: number, currentActive: boolean) {
  await checkAdminAuth();
  await db.player.update({ where: { id }, data: { active: !currentActive } });
  revalidatePath("/admin/players");
  revalidatePath("/results");
}
