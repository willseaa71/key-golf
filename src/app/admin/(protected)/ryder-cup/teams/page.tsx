import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { TeamsForm } from "./TeamsForm";

export const metadata = { title: "Ryder Cup Teams — KEY Golf Admin" };

export default async function RyderCupTeamsPage() {
  await checkAdminAuth();

  const season = await db.season.findFirst({
    where: { start_date: { lte: new Date() }, end_date: { gte: new Date() } },
  });
  if (!season) {
    return <p className="text-gray-500">No active season.</p>;
  }

  const players = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const existingTeams = await db.ryderCupTeam.findMany({
    where: { season_id: season.id },
    orderBy: { id: "asc" },
    include: { members: true },
  });

  const teamA = existingTeams[0]
    ? { id: existingTeams[0].id, name: existingTeams[0].name, memberIds: existingTeams[0].members.map((m) => m.player_id) }
    : null;
  const teamB = existingTeams[1]
    ? { id: existingTeams[1].id, name: existingTeams[1].name, memberIds: existingTeams[1].members.map((m) => m.player_id) }
    : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Ryder Cup — Teams</h1>
      <p className="text-sm text-gray-500">
        Assign every player to one of the two teams. Saving replaces the current
        rosters — existing logged matches aren't affected.
      </p>
      <TeamsForm seasonId={season.id} players={players} teamA={teamA} teamB={teamB} />
    </div>
  );
}
