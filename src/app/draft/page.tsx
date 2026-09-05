import { createClient } from "@/lib/supabase/server";
import { DraftBoard } from "./draft-board";
import { StartDraftButton } from "./start-draft-button";

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: teams }, { data: profiles }, { data: session }] =
    await Promise.all([
      user
        ? supabase.from("profiles").select("is_commissioner").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("teams")
        .select("id, name, code, conference, division")
        .order("conference")
        .order("division")
        .order("name"),
      supabase.from("profiles").select("id, display_name"),
      supabase
        .from("draft_sessions")
        .select("id, status, snake_order, current_pick_index, total_rounds, current_round")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const picks = session
    ? (
        await supabase
          .from("draft_picks")
          .select("id, user_id, team_id, side, round, pick_number")
          .eq("session_id", session.id)
          .order("pick_number")
      ).data
    : null;

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
          Draft
        </h1>
        <p className="mt-2 text-sm text-ink-muted">The draft hasn&apos;t started yet.</p>
        {profile?.is_commissioner && (
          <div className="mt-6">
            <StartDraftButton />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="font-heading text-2xl font-semibold tracking-wide text-accent uppercase">
        Draft
      </h1>
      <DraftBoard
        session={session}
        initialPicks={picks ?? []}
        teams={teams ?? []}
        players={profiles ?? []}
        currentUserId={user?.id ?? null}
      />
    </main>
  );
}
