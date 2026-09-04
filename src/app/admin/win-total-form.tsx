"use client";

import { useActionState } from "react";
import { saveWinTotalLines, type AdminFormState } from "./actions";

const initialState: AdminFormState = { error: null, success: false };

interface Team {
  id: number;
  name: string;
  win_total_line: number | null;
}

export function WinTotalForm({ teams }: { teams: Team[] }) {
  const [state, action, pending] = useActionState(saveWinTotalLines, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {teams.map((team) => (
          <label key={team.id} className="flex items-center justify-between gap-3 text-sm">
            {team.name}
            <input
              type="number"
              step={0.5}
              name={`line:${team.id}`}
              defaultValue={team.win_total_line ?? ""}
              className="w-20 rounded-md border border-black/10 bg-transparent px-2 py-1 text-right dark:border-white/15"
            />
          </label>
        ))}
      </div>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Saving…" : "Save win totals"}
      </button>
    </form>
  );
}
