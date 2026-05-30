import { db } from "@/lib/db";
import { ScoreForm } from "./ScoreForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enter Score — KEY Golf" };

export default async function EnterPage() {
  // Compute today's date string in UTC (matches how game dates are stored)
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const [players, season, allGames] = await Promise.all([
    db.player.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sub_order: true },
    }),
    db.season.findFirst({
      where: {
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
      orderBy: { start_date: "desc" },
    }),
    db.game.findMany({
      include: {
        teams: {
          include: { members: true },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

  // Match on date string to avoid any UTC timestamp range edge cases
  const activeGame = allGames.find(
    (g) => g.date.toISOString().slice(0, 10) === todayStr
  ) ?? null;

  if (!season) {
    return (
      <main className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Enter Score</h1>
        <p className="text-gray-500">No active season found. Ask the admin to set season dates.</p>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <ScoreForm
        players={players}
        season={{
          id: season.id,
          name: season.name,
          start_date: season.start_date.toISOString(),
          end_date: season.end_date.toISOString(),
        }}
        activeGame={activeGame ? {
          id: activeGame.id,
          status: activeGame.status,
          is_major: activeGame.is_major,
          teams: activeGame.teams.map((t) => ({
            id: t.id,
            name: t.name,
            members: t.members.map((m) => ({ player_id: m.player_id, is_sub: m.is_sub })),
          })),
        } : null}
      />
    </main>
  );
}
