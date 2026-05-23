import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { updatePlayer, upsertPriorAverage, deletePriorAverage } from "@/app/admin/actions/players";

export const metadata = { title: "Edit Player — KEY Golf Admin" };

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await checkAdminAuth();
  const { id } = await params;
  const playerId = parseInt(id, 10);

  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      prior_averages: { orderBy: { season_year: "desc" } },
      _count: { select: { rounds: true } },
    },
  });

  if (!player) notFound();

  const updateAction = updatePlayer.bind(null, player.id);

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <Link href="/admin/players" className="text-sm text-[#006747] hover:underline">
          ← Back to Players
        </Link>
        <h1 className="text-2xl font-bold mt-2">{player.name}</h1>
        <p className="text-sm text-gray-400 mt-1">{player._count.rounds} rounds this season</p>
      </div>

      {/* Edit player info */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">Player Info</h2>
        <form action={updateAction} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              name="name"
              defaultValue={player.name}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                name="type"
                defaultValue={player.sub_order !== null ? "sub" : "regular"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
              >
                <option value="regular">Regular player</option>
                <option value="sub">Sub</option>
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sub priority #</label>
              <input
                name="sub_order"
                type="number"
                min="1"
                defaultValue={player.sub_order ?? ""}
                placeholder="—"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
            >
              Save Changes
            </button>
            <Link
              href="/admin/players"
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>

      {/* Prior season averages */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">Prior Season Averages</h2>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {player.prior_averages.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Year</th>
                  <th className="text-right px-4 py-2">Avg Score</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {player.prior_averages.map((avg) => {
                  const upsertAction = upsertPriorAverage.bind(null, player.id);
                  const deleteAction = deletePriorAverage.bind(null, player.id, avg.season_year);
                  return (
                    <tr key={avg.season_year} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium">{avg.season_year}</td>
                      <td className="px-4 py-2.5 text-right">
                        <form action={upsertAction} className="flex items-center justify-end gap-2">
                          <input type="hidden" name="year" value={avg.season_year} />
                          <input
                            name="average"
                            type="number"
                            step="0.1"
                            defaultValue={avg.average.toFixed(1)}
                            className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
                          />
                          <button type="submit" className="text-xs text-[#006747] font-medium hover:underline">
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <form action={deleteAction}>
                          <button type="submit" className="text-xs text-red-400 hover:text-red-600 font-medium">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-400">No prior averages on record.</p>
          )}

          {/* Add new average */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
            <p className="text-xs font-medium text-gray-500 mb-2">Add / update year</p>
            <form action={upsertPriorAverage.bind(null, player.id)} className="flex items-center gap-2">
              <input
                name="year"
                type="number"
                min="2020"
                max="2030"
                placeholder="Year"
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
                required
              />
              <input
                name="average"
                type="number"
                step="0.1"
                min="0"
                placeholder="Avg"
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
                required
              />
              <button
                type="submit"
                className="px-3 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
