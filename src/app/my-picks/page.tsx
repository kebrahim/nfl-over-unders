import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import type { Division } from "@/lib/supabase/types";
import { divisionPicksLocked, DIVISION_PICKS_LOCK_AT } from "@/lib/domain/season";
import {
  DEMO_DIVISION_PREDICTIONS,
  DEMO_TEAMS,
  DEMO_TIEBREAKER_PREDICTIONS,
  DEMO_VIEWER_ID,
  demoDraftPickScores,
} from "@/lib/demo/data";
import { TeamLogo } from "@/components/team-logo";
import { DivisionForm } from "./division-form";
import { TiebreakerForm } from "./tiebreaker-form";

export const dynamic = "force-dynamic";

export default async function MyPicksPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p>Sign in to see your picks.</p>
      </main>
    );
  }

  const isDemo = profile.is_demo;

  type PickScore = {
    pick_id: string;
    team_id: number;
    side: string;
    wins: number;
    games_played: number;
    win_total_line: number | null;
    resolved: boolean;
    points: number;
  };
  type Team = { id: number; name: string; code: string; conference: string; division: string };

  let pickScores: PickScore[];
  let teams: Team[];
  let existingDivisionPicks: Map<Division, number>;
  let tiebreakerGuess: number | null;

  if (isDemo) {
    pickScores = demoDraftPickScores(DEMO_VIEWER_ID);
    teams = DEMO_TEAMS;
    existingDivisionPicks = new Map(
      DEMO_DIVISION_PREDICTIONS.filter((p) => p.user_id === DEMO_VIEWER_ID).map((p) => [
        p.division,
        p.predicted_team_id,
      ]),
    );
    tiebreakerGuess = DEMO_TIEBREAKER_PREDICTIONS[DEMO_VIEWER_ID] ?? null;
  } else {
    const supabase = await createClient();
    const [
      { data: fetchedPickScores },
      { data: fetchedTeams },
      { data: divisionPredictions },
      { data: tiebreaker },
    ] = await Promise.all([
      supabase
        .from("draft_pick_scores")
        .select(
          "pick_id, team_id, side, wins, games_played, win_total_line, resolved, correct, points",
        )
        .eq("user_id", profile.id),
      supabase.from("teams").select("id, name, code, conference, division"),
      supabase
        .from("division_predictions")
        .select("division, predicted_team_id")
        .eq("user_id", profile.id),
      supabase
        .from("tiebreaker_predictions")
        .select("points_guess")
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);
    pickScores = fetchedPickScores ?? [];
    teams = fetchedTeams ?? [];
    existingDivisionPicks = new Map(
      (divisionPredictions ?? []).map((p) => [p.division as Division, p.predicted_team_id]),
    );
    tiebreakerGuess = tiebreaker?.points_guess ?? null;
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const totalPoints = pickScores.reduce((sum, p) => sum + p.points, 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
          My Picks
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {totalPoints} draft point{totalPoints === 1 ? "" : "s"} so far.
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left">
              <tr>
                <th className="px-4 py-2 font-medium text-ink-muted">Team</th>
                <th className="px-4 py-2 font-medium text-ink-muted">Side</th>
                <th className="px-4 py-2 font-medium text-ink-muted">Line</th>
                <th className="px-4 py-2 font-medium text-ink-muted">Record</th>
                <th className="px-4 py-2 font-medium text-ink-muted">Points</th>
              </tr>
            </thead>
            <tbody>
              {pickScores.map((pick) => {
                const team = teamById.get(pick.team_id);
                return (
                  <tr key={pick.pick_id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        {team && <TeamLogo code={team.code} name={team.name} size={20} />}
                        {team?.name ?? pick.team_id}
                      </div>
                    </td>
                    <td className="px-4 py-2 capitalize">{pick.side}</td>
                    <td className="px-4 py-2">{pick.win_total_line ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {pick.wins}-{pick.games_played - pick.wins} ({pick.games_played}/17)
                    </td>
                    <td className="px-4 py-2 font-semibold text-accent">
                      {pick.resolved ? pick.points : "pending"}
                    </td>
                  </tr>
                );
              })}
              {pickScores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No picks yet — head to the draft.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Division winners
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          1 point per correct pick.{" "}
          {isDemo ? null : divisionPicksLocked() ? (
            <span className="text-bad">Locked — the season has started.</span>
          ) : (
            <>
              Locks at kickoff:{" "}
              {new Date(DIVISION_PICKS_LOCK_AT).toLocaleString("en-US", {
                timeZone: "America/New_York",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              ET.
            </>
          )}
        </p>
        <div className="mt-4">
          <DivisionForm
            teams={teams}
            existing={existingDivisionPicks}
            locked={isDemo || divisionPicksLocked()}
          />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Tiebreaker
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Only used if the final standings are tied.
        </p>
        <div className="mt-4">
          {isDemo ? (
            <p className="text-sm">
              Your guess: <span className="font-semibold text-accent">{tiebreakerGuess}</span>{" "}
              points
            </p>
          ) : (
            <TiebreakerForm existing={tiebreakerGuess} />
          )}
        </div>
      </div>
    </main>
  );
}
