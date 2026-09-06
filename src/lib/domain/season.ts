// Kickoff of the 2026 regular season — 8:20 PM ET on 9/9/2026 (EDT, UTC-4).
// Division-winner picks lock at this instant. Keep in sync with the
// matching check in supabase/migrations/0002_division_picks_lock.sql.
export const DIVISION_PICKS_LOCK_AT = "2026-09-10T00:20:00Z";

export function divisionPicksLocked(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(DIVISION_PICKS_LOCK_AT).getTime();
}

// NFL weeks run Tuesday-to-Monday; this is the Tuesday that starts Week 1
// (the same week as kickoff). Used to compute a game's week from its own
// kickoff date, since ESPN's scoreboard doesn't reliably include a
// per-event week number when queried by date range (only by week number,
// which requires already knowing the week — see /api/sync/games).
export const SEASON_WEEK_1_START = "2026-09-08T00:00:00Z";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Returns the NFL week number for a game's kickoff time. Not clamped —
 * callers should validate the result is within the real 1-18 week range
 * (values outside it indicate a preseason/postseason game). */
export function computeNflWeek(kickoffIso: string): number {
  const kickoff = new Date(kickoffIso).getTime();
  const start = new Date(SEASON_WEEK_1_START).getTime();
  return Math.floor((kickoff - start) / WEEK_MS) + 1;
}
