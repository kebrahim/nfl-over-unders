// A fully self-contained, fake dataset for the read-only demo account.
// Nothing here touches Supabase — every page checks profile.is_demo and,
// if true, renders these fixtures instead of querying the real database.
// Numbers are invented but internally consistent (division winners match
// the fake final records, pick scores are computed with the same
// `scorePick` function the real app uses, etc.) so the demo looks and
// behaves like a completed season.

import { scorePick, REGULAR_SEASON_GAMES_PER_TEAM, POINTS_PER_DIVISION_PICK } from "@/lib/domain/scoring";
import type { Conference, Division, DivisionName, Side } from "@/lib/supabase/types";

export interface DemoTeam {
  id: number;
  name: string;
  code: string;
  conference: Conference;
  division: DivisionName;
  win_total_line: number;
}

export interface DemoPlayer {
  id: string;
  display_name: string;
}

export const DEMO_PLAYERS: DemoPlayer[] = [
  { id: "demo-alex", display_name: "Demo Alex" },
  { id: "demo-jordan", display_name: "Demo Jordan" },
  { id: "demo-sam", display_name: "Demo Sam" },
  { id: "demo-riley", display_name: "Demo Riley" },
  { id: "demo-casey", display_name: "Demo Casey" },
];

// The player the demo login "is" when viewing /my-picks.
export const DEMO_VIEWER_ID = "demo-alex";

export const DEMO_TEAMS: DemoTeam[] = [
  { id: 1, name: "Buffalo Bills", code: "BUF", conference: "AFC", division: "East", win_total_line: 10.5 },
  { id: 2, name: "Miami Dolphins", code: "MIA", conference: "AFC", division: "East", win_total_line: 3.5 },
  { id: 3, name: "New England Patriots", code: "NE", conference: "AFC", division: "East", win_total_line: 10.5 },
  { id: 4, name: "New York Jets", code: "NYJ", conference: "AFC", division: "East", win_total_line: 5.5 },
  { id: 5, name: "Baltimore Ravens", code: "BAL", conference: "AFC", division: "North", win_total_line: 10.5 },
  { id: 6, name: "Cincinnati Bengals", code: "CIN", conference: "AFC", division: "North", win_total_line: 10.5 },
  { id: 7, name: "Cleveland Browns", code: "CLE", conference: "AFC", division: "North", win_total_line: 5.5 },
  { id: 8, name: "Pittsburgh Steelers", code: "PIT", conference: "AFC", division: "North", win_total_line: 7.5 },
  { id: 9, name: "Houston Texans", code: "HOU", conference: "AFC", division: "South", win_total_line: 9.5 },
  { id: 10, name: "Indianapolis Colts", code: "IND", conference: "AFC", division: "South", win_total_line: 7.5 },
  { id: 11, name: "Jacksonville Jaguars", code: "JAX", conference: "AFC", division: "South", win_total_line: 8.5 },
  { id: 12, name: "Tennessee Titans", code: "TEN", conference: "AFC", division: "South", win_total_line: 7.5 },
  { id: 13, name: "Denver Broncos", code: "DEN", conference: "AFC", division: "West", win_total_line: 9.5 },
  { id: 14, name: "Kansas City Chiefs", code: "KC", conference: "AFC", division: "West", win_total_line: 10.5 },
  { id: 15, name: "Las Vegas Raiders", code: "LV", conference: "AFC", division: "West", win_total_line: 5.5 },
  { id: 16, name: "Los Angeles Chargers", code: "LAC", conference: "AFC", division: "West", win_total_line: 9.5 },
  { id: 17, name: "Dallas Cowboys", code: "DAL", conference: "NFC", division: "East", win_total_line: 9.5 },
  { id: 18, name: "New York Giants", code: "NYG", conference: "NFC", division: "East", win_total_line: 7.5 },
  { id: 19, name: "Philadelphia Eagles", code: "PHI", conference: "NFC", division: "East", win_total_line: 9.5 },
  { id: 20, name: "Washington Commanders", code: "WAS", conference: "NFC", division: "East", win_total_line: 7.5 },
  { id: 21, name: "Chicago Bears", code: "CHI", conference: "NFC", division: "North", win_total_line: 9.5 },
  { id: 22, name: "Detroit Lions", code: "DET", conference: "NFC", division: "North", win_total_line: 10.5 },
  { id: 23, name: "Green Bay Packers", code: "GB", conference: "NFC", division: "North", win_total_line: 9.5 },
  { id: 24, name: "Minnesota Vikings", code: "MIN", conference: "NFC", division: "North", win_total_line: 8.5 },
  { id: 25, name: "Atlanta Falcons", code: "ATL", conference: "NFC", division: "South", win_total_line: 7.5 },
  { id: 26, name: "Carolina Panthers", code: "CAR", conference: "NFC", division: "South", win_total_line: 7.5 },
  { id: 27, name: "New Orleans Saints", code: "NO", conference: "NFC", division: "South", win_total_line: 7.5 },
  { id: 28, name: "Tampa Bay Buccaneers", code: "TB", conference: "NFC", division: "South", win_total_line: 8.5 },
  { id: 29, name: "Arizona Cardinals", code: "ARI", conference: "NFC", division: "West", win_total_line: 3.5 },
  { id: 30, name: "Los Angeles Rams", code: "LAR", conference: "NFC", division: "West", win_total_line: 11.5 },
  { id: 31, name: "San Francisco 49ers", code: "SF", conference: "NFC", division: "West", win_total_line: 9.5 },
  { id: 32, name: "Seattle Seahawks", code: "SEA", conference: "NFC", division: "West", win_total_line: 10.5 },
];

const teamByCode = new Map(DEMO_TEAMS.map((t) => [t.code, t]));

// Fake final regular-season win totals (17 games each, no ties).
const DEMO_FINAL_WINS: Record<string, number> = {
  BUF: 11, MIA: 4, NE: 9, NYJ: 4,
  BAL: 13, CIN: 8, CLE: 7, PIT: 10,
  HOU: 11, IND: 6, JAX: 10, TEN: 5,
  DEN: 10, KC: 12, LV: 6, LAC: 8,
  DAL: 9, NYG: 6, PHI: 12, WAS: 9,
  CHI: 7, DET: 13, GB: 10, MIN: 7,
  ATL: 8, CAR: 5, NO: 6, TB: 9,
  ARI: 5, LAR: 13, SF: 11, SEA: 9,
};

export function demoTeamRecords() {
  return DEMO_TEAMS.map((team) => {
    const wins = DEMO_FINAL_WINS[team.code] ?? 0;
    return {
      team_id: team.id,
      wins,
      losses: REGULAR_SEASON_GAMES_PER_TEAM - wins,
      ties: 0,
      games_played: REGULAR_SEASON_GAMES_PER_TEAM,
    };
  });
}

export const DEMO_DRAFT_SESSION = {
  id: "demo-session",
  status: "completed" as const,
  snake_order: DEMO_PLAYERS.map((p) => p.id),
  current_pick_index: 30,
  total_rounds: 6,
  current_round: 6,
};

interface DemoPickInput {
  pickNumber: number;
  playerId: string;
  teamCode: string;
  side: Side;
}

// Snake order [Alex, Jordan, Sam, Riley, Casey]; 6 rounds, 30 of the 64
// possible (team, side) slots drafted — same shape as a real draft.
const DEMO_PICK_INPUTS: DemoPickInput[] = [
  { pickNumber: 1, playerId: "demo-alex", teamCode: "BAL", side: "over" },
  { pickNumber: 2, playerId: "demo-jordan", teamCode: "MIA", side: "under" },
  { pickNumber: 3, playerId: "demo-sam", teamCode: "BUF", side: "over" },
  { pickNumber: 4, playerId: "demo-riley", teamCode: "NE", side: "under" },
  { pickNumber: 5, playerId: "demo-casey", teamCode: "CIN", side: "under" },
  { pickNumber: 6, playerId: "demo-casey", teamCode: "CLE", side: "over" },
  { pickNumber: 7, playerId: "demo-riley", teamCode: "PIT", side: "over" },
  { pickNumber: 8, playerId: "demo-sam", teamCode: "HOU", side: "over" },
  { pickNumber: 9, playerId: "demo-jordan", teamCode: "IND", side: "under" },
  { pickNumber: 10, playerId: "demo-alex", teamCode: "JAX", side: "over" },
  { pickNumber: 11, playerId: "demo-alex", teamCode: "TEN", side: "under" },
  { pickNumber: 12, playerId: "demo-jordan", teamCode: "DEN", side: "under" },
  { pickNumber: 13, playerId: "demo-sam", teamCode: "KC", side: "over" },
  { pickNumber: 14, playerId: "demo-riley", teamCode: "LV", side: "over" },
  { pickNumber: 15, playerId: "demo-casey", teamCode: "LAC", side: "under" },
  { pickNumber: 16, playerId: "demo-casey", teamCode: "DAL", side: "under" },
  { pickNumber: 17, playerId: "demo-riley", teamCode: "NYG", side: "under" },
  { pickNumber: 18, playerId: "demo-sam", teamCode: "PHI", side: "over" },
  { pickNumber: 19, playerId: "demo-jordan", teamCode: "WAS", side: "over" },
  { pickNumber: 20, playerId: "demo-alex", teamCode: "CHI", side: "under" },
  { pickNumber: 21, playerId: "demo-alex", teamCode: "DET", side: "over" },
  { pickNumber: 22, playerId: "demo-jordan", teamCode: "GB", side: "under" },
  { pickNumber: 23, playerId: "demo-sam", teamCode: "MIN", side: "under" },
  { pickNumber: 24, playerId: "demo-riley", teamCode: "ATL", side: "over" },
  { pickNumber: 25, playerId: "demo-casey", teamCode: "NO", side: "under" },
  { pickNumber: 26, playerId: "demo-casey", teamCode: "TB", side: "under" },
  { pickNumber: 27, playerId: "demo-riley", teamCode: "ARI", side: "over" },
  { pickNumber: 28, playerId: "demo-sam", teamCode: "LAR", side: "over" },
  { pickNumber: 29, playerId: "demo-jordan", teamCode: "SF", side: "under" },
  { pickNumber: 30, playerId: "demo-alex", teamCode: "SEA", side: "under" },
];

export const DEMO_DRAFT_PICKS = DEMO_PICK_INPUTS.map((p) => {
  const team = teamByCode.get(p.teamCode)!;
  return {
    id: `demo-pick-${p.pickNumber}`,
    session_id: DEMO_DRAFT_SESSION.id,
    user_id: p.playerId,
    team_id: team.id,
    side: p.side,
    round: Math.ceil(p.pickNumber / DEMO_PLAYERS.length),
    pick_number: p.pickNumber,
  };
});

export function demoDraftPickScores(userId?: string) {
  const records = demoTeamRecords();
  const recordByTeam = new Map(records.map((r) => [r.team_id, r]));

  return DEMO_DRAFT_PICKS.filter((pick) => !userId || pick.user_id === userId).map((pick) => {
    const record = recordByTeam.get(pick.team_id)!;
    const team = DEMO_TEAMS.find((t) => t.id === pick.team_id)!;
    const score = scorePick(record.wins, record.games_played, team.win_total_line, pick.side);
    return {
      pick_id: pick.id,
      session_id: pick.session_id,
      user_id: pick.user_id,
      team_id: pick.team_id,
      side: pick.side,
      round: pick.round,
      pick_number: pick.pick_number,
      wins: record.wins,
      games_played: record.games_played,
      win_total_line: team.win_total_line,
      resolved: score.resolved,
      correct: score.correct,
      points: score.points,
    };
  });
}

// Actual (fake) division winners — the team with the most wins in each.
export const DEMO_DIVISION_WINNERS: Record<Division, string> = {
  "AFC East": "BUF",
  "AFC North": "BAL",
  "AFC South": "HOU",
  "AFC West": "KC",
  "NFC East": "PHI",
  "NFC North": "DET",
  "NFC South": "TB",
  "NFC West": "LAR",
};

interface DemoDivisionPredictionInput {
  playerId: string;
  division: Division;
  teamCode: string;
}

const DEMO_DIVISION_PREDICTION_INPUTS: DemoDivisionPredictionInput[] = [
  { playerId: "demo-alex", division: "AFC East", teamCode: "BUF" },
  { playerId: "demo-alex", division: "AFC North", teamCode: "BAL" },
  { playerId: "demo-alex", division: "AFC South", teamCode: "HOU" },
  { playerId: "demo-alex", division: "AFC West", teamCode: "KC" },
  { playerId: "demo-alex", division: "NFC East", teamCode: "DAL" },
  { playerId: "demo-alex", division: "NFC North", teamCode: "DET" },
  { playerId: "demo-alex", division: "NFC South", teamCode: "ATL" },
  { playerId: "demo-alex", division: "NFC West", teamCode: "LAR" },

  { playerId: "demo-jordan", division: "AFC East", teamCode: "MIA" },
  { playerId: "demo-jordan", division: "AFC North", teamCode: "PIT" },
  { playerId: "demo-jordan", division: "AFC South", teamCode: "HOU" },
  { playerId: "demo-jordan", division: "AFC West", teamCode: "DEN" },
  { playerId: "demo-jordan", division: "NFC East", teamCode: "PHI" },
  { playerId: "demo-jordan", division: "NFC North", teamCode: "DET" },
  { playerId: "demo-jordan", division: "NFC South", teamCode: "TB" },
  { playerId: "demo-jordan", division: "NFC West", teamCode: "SF" },

  { playerId: "demo-sam", division: "AFC East", teamCode: "BUF" },
  { playerId: "demo-sam", division: "AFC North", teamCode: "CLE" },
  { playerId: "demo-sam", division: "AFC South", teamCode: "JAX" },
  { playerId: "demo-sam", division: "AFC West", teamCode: "KC" },
  { playerId: "demo-sam", division: "NFC East", teamCode: "PHI" },
  { playerId: "demo-sam", division: "NFC North", teamCode: "GB" },
  { playerId: "demo-sam", division: "NFC South", teamCode: "TB" },
  { playerId: "demo-sam", division: "NFC West", teamCode: "LAR" },

  { playerId: "demo-riley", division: "AFC East", teamCode: "NE" },
  { playerId: "demo-riley", division: "AFC North", teamCode: "BAL" },
  { playerId: "demo-riley", division: "AFC South", teamCode: "TEN" },
  { playerId: "demo-riley", division: "AFC West", teamCode: "LAC" },
  { playerId: "demo-riley", division: "NFC East", teamCode: "WAS" },
  { playerId: "demo-riley", division: "NFC North", teamCode: "DET" },
  { playerId: "demo-riley", division: "NFC South", teamCode: "NO" },
  { playerId: "demo-riley", division: "NFC West", teamCode: "LAR" },

  { playerId: "demo-casey", division: "AFC East", teamCode: "BUF" },
  { playerId: "demo-casey", division: "AFC North", teamCode: "BAL" },
  { playerId: "demo-casey", division: "AFC South", teamCode: "HOU" },
  { playerId: "demo-casey", division: "AFC West", teamCode: "KC" },
  { playerId: "demo-casey", division: "NFC East", teamCode: "PHI" },
  { playerId: "demo-casey", division: "NFC North", teamCode: "DET" },
  { playerId: "demo-casey", division: "NFC South", teamCode: "TB" },
  { playerId: "demo-casey", division: "NFC West", teamCode: "SF" },
];

export const DEMO_DIVISION_PREDICTIONS = DEMO_DIVISION_PREDICTION_INPUTS.map((p) => ({
  user_id: p.playerId,
  division: p.division,
  predicted_team_id: teamByCode.get(p.teamCode)!.id,
}));

function demoDivisionPointsByUser() {
  const points = new Map<string, number>();
  for (const pred of DEMO_DIVISION_PREDICTIONS) {
    const actualCode = DEMO_DIVISION_WINNERS[pred.division as Division];
    const actualTeamId = teamByCode.get(actualCode)!.id;
    if (pred.predicted_team_id === actualTeamId) {
      points.set(pred.user_id, (points.get(pred.user_id) ?? 0) + POINTS_PER_DIVISION_PICK);
    }
  }
  return points;
}

export const DEMO_TIEBREAKER_PREDICTIONS: Record<string, number> = {
  "demo-alex": 12300,
  "demo-jordan": 12550,
  "demo-sam": 12480,
  "demo-riley": 12100,
  "demo-casey": 12700,
};

export const DEMO_LEAGUE_TOTAL_POINTS = { total_points: 12480, games_final: 272 };

export function demoOverallLeaderboard() {
  const divisionPoints = demoDivisionPointsByUser();
  const draftPointsByUser = new Map<string, number>();
  for (const player of DEMO_PLAYERS) {
    const total = demoDraftPickScores(player.id).reduce((sum, p) => sum + p.points, 0);
    draftPointsByUser.set(player.id, total);
  }

  return DEMO_PLAYERS.map((player) => {
    const draft_points = draftPointsByUser.get(player.id) ?? 0;
    const division_points = divisionPoints.get(player.id) ?? 0;
    return {
      user_id: player.id,
      display_name: player.display_name,
      draft_points,
      division_points,
      total_points: draft_points + division_points,
    };
  }).sort((a, b) => b.total_points - a.total_points);
}
