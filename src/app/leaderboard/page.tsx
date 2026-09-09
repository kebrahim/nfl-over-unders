import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import { TeamLogo } from "@/components/team-logo";
import {
  DEMO_LEAGUE_TOTAL_POINTS,
  DEMO_TEAMS,
  DEMO_TIEBREAKER_PREDICTIONS,
  demoDraftPickScores,
  demoOverallLeaderboard,
} from "@/lib/demo/data";

export const dynamic = "force-dynamic";

type PickScore = {
  pick_id: string;
  user_id: string;
  team_id: number;
  side: string;
  wins: number;
  games_played: number;
  win_total_line: number | null;
  resolved: boolean;
  points: number;
};
type Team = { id: number; name: string; code: string };

export default async function LeaderboardPage() {
  const profile = await getCurrentProfile();

  let rows: { user_id: string; display_name: string; draft_points: number; division_points: number; total_points: number }[];
  let guessByUser: Map<string, number>;
  let leaguePoints: { total_points: number; games_final: number } | null;
  let pickScores: PickScore[];
  let teams: Team[];

  if (profile?.is_demo) {
    rows = demoOverallLeaderboard();
    guessByUser = new Map(Object.entries(DEMO_TIEBREAKER_PREDICTIONS));
    leaguePoints = DEMO_LEAGUE_TOTAL_POINTS;
    pickScores = demoDraftPickScores();
    teams = DEMO_TEAMS;
  } else {
    const supabase = await createClient();
    const [
      { data: leaderboard },
      { data: tiebreakers },
      { data: fetchedLeaguePoints },
      { data: fetchedPickScores },
      { data: fetchedTeams },
    ] = await Promise.all([
      supabase
        .from("overall_leaderboard")
        .select("user_id, display_name, draft_points, division_points, total_points")
        .order("total_points", { ascending: false }),
      supabase.from("tiebreaker_predictions").select("user_id, points_guess"),
      supabase.from("league_total_points").select("total_points, games_final").single(),
      supabase
        .from("draft_pick_scores")
        .select("pick_id, user_id, team_id, side, wins, games_played, win_total_line, resolved, points")
        .order("pick_number"),
      supabase.from("teams").select("id, name, code"),
    ]);
    rows = leaderboard ?? [];
    guessByUser = new Map((tiebreakers ?? []).map((t) => [t.user_id, t.points_guess]));
    leaguePoints = fetchedLeaguePoints;
    pickScores = fetchedPickScores ?? [];
    teams = fetchedTeams ?? [];
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const picksByUser = new Map<string, PickScore[]>();
  for (const pick of pickScores) {
    const list = picksByUser.get(pick.user_id) ?? [];
    list.push(pick);
    picksByUser.set(pick.user_id, list);
  }

  const topScore = rows[0]?.total_points;
  const leadersTied = rows.filter((r) => r.total_points === topScore).length > 1;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
        Leaderboard
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        Draft points + division bonus points. Updates as games go final.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left">
            <tr>
              <th className="px-4 py-2 font-medium text-ink-muted">Player</th>
              <th className="px-4 py-2 font-medium text-ink-muted">Draft</th>
              <th className="px-4 py-2 font-medium text-ink-muted">Divisions</th>
              <th className="px-4 py-2 font-medium text-ink-muted">Total</th>
              {leadersTied && (
                <th className="px-4 py-2 font-medium text-ink-muted">Tiebreaker guess</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.user_id} className={i > 0 ? "border-t border-border" : ""}>
                <td className="px-4 py-2 font-medium">{row.display_name}</td>
                <td className="px-4 py-2">{row.draft_points}</td>
                <td className="px-4 py-2">{row.division_points}</td>
                <td className="px-4 py-2 font-semibold text-accent">{row.total_points}</td>
                {leadersTied && (
                  <td className="px-4 py-2 text-ink-muted">
                    {guessByUser.get(row.user_id) ?? "—"}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No players yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaguePoints && (
        <p className="mt-4 text-sm text-ink-muted">
          League-wide points scored so far: {leaguePoints.total_points} across{" "}
          {leaguePoints.games_final} completed games.
        </p>
      )}

      <div className="mt-12 space-y-6">
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Everyone&apos;s Picks
        </h2>
        {rows.map((row) => {
          const picks = (picksByUser.get(row.user_id) ?? []).sort(
            (a, b) => (teamById.get(a.team_id)?.name ?? "").localeCompare(teamById.get(b.team_id)?.name ?? ""),
          );
          return (
            <div key={row.user_id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
                <p className="font-heading font-semibold tracking-wide uppercase">
                  {row.display_name}
                </p>
                <p className="text-sm text-ink-muted">
                  {row.draft_points} draft pt{row.draft_points === 1 ? "" : "s"}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="px-4 py-1.5 font-medium text-ink-muted">Team</th>
                    <th className="px-4 py-1.5 font-medium text-ink-muted">Side</th>
                    <th className="px-4 py-1.5 font-medium text-ink-muted">Line</th>
                    <th className="px-4 py-1.5 font-medium text-ink-muted">Record</th>
                    <th className="px-4 py-1.5 font-medium text-ink-muted">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick) => {
                    const team = teamById.get(pick.team_id);
                    return (
                      <tr key={pick.pick_id} className="border-t border-border">
                        <td className="px-4 py-1.5 font-medium">
                          <div className="flex items-center gap-2">
                            {team && <TeamLogo code={team.code} name={team.name} size={18} />}
                            {team?.name ?? pick.team_id}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 capitalize">{pick.side}</td>
                        <td className="px-4 py-1.5">{pick.win_total_line ?? "—"}</td>
                        <td className="px-4 py-1.5 text-ink-muted">
                          {pick.wins}-{pick.games_played - pick.wins} ({pick.games_played}/17)
                        </td>
                        <td className="px-4 py-1.5 font-semibold text-accent">
                          {pick.resolved ? pick.points : "pending"}
                        </td>
                      </tr>
                    );
                  })}
                  {picks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-ink-muted">
                        No picks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </main>
  );
}
