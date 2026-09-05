interface Participant {
  id: string;
  display_name: string;
  email: string;
}

interface DivisionPick {
  division: string;
  teamName: string;
}

interface DraftPick {
  pickNumber: number;
  teamName: string;
  side: string;
}

export function Participants({
  participants,
  divisionPicksByUser,
  tiebreakerByUser,
  draftPicksByUser,
}: {
  participants: Participant[];
  divisionPicksByUser: Map<string, DivisionPick[]>;
  tiebreakerByUser: Map<string, number>;
  draftPicksByUser: Map<string, DraftPick[]>;
}) {
  return (
    <div className="space-y-4">
      {participants.map((p) => {
        const divisionPicks = divisionPicksByUser.get(p.id) ?? [];
        const draftPicks = (draftPicksByUser.get(p.id) ?? []).sort(
          (a, b) => a.pickNumber - b.pickNumber,
        );
        const tiebreaker = tiebreakerByUser.get(p.id);

        return (
          <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-heading font-semibold tracking-wide text-accent uppercase">
              {p.display_name}
            </p>
            <p className="text-sm text-ink-muted">{p.email}</p>

            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Draft picks
                </p>
                {draftPicks.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {draftPicks.map((pick, i) => (
                      <li key={i}>
                        #{pick.pickNumber} {pick.teamName} <span className="capitalize">{pick.side}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">None yet</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Division picks
                </p>
                {divisionPicks.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {divisionPicks.map((pick) => (
                      <li key={pick.division}>
                        {pick.division}: {pick.teamName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">None yet</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
                  Tiebreaker
                </p>
                <p className="mt-1 text-sm">
                  {tiebreaker != null ? `${tiebreaker} points` : (
                    <span className="text-ink-muted">None yet</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      {participants.length === 0 && <p className="text-sm text-ink-muted">No participants yet.</p>}
    </div>
  );
}
