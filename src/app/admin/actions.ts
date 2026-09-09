"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { DIVISIONS } from "@/lib/domain/divisions";
import { normalizeUsPhone } from "@/lib/domain/phone";
import { sendOptInConfirmation } from "@/lib/notify/sms";

export interface AdminFormState {
  error: string | null;
  success: boolean;
}

export async function saveWinTotalLines(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) return { error: "Commissioner only.", success: false };

  const updates = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("line:"))
    .map(([key, value]) => ({
      id: Number(key.replace("line:", "")),
      win_total_line: value === "" ? null : Number(value),
      win_total_source: "manual" as const,
      win_total_updated_at: new Date().toISOString(),
    }))
    .filter((row) => Number.isFinite(row.id));

  for (const row of updates) {
    const { error } = await supabase
      .from("teams")
      .update({
        win_total_line: row.win_total_line,
        win_total_source: row.win_total_source,
        win_total_updated_at: row.win_total_updated_at,
      })
      .eq("id", row.id);
    if (error) return { error: error.message, success: false };
  }

  revalidatePath("/admin");
  revalidatePath("/standings");
  return { error: null, success: true };
}

export async function saveDivisionWinners(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) return { error: "Commissioner only.", success: false };

  for (const division of DIVISIONS) {
    const raw = formData.get(`division:${division}`);
    const teamId = raw ? Number(raw) : null;

    if (teamId) {
      const { error } = await supabase
        .from("division_winners")
        .upsert({ division, team_id: teamId }, { onConflict: "division" });
      if (error) return { error: error.message, success: false };
    } else {
      const { error } = await supabase.from("division_winners").delete().eq("division", division);
      if (error) return { error: error.message, success: false };
    }
  }

  revalidatePath("/admin");
  revalidatePath("/leaderboard");
  revalidatePath("/my-picks");
  return { error: null, success: true };
}

export async function savePlayerPhone(
  _prevState: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_commissioner")
    .eq("id", user.id)
    .single();
  if (!profile?.is_commissioner) return { error: "Commissioner only.", success: false };

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Missing player.", success: false };

  const raw = String(formData.get("phone") ?? "").trim();
  const phone = raw ? normalizeUsPhone(raw) : null;
  if (raw && !phone) {
    return { error: "Enter a valid 10-digit US phone number.", success: false };
  }

  // profiles has no commissioner-write RLS policy (only self-update), so
  // this needs the service role — the is_commissioner check above is the
  // authorization gate.
  const db = createServiceRoleClient();
  const { data: existing } = await db.from("profiles").select("phone").eq("id", userId).single();

  // Adding or changing a number on someone else's behalf requires the
  // commissioner to affirmatively confirm consent was obtained — this is
  // the actual, enforced record of that second opt-in path, not just a
  // claim in a policy document.
  if (phone && phone !== existing?.phone && formData.get("confirmed") !== "on") {
    return {
      error: "Check the confirmation box to confirm you asked them before adding this number.",
      success: false,
    };
  }

  const { error } = await db.from("profiles").update({ phone }).eq("id", userId);
  if (error) return { error: error.message, success: false };

  if (phone && !existing?.phone) {
    await sendOptInConfirmation(phone);
  }

  revalidatePath("/admin");
  return { error: null, success: true };
}
