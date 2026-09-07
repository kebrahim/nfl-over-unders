"use client";

import { useActionState } from "react";
import { savePhone, type PredictionFormState } from "./actions";

const initialState: PredictionFormState = { error: null, success: false };

export function PhoneForm({ existing }: { existing: string | null }) {
  const [state, action, pending] = useActionState(savePhone, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="(555) 123-4567"
          defaultValue={existing ?? undefined}
          className="w-48 rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="w-full text-sm text-bad">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-good">Saved.</p>}
    </form>
  );
}
