"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DIVISIONS } from "@/lib/domain/divisions";
import type { Division } from "@/lib/supabase/types";

interface Team {
  id: number;
  name: string;
  conference: string;
  division: string;
}

export function DivisionWinnersForm({
  teams,
  existing,
}: {
  teams: Team[];
  existing: Map<Division, number>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Division | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setWinner(division: Division, teamId: number) {
    setPending(division);
    setError(null);
    const res = await fetch("/api/admin/division-winners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division, teamId }),
    });
    const body = await res.json();
    setPending(null);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DIVISIONS.map((division) => {
        const [conference, ...rest] = division.split(" ");
        const divisionName = rest.join(" ");
        const options = teams.filter(
          (t) => t.conference === conference && t.division === divisionName,
        );
        return (
          <label key={division} className="flex items-center justify-between gap-3 text-sm">
            {division}
            <select
              defaultValue={existing.get(division) ?? ""}
              disabled={pending === division}
              onChange={(e) => setWinner(division, Number(e.target.value))}
              className="rounded-md border border-border bg-bg px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                — select —
              </option>
              {options.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {error && <p className="col-span-full text-sm text-bad">{error}</p>}
    </div>
  );
}
