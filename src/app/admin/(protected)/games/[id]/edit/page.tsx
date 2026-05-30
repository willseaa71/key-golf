import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { EditGameForm } from "./EditGameForm";

export const metadata = { title: "Edit Game — KEY Golf Admin" };

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdminAuth();

  const { id } = await params;
  const gameId = parseInt(id, 10);

  const [game, players] = await Promise.all([
    db.game.findUnique({
      where: { id: gameId },
      include: {
        teams: {
          include: { members: { include: { player: true } } },
          orderBy: { id: "asc" },
        },
      },
    }),
    db.player.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!game) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Game</h1>
      <EditGameForm game={game} players={players} />
    </div>
  );
}
