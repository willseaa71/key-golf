import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "admin_session";

function deriveSessionToken(): string {
  const secret = process.env.ADMIN_SECRET!;
  return crypto.createHmac("sha256", secret).update("admin-session").digest("hex");
}

function verifyPassword(attempt: string): boolean {
  const secret = process.env.ADMIN_SECRET!;
  const expected = crypto.createHmac("sha256", secret).update(process.env.ADMIN_PASSWORD!).digest();
  const actual   = crypto.createHmac("sha256", secret).update(attempt).digest();
  try {
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function verifyCookieValue(value: string): boolean {
  const expected = deriveSessionToken();
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(value, "hex"));
  } catch {
    return false;
  }
}

export async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session || !verifyCookieValue(session.value)) {
    redirect("/admin/login");
  }
}

export async function createAdminSession(password: string): Promise<boolean> {
  if (!verifyPassword(password)) return false;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, deriveSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === "production",
  });
  return true;
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
