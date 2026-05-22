"use client";

import { useActionState } from "react";
import { updateRound, type RoundEditState } from "@/app/admin/actions/rounds";

type Round = {
  id: number;
  total_score: number;
  course_half: string;
  date: Date;
  week_number: number;
  player: { name: string };
};

export function EditRoundForm({ round }: { round: Round }) {
  const boundAction = updateRound.bind(null, round.id);
  const [state, formAction, pending] = useActionState<RoundEditState, FormData>(boundAction, {});

  const dateStr = new Date(round.date).toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total score</label>
          <input
            type="number"
            name="total_score"
            defaultValue={round.total_score}
            min={9} max={99}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#006747]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course half</label>
          <select
            name="course_half"
            defaultValue={round.course_half}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
          >
            <option value="front9">Front-9</option>
            <option value="back9">Back-9</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={dateStr}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#006747]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Week number</label>
          <input
            type="number"
            name="week_number"
            defaultValue={round.week_number}
            min={1} max={13}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#006747]"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <a
          href="/admin"
          className="flex-1 py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium text-center"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-3 rounded-xl bg-[#006747] text-white font-semibold text-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
