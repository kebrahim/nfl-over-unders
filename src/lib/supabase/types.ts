// Hand-written to match supabase/migrations/0001_init.sql. Once the
// Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type Conference = "AFC" | "NFC";
export type DivisionName = "East" | "North" | "South" | "West";
export type Division =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";
export type Side = "over" | "under";
export type GameStatus = "scheduled" | "live" | "final";
export type DraftSessionStatus = "pending" | "active" | "completed";
export type WinTotalSource = "manual" | "api";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          email: string;
          is_commissioner: boolean;
          is_demo: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          display_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: number;
          name: string;
          code: string;
          conference: Conference;
          division: DivisionName;
          win_total_line: number | null;
          win_total_source: WinTotalSource;
          win_total_updated_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["teams"]["Row"]> & {
          name: string;
          code: string;
          conference: Conference;
          division: DivisionName;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Row"]>;
        Relationships: [];
      };
      games: {
        Row: {
          id: number;
          week: number;
          home_team_id: number;
          away_team_id: number;
          home_score: number | null;
          away_score: number | null;
          status: GameStatus;
          kickoff_utc: string;
        };
        Insert: Partial<Database["public"]["Tables"]["games"]["Row"]> & {
          id: number;
          week: number;
          home_team_id: number;
          away_team_id: number;
          kickoff_utc: string;
        };
        Update: Partial<Database["public"]["Tables"]["games"]["Row"]>;
        Relationships: [];
      };
      draft_sessions: {
        Row: {
          id: string;
          status: DraftSessionStatus;
          total_rounds: number;
          current_round: number;
          current_pick_index: number;
          snake_order: string[];
          created_at: string;
          completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["draft_sessions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["draft_sessions"]["Row"]>;
        Relationships: [];
      };
      draft_picks: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          team_id: number;
          side: Side;
          round: number;
          pick_number: number;
          picked_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["draft_picks"]["Row"]> & {
          session_id: string;
          user_id: string;
          team_id: number;
          side: Side;
          round: number;
          pick_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["draft_picks"]["Row"]>;
        Relationships: [];
      };
      division_predictions: {
        Row: {
          user_id: string;
          division: Division;
          predicted_team_id: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["division_predictions"]["Row"]> & {
          user_id: string;
          division: Division;
          predicted_team_id: number;
        };
        Update: Partial<Database["public"]["Tables"]["division_predictions"]["Row"]>;
        Relationships: [];
      };
      division_winners: {
        Row: {
          division: Division;
          team_id: number;
          set_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["division_winners"]["Row"]> & {
          division: Division;
          team_id: number;
        };
        Update: Partial<Database["public"]["Tables"]["division_winners"]["Row"]>;
        Relationships: [];
      };
      tiebreaker_predictions: {
        Row: {
          user_id: string;
          points_guess: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tiebreaker_predictions"]["Row"]> & {
          user_id: string;
          points_guess: number;
        };
        Update: Partial<Database["public"]["Tables"]["tiebreaker_predictions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      team_records: {
        Row: {
          team_id: number;
          wins: number;
          losses: number;
          ties: number;
          games_played: number;
        };
        Relationships: [];
      };
      league_total_points: {
        Row: {
          total_points: number;
          games_final: number;
        };
        Relationships: [];
      };
      draft_pick_scores: {
        Row: {
          pick_id: string;
          session_id: string;
          user_id: string;
          team_id: number;
          side: Side;
          round: number;
          pick_number: number;
          wins: number;
          games_played: number;
          win_total_line: number | null;
          resolved: boolean;
          correct: boolean | null;
          points: number;
        };
        Relationships: [];
      };
      overall_leaderboard: {
        Row: {
          user_id: string;
          display_name: string;
          draft_points: number;
          division_points: number;
          total_points: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
