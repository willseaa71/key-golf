import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { updateMatch } from "@/app/admin/actions/ryder-cup";

export const metadata = { title: "Edit Match — KEY Golf Admin" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  await checkAdminAuth();
  const { id } = await params;
  const match = await db.ryderCupMatch.findUnique({ where: { id: Number(id) } });
  if (!match) notFound();

  const teamA = await db.ryderCupTeam.findUnique({ where: { id: match.team_a_id } });
  const teamB = await db.ryderCupTeam.findUnique({ where: { id: match.team_b_id } });
  const updateMatchWithId = updateMatch.bind(null, match.id);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Edit Match</h1>
      <form action={updateMatchWithId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Week number</label>
          <input name="week_number" type="number" required min={1} defaultValue={match.week_number} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
          <input name="format" required defaultValue={match.format} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">{teamA?.name ?? "Team A"} points</label>
            <input name="team_a_points" type="number" step="0.5" min={0} required defaultValue={match.team_a_points} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">{teamB?.name ?? "Team B"} points</label>
            <input name="team_b_points" type="number" step="0.5" min={0} required defaultValue={match.team_b_points} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
          <textarea name="notes" rows={2} defaultValue={match.notes ?? ""} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <button type="submit" className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]">
          Save Changes
        </button>
      </form>
    </div>
  );
}
