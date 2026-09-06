import type { Side } from "@/lib/supabase/types";

export const REGULAR_SEASON_GAMES_PER_TEAM = 17;
export const BONUS_PER_WIN_MARGIN = 0.5;
export const MAX_BONUS_POINTS = 3;
export const POINTS_PER_DIVISION_PICK = 1;

export interface PickScore {
  resolved: boolean;
  correct: boolean | null;
  marginWins: number;
  bonusPoints: number;
  points: number;
}

/**
 * Scores a single draft pick. Mirrors the draft_pick_scores SQL view —
 * keep the two in sync if this formula changes.
 */
export function scorePick(
  wins: number,
  gamesPlayed: number,
  winTotalLine: number,
  side: Side,
): PickScore {
  const resolved = gamesPlayed >= REGULAR_SEASON_GAMES_PER_TEAM;
  if (!resolved) {
    return { resolved: false, correct: null, marginWins: 0, bonusPoints: 0, points: 0 };
  }

  const correct = side === "over" ? wins > winTotalLine : wins < winTotalLine;
  if (!correct) {
    return { resolved: true, correct: false, marginWins: 0, bonusPoints: 0, points: 0 };
  }

  const marginWins = Math.floor(Math.abs(wins - winTotalLine));
  const bonusPoints = Math.min(marginWins * BONUS_PER_WIN_MARGIN, MAX_BONUS_POINTS);
  return { resolved: true, correct: true, marginWins, bonusPoints, points: 1 + bonusPoints };
}

/**
 * Projects a team's final win total from its current pace, for display
 * only (e.g. the standings page's "on pace" indicator) — never used for
 * actual scoring, which always waits for the real final record.
 */
export function projectedWins(wins: number, gamesPlayed: number): number | null {
  if (gamesPlayed <= 0) return null;
  return (wins / gamesPlayed) * REGULAR_SEASON_GAMES_PER_TEAM;
}
