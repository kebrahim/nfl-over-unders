"use client";

import { useActionState } from "react";
import { saveTiebreaker, type PredictionFormState } from "./actions";

const initialState: PredictionFormState = { error: null, success: false };

export function TiebreakerForm({ existing }: { existing: number | null }) {
  const [state, action, pending] = useActionState(saveTiebreaker, initialState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="points_guess" className="text-sm font-medium">
          Total points scored, all regular-season games
        </label>
        <input
          id="points_guess"
          name="points_guess"
          type="number"
          min={1}
          step={1}
          defaultValue={existing ?? undefined}
          className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Saving…" : "Save guess"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && (
        <p className="w-full text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}
    </form>
  );
}
