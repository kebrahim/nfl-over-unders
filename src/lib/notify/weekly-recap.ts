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

const TONE_INSTRUCTIONS: Record<RecapTone, string> = {
  nice: `Write 2-4 warm, encouraging sentences celebrating the week. Call people out by name for good picks and hype them up; if someone had a rough week, be gentle and supportive about it — find a silver lining or just note it kindly without piling on. This is a wholesome group of friends cheering each other on.`,
  playful: `Write 2-4 lighthearted, joking sentences. Call people out by name and have fun with it — a little ribbing for bad picks, a little bragging-rights tease for good ones — but keep it good-natured, like friends who like each other. Nothing mean-spirited; the vibe is banter, not a roast.`,
  snarky: `Write 2-4 sentences with a snarky, sarcastic edge. Call people out by name — tease bad picks pretty hard and undercut good ones with a joke — but stay playful about it overall; this is ribbing between friends, not a genuine attack.`,
  brutal: `Write 2-4 sentences absolutely torching whoever deserves it. Call people out by name and go hard — question their judgment, their football knowledge, their life choices for making the pick. Bad losses and blown-out unders should get mocked without restraint, not gently teased. Even a "good" result should get undercut somehow — a backhanded insult, a reason it doesn't actually matter, whatever. Nobody gets a genuine compliment and nobody gets off easy. Full send: sarcastic, savage, a little cruel — these are close friends who can take it, this isn't customer-facing copy, so do not soften it, hedge it, or add a caring/wholesome coda at the end.`,
};

function buildSystemPrompt(tone: RecapTone): string {
  return `You write a short group-text recap for 5 close friends in a season-long NFL prediction pool. Each of them drafted specific NFL teams paired with an over/under on that team's season win total. You'll be given a JSON list of drafted (team, side) picks that played games this week, with the result and each team's current record.

${TONE_INSTRUCTIONS[tone]} Skip unremarkable picks if space is tight; spend the words on whoever's result mattered most. No hashtags, no markdown, no emoji beyond an occasional 🏈. Keep the whole thing under 320 characters so it reads well as one text message.`;
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
      system: buildSystemPrompt(tone),
      messages: [
        { role: "user", content: `Week ${week} drafted-team results:\n${JSON.stringify(results, null, 2)}` },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock?.text.trim() || null;
  } catch (err) {
    console.error("generateWeeklyRecapMessage error:", err);
    return null;
  }
}
