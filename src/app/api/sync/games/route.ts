import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fromEspnCode } from "@/lib/domain/espn";
import { computeNflWeek } from "@/lib/domain/season";
import { projectedLeaguePoints, TOTAL_REGULAR_SEASON_GAMES } from "@/lib/domain/scoring";
import { recordSyncCompleted } from "@/lib/domain/sync-status";
import { sendGroupText } from "@/lib/notify/sms";
import { generateUpcomingPreviewMessage, generateWeeklyRecapMessage, getUpcomingWeekFirstKickoff } from "@/lib/notify/weekly-recap";

// Pulls current scores from ESPN's public (unofficial, undocumented but
// widely relied on) scoreboard endpoint and upserts them into `games`.
// Two ways to trigger it:
//   - GET, with `Authorization: Bearer $CRON_SECRET` — Vercel Cron (see
//     vercel.json). Vercel always calls cron routes with GET. vercel.json
//     fires twice daily (13:00 and 14:00 UTC, covering 9am EDT and 9am
//     EST); isNineAmEastern() below picks out whichever one is actually
//     9am America/New_York right now and no-ops the other, so the sync
//     (and the weekly recap/preview texts it can trigger) always land
//     at 9am local time year-round without a manual schedule flip at
//     the DST changeover.
//   - POST, with a signed-in commissioner session — the "Sync scores now"
//     button on /admin. Not subject to the 9am gate.
const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const MIN_WEEK = 1;
const MAX_WEEK = 18;
const LAST_WEEKLY_SUMMARY_KEY = "last_weekly_summary_week";
const LAST_WEEKLY_PREVIEW_KEY = "last_weekly_preview_week";

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
    competitors?: EspnCompetitor[];
  }[];
}

function formatMonth(d: Date): string {
  return d.toISOString().slice(0, 7).replace("-", "");
}

// As of 2026-09-15, ESPN's scoreboard endpoint stopped accepting the
// `dates=YYYYMMDD-YYYYMMDD` range form (answers 400 "Failed to get events
// endpoint." for every sport) — but a single day, month, or year still
// works. Query one request per distinct calendar month covering the
// window instead; extra games outside the exact window are harmless,
// since performSync already filters events down by computed NFL week.
function monthsInRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= last) {
    months.push(formatMonth(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function mapStatus(espnStatusName: string | undefined): "scheduled" | "live" | "final" {
  if (espnStatusName === "STATUS_SCHEDULED") return "scheduled";
  if (espnStatusName === "STATUS_FINAL") return "final";
  return "live";
}

// ESPN's endpoint is unofficial and undocumented — no auth, but it sits
// behind Akamai's bot protection, which fingerprints the TLS/HTTP2
// handshake against the claimed User-Agent. A UA that *claims* to be a
// full browser (Chrome/Safari) from a server that doesn't actually
// handshake like one gets flagged and 403'd; a plain, honest non-browser
// UA (curl, a generic script UA) reliably passes. So: no browser
// impersonation, and retry with a couple of variants + backoff in case
// one specific UA or edge node is (temporarily) on a blocklist.
const ESPN_USER_AGENTS = ["curl/8.7.1", "gridiron-sync/1.0", ""];

async function fetchEspnScoreboard(dates: string): Promise<EspnEvent[]> {
  const url = `${ESPN_SCOREBOARD_URL}?dates=${dates}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < ESPN_USER_AGENTS.length; attempt++) {
    const userAgent = ESPN_USER_AGENTS[attempt];
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }

    const res = await fetch(url, {
      cache: "no-store",
      headers: userAgent ? { "User-Agent": userAgent } : {},
    });
    if (res.ok) {
      const data = (await res.json()) as { events?: EspnEvent[] };
      return data.events ?? [];
    }

    const body = await res.text().catch(() => "");
    lastError = new Error(
      `ESPN scoreboard request failed: ${res.status} (User-Agent: ${userAgent || "(none)"}) ${body.slice(0, 300)}`,
    );
    // Only retry on the kind of status a bot-detection block would produce.
    if (res.status !== 403 && res.status !== 429) break;
  }
  throw lastError ?? new Error("ESPN scoreboard request failed.");
}

async function fetchEspnGames() {
  const now = new Date();
  const start = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
  // Wide enough to always include at least one full upcoming NFL week
  // (games run Thu-Mon), so scheduled matchups are visible for testing
  // even before the season starts, not just live/recent scores.
  const end = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000);

  const eventsById = new Map<string, EspnEvent>();
  for (const month of monthsInRange(start, end)) {
    const events = await fetchEspnScoreboard(month);
    for (const event of events) eventsById.set(event.id, event);
  }
  return [...eventsById.values()];
}

async function performSync() {
  const db = createServiceRoleClient();

  const { data: teams, error: teamsError } = await db.from("teams").select("id, code");
  if (teamsError) throw new Error(teamsError.message);
  const teamIdByCode = new Map((teams ?? []).map((t) => [t.code, t.id]));

  const events = await fetchEspnGames();
  await recordSyncCompleted();

  const skipped = { badWeek: 0, noCompetitors: 0, unknownTeam: 0 };
  const sampleEvent = events[0]
    ? {
        id: events[0].id,
        date: events[0].date,
        computedWeek: computeNflWeek(events[0].date),
        statusName: events[0].status?.type?.name,
        competitorAbbreviations: (events[0].competitions?.[0]?.competitors ?? []).map(
          (c) => `${c.homeAway}:${c.team?.abbreviation}`,
        ),
      }
    : null;

  const games = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    const week = computeNflWeek(event.date);
    if (!competition || week < MIN_WEEK || week > MAX_WEEK) {
      skipped.badWeek++;
      continue;
    }

    const competitors = competition.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) {
      skipped.noCompetitors++;
      continue;
    }

    const homeTeamId = teamIdByCode.get(fromEspnCode(home.team.abbreviation));
    const awayTeamId = teamIdByCode.get(fromEspnCode(away.team.abbreviation));
    if (!homeTeamId || !awayTeamId) {
      skipped.unknownTeam++;
      continue;
    }

    const status = mapStatus(event.status?.type?.name);
    const toScore = (raw: string | undefined) =>
      status === "scheduled" || raw == null ? null : Number(raw);

    games.push({
      id: Number(event.id),
      week,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: toScore(home.score),
      away_score: toScore(away.score),
      status,
      kickoff_utc: event.date,
    });
  }

  if (games.length === 0) {
    return { synced: 0, rawEvents: events.length, skipped, sampleEvent };
  }

  const { error } = await db.from("games").upsert(games, { onConflict: "id" });
  if (error) throw new Error(error.message);

  await maybeSendWeeklySummary(db);
  await maybeSendWeeklyPreview(db);

  return { synced: games.length, rawEvents: events.length };
}

/**
 * Sends one group-text recap the first time each NFL week's games are
 * all final. Prefers a Claude-written recap highlighting meaningful
 * outcomes among drafted teams; falls back to a simple league-wide
 * scoring-pace line if ANTHROPIC_API_KEY isn't set or generation fails.
 * Draft/division points aren't part of either version — they don't
 * meaningfully change week to week (only resolving once a team's full
 * 17-game season is in), so a leaderboard snapshot would mostly show
 * zeros until the season ends.
 */
async function maybeSendWeeklySummary(db: ReturnType<typeof createServiceRoleClient>) {
  const { data: allGames } = await db.from("games").select("week, status");
  if (!allGames) return;

  const byWeek = new Map<number, { total: number; final: number }>();
  for (const g of allGames) {
    const entry = byWeek.get(g.week) ?? { total: 0, final: 0 };
    entry.total++;
    if (g.status === "final") entry.final++;
    byWeek.set(g.week, entry);
  }

  let completeThroughWeek = 0;
  for (let week = MIN_WEEK; week <= MAX_WEEK; week++) {
    const entry = byWeek.get(week);
    if (!entry || entry.total === 0 || entry.final < entry.total) break;
    completeThroughWeek = week;
  }
  if (completeThroughWeek === 0) return;

  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", LAST_WEEKLY_SUMMARY_KEY)
    .maybeSingle();
  const lastSummarizedWeek = setting?.value ? Number(setting.value) : 0;
  if (completeThroughWeek <= lastSummarizedWeek) return;

  const recap = await generateWeeklyRecapMessage(completeThroughWeek);
  if (recap) {
    await sendGroupText(recap, "recap");
  } else {
    const { data: leaguePoints } = await db
      .from("league_total_points")
      .select("total_points, games_final")
      .single();
    if (leaguePoints) {
      const pace = projectedLeaguePoints(leaguePoints.total_points, leaguePoints.games_final);
      const paceText = pace != null ? ` On pace for ${Math.round(pace)} across all ${TOTAL_REGULAR_SEASON_GAMES} games.` : "";
      await sendGroupText(
        `Week ${completeThroughWeek} is in the books! League has scored ${leaguePoints.total_points} points so far.${paceText} Check standings: gridiron.zebrahim.com/standings`,
        "recap_fallback",
      );
    }
  }

  await db
    .from("app_settings")
    .upsert({ key: LAST_WEEKLY_SUMMARY_KEY, value: String(completeThroughWeek) }, { onConflict: "key" });
}

/**
 * Sends the Claude-written preview of the upcoming week's drafted-team
 * matchups on or after that week's first game day (its earliest kickoff,
 * by America/New_York calendar date — not UTC, since a Thursday-night
 * kickoff at 8:20pm ET is already Friday in UTC). "On or after," not an
 * exact-day match, so a sync failure on the actual game day (ESPN's
 * endpoint is unofficial and does occasionally error) doesn't permanently
 * skip that week's preview — the next successful run catches up instead.
 * app_settings tracks the last previewed week so it only ever sends once.
 */
async function maybeSendWeeklyPreview(db: ReturnType<typeof createServiceRoleClient>) {
  const upcoming = await getUpcomingWeekFirstKickoff();
  if (!upcoming) return;

  const easternDate = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
  if (easternDate(new Date()) < easternDate(upcoming.firstKickoff)) return;

  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", LAST_WEEKLY_PREVIEW_KEY)
    .maybeSingle();
  const lastPreviewedWeek = setting?.value ? Number(setting.value) : 0;
  if (upcoming.week <= lastPreviewedWeek) return;

  const preview = await generateUpcomingPreviewMessage();
  if (preview) {
    await sendGroupText(preview, "preview");
  }

  await db
    .from("app_settings")
    .upsert({ key: LAST_WEEKLY_PREVIEW_KEY, value: String(upcoming.week) }, { onConflict: "key" });
}

function isCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// Vercel Cron schedules are fixed UTC with no timezone/DST awareness, so
// vercel.json fires this route at both 13:00 and 14:00 UTC (the two
// possible UTC times for 9am America/New_York, depending on EDT vs EST).
// Checking the live local hour here — rather than hardcoding a UTC
// offset — means the "actual" 9am run picks itself out correctly across
// the DST changeover with no manual schedule flip required.
function isNineAmEastern(): boolean {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour) === 9;
}

async function requireAuthorized(request: Request): Promise<NextResponse | null> {
  if (isCronRequest(request)) {
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
    console.log("sync/games result:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    console.error("sync/games performSync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const cron = isCronRequest(request);
  const nineAm = isNineAmEastern();
  console.log(`sync/games GET: isCronRequest=${cron} isNineAmEastern=${nineAm} nowUTC=${new Date().toISOString()}`);
  if (cron && !nineAm) {
    return NextResponse.json({ skipped: true, reason: "not 9am America/New_York yet" });
  }
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
