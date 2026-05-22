"use server";

import { redirect } from "next/navigation";
import { createAdminSession, deleteAdminSession } from "@/lib/admin-auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password") as string;
  if (!password) return { error: "Password required." };

  const ok = await createAdminSession(password);
  if (!ok) return { error: "Incorrect password." };

  redirect("/admin");
}

export async function logout() {
  await deleteAdminSession();
  redirect("/admin/login");
}
