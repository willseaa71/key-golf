import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { NewGameForm } from "./NewGameForm";

export const metadata = { title: "New Game — KEY Golf Admin" };

export default async function NewGamePage() {
  await checkAdminAuth();

  const players = await db.player.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Game</h1>
      <NewGameForm players={players} />
    </div>
  );
}
