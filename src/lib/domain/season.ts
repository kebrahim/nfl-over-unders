// Kickoff of the 2026 regular season — 8:20 PM ET on 9/9/2026 (EDT, UTC-4).
// Division-winner picks lock at this instant. Keep in sync with the
// matching check in supabase/migrations/0002_division_picks_lock.sql.
export const DIVISION_PICKS_LOCK_AT = "2026-09-10T00:20:00Z";

export function divisionPicksLocked(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(DIVISION_PICKS_LOCK_AT).getTime();
}
