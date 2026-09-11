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

const SYSTEM_PROMPT = `You write a short, fun group-text recap for 5 friends in a season-long NFL prediction pool. Each of them drafted specific NFL teams paired with an over/under on that team's season win total. You'll be given a JSON list of drafted (team, side) picks that played games this week, with the result and each team's current record.

Write 2-4 sentences highlighting the most meaningful outcomes for the pool — teams that had a big win or loss relative to their win-total line, upsets, or picks that are now clearly trending over or under. Skip picks with unremarkable results if space is tight; focus on what actually matters for the contest. Casual, football-fan tone. No hashtags, no markdown, no emoji beyond an occasional 🏈. Keep the whole thing under 320 characters so it reads well as one text message.`;

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

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
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
