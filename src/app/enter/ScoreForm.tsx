"use client";

import Link from "next/link";
import { holePar } from "@/lib/course";
import { useActionState, useRef, useState } from "react";
import { submitRound, type RoundFormState } from "@/app/actions/rounds";

type Player = { id: number; name: string; sub_order: number | null };
type Season = { id: number; name: string; start_date: string; end_date: string };
type ActiveGameMember = { player_id: number; is_sub: boolean };
type ActiveGameTeam = { id: number; name: string; members: ActiveGameMember[] };
type ActiveGame = { id: number; status: string; is_major?: boolean; teams: ActiveGameTeam[] };

const TOTAL_WEEKS = 13;

function computeWeekNumber(dateStr: string, seasonStart: string): number {
  const date = new Date(dateStr + "T12:00:00Z");
  const start = new Date(seasonStart);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.min(TOTAL_WEEKS, Math.max(1, Math.floor((date.getTime() - start.getTime()) / msPerWeek) + 1));
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_HOLES = Array(9).fill("") as string[];

export function ScoreForm({
  players,
  season,
  activeGame,
}: {
  players: Player[];
  season: Season;
  activeGame: ActiveGame | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<RoundFormState, FormData>(
    submitRound,
    {}
  );

  const [playerId, setPlayerId] = useState<string>("");
  const [date, setDate] = useState<string>(todayString());
  const [courseHalf, setCourseHalf] = useState<"front9" | "back9">("front9");
  const [mode, setMode] = useState<"hole" | "total">("hole");
  const [holes, setHoles] = useState<string[]>(EMPTY_HOLES);
  const [totalScore, setTotalScore] = useState<string>("");
  const [view, setView] = useState<"form" | "confirm">("form");
  const [clientError, setClientError] = useState<string>("");
  const [puttOffWinner, setPuttOffWinner] = useState<boolean>(false);

  const weekNumber = computeWeekNumber(date, season.start_date);
  const holeTotal = holes.reduce((sum, h) => sum + (parseInt(h, 10) || 0), 0);
  const selectedPlayer = players.find((p) => p.id === parseInt(playerId, 10));
  const courseHalfLabel = courseHalf === "front9" ? "Front-9" : courseHalf === "back9" ? "Back-9" : "";

  // Derive which game team (if any) the selected player is on
  const playerNumId = parseInt(playerId, 10);
  const playerTeam = activeGame?.teams.find((t) =>
    t.members.some((m) => m.player_id === playerNumId)
  ) ?? null;

  function handleHoleChange(index: number, value: string) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setClientError("");

    if (!playerId) return setClientError("Please select a player.");
    if (!date) return setClientError("Please pick a date.");

    if (mode === "hole") {
      for (let i = 0; i < 9; i++) {
        const v = parseInt(holes[i], 10);
        if (!holes[i] || isNaN(v) || v < 1 || v > 20) {
          return setClientError(`Enter a valid score (1–20) for hole ${i + 1}.`);
        }
      }
    } else {
      const v = parseInt(totalScore, 10);
      if (isNaN(v) || v < 9 || v > 99) {
        return setClientError("Total score must be between 9 and 99.");
      }
    }

    setView("confirm");
  }

  function handleConfirm() {
    formRef.current?.requestSubmit();
  }

  function handleReset() {
    setPlayerId("");
    setDate(todayString());
    setCourseHalf("front9");
    setMode("hole");
    setHoles(EMPTY_HOLES);
    setTotalScore("");
    setView("form");
    setClientError("");
    setPuttOffWinner(false);
  }

  const serverError = state.error;

  return (
    <>
    <div className="mb-8">
      <h1 className="text-2xl font-bold">{view === "confirm" ? "Confirm" : "Enter Score"}</h1>
    </div>
    <form ref={formRef} action={formAction} noValidate>
      {/* Hidden fields */}
      <input type="hidden" name="season_id" value={season.id} />
      <input type="hidden" name="week_number" value={weekNumber} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="course_half" value={courseHalf} />
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="date" value={date} />
      {mode === "hole" &&
        holes.map((h, i) => (
          <input key={i} type="hidden" name={`hole_${i + 1}`} value={h} />
        ))}
      {mode === "total" && (
        <input type="hidden" name="total_score" value={totalScore} />
      )}
      {/* Game-aware hidden fields */}
      {activeGame && playerTeam && (
        <>
          <input type="hidden" name="game_id" value={activeGame.id} />
          <input type="hidden" name="team_id" value={playerTeam.id} />
          <input type="hidden" name="putt_off_winner" value={puttOffWinner ? "true" : ""} />
        </>
      )}

      {view === "form" ? (
        <div className="space-y-6">
          {/* Player */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player
            </label>
            <select
              value={playerId}
              onChange={(e) => { setPlayerId(e.target.value); setPuttOffWinner(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
            >
              <option value="">Select a player…</option>
              <optgroup label="Players">
                {players.filter((p) => p.sub_order === null).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="Subs">
                {players.filter((p) => p.sub_order !== null).sort((a, b) => a.sub_order! - b.sub_order!).map((p) => (
                  <option key={p.id} value={p.id}>Sub {p.sub_order} · {p.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* TEMP DEBUG — remove after confirming game lookup works */}
          <p className="text-[11px] text-gray-400">
            {activeGame
              ? `⚑ Game ${activeGame.id} · ${activeGame.teams.flatMap(t => t.members).length} members · you: ${playerId || "none"} → team: ${playerTeam?.name ?? "not matched"}`
              : "⚑ No game found for today"}
          </p>

          {/* Team (read-only, game-aware) */}
          {playerTeam && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team
              </label>
              <div className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base bg-gray-50 text-gray-700 flex items-center gap-2">
                <span className="font-medium">{playerTeam.name}</span>
                {activeGame?.is_major && (
                  <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                    MAJOR
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Putt-off winner toggle (PENDING games only) */}
          {playerTeam && activeGame?.status === "PENDING" && (
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={puttOffWinner}
                onChange={(e) => setPuttOffWinner(e.target.checked)}
                className="w-4 h-4 accent-[#C9A84C]"
              />
              <span className="text-sm font-medium text-gray-700">I won the putt-off</span>
            </label>
          )}

          {/* Date + derived week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of round
            </label>
            <input
              type="date"
              value={date}
              min={season.start_date.slice(0, 10)}
              max={season.end_date.slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#006747]"
            />
          </div>

          {/* Front-9 / Back-9 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Course half
            </label>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setCourseHalf("front9")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  courseHalf === "front9"
                    ? "bg-[#006747] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Front-9
              </button>
              <button
                type="button"
                onClick={() => setCourseHalf("back9")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  courseHalf === "back9"
                    ? "bg-[#006747] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Back-9
              </button>
            </div>
          </div>

          {/* Score type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Score type
            </label>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode("hole")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === "hole"
                    ? "bg-[#006747] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Hole-by-hole
              </button>
              <button
                type="button"
                onClick={() => setMode("total")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === "total"
                    ? "bg-[#006747] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Total only
              </button>
            </div>
          </div>

          {/* Hole grid */}
          {mode === "hole" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hole scores
              </label>
              <div className="grid grid-cols-3 gap-2">
                {holes.map((h, i) => {
                  const holeNum = i + 1;
                  const par = courseHalf ? holePar(holeNum, courseHalf) : null;
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-0.5">
                        H{holeNum}
                        {par !== null && (
                          <span className="text-gray-400"> · p{par}</span>
                        )}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        value={h}
                        onChange={(e) => handleHoleChange(i, e.target.value)}
                        placeholder="—"
                        className="w-full border border-gray-300 rounded-lg text-center text-xl font-bold py-3 focus:outline-none focus:ring-2 focus:ring-[#006747]"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-right">
                <span className="text-sm text-gray-500">Total: </span>
                <span className="text-2xl font-bold text-gray-900">
                  {holeTotal > 0 ? holeTotal : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Total score input */}
          {mode === "total" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total score (strokes)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={9}
                max={99}
                value={totalScore}
                onChange={(e) => setTotalScore(e.target.value)}
                placeholder="e.g. 42"
                className="w-full border border-gray-300 rounded-lg px-3 py-4 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#006747]"
              />
            </div>
          )}

          {/* Errors */}
          {clientError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {clientError}
            </p>
          )}
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <button
            onClick={handleReview}
            className="w-full py-4 rounded-xl bg-[#006747] text-white font-semibold text-base"
          >
            Review &amp; Submit
          </button>
        </div>
      ) : (
        /* Confirm view */
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Confirm your score</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Player</span>
              <span className="font-medium text-black">{selectedPlayer?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-black">{date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Week</span>
              <span className="font-medium text-black">{weekNumber} of {TOTAL_WEEKS} — {season.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Course half</span>
              <span className="font-medium text-black">{courseHalfLabel}</span>
            </div>
            {playerTeam && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Team</span>
                <span className="font-medium text-black">{playerTeam.name}</span>
              </div>
            )}
            {playerTeam && puttOffWinner && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Putt-off</span>
                <span className="font-medium text-[#C9A84C]">Winner ✓</span>
              </div>
            )}
            {mode === "hole" ? (
              <>
                <div className="pt-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Hole scores</span>
                  <div className="grid grid-cols-9 gap-1 mt-1">
                    {holes.map((h, i) => (
                      <div key={i} className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400">{i + 1}</span>
                        <span className="text-sm font-semibold">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm border-t pt-3">
                  <span className="text-gray-500">Total</span>
                  <span className="text-2xl font-bold text-[#006747]">{holeTotal}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-gray-500">Total score</span>
                <span className="text-2xl font-bold text-[#006747]">{totalScore}</span>
              </div>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setView("form")}
              className="flex-1 py-4 rounded-xl border border-gray-300 bg-gray-500 text-white font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="flex-1 py-4 rounded-xl bg-[#006747] text-white font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </form>
    <div className="mt-6">
      <Link
        href="/"
        className="block w-full text-center py-3 rounded-xl border border-gray-300 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
      >
        ← Home
      </Link>
    </div>
    </>
  );
}
