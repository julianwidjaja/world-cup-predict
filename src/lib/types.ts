export type Stage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final'

export type MatchResult = 'home' | 'away' | 'draw'

export interface Match {
  id: number
  match_number: number | null
  stage: Stage
  group_label: string | null
  home_team: string
  away_team: string
  home_team_resolved: string | null
  away_team_resolved: string | null
  match_date: string
  venue: string | null
  home_score: number | null
  away_score: number | null
  result: MatchResult | null
  is_completed: boolean
}

export interface Prediction {
  id: string
  user_id: string
  match_id: number
  predicted_result: MatchResult
  predicted_home_score: number | null
  predicted_away_score: number | null
  created_at: string
  updated_at: string
}

export interface WinnerPrediction {
  id: string
  user_id: string
  predicted_team: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string
  is_admin: boolean
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
}

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  total_points: number
  correct_predictions: number
  total_completed: number
  exact_scores: number
}

export interface Deadline {
  stage: string
  deadline_time: string
}
