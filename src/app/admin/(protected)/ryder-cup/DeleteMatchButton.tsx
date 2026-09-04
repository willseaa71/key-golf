"use client";

import { deleteMatch } from "@/app/admin/actions/ryder-cup";

export function DeleteMatchButton({ id, label }: { id: number; label: string }) {
  return (
    <button
      onClick={() => {
        if (confirm(`Delete ${label}?`)) deleteMatch(id);
      }}
      className="text-xs text-red-500 font-medium hover:underline"
    >
      Delete
    </button>
  );
}
