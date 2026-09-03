import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { updateSeason } from "@/app/admin/actions/seasons";

export const metadata = { title: "Edit Season — KEY Golf Admin" };

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await checkAdminAuth();
  const { id } = await params;
  const season = await db.season.findUnique({ where: { id: Number(id) } });
  if (!season) notFound();

  const updateSeasonWithId = updateSeason.bind(null, season.id);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Season</h1>
        <Link href="/admin/seasons" className="text-sm text-[#006747] font-medium hover:underline">
          ← Back to Seasons
        </Link>
      </div>
      <form action={updateSeasonWithId} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Season name</label>
          <input
            name="name"
            required
            defaultValue={season.name}
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
              defaultValue={fmtDate(season.start_date)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">End date</label>
            <input
              name="end_date"
              type="date"
              required
              defaultValue={fmtDate(season.end_date)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Changing the start date after rounds have been logged this season
          may shift which week those rounds display under.
        </p>
        <button
          type="submit"
          className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
