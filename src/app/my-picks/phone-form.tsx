"use client";

import { useActionState } from "react";
import { savePhone, type PredictionFormState } from "./actions";

const initialState: PredictionFormState = { error: null, success: false };

export function PhoneForm({ existing }: { existing: string | null }) {
  const [state, action, pending] = useActionState(savePhone, initialState);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium">
          Phone number (optional)
        </label>
        <input
          key={existing ?? "empty"}
          id="phone"
          name="phone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={existing ?? undefined}
          className="w-48 rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" defaultChecked={false} className="mt-0.5" />
        <span>
          Yes, send me SMS/MMS text updates from Gridiron (gridiron.zebrahim.com) — draft turn
          alerts, pick updates, and score notifications. Message frequency varies. Message and
          data rates may apply. Reply STOP to opt out at any time, or HELP for help.
        </span>
      </label>
      <p className="text-xs text-ink-muted">
        This is entirely optional — leaving it unchecked doesn&apos;t affect your participation in
        the contest.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="text-sm text-bad">{state.error}</p>}
      {state.success && <p className="text-sm text-good">Saved.</p>}
    </form>
  );
}
