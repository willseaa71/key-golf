import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";

  if (url.startsWith("file:")) {
    // Local development — SQLite via better-sqlite3 adapter
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({ adapter } as never);
  }

  // Production — PostgreSQL (Neon, Supabase, etc.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter } as never);
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createClient> | undefined;
}

export const db =
  process.env.NODE_ENV === "production"
    ? createClient()
    : (globalThis.__prisma ??= createClient());
