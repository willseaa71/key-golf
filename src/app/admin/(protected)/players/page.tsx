import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { togglePlayerActive } from "@/app/admin/actions/players";

export const metadata = { title: "Players — KEY Golf Admin" };

export default async function PlayersPage() {
  await checkAdminAuth();

  const players = await db.player.findMany({
    orderBy: [{ sub_order: "asc" }, { name: "asc" }],
    include: { _count: { select: { rounds: true } } },
  });

  const regulars = players.filter((p) => p.sub_order === null);
  const subs = players.filter((p) => p.sub_order !== null);

  function PlayerRow({ player }: { player: (typeof players)[0] }) {
    const toggleAction = togglePlayerActive.bind(null, player.id, player.active);
    return (
      <tr className={`hover:bg-gray-50 ${!player.active ? "opacity-40" : ""}`}>
        <td className="px-4 py-2.5 font-medium">{player.name}</td>
        <td className="px-4 py-2.5 text-gray-400 text-sm text-center">
          {player._count.rounds}
        </td>
        <td className="px-4 py-2.5 text-right">
          <form action={toggleAction}>
            <button
              type="submit"
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                player.active
                  ? "border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500"
                  : "border-[#006747] text-[#006747]"
              }`}
            >
              {player.active ? "Deactivate" : "Activate"}
            </button>
          </form>
        </td>
      </tr>
    );
  }

  function PlayerTable({ title, rows }: { title: string; rows: (typeof players) }) {
    return (
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">{title}</h2>
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-center px-4 py-2">Rounds</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => <PlayerRow key={p.id} player={p} />)}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Players</h1>
      <PlayerTable title="League Players" rows={regulars} />
      <PlayerTable title="Subs" rows={subs} />
    </div>
  );
}
