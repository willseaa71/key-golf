import Link from "next/link";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { togglePlayerActive, addPlayer } from "@/app/admin/actions/players";
import { DeletePlayerButton } from "./DeletePlayerButton";

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
    const canDelete = player._count.rounds === 0;

    return (
      <tr className={`hover:bg-gray-50 ${!player.active ? "opacity-40" : ""}`}>
        <td className="px-4 py-2.5 font-medium">
          {player.name}
          {player.sub_order !== null && (
            <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
              SUB {player.sub_order}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5 text-gray-400 text-sm text-center">
          {player._count.rounds}
        </td>
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/admin/players/${player.id}`}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-[#006747] hover:text-[#006747]"
            >
              Edit
            </Link>
            <form action={toggleAction} className="inline">
              <button
                type="submit"
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                  player.active
                    ? "border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-500"
                    : "border-[#006747] text-[#006747]"
                }`}
              >
                {player.active ? "Deactivate" : "Activate"}
              </button>
            </form>
            {canDelete && (
              <DeletePlayerButton id={player.id} name={player.name} />
            )}
          </div>
        </td>
      </tr>
    );
  }

  function PlayerTable({ title, rows }: { title: string; rows: (typeof players) }) {
    if (rows.length === 0) return null;
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

      {/* Add Player */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2">Add Player</h2>
        <form action={addPlayer} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              name="name"
              required
              placeholder="Full name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
            <select
              name="type"
              defaultValue="regular"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            >
              <option value="regular">Regular player</option>
              <option value="sub">Sub</option>
            </select>
            <input
              name="sub_order"
              type="number"
              min="1"
              placeholder="Sub #"
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400">Sub # only required when type is Sub. Smaller number = higher priority.</p>
        </form>
      </section>

      <PlayerTable title="League Players" rows={regulars} />
      <PlayerTable title="Subs" rows={subs} />
    </div>
  );
}
