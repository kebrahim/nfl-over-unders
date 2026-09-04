import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Upserts game results. Protected by a shared secret rather than user auth
// since this is meant to be called by a cron job / external script, not a
// signed-in player.
//
// TODO: this route accepts pre-fetched game data rather than calling a
// scores provider itself — wiring up an actual NFL schedule/score source
// (e.g. ESPN's public scoreboard endpoint) is a follow-up task. For now,
// POST a body shaped like { games: GameUpsert[] } from wherever that data
// comes from (a script, a cron job, or manual entry).
interface GameUpsert {
  id: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "final";
  kickoff_utc: string;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const games = body?.games as GameUpsert[] | undefined;
  if (!Array.isArray(games) || games.length === 0) {
    return NextResponse.json({ error: "Expected a non-empty games array." }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from("games").upsert(games, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ synced: games.length });
}
