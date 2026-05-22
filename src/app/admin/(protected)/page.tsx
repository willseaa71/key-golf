import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { DeleteRoundButton } from "./DeleteRoundButton";

export const metadata = { title: "Admin — KEY Golf" };

export default async function AdminPage() {
  await checkAdminAuth();

  const rounds = await db.round.findMany({
    include: { player: true, season: true },
    orderBy: [{ week_number: "desc" }, { player: { name: "asc" } }],
  });

  // Group by week
  const byWeek = new Map<number, typeof rounds>();
  for (const r of rounds) {
    if (!byWeek.has(r.week_number)) byWeek.set(r.week_number, []);
    byWeek.get(r.week_number)!.push(r);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rounds</h1>
        <span className="text-sm text-gray-500">{rounds.length} total</span>
      </div>

      {weeks.length === 0 && (
        <p className="text-gray-400 text-sm">No rounds submitted yet.</p>
      )}

      {weeks.map((week) => (
        <section key={week}>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Week {week}
          </h2>
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-left px-4 py-2">Half</th>
                  <th className="text-right px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byWeek.get(week)!.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">
                        {r.player.name}
                        {r.player.sub_order !== null && (
                          <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                            SUB {r.player.sub_order}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {r.course_half === "front9" ? "Front-9" : "Back-9"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">{r.total_score}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {new Date(r.date).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/rounds/${r.id}/edit`}
                            className="text-xs text-[#006747] font-medium hover:underline"
                          >
                            Edit
                          </Link>
                          <DeleteRoundButton
                            id={r.id}
                            label={`${r.player.name}'s Week ${week} score`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
