import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { neededRemainingRecord, projectedWins, type NeededRecord } from "@/lib/domain/scoring";
import { getRecapTone, resolveTone, toneLabel, type ConcreteRecapTone } from "@/lib/notify/weekly-recap";
import type { Side } from "@/lib/supabase/types";

interface StandingPick {
  team: string;
  side: Side;
  line: number | null;
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  resolved: boolean;
  points: number;
  // The team's full-season win pace projected from its current record,
  // and which side of the line that pace is currently tracking toward —
  // mirrors the Leaderboard's Trend column.
  projectedWins: number | null;
  trend: "over" | "under" | "push" | null;
  // The win threshold still needed over the remaining games for this
  // pick to hit — mirrors the Leaderboard's Needs column.
  needed: NeededRecord | null;
}

interface PlayerStanding {
  player: string;
  totalPoints: number;
  draftPoints: number;
  divisionPoints: number;
  picks: StandingPick[];
}

async function gatherStandingsData(): Promise<PlayerStanding[]> {
  const db = createServiceRoleClient();

  const [{ data: leaderboard }, { data: pickScores }, { data: teams }] = await Promise.all([
    db
      .from("overall_leaderboard")
      .select("user_id, display_name, draft_points, division_points, total_points")
      .order("total_points", { ascending: false }),
    db
      .from("draft_pick_scores")
      .select("user_id, team_id, side, wins, losses, ties, games_played, win_total_line, resolved, points"),
    db.from("teams").select("id, name"),
  ]);
  if (!leaderboard) return [];

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const picksByUser = new Map<string, NonNullable<typeof pickScores>>();
  for (const p of pickScores ?? []) {
    const list = picksByUser.get(p.user_id) ?? [];
    list.push(p);
    picksByUser.set(p.user_id, list);
  }

  return leaderboard.map((row) => ({
    player: row.display_name,
    totalPoints: row.total_points,
    draftPoints: row.draft_points,
    divisionPoints: row.division_points,
    picks: (picksByUser.get(row.user_id) ?? []).map((p) => {
      const line = p.win_total_line;
      const projected = projectedWins(p.wins, p.games_played);
      const trend =
        line != null && projected != null
          ? projected > line
            ? "over"
            : projected < line
              ? "under"
              : "push"
          : null;
      return {
        team: teamById.get(p.team_id)?.name ?? "?",
        side: p.side,
        line,
        wins: p.wins,
        losses: p.losses,
        ties: p.ties,
        gamesPlayed: p.games_played,
        resolved: p.resolved,
        points: p.points,
        projectedWins: projected,
        trend,
        needed: line != null ? neededRemainingRecord(p.wins, p.games_played, line, p.side) : null,
      };
    }),
  }));
}

const STANDINGS_TONE_INSTRUCTIONS: Record<ConcreteRecapTone, string> = {
  nice: `Write warm, encouraging lines celebrating where everyone stands. Hype up whoever's leading and whoever's tracking well; if someone's picks are in danger or they're near the bottom, stay gentle and supportive about it.`,
  playful: `Write lighthearted, joking lines about the current standings. Have fun with who's up and who's down — a little ribbing for picks in trouble, a little bragging-rights tease for whoever's clinched or leading — but keep it good-natured.`,
  snarky: `Write lines with a snarky, sarcastic edge about the current standings. Needle whoever's picks are in danger or stuck at the bottom pretty hard, undercut the leader's lead with a joke — but stay playful about it overall.`,
  brutal: `Write lines absolutely torching whoever deserves it based on the standings. Go hard on anyone with picks trending toward elimination or sitting last — question their draft strategy, their life choices. Even the leader should get undercut somehow. Full send: sarcastic, savage, a little cruel — these are close friends who can take it, so do not soften it, hedge it, or add a caring/wholesome coda.`,
};

function buildStandingsSystemPrompt(tone: ConcreteRecapTone): string {
  return `You write a short group-text standings update for 5 close friends in a season-long NFL prediction pool. Each drafted specific NFL teams paired with an over/under on that team's season win total, plus a division-winner bonus pick worth 1 point each. You'll be given each player's current total points (draft + division bonus) and, for each of their draft picks: the team's actual record, the team's full-season win pace projected from that record, which side of the line that pace is currently tracking toward (null/"push" if there's no line or it's dead on it), and — if the pick isn't resolved yet — the win threshold still needed over the team's remaining games (object with status "live" and a wins/losses breakdown of the remaining games needed), or "clinched"/"eliminated" if the outcome is already locked in regardless of what's left.

${STANDINGS_TONE_INSTRUCTIONS[tone]}

Format: one line per player ("Name — N pts: ...", using real line breaks between players, not run together in one paragraph), ordered by total points with the leader first. Keep each player's line to one short sentence covering whatever's most notable about their picks (something clinched, something in real danger, or the pick furthest off pace) — skip picks that are unremarkable, and don't restate every pick for every player. No hashtags, no markdown besides what's needed for line breaks, no emoji beyond an occasional 🏈.`;
}

/**
 * Asks Claude to write a mid-season standings-check text from everyone's
 * current points and how their draft picks are trending. Unlike the
 * weekly recap (one week's results) or preview (one week's matchups),
 * this looks at the whole season to date. Returns null (never throws)
 * if there's no data yet or the API call fails.
 */
export async function generateStandingsMessage(): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const standings = await gatherStandingsData();
    if (standings.length === 0) return null;

    const configuredTone = await getRecapTone();
    const tone = resolveTone(configuredTone);
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: buildStandingsSystemPrompt(tone),
      messages: [{ role: "user", content: `Current standings:\n${JSON.stringify(standings, null, 2)}` }],
    });

    if (response.stop_reason === "max_tokens") {
      console.error("generateStandingsMessage: response truncated at max_tokens");
      return null;
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const body = textBlock?.text.trim();
    if (!body) return null;
    const header =
      configuredTone === "random" ? `Standings Update (random tone: ${toneLabel(tone)})` : "Standings Update";
    return `${header}\n${body}`;
  } catch (err) {
    console.error("generateStandingsMessage error:", err);
    return null;
  }
}
