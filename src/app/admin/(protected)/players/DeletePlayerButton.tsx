"use client";

import { deletePlayer } from "@/app/admin/actions/players";

export function DeletePlayerButton({ id, name }: { id: number; name: string }) {
  const action = deletePlayer.bind(null, id);
  return (
    <form action={action} className="inline">
      <button
        type="submit"
        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
        onClick={(e) => {
          if (!confirm(`Delete ${name}? This cannot be undone.`)) e.preventDefault();
        }}
      >
        Delete
      </button>
    </form>
  );
}
