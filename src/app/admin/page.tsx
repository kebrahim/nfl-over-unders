import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import type { Division } from "@/lib/supabase/types";
import { WinTotalForm } from "./win-total-form";
import { DivisionWinnersForm } from "./division-winners-form";
import { Participants } from "./participants";
import { StartDraftButton } from "../draft/start-draft-button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile?.is_commissioner) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <p className="text-ink-muted">Commissioner access only.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const [
    { data: teams },
    { data: divisionWinners },
    { data: session },
    { data: recentPicks },
    { data: participants },
    { data: divisionPredictions },
    { data: tiebreakers },
    { data: allDraftPicks },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, conference, division, win_total_line")
      .order("name"),
    supabase.from("division_winners").select("division, team_id"),
    supabase
      .from("draft_sessions")
      .select("id, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("draft_picks")
      .select("id, pick_number, team_id, side, user_id")
      .order("pick_number", { ascending: false })
      .limit(10),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
    supabase.from("division_predictions").select("user_id, division, predicted_team_id"),
    supabase.from("tiebreaker_predictions").select("user_id, points_guess"),
    supabase.from("draft_picks").select("user_id, team_id, side, pick_number"),
  ]);

  const existingWinners = new Map<Division, number>(
    (divisionWinners ?? []).map((w) => [w.division as Division, w.team_id]),
  );

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const divisionPicksByUser = new Map<string, { division: string; teamName: string }[]>();
  for (const p of divisionPredictions ?? []) {
    const list = divisionPicksByUser.get(p.user_id) ?? [];
    list.push({ division: p.division, teamName: teamById.get(p.predicted_team_id)?.name ?? "?" });
    divisionPicksByUser.set(p.user_id, list);
  }

  const tiebreakerByUser = new Map((tiebreakers ?? []).map((t) => [t.user_id, t.points_guess]));

  const draftPicksByUser = new Map<
    string,
    { pickNumber: number; teamName: string; side: string }[]
  >();
  for (const dp of allDraftPicks ?? []) {
    const list = draftPicksByUser.get(dp.user_id) ?? [];
    list.push({
      pickNumber: dp.pick_number,
      teamName: teamById.get(dp.team_id)?.name ?? "?",
      side: dp.side,
    });
    draftPicksByUser.set(dp.user_id, list);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
          Admin
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Commissioner tools.</p>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Participants
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Everyone&apos;s nickname, email, and picks at a glance.
        </p>
        <div className="mt-4">
          <Participants
            participants={participants ?? []}
            divisionPicksByUser={divisionPicksByUser}
            tiebreakerByUser={tiebreakerByUser}
            draftPicksByUser={draftPicksByUser}
          />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">Draft</h2>
        <p className="mt-1 text-sm text-ink-muted">Status: {session?.status ?? "not started"}</p>
        {!session || session.status === "completed" ? (
          <div className="mt-3">
            <StartDraftButton />
          </div>
        ) : null}
        {recentPicks && recentPicks.length > 0 && (
          <ol className="mt-4 space-y-1 text-sm text-ink-muted">
            {recentPicks.map((p) => (
              <li key={p.id}>
                #{p.pick_number} — team {p.team_id} {p.side}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Win-total lines
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Set before the draft starts. Use half-point lines to avoid pushes.
        </p>
        <div className="mt-4">
          <WinTotalForm teams={teams ?? []} />
        </div>
      </div>

      <div>
        <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">
          Division winners
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Record the actual winners once the regular season ends.
        </p>
        <div className="mt-4">
          <DivisionWinnersForm teams={teams ?? []} existing={existingWinners} />
        </div>
      </div>
    </main>
  );
}
