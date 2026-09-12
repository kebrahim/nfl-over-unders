// Kickoff of the 2026 regular season — 8:20 PM ET on 9/9/2026 (EDT, UTC-4).
// Division-winner picks lock at this instant. Keep in sync with the
// matching check in supabase/migrations/0002_division_picks_lock.sql.
export const DIVISION_PICKS_LOCK_AT = "2026-09-10T00:20:00Z";

export function divisionPicksLocked(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(DIVISION_PICKS_LOCK_AT).getTime();
}

// NFL weeks run Tuesday-to-Monday in America/New_York local time — not
// UTC. This is the Tuesday (ET calendar date) that starts Week 1, the
// same week as kickoff. Used to compute a game's week from its own
// kickoff date, since ESPN's scoreboard doesn't reliably include a
// per-event week number when queried by date range (only by week number,
// which requires already knowing the week — see /api/sync/games).
export const SEASON_WEEK_1_START_ET_DATE = "2026-09-08";

function easternCalendarDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));
}

/**
 * Returns the NFL week number for a game's kickoff time. Not clamped —
 * callers should validate the result is within the real 1-18 week range
 * (values outside it indicate a preseason/postseason game).
 *
 * Compares ET *calendar dates*, not raw UTC milliseconds — a Monday
 * Night Football game kicking off at 8pm+ ET lands after midnight UTC
 * (already Tuesday), which a naive UTC-instant diff misclassifies as
 * the next week. Diffing calendar dates as UTC midnight of each date
 * string also keeps this immune to DST's 23/25-hour days.
 */
export function computeNflWeek(kickoffIso: string): number {
  const kickoffMs = new Date(`${easternCalendarDate(kickoffIso)}T00:00:00Z`).getTime();
  const startMs = new Date(`${SEASON_WEEK_1_START_ET_DATE}T00:00:00Z`).getTime();
  const dayDiff = Math.round((kickoffMs - startMs) / (24 * 60 * 60 * 1000));
  return Math.floor(dayDiff / 7) + 1;
}
