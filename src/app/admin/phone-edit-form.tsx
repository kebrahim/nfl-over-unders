"use client";

import { useActionState } from "react";
import { savePlayerPhone, type AdminFormState } from "./actions";

const initialState: AdminFormState = { error: null, success: false };

export function PhoneEditForm({
  userId,
  displayName,
  existing,
}: {
  userId: string;
  displayName: string;
  existing: string | null;
}) {
  const [state, action, pending] = useActionState(savePlayerPhone, initialState);

  return (
    <form action={action} className="mt-1 space-y-1.5">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          key={existing ?? "empty"}
          name="phone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={existing ?? undefined}
          className="w-40 rounded-md border border-border bg-bg px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && <span className="text-xs text-bad">{state.error}</span>}
        {state.success && <span className="text-xs text-good">Saved.</span>}
      </div>
      <label className="flex items-start gap-1.5 text-xs text-ink-muted">
        <input type="checkbox" name="confirmed" className="mt-0.5" />
        <span>
          I confirmed directly with {displayName} that they want to receive text updates before
          entering this number. (Only required when adding or changing a number.)
        </span>
      </label>
    </form>
  );
}
