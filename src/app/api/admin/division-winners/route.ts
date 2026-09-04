import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/domain/divisions";
import type { Division } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) {
    return NextResponse.json({ error: "Commissioner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const division = body?.division as Division | undefined;
  const teamId = Number(body?.teamId);
  if (!division || !DIVISIONS.includes(division) || !Number.isFinite(teamId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { error } = await supabase
    .from("division_winners")
    .upsert({ division, team_id: teamId }, { onConflict: "division" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
