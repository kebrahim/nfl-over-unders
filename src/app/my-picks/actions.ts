"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DIVISIONS } from "@/lib/domain/divisions";
import { divisionPicksLocked } from "@/lib/domain/season";
import { normalizeUsPhone } from "@/lib/domain/phone";
import { sendOptInConfirmation } from "@/lib/notify/sms";
import type { Division } from "@/lib/supabase/types";

export interface PredictionFormState {
  error: string | null;
  success: boolean;
}

export async function saveDivisionPredictions(
  _prevState: PredictionFormState,
  formData: FormData,
): Promise<PredictionFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", success: false };
  if (divisionPicksLocked()) {
    return { error: "Division picks are locked — the season has started.", success: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_demo")
    .eq("id", user.id)
    .single();
  if (profile?.is_demo) {
    return { error: "Demo accounts are read-only.", success: false };
  }

  const rows = DIVISIONS.map((division) => {
    const teamId = formData.get(`division:${division}`);
    return teamId ? { user_id: user.id, division: division as Division, predicted_team_id: Number(teamId) } : null;
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return { error: "Pick at least one division.", success: false };

  const { error } = await supabase
    .from("division_predictions")
    .upsert(rows, { onConflict: "user_id,division" });

  if (error) return { error: error.message, success: false };

  revalidatePath("/my-picks");
  return { error: null, success: true };
}

export async function saveTiebreaker(
  _prevState: PredictionFormState,
  formData: FormData,
): Promise<PredictionFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", success: false };
  if (divisionPicksLocked()) {
    return { error: "The tiebreaker guess is locked — the season has started.", success: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_demo")
    .eq("id", user.id)
    .single();
  if (profile?.is_demo) {
    return { error: "Demo accounts are read-only.", success: false };
  }

  const guess = Number(formData.get("points_guess"));
  if (!Number.isFinite(guess) || guess <= 0) {
    return { error: "Enter a positive number.", success: false };
  }

  const { error } = await supabase
    .from("tiebreaker_predictions")
    .upsert({ user_id: user.id, points_guess: guess }, { onConflict: "user_id" });

  if (error) return { error: error.message, success: false };

  revalidatePath("/my-picks");
  return { error: null, success: true };
}

export async function savePhone(
  _prevState: PredictionFormState,
  formData: FormData,
): Promise<PredictionFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", success: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_demo, phone")
    .eq("id", user.id)
    .single();
  if (profile?.is_demo) {
    return { error: "Demo accounts are read-only.", success: false };
  }

  const raw = String(formData.get("phone") ?? "").trim();
  const phone = raw ? normalizeUsPhone(raw) : null;
  if (raw && !phone) {
    return { error: "Enter a valid 10-digit US phone number.", success: false };
  }

  // The checkbox is the actual opt-in — a phone number is never saved
  // without it checked, so consent is enforced here, not just claimed.
  if (phone && formData.get("consent") !== "on") {
    return { error: "Check the box to opt in before saving your number.", success: false };
  }

  const { error } = await supabase.from("profiles").update({ phone }).eq("id", user.id);
  if (error) return { error: error.message, success: false };

  if (phone && !profile?.phone) {
    await sendOptInConfirmation(phone);
  }

  revalidatePath("/my-picks");
  revalidatePath("/admin");
  return { error: null, success: true };
}
