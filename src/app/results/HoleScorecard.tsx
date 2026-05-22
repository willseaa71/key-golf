// Server Component — no "use client" needed
import { holePar, halfPar, fmtVsPar } from "@/lib/course";

type HoleScorecardProps = {
  holes: { hole_number: number; strokes: number }[];
  courseHalf: string; // "front9" | "back9"
  holeAvgs: Record<number, number>; // avg per hole across all rounds (may be empty)
  total: number;
};

/** Golf-standard cell coloring relative to par */
function parCellClass(diff: number): string {
  if (diff <= -2) return "bg-yellow-100 text-yellow-700 font-bold"; // Eagle or better
  if (diff === -1) return "bg-[#006747]/10 text-[#006747] font-semibold"; // Birdie
  if (diff === 0)  return "text-gray-700"; // Par
  if (diff === 1)  return "bg-red-50 text-red-500"; // Bogey
  return "bg-red-100 text-red-700 font-bold"; // Double bogey+
}

export function HoleScorecard({ holes, courseHalf, holeAvgs, total }: HoleScorecardProps) {
  const isBack9 = courseHalf === "back9";
  const offset  = isBack9 ? 9 : 0;
  const sorted  = [...holes].sort((a, b) => a.hole_number - b.hole_number);
  const hasAvgs = Object.keys(holeAvgs).length > 0;
  const parTotal = halfPar(courseHalf);
  const totalDiff = total - parTotal;

  // Shared cell size classes
  const cellW   = "w-9 min-w-[2.25rem]";
  const thBase  = `text-center text-[10px] font-medium text-gray-500 border border-gray-200 px-0 py-1 ${cellW}`;
  const tdBase  = `text-center text-sm border border-gray-200 px-0 py-1.5 ${cellW}`;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        {/* ── Header row: hole numbers ── */}
        <thead>
          <tr>
            <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide border border-gray-200 px-2 py-1 bg-gray-50 whitespace-nowrap">
              HOLE
            </th>
            {sorted.map((h) => (
              <th key={h.hole_number} className={`${thBase} bg-gray-50 uppercase tracking-wide`}>
                H{h.hole_number + offset}
              </th>
            ))}
            <th className={`${thBase} bg-gray-50 uppercase tracking-wide`}>OUT</th>
          </tr>
        </thead>

        <tbody>
          {/* ── Par row ── */}
          <tr>
            <td className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide border border-gray-200 px-2 py-1 bg-gray-50/60 whitespace-nowrap">
              PAR
            </td>
            {sorted.map((h) => {
              const par = holePar(h.hole_number, courseHalf);
              return (
                <td key={h.hole_number} className={`${tdBase} text-gray-500 bg-gray-50/60`}>
                  {par}
                </td>
              );
            })}
            <td className={`${tdBase} text-gray-500 bg-gray-50/60 font-medium`}>{parTotal}</td>
          </tr>

          {/* ── Score row — colored vs par ── */}
          <tr>
            <td className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide border border-gray-200 px-2 py-1.5 whitespace-nowrap">
              SCORE
            </td>
            {sorted.map((h) => {
              const par  = holePar(h.hole_number, courseHalf);
              const diff = h.strokes - par;
              return (
                <td key={h.hole_number} className={`${tdBase} ${parCellClass(diff)}`}>
                  {h.strokes}
                </td>
              );
            })}
            {/* Total + vs-par badge */}
            <td className={`${tdBase} bg-[#006747]/8 text-[#006747] font-bold`}>
              <div className="flex flex-col items-center leading-tight">
                <span>{total}</span>
                <span className={`text-[9px] font-semibold ${totalDiff > 0 ? "text-red-500" : totalDiff < 0 ? "text-[#006747]" : "text-gray-400"}`}>
                  {fmtVsPar(totalDiff)}
                </span>
              </div>
            </td>
          </tr>

          {/* ── Avg row — only if 2+ rounds with hole data ── */}
          {hasAvgs && (
            <tr>
              <td className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide border border-gray-200 px-2 py-1.5 bg-gray-50/40 whitespace-nowrap">
                AVG
              </td>
              {sorted.map((h) => {
                const a = holeAvgs[h.hole_number];
                return (
                  <td key={h.hole_number} className={`${tdBase} text-xs text-gray-400 bg-gray-50/40`}>
                    {a !== undefined ? a.toFixed(1) : "—"}
                  </td>
                );
              })}
              <td className={`${tdBase} text-xs text-gray-400 bg-gray-50/40`}>
                {Object.values(holeAvgs).length > 0
                  ? Object.values(holeAvgs).reduce((a, b) => a + b, 0).toFixed(1)
                  : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Par legend */}
      <div className="flex flex-wrap gap-3 mt-2.5 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded flex items-center justify-center bg-yellow-100 text-yellow-700 font-bold text-[9px]">3</span>
          Eagle+
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded flex items-center justify-center bg-[#006747]/10 text-[#006747] font-semibold text-[9px]">4</span>
          Birdie
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded flex items-center justify-center bg-red-50 text-red-500 text-[9px]">5</span>
          Bogey
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded flex items-center justify-center bg-red-100 text-red-700 font-bold text-[9px]">6</span>
          Dbl+
        </span>
      </div>
    </div>
  );
}
