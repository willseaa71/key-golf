"use client";

import { useRouter } from "next/navigation";

export function WeekPicker({
  availableWeeks,
  currentWeek,
  playerId,
}: {
  availableWeeks: number[];
  currentWeek: number | null;
  playerId: number | null;
}) {
  const router = useRouter();
  const sorted = [...availableWeeks].sort((a, b) => a - b);
  const idx = currentWeek !== null ? sorted.indexOf(currentWeek) : sorted.length - 1;
  const hasPrev = idx > 0;
  const hasNext = idx < sorted.length - 1;

  function navigate(week: number) {
    const params = new URLSearchParams();
    params.set("week", String(week));
    if (playerId !== null) params.set("player", String(playerId));
    router.push(`/results?${params.toString()}`);
  }

  if (sorted.length === 0) return null;

  const displayWeek = currentWeek ?? sorted[sorted.length - 1];

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => hasPrev && navigate(sorted[idx - 1])}
        disabled={!hasPrev}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:enabled:bg-gray-50"
        aria-label="Previous week"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-black min-w-[72px] text-center">
        Week {displayWeek} <span className="text-black font-normal">of 13</span>
      </span>
      <button
        onClick={() => hasNext && navigate(sorted[idx + 1])}
        disabled={!hasNext}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 hover:enabled:bg-gray-50"
        aria-label="Next week"
      >
        ›
      </button>
    </div>
  );
}
