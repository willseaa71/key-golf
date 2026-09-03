import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { upsertSeason } from "@/app/admin/actions/seasons";

export const metadata = { title: "Seasons — KEY Golf Admin" };

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SeasonsPage() {
  await checkAdminAuth();

  const seasons = await db.season.findMany({
    orderBy: { start_date: "desc" },
    include: { _count: { select: { rounds: true } } },
  });

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-2xl font-bold">Seasons</h1>

      {/* Existing seasons */}
      {seasons.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">All Seasons</h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Dates</th>
                  <th className="text-center px-4 py-2">Rounds</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seasons.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-400">{s._count.rounds}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/seasons/${s.id}/edit`}
                        className="text-xs text-[#006747] font-medium hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Create / edit season */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">
          Create New Season
        </h2>
        <form action={upsertSeason} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Season name</label>
            <input
              name="name"
              required
              placeholder="e.g. 2026 Season"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Start date</label>
              <input
                name="start_date"
                type="date"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">End date</label>
              <input
                name="end_date"
                type="date"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
          >
            Create Season
          </button>
        </form>
      </section>
    </div>
  );
}
