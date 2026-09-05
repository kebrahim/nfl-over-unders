import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/current-user";
import type { Division } from "@/lib/supabase/types";
import { WinTotalForm } from "./win-total-form";
import { DivisionWinnersForm } from "./division-winners-form";
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
  const [{ data: teams }, { data: divisionWinners }, { data: session }, { data: recentPicks }] =
    await Promise.all([
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
    ]);

  const existingWinners = new Map<Division, number>(
    (divisionWinners ?? []).map((w) => [w.division as Division, w.team_id]),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-6 py-12">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
          Admin
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Commissioner tools.</p>
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
