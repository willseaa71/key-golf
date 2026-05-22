import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";

let db: PrismaClient;
if (url.startsWith("file:")) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const adapter = new PrismaBetterSqlite3({ url });
  db = new PrismaClient({ adapter } as never);
} else {
  db = new PrismaClient();
}

const PLAYERS = [
  "Mike Pilkington",
  "Pepper Pilkington",
  "Evan Pilkington",
  "Tony Soprano",
  "Peter Guidarelli",
  "Parker Stafford",
  "Bob Fitch",
  "Tim Oliver",
  "David Cerniglia",
  "Angelo Mazzone",
  "John Lefner",
  "Adam Fitch",
  "Will Critcher",
  "Lance O'Brien",
  "Thomas Smith (Smitty)",
  "Jack Shellard",
];

const SUBS: { name: string; sub_order: number }[] = [
  { name: "Eric Donovan",            sub_order: 1 },
  { name: "Jeff Gallo",              sub_order: 2 },
  { name: "Jonathan Gable",          sub_order: 3 },
  { name: "Dave Watsky",             sub_order: 4 },
  { name: "Brian (Will's Neighbor)", sub_order: 5 },
];

// Prior season averages — matched to current roster only.
// Source: spreadsheet screenshots provided by Will Critcher (May 2026).
const PRIOR_AVERAGES: Record<string, { year: number; avg: number }[]> = {
  "Mike Pilkington":   [{ year: 2024, avg: 44.8 }, { year: 2025, avg: 42.3 }],
  "Pepper Pilkington": [{ year: 2024, avg: 48.5 }, { year: 2025, avg: 43.0 }],
  "Evan Pilkington":   [{ year: 2024, avg: 51.5 }, { year: 2025, avg: 48.0 }],
  "Peter Guidarelli":  [{ year: 2024, avg: 43.5 }],
  "Tim Oliver":        [{ year: 2024, avg: 38.0 }, { year: 2025, avg: 42.0 }],
  "David Cerniglia":   [{ year: 2024, avg: 49.0 }, { year: 2025, avg: 51.7 }],
  "Angelo Mazzone":    [{ year: 2024, avg: 50.0 }, { year: 2025, avg: 47.3 }],
  "Will Critcher":     [{ year: 2024, avg: 59.1 }, { year: 2025, avg: 59.0 }],
  "Lance O'Brien":     [{ year: 2024, avg: 51.3 }, { year: 2025, avg: 48.7 }],
  "Parker Stafford":   [{ year: 2025, avg: 40.0 }],
  "Bob Fitch":         [{ year: 2025, avg: 43.5 }],
  "Tony Soprano":      [{ year: 2025, avg: 44.3 }],
  "Adam Fitch":        [{ year: 2025, avg: 42.3 }],
  // John Lefner, Jack Shellard, Thomas Smith (Smitty) — no prior data
};

async function main() {
  console.log("Seeding database (safe — rounds are never touched)...");

  // Upsert regular players
  for (const name of PLAYERS) {
    await db.player.upsert({
      where: { name },
      update: { active: true, sub_order: null },
      create: { name, active: true },
    });
  }

  // Upsert subs
  for (const { name, sub_order } of SUBS) {
    await db.player.upsert({
      where: { name },
      update: { active: true, sub_order },
      create: { name, active: true, sub_order },
    });
  }

  const allPlayers = await db.player.findMany();
  console.log(`Upserted ${allPlayers.length} players (${SUBS.length} subs)`);

  // Upsert season
  const season = await db.season.upsert({
    where: { name: "2026 Season" },
    update: {},
    create: {
      name: "2026 Season",
      start_date: new Date("2026-05-14T12:00:00Z"),
      end_date: new Date("2026-08-06T12:00:00Z"),
    },
  });
  console.log(`Upserted season: ${season.name}`);

  // Upsert prior season averages
  let avgCount = 0;
  for (const player of allPlayers) {
    const entries = PRIOR_AVERAGES[player.name];
    if (!entries) continue;
    for (const { year, avg } of entries) {
      await db.priorSeasonAverage.upsert({
        where: { player_id_season_year: { player_id: player.id, season_year: year } },
        update: { average: avg },
        create: { player_id: player.id, season_year: year, average: avg },
      });
      avgCount++;
    }
  }
  console.log(`Upserted ${avgCount} prior season averages`);
  console.log(`\nSeed complete — existing rounds untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
