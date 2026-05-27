"use client";

import { useState } from "react";

export function CollapsibleAchievementCard({
  icon,
  title,
  description,
  earners,
  accent,
  collapseAfter,
}: {
  icon: string;
  title: string;
  description: string;
  earners: { name: string; detail?: string }[];
  accent: "gold" | "green" | "blue" | "slate";
  collapseAfter: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const border = {
    gold: "border-[#C9A84C]/40 bg-[#C9A84C]/5",
    green: "border-[#006747]/30 bg-[#006747]/5",
    blue: "border-blue-200 bg-blue-50/50",
    slate: "border-gray-200 bg-gray-50/50",
  }[accent];

  const iconBg = {
    gold: "bg-[#C9A84C]/15 text-[#C9A84C]",
    green: "bg-[#006747]/10 text-[#006747]",
    blue: "bg-blue-100 text-blue-600",
    slate: "bg-gray-100 text-gray-500",
  }[accent];

  const visible = expanded ? earners : earners.slice(0, collapseAfter);
  const remaining = earners.length - collapseAfter;

  return (
    <div className={`rounded-xl border p-4 ${border}`}>
      <div className="flex items-start gap-3">
        <span className={`text-xl w-9 h-9 flex items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          <div className="mt-2 space-y-0.5">
            {visible.map((e, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-gray-800">{e.name}</span>
                {e.detail && (
                  <span className="text-xs text-gray-400">{e.detail}</span>
                )}
              </div>
            ))}
            {!expanded && remaining > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-[#006747] font-medium mt-1 hover:underline"
              >
                and {remaining} more
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
