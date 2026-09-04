import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { DeleteMatchButton } from "./DeleteMatchButton";

export const metadata = { title: "Ryder Cup — KEY Golf Admin" };

export default async function RyderCupAdminPage() {
  await checkAdminAuth();

  const season = await db.season.findFirst({
    where: { start_date: { lte: new Date() }, end_date: { gte: new Date() } },
  });
  if (!season) {
    return <p className="text-gray-500">No active season.</p>;
  }

  const teams = await db.ryderCupTeam.findMany({
    where: { season_id: season.id },
    orderBy: { id: "asc" },
    include: { members: { include: { player: true } } },
  });

  if (teams.length < 2) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="text-2xl font-bold">Ryder Cup</h1>
        <p className="text-sm text-gray-500">Teams haven't been set up yet for this season.</p>
        <Link href="/admin/ryder-cup/teams" className="inline-block px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]">
          Set Up Teams
        </Link>
      </div>
    );
  }

  const [teamA, teamB] = teams;
  const matches = await db.ryderCupMatch.findMany({
    where: { season_id: season.id },
    orderBy: { week_number: "asc" },
  });
  const totalA = matches.reduce((sum, m) => sum + m.team_a_points, 0);
  const totalB = matches.reduce((sum, m) => sum + m.team_b_points, 0);

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ryder Cup</h1>
        <Link href="/admin/ryder-cup/teams" className="text-sm text-[#006747] font-medium hover:underline">
          Manage Rosters
        </Link>
      </div>

      <div className="rounded-xl border-2 border-[#C9A84C] bg-[#C9A84C]/5 px-5 py-4 flex items-center justify-between">
        <div className="text-center flex-1">
          <p className="text-sm font-semibold text-gray-700">{teamA.name}</p>
          <p className="text-3xl font-bold text-[#006747]">{totalA}</p>
          <p className="text-xs text-gray-400 mt-1">{teamA.members.map((m) => m.player.name).join(", ")}</p>
        </div>
        <span className="text-gray-300 font-bold text-lg px-2">–</span>
        <div className="text-center flex-1">
          <p className="text-sm font-semibold text-gray-700">{teamB.name}</p>
          <p className="text-3xl font-bold text-[#006747]">{totalB}</p>
          <p className="text-xs text-gray-400 mt-1">{teamB.members.map((m) => m.player.name).join(", ")}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Matches</h2>
          <Link href="/admin/ryder-cup/matches/new" className="text-sm text-[#006747] font-medium hover:underline">
            + Add Match
          </Link>
        </div>
        {matches.length === 0 ? (
          <p className="text-gray-400 text-sm">No matches logged yet.</p>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Week</th>
                  <th className="text-left px-4 py-2">Format</th>
                  <th className="text-right px-4 py-2">{teamA.name}</th>
                  <th className="text-right px-4 py-2">{teamB.name}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matches.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">R{m.week_number}</td>
                    <td className="px-4 py-2.5 text-gray-500">{m.format}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{m.team_a_points}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{m.team_b_points}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/admin/ryder-cup/matches/${m.id}/edit`} className="text-xs text-[#006747] font-medium hover:underline">
                          Edit
                        </Link>
                        <DeleteMatchButton id={m.id} label={`the R${m.week_number} ${m.format} match`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
