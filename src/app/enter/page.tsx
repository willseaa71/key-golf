import { db } from "@/lib/db";
import { ScoreForm } from "./ScoreForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enter Score — KEY Golf" };

export default async function EnterPage() {
  const [players, season, pendingGames] = await Promise.all([
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
    // Fetch all PENDING games — the client will match by local date
    db.game.findMany({
      where: { status: "PENDING" },
      include: {
        teams: {
          include: { members: true },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

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
        pendingGames={pendingGames.map((g) => ({
          id: g.id,
          status: g.status,
          is_major: g.is_major,
          date: g.date.toISOString(),
          teams: g.teams.map((t) => ({
            id: t.id,
            name: t.name,
            members: t.members.map((m) => ({ player_id: m.player_id, is_sub: m.is_sub })),
          })),
        }))}
      />
    </main>
  );
}
