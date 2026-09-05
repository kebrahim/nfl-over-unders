import Link from "next/link";

const STEPS = [
  {
    title: "Draft",
    body: "5 players, 6 rounds, snake order. Each pick is a team + Over or Under on its season win total.",
  },
  {
    title: "Score",
    body: "1 point per correct pick, plus a bonus of 0.5 points per win of margin beyond the line (capped at +3).",
  },
  {
    title: "Bonus picks",
    body: "Predict all 8 division winners (1 point each) — separate from the draft.",
  },
  {
    title: "Tiebreaker",
    body: "Guess the total points scored across the regular season, in case the standings are tied.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center">
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center gap-12 px-6 py-24 text-center">
        <div className="space-y-4">
          <h1 className="font-heading text-5xl font-semibold tracking-wide text-ink uppercase">
            NFL <span className="text-accent">Over/Unders</span>
          </h1>
          <p className="mx-auto max-w-md text-lg leading-8 text-ink-muted">
            A season-long contest for 5 friends: draft NFL win-total
            over/unders, then see who calls it best.
          </p>
        </div>

        <div className="grid w-full gap-4 text-left sm:grid-cols-2">
          {STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="font-heading font-semibold tracking-wide text-accent uppercase">
                {step.title}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            href="/draft"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-accent-ink transition-colors hover:bg-accent-hover"
          >
            Go to the draft
          </Link>
          <Link
            href="/leaderboard"
            className="flex h-12 items-center justify-center rounded-full border border-border px-6 text-ink transition-colors hover:bg-surface-2"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}
