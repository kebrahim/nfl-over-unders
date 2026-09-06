# NFL Over/Unders

A season-long prediction contest for 5 friends, built around a draft of NFL
team win-total over/unders.

## How the contest works

**The draft.** Before the season, every NFL team is assigned a win-total
line (e.g. Chiefs 10.5). Each team offers two draftable picks: **Over** and
**Under**. The 5 players take turns in a snake draft for 6 rounds (30 picks
total). Once a player takes "Chiefs Over," no one else can take it — but
"Chiefs Under" is still open for anyone, including the same player. Picks
are for a specific team *and* side, so most of the 64 possible (team, side)
slots go undrafted; only the 30 that get picked matter.

**Scoring a pick.** After the season, each drafted pick is checked against
the team's actual win total:
- Correct side: **1 point**
- Bonus: **+0.5 points per full win of margin** beyond the line, capped at
  **+3 bonus points** (so a blowout season can't run away with the pool)
- Wrong side: **0 points**, no penalty

Since every line is a half-number (x.5), there are no pushes — every pick
resolves cleanly.

**Division bonus.** Separately from the draft, each player predicts the
winner of all 8 NFL divisions (AFC/NFC × East/North/South/West) before
Week 1. Each correct prediction is worth **1 point** (8 max) — intentionally
worth less than the draft so it stays a bonus, not a second contest.

**Tiebreaker.** Each player also submits a guess for the total points
scored across all regular-season games (all 272 games, playoffs excluded).
If the overall standings are tied at the end of the season, the closest
guess wins. If guesses are equidistant, the tie stands as a shared tie.

**Final score** = sum of all draft pick points + division bonus points.
The tiebreaker only applies if two or more players are tied at the top.

## Tech stack

- **Framework**: [Next.js](https://nextjs.org) (App Router, TypeScript)
- **Database + Auth**: [Supabase](https://supabase.com) (Postgres, Auth, Realtime)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Email**: [Resend](https://resend.com) (draft turn notifications)
- **Hosting**: [Vercel](https://vercel.com), with a cron job for score syncing

## Project structure

```
src/
  app/
    page.tsx              Home
    login/                 Sign in / sign up
    draft/                 Live draft board
    leaderboard/           Overall standings
    my-picks/              A player's picks, division call, and running score
    standings/             Live NFL team records vs. their win-total line
    admin/                 Commissioner tools
    api/
      draft/start/         Commissioner: start the draft
      draft/pick/          Make a draft pick
      sync/games/          Pull latest scores, recompute derived data
      admin/division-winners/  Commissioner: record actual division winners
  lib/
    supabase/              Browser/server Supabase clients
    domain/                Snake draft order, scoring math, shared types
supabase/
  migrations/              SQL schema (tables, views, RLS policies)
  seed.sql                 32 NFL teams (name, code, conference, division)
```

### Data model

- `teams` — the 32 NFL teams, each with a `win_total_line`
- `games` — synced daily from ESPN's public scoreboard (or on demand from
  `/admin`); team records and the league-wide point total are both derived
  from this rather than stored separately
- `draft_sessions` / `draft_picks` — the single 6-round snake draft; a pick
  is `(team, side)`, not just a team
- `division_predictions` / `division_winners` — each player's division
  picks, and the commissioner-recorded actual winners
- `tiebreaker_predictions` — each player's total-points guess

See `supabase/migrations/` for the full schema and derived views
(`team_records`, `league_total_points`, `draft_pick_scores`,
`overall_leaderboard`).

## Getting started

```bash
npm install
cp .env.local.example .env.local  # fill in your Supabase project values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
