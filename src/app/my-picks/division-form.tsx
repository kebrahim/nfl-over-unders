"use client";

import { useActionState } from "react";
import { saveDivisionPredictions, type PredictionFormState } from "./actions";
import { DIVISIONS } from "@/lib/domain/divisions";
import type { Division } from "@/lib/supabase/types";

const initialState: PredictionFormState = { error: null, success: false };

interface Team {
  id: number;
  name: string;
  conference: string;
  division: string;
}

export function DivisionForm({
  teams,
  existing,
}: {
  teams: Team[];
  existing: Map<Division, number>;
}) {
  const [state, action, pending] = useActionState(saveDivisionPredictions, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {DIVISIONS.map((division) => {
          const [conference, ...rest] = division.split(" ");
          const divisionName = rest.join(" ");
          const options = teams.filter(
            (t) => t.conference === conference && t.division === divisionName,
          );

          return (
            <div key={division} className="space-y-1">
              <label className="text-sm font-medium">{division}</label>
              <select
                name={`division:${division}`}
                defaultValue={existing.get(division) ?? ""}
                className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              >
                <option value="">— pick a team —</option>
                {options.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Saving…" : "Save division picks"}
      </button>
    </form>
  );
}
