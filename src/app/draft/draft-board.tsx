"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playerIndexForPick, userIdOnTheClock } from "@/lib/domain/draft";
import type { Side } from "@/lib/supabase/types";

interface Team {
  id: number;
  name: string;
  code: string;
  conference: string;
  division: string;
}
interface Player {
  id: string;
  display_name: string;
}
interface Pick {
  id: string;
  user_id: string;
  team_id: number;
  side: Side;
  round: number;
  pick_number: number;
}
interface Session {
  id: string;
  status: string;
  snake_order: string[];
  current_pick_index: number;
  total_rounds: number;
  current_round: number;
}

export function DraftBoard({
  session,
  initialPicks,
  teams,
  players,
  currentUserId,
}: {
  session: Session;
  initialPicks: Pick[];
  teams: Team[];
  players: Player[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [conferenceFilter, setConferenceFilter] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`draft-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_picks", filter: `session_id=eq.${session.id}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_sessions", filter: `id=eq.${session.id}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, router]);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const takenKeys = useMemo(
    () => new Set(initialPicks.map((p) => `${p.team_id}:${p.side}`)),
    [initialPicks],
  );
  const onTheClock = userIdOnTheClock(session.snake_order, session.current_pick_index);
  const onTheClockIndex =
    session.status === "active"
      ? playerIndexForPick(session.current_pick_index + 1, session.snake_order.length)
      : -1;
  const isMyTurn = session.status === "active" && onTheClock === currentUserId;
  const conferences = Array.from(new Set(teams.map((t) => t.conference)));
  const visibleTeams = conferenceFilter
    ? teams.filter((t) => t.conference === conferenceFilter)
    : teams;

  async function makePick(teamId: number, side: Side) {
    const key = `${teamId}:${side}`;
    setPendingKey(key);
    setError(null);
    const res = await fetch("/api/draft/pick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, teamId, side }),
    });
    const body = await res.json();
    setPendingKey(null);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        {session.status === "completed" ? (
          <p className="font-medium">Draft complete.</p>
        ) : (
          <p className="font-medium">
            Round {session.current_round} of {session.total_rounds} — on the clock:{" "}
            <span className="text-black dark:text-white">
              {onTheClock ? playerById.get(onTheClock)?.display_name ?? "…" : "—"}
            </span>
            {isMyTurn && <span className="ml-2 text-green-600 dark:text-green-400">(you!)</span>}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {session.snake_order.map((playerId, i) => (
            <span
              key={i}
              className={
                i === onTheClockIndex ? "font-semibold text-black dark:text-white" : ""
              }
            >
              {playerById.get(playerId)?.display_name ?? "?"}
              {i < session.snake_order.length - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConferenceFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            conferenceFilter === null
              ? "bg-foreground text-background"
              : "border border-black/10 dark:border-white/15"
          }`}
        >
          All
        </button>
        {conferences.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setConferenceFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              conferenceFilter === c
                ? "bg-foreground text-background"
                : "border border-black/10 dark:border-white/15"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleTeams.map((team) => {
          const overTaken = takenKeys.has(`${team.id}:over`);
          const underTaken = takenKeys.has(`${team.id}:under`);
          return (
            <div key={team.id} className="rounded-lg border border-black/10 p-3 dark:border-white/15">
              <p className="text-sm font-medium">{team.name}</p>
              <p className="text-xs text-zinc-500">
                {team.conference} {team.division}
              </p>
              <div className="mt-2 flex gap-2">
                <PickButton
                  label="Over"
                  taken={overTaken}
                  disabled={!isMyTurn}
                  pending={pendingKey === `${team.id}:over`}
                  onClick={() => makePick(team.id, "over")}
                />
                <PickButton
                  label="Under"
                  taken={underTaken}
                  disabled={!isMyTurn}
                  pending={pendingKey === `${team.id}:under`}
                  onClick={() => makePick(team.id, "under")}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Picks so far</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {[...initialPicks].reverse().map((pick) => {
            const team = teams.find((t) => t.id === pick.team_id);
            return (
              <li key={pick.id} className="text-zinc-600 dark:text-zinc-400">
                #{pick.pick_number} — {playerById.get(pick.user_id)?.display_name} took{" "}
                <span className="text-black dark:text-white">
                  {team?.name} {pick.side}
                </span>
              </li>
            );
          })}
          {initialPicks.length === 0 && <li className="text-zinc-500">No picks yet.</li>}
        </ol>
      </div>
    </div>
  );
}

function PickButton({
  label,
  taken,
  disabled,
  pending,
  onClick,
}: {
  label: string;
  taken: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={taken || disabled || pending}
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
        taken
          ? "cursor-not-allowed bg-black/5 text-zinc-400 dark:bg-white/5 dark:text-zinc-600"
          : disabled
            ? "cursor-not-allowed border border-black/10 text-zinc-400 dark:border-white/15"
            : "border border-black/10 hover:border-transparent hover:bg-foreground hover:text-background dark:border-white/15"
      }`}
    >
      {pending ? "…" : taken ? `${label} (taken)` : label}
    </button>
  );
}
