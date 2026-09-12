import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface PickResult {
  player: string;
  team: string;
  side: string;
  line: number | null;
  weekResult: string | null;
  record: string;
}

async function gatherWeekData(week: number): Promise<PickResult[]> {
  const db = createServiceRoleClient();

  const [{ data: picks }, { data: profiles }, { data: teams }, { data: records }, { data: weekGames }] =
    await Promise.all([
      db.from("draft_picks").select("user_id, team_id, side").order("pick_number"),
      db.from("profiles").select("id, display_name"),
      db.from("teams").select("id, name, win_total_line"),
      db.from("team_records").select("team_id, wins, losses"),
      db
        .from("games")
        .select("home_team_id, away_team_id, home_score, away_score")
        .eq("week", week)
        .eq("status", "final"),
    ]);
  if (!picks) return [];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const recordByTeam = new Map((records ?? []).map((r) => [r.team_id, r]));

  const gameByTeam = new Map<number, string>();
  for (const g of weekGames ?? []) {
    if (g.home_score == null || g.away_score == null) continue;
    const homeTeam = teamById.get(g.home_team_id);
    const awayTeam = teamById.get(g.away_team_id);
    const homeWon = g.home_score > g.away_score;
    gameByTeam.set(
      g.home_team_id,
      `${homeWon ? "W" : "L"} ${g.home_score}-${g.away_score} vs ${awayTeam?.name ?? "opponent"}`,
    );
    gameByTeam.set(
      g.away_team_id,
      `${!homeWon ? "W" : "L"} ${g.away_score}-${g.home_score} @ ${homeTeam?.name ?? "opponent"}`,
    );
  }

  return picks
    .map((p): PickResult | null => {
      const team = teamById.get(p.team_id);
      const profile = profileById.get(p.user_id);
      const weekResult = gameByTeam.get(p.team_id);
      if (!team || !profile || !weekResult) return null; // bye week or no game found
      const record = recordByTeam.get(p.team_id);
      return {
        player: profile.display_name,
        team: team.name,
        side: p.side,
        line: team.win_total_line,
        weekResult,
        record: record ? `${record.wins}-${record.losses}` : "?",
      };
    })
    .filter((p): p is PickResult => p !== null);
}

export type RecapTone = "nice" | "playful" | "snarky" | "brutal";

export const RECAP_TONE_KEY = "weekly_recap_tone";
export const DEFAULT_RECAP_TONE: RecapTone = "brutal";

export const RECAP_TONES: { id: RecapTone; label: string; description: string }[] = [
  { id: "nice", label: "Nice", description: "Warm and encouraging, cheers everyone on." },
  { id: "playful", label: "Playful", description: "Light teasing, good-natured banter." },
  { id: "snarky", label: "Snarky", description: "Sarcastic ribbing, still friendly underneath." },
  { id: "brutal", label: "Brutal", description: "Merciless roast, nobody gets off easy." },
];

const RECAP_TONE_INSTRUCTIONS: Record<RecapTone, string> = {
  nice: `Write 2-4 warm, encouraging sentences celebrating the week. Call people out by name for good picks and hype them up; if someone had a rough week, be gentle and supportive about it — find a silver lining or just note it kindly without piling on. This is a wholesome group of friends cheering each other on.`,
  playful: `Write 2-4 lighthearted, joking sentences. Call people out by name and have fun with it — a little ribbing for bad picks, a little bragging-rights tease for good ones — but keep it good-natured, like friends who like each other. Nothing mean-spirited; the vibe is banter, not a roast.`,
  snarky: `Write 2-4 sentences with a snarky, sarcastic edge. Call people out by name — tease bad picks pretty hard and undercut good ones with a joke — but stay playful about it overall; this is ribbing between friends, not a genuine attack.`,
  brutal: `Write 2-4 sentences absolutely torching whoever deserves it. Call people out by name and go hard — question their judgment, their football knowledge, their life choices for making the pick. Bad losses and blown-out unders should get mocked without restraint, not gently teased. Even a "good" result should get undercut somehow — a backhanded insult, a reason it doesn't actually matter, whatever. Nobody gets a genuine compliment and nobody gets off easy. Full send: sarcastic, savage, a little cruel — these are close friends who can take it, this isn't customer-facing copy, so do not soften it, hedge it, or add a caring/wholesome coda at the end.`,
};

function buildRecapSystemPrompt(tone: RecapTone): string {
  return `You write a short group-text recap for 5 close friends in a season-long NFL prediction pool. Each of them drafted specific NFL teams paired with an over/under on that team's season win total. You'll be given a JSON list of drafted (team, side) picks that played games this week, with the result and each team's current record.

${RECAP_TONE_INSTRUCTIONS[tone]}

Format: one bullet point per matchup worth calling out (2-4 bullets), each starting with "• " on its own line — real line breaks between bullets, not run together in one paragraph. Skip unremarkable picks if space is tight; spend the bullets on whoever's result mattered most. Keep each bullet to one short sentence. Don't include a title or header line — that's added separately. No hashtags, no markdown besides the bullet character, no emoji beyond an occasional 🏈.`;
}

export async function getRecapTone(): Promise<RecapTone> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", RECAP_TONE_KEY)
    .maybeSingle();
  const value = data?.value;
  return RECAP_TONES.some((t) => t.id === value) ? (value as RecapTone) : DEFAULT_RECAP_TONE;
}

export async function setRecapTone(tone: RecapTone): Promise<void> {
  const db = createServiceRoleClient();
  await db.from("app_settings").upsert({ key: RECAP_TONE_KEY, value: tone }, { onConflict: "key" });
}

/**
 * The latest week with any final game — used by the admin test button,
 * which (unlike the real automated recap) doesn't need the whole week to
 * be complete, just something real to summarize.
 */
export async function findLatestRecapWeek(): Promise<number | null> {
  const db = createServiceRoleClient();
  const { data: games } = await db.from("games").select("week, status");
  if (!games || games.length === 0) return null;

  const weeksWithFinal = games.filter((g) => g.status === "final").map((g) => g.week);
  return weeksWithFinal.length > 0 ? Math.max(...weeksWithFinal) : null;
}

/**
 * Asks Claude to write the weekly recap text from that week's drafted-team
 * results. Returns null (never throws) if data or the API call fails, so
 * the caller can fall back to a simpler templated message.
 */
export async function generateWeeklyRecapMessage(week: number): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const results = await gatherWeekData(week);
    if (results.length === 0) return null;

    const tone = await getRecapTone();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low" },
      system: buildRecapSystemPrompt(tone),
      messages: [
        { role: "user", content: `Week ${week} drafted-team results:\n${JSON.stringify(results, null, 2)}` },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const body = textBlock?.text.trim();
    return body ? `Week ${week} Recap\n${body}` : null;
  } catch (err) {
    console.error("generateWeeklyRecapMessage error:", err);
    return null;
  }
}

interface UpcomingPick {
  player: string;
  team: string;
  side: string;
  line: number | null;
  opponent: string;
  record: string;
}

/**
 * The earliest week with any not-yet-final game — i.e. the week that's
 * about to be (or currently being) played. Returns null if every synced
 * game is already final (nothing upcoming to preview) or none exist yet.
 */
async function findUpcomingWeek(db: ReturnType<typeof createServiceRoleClient>): Promise<number | null> {
  const { data: games } = await db.from("games").select("week, status");
  if (!games || games.length === 0) return null;

  const upcomingWeeks = games.filter((g) => g.status !== "final").map((g) => g.week);
  return upcomingWeeks.length > 0 ? Math.min(...upcomingWeeks) : null;
}

/**
 * The upcoming week's number and its earliest kickoff time — used to
 * fire the preview text on that week's first game day. Returns null if
 * there's no upcoming week, or its games haven't synced any kickoff
 * times yet.
 */
export async function getUpcomingWeekFirstKickoff(): Promise<{ week: number; firstKickoff: Date } | null> {
  const db = createServiceRoleClient();
  const week = await findUpcomingWeek(db);
  if (week == null) return null;

  const { data: games } = await db.from("games").select("kickoff_utc").eq("week", week);
  if (!games || games.length === 0) return null;

  const kickoffs = games.map((g) => new Date(g.kickoff_utc).getTime());
  return { week, firstKickoff: new Date(Math.min(...kickoffs)) };
}

async function gatherUpcomingWeekData(week: number): Promise<UpcomingPick[]> {
  const db = createServiceRoleClient();

  const [{ data: picks }, { data: profiles }, { data: teams }, { data: records }, { data: weekGames }] =
    await Promise.all([
      db.from("draft_picks").select("user_id, team_id, side").order("pick_number"),
      db.from("profiles").select("id, display_name"),
      db.from("teams").select("id, name, win_total_line"),
      db.from("team_records").select("team_id, wins, losses"),
      db
        .from("games")
        .select("home_team_id, away_team_id")
        .eq("week", week)
        .neq("status", "final"),
    ]);
  if (!picks) return [];

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const recordByTeam = new Map((records ?? []).map((r) => [r.team_id, r]));

  const opponentByTeam = new Map<number, string>();
  for (const g of weekGames ?? []) {
    const homeTeam = teamById.get(g.home_team_id);
    const awayTeam = teamById.get(g.away_team_id);
    opponentByTeam.set(g.home_team_id, `vs ${awayTeam?.name ?? "opponent"}`);
    opponentByTeam.set(g.away_team_id, `@ ${homeTeam?.name ?? "opponent"}`);
  }

  return picks
    .map((p): UpcomingPick | null => {
      const team = teamById.get(p.team_id);
      const profile = profileById.get(p.user_id);
      const opponent = opponentByTeam.get(p.team_id);
      if (!team || !profile || !opponent) return null; // bye week or no game found
      const record = recordByTeam.get(p.team_id);
      return {
        player: profile.display_name,
        team: team.name,
        side: p.side,
        line: team.win_total_line,
        opponent,
        record: record ? `${record.wins}-${record.losses}` : "0-0",
      };
    })
    .filter((p): p is UpcomingPick => p !== null);
}

const PREVIEW_TONE_INSTRUCTIONS: Record<RecapTone, string> = {
  nice: `Write 2-4 warm, upbeat sentences hyping up the week ahead. Call out drafted teams by name and get people excited for their matchups; if a matchup looks rough for someone's pick, stay encouraging and hopeful about it.`,
  playful: `Write 2-4 lighthearted, joking sentences previewing the week. Call out drafted teams by name and have fun predicting how it'll go — some ribbing about tough matchups, some hype for good ones — but keep it good-natured banter.`,
  snarky: `Write 2-4 sentences with a snarky, sarcastic edge previewing the week's matchups. Call out drafted teams by name — needle whoever's got a scary matchup coming, poke fun at bold predictions — but stay playful, this is ribbing not a real attack.`,
  brutal: `Write 2-4 sentences absolutely torching whoever's about to have a bad week. Call out drafted teams by name and go hard on anyone facing a brutal matchup — question why they ever drafted that team, predict the humiliation to come. Even a favorable matchup should get undercut somehow. Nobody gets genuine encouragement. Full send: sarcastic, savage, a little cruel — these are close friends who can take it, this isn't customer-facing copy, so do not soften it, hedge it, or add a caring/wholesome coda at the end.`,
};

function buildPreviewSystemPrompt(tone: RecapTone): string {
  return `You write a short group-text preview for 5 close friends in a season-long NFL prediction pool, previewing the upcoming week's games before they're played. Each of them drafted specific NFL teams paired with an over/under on that team's season win total. You'll be given a JSON list of drafted teams' matchups this week, with each team's current record and win-total line.

${PREVIEW_TONE_INSTRUCTIONS[tone]}

Format: one bullet point per matchup worth calling out (2-4 bullets), each starting with "• " on its own line — real line breaks between bullets, not run together in one paragraph. Call out any matchup where two drafted teams play each other especially — that's a direct pool-vs-pool showdown. Skip unremarkable matchups if space is tight. Keep each bullet to one short sentence. Don't include a title or header line — that's added separately. No hashtags, no markdown besides the bullet character, no emoji beyond an occasional 🏈.`;
}

/**
 * Asks Claude to write a preview of the upcoming week's drafted-team
 * matchups, in the same admin-configured tone as the weekly recap.
 * Returns null (never throws) if there's nothing upcoming to preview or
 * the API call fails.
 */
export async function generateUpcomingPreviewMessage(): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const db = createServiceRoleClient();
    const week = await findUpcomingWeek(db);
    if (week == null) return null;

    const picks = await gatherUpcomingWeekData(week);
    if (picks.length === 0) return null;

    const tone = await getRecapTone();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low" },
      system: buildPreviewSystemPrompt(tone),
      messages: [
        { role: "user", content: `Week ${week} upcoming drafted-team matchups:\n${JSON.stringify(picks, null, 2)}` },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const body = textBlock?.text.trim();
    return body ? `Week ${week} Preview\n${body}` : null;
  } catch (err) {
    console.error("generateUpcomingPreviewMessage error:", err);
    return null;
  }
}
