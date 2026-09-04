import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isDraftComplete, roundForPick, userIdOnTheClock } from "@/lib/domain/draft";
import type { Side } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  const teamId = Number(body?.teamId);
  const side = body?.side as Side | undefined;
  if (!sessionId || !Number.isFinite(teamId) || (side !== "over" && side !== "under")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: session, error: sessionError } = await db
    .from("draft_sessions")
    .select("id, status, snake_order, current_pick_index, total_rounds")
    .eq("id", sessionId)
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "Draft session not found." }, { status: 404 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ error: "This draft isn't active." }, { status: 409 });
  }

  const onTheClock = userIdOnTheClock(session.snake_order, session.current_pick_index);
  if (onTheClock !== user.id) {
    return NextResponse.json({ error: "It's not your turn." }, { status: 403 });
  }

  const pickNumber = session.current_pick_index + 1;
  const round = roundForPick(pickNumber, session.snake_order.length);

  const { data: pick, error: pickError } = await db
    .from("draft_picks")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      team_id: teamId,
      side,
      round,
      pick_number: pickNumber,
    })
    .select()
    .single();

  if (pickError) {
    if (pickError.code === "23505") {
      return NextResponse.json(
        { error: "That team/side was just taken, or this pick already happened." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: pickError.message }, { status: 500 });
  }

  const nextPickIndex = session.current_pick_index + 1;
  const complete = isDraftComplete(nextPickIndex, session.snake_order.length);

  const { error: updateError } = await db
    .from("draft_sessions")
    .update({
      current_pick_index: nextPickIndex,
      current_round: roundForPick(nextPickIndex + 1, session.snake_order.length),
      status: complete ? "completed" : "active",
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq("id", sessionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ pick });
}
