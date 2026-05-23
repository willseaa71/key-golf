"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function upsertSeason(formData: FormData) {
  await checkAdminAuth();
  const name = (formData.get("name") as string).trim();
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;

  if (!name || !startDate || !endDate) return;

  await db.season.upsert({
    where: { name },
    update: {
      start_date: new Date(startDate + "T12:00:00Z"),
      end_date: new Date(endDate + "T12:00:00Z"),
    },
    create: {
      name,
      start_date: new Date(startDate + "T12:00:00Z"),
      end_date: new Date(endDate + "T12:00:00Z"),
    },
  });

  revalidatePath("/admin/seasons");
  revalidatePath("/");
  revalidatePath("/results");
  redirect("/admin/seasons");
}
