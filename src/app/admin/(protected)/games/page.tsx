import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";

export const metadata = { title: "Games — KEY Golf Admin" };

export default async function GamesPage() {
  await checkAdminAuth();

  const games = await db.game.findMany({
    orderBy: { date: "desc" },
    include: {
      teams: { where: { is_winner: true }, take: 1 },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Games</h1>
        <Link
          href="/admin/games/new"
          className="px-4 py-2 rounded-lg bg-[#006747] text-white text-sm font-medium hover:bg-[#005236]"
        >
          New Game
        </Link>
      </div>

      {games.length === 0 && (
        <p className="text-sm text-gray-400">No games yet.</p>
      )}

      {games.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Ruleset</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Winner</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {games.map((game) => {
                const winner = game.teams[0] ?? null;
                return (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">
                      {game.name}
                      {game.is_major && (
                        <span className="ml-1.5 text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                          MAJOR
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(game.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {game.ruleset_type === "BEST_BALL" ? "Best Ball" : game.ruleset_type}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          game.status === "COMPLETE"
                            ? "bg-[#006747]/10 text-[#006747]"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {game.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {winner?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/games/${game.id}`}
                        className="text-xs text-[#006747] font-medium hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
