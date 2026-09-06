import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fromEspnCode } from "@/lib/domain/espn";

// Pulls current scores from ESPN's public (unofficial, undocumented but
// widely relied on) scoreboard endpoint and upserts them into `games`.
// Two ways to trigger it:
//   - GET, with `Authorization: Bearer $CRON_SECRET` — Vercel Cron (see
//     vercel.json). Vercel always calls cron routes with GET.
//   - POST, with a signed-in commissioner session — the "Sync scores now"
//     button on /admin.
const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const MIN_WEEK = 1;
const MAX_WEEK = 18;

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { abbreviation: string };
}

interface EspnEvent {
  id: string;
  date: string;
  status?: { type?: { name?: string } };
  competitions?: {
    week?: { number?: number };
    competitors?: EspnCompetitor[];
  }[];
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function mapStatus(espnStatusName: string | undefined): "scheduled" | "live" | "final" {
  if (espnStatusName === "STATUS_SCHEDULED") return "scheduled";
  if (espnStatusName === "STATUS_FINAL") return "final";
  return "live";
}

async function fetchEspnGames() {
  const now = new Date();
  const start = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const url = `${ESPN_SCOREBOARD_URL}?seasontype=2&dates=${formatDate(start)}-${formatDate(end)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status}`);
  }
  const data = (await res.json()) as { events?: EspnEvent[] };
  return data.events ?? [];
}

async function performSync() {
  const db = createServiceRoleClient();

  const { data: teams, error: teamsError } = await db.from("teams").select("id, code");
  if (teamsError) throw new Error(teamsError.message);
  const teamIdByCode = new Map((teams ?? []).map((t) => [t.code, t.id]));

  const events = await fetchEspnGames();

  const games = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    const week = competition?.week?.number;
    if (!competition || !Number.isInteger(week) || week! < MIN_WEEK || week! > MAX_WEEK) {
      continue;
    }

    const competitors = competition.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeTeamId = teamIdByCode.get(fromEspnCode(home.team.abbreviation));
    const awayTeamId = teamIdByCode.get(fromEspnCode(away.team.abbreviation));
    if (!homeTeamId || !awayTeamId) continue;

    const status = mapStatus(event.status?.type?.name);
    const toScore = (raw: string | undefined) =>
      status === "scheduled" || raw == null ? null : Number(raw);

    games.push({
      id: Number(event.id),
      week: week!,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: toScore(home.score),
      away_score: toScore(away.score),
      status,
      kickoff_utc: event.date,
    });
  }

  if (games.length === 0) {
    return { synced: 0 };
  }

  const { error } = await db.from("games").upsert(games, { onConflict: "id" });
  if (error) throw new Error(error.message);

  return { synced: games.length };
}

async function requireAuthorized(request: Request): Promise<NextResponse | null> {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) {
    return NextResponse.json({ error: "Commissioner only." }, { status: 403 });
  }

  return null;
}

async function handle(request: Request) {
  const unauthorized = await requireAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await performSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
