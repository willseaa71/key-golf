"use client";

import { useState } from "react";
import { setupTeams } from "@/app/admin/actions/ryder-cup";

type Player = { id: number; name: string };
type ExistingTeam = { id: number; name: string; memberIds: number[] };

export function TeamsForm({
  seasonId,
  players,
  teamA,
  teamB,
}: {
  seasonId: number;
  players: Player[];
  teamA: ExistingTeam | null;
  teamB: ExistingTeam | null;
}) {
  const [nameA, setNameA] = useState(teamA?.name ?? "");
  const [nameB, setNameB] = useState(teamB?.name ?? "");
  const [aIds, setAIds] = useState<number[]>(teamA?.memberIds ?? []);
  const [bIds, setBIds] = useState<number[]>(teamB?.memberIds ?? []);

  const setupTeamsWithSeason = setupTeams.bind(null, seasonId);

  function toggleA(id: number) {
    setAIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setBIds((prev) => prev.filter((x) => x !== id));
  }
  function toggleB(id: number) {
    setBIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setAIds((prev) => prev.filter((x) => x !== id));
  }

  return (
    <form action={setupTeamsWithSeason} className="space-y-6">
      <input type="hidden" name="team_a_id" value={teamA?.id ?? ""} />
      <input type="hidden" name="team_b_id" value={teamB?.id ?? ""} />
      {aIds.map((id) => (
        <input key={`a-${id}`} type="hidden" name="team_a_players" value={id} />
      ))}
      {bIds.map((id) => (
        <input key={`b-${id}`} type="hidden" name="team_b_players" value={id} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <input
            name="team_a_name"
            required
            value={nameA}
            onChange={(e) => setNameA(e.target.value)}
            placeholder="Team A name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
          />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                <input
                  type="checkbox"
                  checked={aIds.includes(p.id)}
                  onChange={() => toggleA(p.id)}
                  className="rounded border-gray-300"
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <input
            name="team_b_name"
            required
            value={nameB}
            onChange={(e) => setNameB(e.target.value)}
            placeholder="Team B name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#006747]/30"
          />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                <input
                  type="checkbox"
                  checked={bIds.includes(p.id)}
                  onChange={() => toggleB(p.id)}
                  className="rounded border-gray-300"
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-[#006747] text-white text-sm font-medium rounded-lg hover:bg-[#005236]"
      >
        Save Teams
      </button>
    </form>
  );
}
