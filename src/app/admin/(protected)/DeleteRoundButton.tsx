"use client";

import { deleteRound } from "@/app/admin/actions/rounds";

export function DeleteRoundButton({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const action = deleteRound.bind(null, id);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete ${label}?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="text-xs text-red-500 font-medium hover:underline">
        Delete
      </button>
    </form>
  );
}
