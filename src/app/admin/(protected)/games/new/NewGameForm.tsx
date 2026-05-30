"use client";

import { useActionState, useState } from "react";
import { createGame, type CreateGameState } from "@/app/admin/actions/games";

type Player = {
  id: number;
  name: string;
  sub_order: number | null;
};

type TeamMember = {
  player_id: number;
  is_sub: boolean;
};

type Team = {
  name: string;
  members: TeamMember[];
};

export function NewGameForm({ players }: { players: Player[] }) {
  const [teams, setTeams] = useState<Team[]>([
    { name: "Team 1", members: [] },
    { name: "Team 2", members: [] },
  ]);

  // Wrap createGame to inject teams JSON into FormData
  const actionWithTeams = async (prev: CreateGameState, formData: FormData) => {
    formData.set("teams", JSON.stringify(teams));
    return createGame(prev, formData);
  };

  const [state, formAction, pending] = useActionState<CreateGameState, FormData>(
    actionWithTeams,
    {}
  );

  // All player IDs already assigned to any team
  const assignedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.player_id)));

  function addTeam() {
    setTeams((prev) => [...prev, { name: `Team ${prev.length + 1}`, members: [] }]);
  }

  function removeTeam(idx: number) {
    setTeams((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTeamName(idx: number, name: string) {
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, name } : t)));
  }

  function addMember(teamIdx: number, playerId: number) {
    setTeams((prev) =>
      prev.map((t, i) =>
        i === teamIdx
          ? { ...t, members: [...t.members, { player_id: playerId, is_sub: false }] }
          : t
      )
    );
  }

  function removeMember(teamIdx: number, playerId: number) {
    setTeams((prev) =>
      prev.map((t, i) =>
        i === teamIdx
          ? { ...t, members: t.members.filter((m) => m.player_id !== playerId) }
          : t
      )
    );
  }

  function toggleSub(teamIdx: number, playerId: number) {
    setTeams((prev) =>
      prev.map((t, i) =>
        i === teamIdx
          ? {
              ...t,
              members: t.members.map((m) =>
                m.player_id === playerId ? { ...m, is_sub: !m.is_sub } : m
              ),
            }
          : t
      )
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}

      {/* Game details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Game Details
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Game name</label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Week 4 Best Ball"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#006747]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#006747]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ruleset</label>
          <select
            name="ruleset_type"
            defaultValue="BEST_BALL"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
          >
            <option value="BEST_BALL">Best Ball</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="is_major"
            id="is_major"
            className="w-4 h-4 accent-[#C9A84C]"
          />
          <label htmlFor="is_major" className="text-sm font-medium text-gray-700">
            Major event{" "}
            <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
              MAJOR
            </span>
          </label>
        </div>
      </div>

      {/* Team builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Teams
          </h2>
          <button
            type="button"
            onClick={addTeam}
            className="text-sm text-[#006747] font-medium hover:underline"
          >
            + Add Team
          </button>
        </div>

        {teams.map((team, teamIdx) => {
          // Players not yet assigned anywhere, or already on this team
          const available = players.filter(
            (p) => !assignedIds.has(p.id) || team.members.some((m) => m.player_id === p.id)
          );
          const unassigned = available.filter(
            (p) => !team.members.some((m) => m.player_id === p.id)
          );

          return (
            <div
              key={teamIdx}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
              {/* Team header */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => updateTeamName(teamIdx, e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#006747]"
                  placeholder="Team name"
                />
                {teams.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeTeam(teamIdx)}
                    className="text-xs text-red-500 hover:underline shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Members */}
              {team.members.length > 0 && (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                  {team.members.map((member) => {
                    const player = players.find((p) => p.id === member.player_id)!;
                    return (
                      <div
                        key={member.player_id}
                        className="flex items-center gap-3 px-3 py-2 bg-gray-50/50"
                      >
                        <span className="flex-1 text-sm font-medium text-gray-800">
                          {player.name}
                          {player.sub_order !== null && (
                            <span className="ml-1.5 text-[10px] font-medium text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">
                              SUB {player.sub_order}
                            </span>
                          )}
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500">
                          <input
                            type="checkbox"
                            checked={member.is_sub}
                            onChange={() => toggleSub(teamIdx, member.player_id)}
                            className="w-3.5 h-3.5"
                          />
                          Sub
                        </label>
                        <button
                          type="button"
                          onClick={() => removeMember(teamIdx, member.player_id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add player dropdown */}
              {unassigned.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const id = parseInt(e.target.value, 10);
                    if (id) addMember(teamIdx, id);
                    e.target.value = "";
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
                >
                  <option value="">+ Add player…</option>
                  {unassigned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sub_order !== null ? ` (Sub ${p.sub_order})` : ""}
                    </option>
                  ))}
                </select>
              )}

              {unassigned.length === 0 && team.members.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  All players are assigned — remove one from another team to add them here.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="/admin/games"
          className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium text-center"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-3 rounded-xl bg-[#006747] text-white font-semibold text-sm disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Game"}
        </button>
      </div>
    </form>
  );
}
