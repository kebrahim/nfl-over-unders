import { createClient } from "@/lib/supabase/server";
import type { Conference, DivisionName } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const CONFERENCES: Conference[] = ["AFC", "NFC"];
const DIVISION_NAMES: DivisionName[] = ["East", "North", "South", "West"];

export default async function StandingsPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: records }] = await Promise.all([
    supabase.from("teams").select("id, name, code, conference, division, win_total_line"),
    supabase.from("team_records").select("team_id, wins, losses, ties, games_played"),
  ]);

  const recordByTeam = new Map((records ?? []).map((r) => [r.team_id, r]));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Standings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Live records against each team&apos;s win-total line.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {CONFERENCES.map((conference) => (
          <div key={conference} className="space-y-6">
            <h2 className="text-lg font-semibold">{conference}</h2>
            {DIVISION_NAMES.map((division) => {
              const divisionTeams = (teams ?? [])
                .filter((t) => t.conference === conference && t.division === division)
                .sort((a, b) => {
                  const ra = recordByTeam.get(a.id);
                  const rb = recordByTeam.get(b.id);
                  return (rb?.wins ?? 0) - (ra?.wins ?? 0);
                });

              return (
                <div key={division}>
                  <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    {conference} {division}
                  </h3>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {divisionTeams.map((team) => {
                        const record = recordByTeam.get(team.id);
                        const wins = record?.wins ?? 0;
                        const losses = record?.losses ?? 0;
                        const ties = record?.ties ?? 0;
                        const line = team.win_total_line;
                        const onPace =
                          line != null
                            ? wins > line
                              ? "over"
                              : wins < line
                                ? "under"
                                : "push"
                            : null;

                        return (
                          <tr
                            key={team.id}
                            className="border-t border-black/10 dark:border-white/15"
                          >
                            <td className="py-1.5 pr-2 font-medium">{team.name}</td>
                            <td className="py-1.5 pr-2 text-zinc-600 dark:text-zinc-400">
                              {wins}-{losses}
                              {ties ? `-${ties}` : ""}
                            </td>
                            <td className="py-1.5 pr-2 text-zinc-500">
                              {line != null ? `Line ${line}` : "No line set"}
                            </td>
                            <td className="py-1.5 text-right">
                              {onPace && (
                                <span
                                  className={
                                    onPace === "over"
                                      ? "text-green-600 dark:text-green-400"
                                      : onPace === "under"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-zinc-500"
                                  }
                                >
                                  {onPace === "push" ? "on the line" : `on pace: ${onPace}`}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
