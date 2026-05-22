import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { EditRoundForm } from "./EditRoundForm";

export const metadata = { title: "Edit Round — KEY Golf Admin" };

export default async function EditRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdminAuth();
  const { id } = await params;
  const round = await db.round.findUnique({
    where: { id: parseInt(id, 10) },
    include: { player: true },
  });
  if (!round) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">
          Week {round.week_number}
        </p>
        <h1 className="text-2xl font-bold">Edit Round</h1>
        <p className="text-sm text-gray-500 mt-0.5">{round.player.name}</p>
      </div>
      <EditRoundForm round={round} />
    </div>
  );
}
