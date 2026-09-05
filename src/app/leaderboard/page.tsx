import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: leaderboard }, { data: tiebreakers }, { data: leaguePoints }] =
    await Promise.all([
      supabase
        .from("overall_leaderboard")
        .select("user_id, display_name, draft_points, division_points, total_points")
        .order("total_points", { ascending: false }),
      supabase
        .from("tiebreaker_predictions")
        .select("user_id, points_guess"),
      supabase.from("league_total_points").select("total_points, games_final").single(),
    ]);

  const rows = leaderboard ?? [];
  const topScore = rows[0]?.total_points;
  const leadersTied = rows.filter((r) => r.total_points === topScore).length > 1;

  const guessByUser = new Map((tiebreakers ?? []).map((t) => [t.user_id, t.points_guess]));

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
    </main>
  );
}
