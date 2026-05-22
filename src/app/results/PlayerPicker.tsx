"use client";

import { useRouter } from "next/navigation";

type Player = { id: number; name: string; sub_order: number | null };

export function PlayerPicker({
  players,
  currentPlayerId,
  weekNumber,
}: {
  players: Player[];
  currentPlayerId: number | null;
  weekNumber: number | null;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const weekParam = weekNumber !== null ? `&week=${weekNumber}` : "";
    router.push(id ? `/results?player=${id}${weekParam}` : `/results${weekNumber !== null ? `?week=${weekNumber}` : ""}`);
  }

  const regulars = players.filter((p) => p.sub_order === null);
  const subs = players.filter((p) => p.sub_order !== null).sort((a, b) => a.sub_order! - b.sub_order!);

  return (
    <select
      value={currentPlayerId ?? ""}
      onChange={handleChange}
      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
    >
      <option value="">Select a player…</option>
      <optgroup label="Players">
        {regulars.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </optgroup>
      <optgroup label="Subs">
        {subs.map((p) => (
          <option key={p.id} value={p.id}>Sub {p.sub_order} · {p.name}</option>
        ))}
      </optgroup>
    </select>
  );
}
