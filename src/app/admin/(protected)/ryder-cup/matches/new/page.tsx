import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { createMatch } from "@/app/admin/actions/ryder-cup";

export const metadata = { title: "New Match — KEY Golf Admin" };

export default async function NewMatchPage() {
  await checkAdminAuth();

  const season = await db.season.findFirst({
    where: { start_date: { lte: new Date() }, end_date: { gte: new Date() } },
  });
  if (!season) return <p className="text-gray-500">No active season.</p>;

  const teams = await db.ryderCupTeam.findMany({
    where: { season_id: season.id },
    orderBy: { id: "asc" },
  });
  if (teams.length < 2) return <p className="text-gray-500">Set up teams first.</p>;

  const [teamA, teamB] = teams;
  const createMatchWithSeason = createMatch.bind(null, season.id);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">New Ryder Cup Match</h1>
      <form action={createMatchWithSeason} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <input type="hidden" name="team_a_id" value={teamA.id} />
        <input type="hidden" name="team_b_id" value={teamB.id} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Week number</label>
          <input name="week_number" type="number" required min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
          <input name="format" required placeholder="e.g. Singles, Fourball, Scramble" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">{teamA.name} points</label>
            <input name="team_a_points" type="number" step="0.5" min={0} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">{teamB.name} points</label>
            <input name="team_b_points" type="number" step="0.5" min={0} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
          <textarea name="notes" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30" />
        </div>
        <button type="submit" className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]">
          Save Match
        </button>
      </form>
    </div>
  );
}
