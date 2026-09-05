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
      <div className="rounded-lg border border-border bg-surface p-4">
        {session.status === "completed" ? (
          <p className="font-heading font-semibold tracking-wide text-accent uppercase">
            Draft complete
          </p>
        ) : (
          <p className="font-medium">
            Round {session.current_round} of {session.total_rounds} — on the clock:{" "}
            <span className="text-accent">
              {onTheClock ? playerById.get(onTheClock)?.display_name ?? "…" : "—"}
            </span>
            {isMyTurn && <span className="ml-2 text-good">(you!)</span>}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-muted">
          {session.snake_order.map((playerId, i) => (
            <span key={i} className={i === onTheClockIndex ? "font-semibold text-accent" : ""}>
              {playerById.get(playerId)?.display_name ?? "?"}
              {i < session.snake_order.length - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConferenceFilter(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            conferenceFilter === null
              ? "bg-accent text-accent-ink"
              : "border border-border text-ink-muted hover:text-ink"
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
                ? "bg-accent text-accent-ink"
                : "border border-border text-ink-muted hover:text-ink"
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
            <div key={team.id} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-medium">{team.name}</p>
              <p className="text-xs text-ink-muted">
                {team.conference} {team.division}
              </p>
              <div className="mt-2 flex gap-2">
                <PickButton
                  label="Over"
                  variant="good"
                  taken={overTaken}
                  disabled={!isMyTurn}
                  pending={pendingKey === `${team.id}:over`}
                  onClick={() => makePick(team.id, "over")}
                />
                <PickButton
                  label="Under"
                  variant="bad"
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
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Picks so far
        </h2>
        <ol className="mt-2 space-y-1 text-sm">
          {[...initialPicks].reverse().map((pick) => {
            const team = teams.find((t) => t.id === pick.team_id);
            return (
              <li key={pick.id} className="text-ink-muted">
                #{pick.pick_number} — {playerById.get(pick.user_id)?.display_name} took{" "}
                <span className="text-ink">
                  {team?.name} {pick.side}
                </span>
              </li>
            );
          })}
          {initialPicks.length === 0 && <li className="text-ink-muted">No picks yet.</li>}
        </ol>
      </div>
    </div>
  );
}

function PickButton({
  label,
  variant,
  taken,
  disabled,
  pending,
  onClick,
}: {
  label: string;
  variant: "good" | "bad";
  taken: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const activeClasses =
    variant === "good"
      ? "border-good/40 text-good hover:border-good hover:bg-good hover:text-accent-ink"
      : "border-bad/40 text-bad hover:border-bad hover:bg-bad hover:text-accent-ink";

  return (
    <button
      type="button"
      disabled={taken || disabled || pending}
      onClick={onClick}
      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
        taken
          ? "cursor-not-allowed border-border bg-surface-2 text-ink-muted"
          : disabled
            ? "cursor-not-allowed border-border text-ink-muted"
            : activeClasses
      }`}
    >
      {pending ? "…" : taken ? `${label} (taken)` : label}
    </button>
  );
}
