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
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Draft points + division bonus points. Updates as games go final.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
        <table className="w-full text-sm">
          <thead className="bg-black/[.03] text-left dark:bg-white/[.05]">
            <tr>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">Draft</th>
              <th className="px-4 py-2 font-medium">Divisions</th>
              <th className="px-4 py-2 font-medium">Total</th>
              {leadersTied && <th className="px-4 py-2 font-medium">Tiebreaker guess</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.user_id}
                className={i > 0 ? "border-t border-black/10 dark:border-white/15" : ""}
              >
                <td className="px-4 py-2 font-medium">{row.display_name}</td>
                <td className="px-4 py-2">{row.draft_points}</td>
                <td className="px-4 py-2">{row.division_points}</td>
                <td className="px-4 py-2 font-semibold">{row.total_points}</td>
                {leadersTied && (
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {guessByUser.get(row.user_id) ?? "—"}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No players yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {leaguePoints && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          League-wide points scored so far: {leaguePoints.total_points} across{" "}
          {leaguePoints.games_final} completed games.
        </p>
      )}
    </main>
  );
}
