import { createClient } from "@/lib/supabase/server";
import type { Division } from "@/lib/supabase/types";
import { DivisionForm } from "./division-form";
import { TiebreakerForm } from "./tiebreaker-form";

export const dynamic = "force-dynamic";

export default async function MyPicksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p>Sign in to see your picks.</p>
      </main>
    );
  }

  const [
    { data: pickScores },
    { data: teams },
    { data: divisionPredictions },
    { data: tiebreaker },
  ] = await Promise.all([
    supabase
      .from("draft_pick_scores")
      .select(
        "pick_id, team_id, side, wins, games_played, win_total_line, resolved, correct, points",
      )
      .eq("user_id", user.id),
    supabase.from("teams").select("id, name, conference, division"),
    supabase
      .from("division_predictions")
      .select("division, predicted_team_id")
      .eq("user_id", user.id),
    supabase
      .from("tiebreaker_predictions")
      .select("points_guess")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const existingDivisionPicks = new Map<Division, number>(
    (divisionPredictions ?? []).map((p) => [p.division as Division, p.predicted_team_id]),
  );

  const totalPoints = (pickScores ?? []).reduce((sum, p) => sum + p.points, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Picks</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {totalPoints} draft point{totalPoints === 1 ? "" : "s"} so far.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full text-sm">
            <thead className="bg-black/[.03] text-left dark:bg-white/[.05]">
              <tr>
                <th className="px-4 py-2 font-medium">Team</th>
                <th className="px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2 font-medium">Line</th>
                <th className="px-4 py-2 font-medium">Record</th>
                <th className="px-4 py-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {(pickScores ?? []).map((pick) => {
                const team = teamById.get(pick.team_id);
                return (
                  <tr key={pick.pick_id} className="border-t border-black/10 dark:border-white/15">
                    <td className="px-4 py-2 font-medium">{team?.name ?? pick.team_id}</td>
                    <td className="px-4 py-2 capitalize">{pick.side}</td>
                    <td className="px-4 py-2">{pick.win_total_line ?? "—"}</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {pick.wins}-{pick.games_played - pick.wins} ({pick.games_played}/17)
                    </td>
                    <td className="px-4 py-2 font-semibold">
                      {pick.resolved ? pick.points : "pending"}
                    </td>
                  </tr>
                );
              })}
              {(!pickScores || pickScores.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No picks yet — head to the draft.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Division winners</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          1 point per correct pick. Lock these in before Week 1.
        </p>
        <div className="mt-4">
          <DivisionForm teams={teams ?? []} existing={existingDivisionPicks} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Tiebreaker</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Only used if the final standings are tied.
        </p>
        <div className="mt-4">
          <TiebreakerForm existing={tiebreaker?.points_guess ?? null} />
        </div>
      </div>
    </main>
  );
}
