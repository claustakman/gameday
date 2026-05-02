export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  season: string;
  hs_team_id: string | null;
}

export interface Game {
  id: string;
  team_id: string;
  season: string;
  date: string;
  time: string | null;
  meetup_time: string | null;
  opponent: string;
  location: string | null;
  is_home: number;
  status: 'planned' | 'done' | 'archived';
  result_us: number | null;
  result_them: number | null;
  focus_1: string | null;
  focus_2: string | null;
  focus_3: string | null;
  goal_1: string | null;
  goal_2: string | null;
  goal_3: string | null;
  tally_1: number;
  tally_2: number;
  tally_3: number;
  went_well: string | null;
  went_bad: string | null;
  motm_player_id: string | null;
  hs_activity_id: string | null;
  has_double_booking?: number;
  player_count?: number;
  coach_names?: string | null;
}

export interface Player {
  id: string;
  org_id: string;
  full_name: string;
  nickname: string | null;
  birth_year: number | null;
  shirt_number: number | null;
  primary_team_id: string | null;
  is_default_keeper: number;
  hs_user_id: string | null;
  active: number;
}

export interface Coach {
  id: string;
  org_id: string;
  name: string;
  hs_user_id: string | null;
}

export interface RosterEntry {
  id: string;
  game_id: string;
  player_id: string | null;
  coach_id: string | null;
  is_keeper: number;
  player_name: string | null;
  nickname: string | null;
  shirt_number: number | null;
  coach_name: string | null;
}

export interface PlayerStat {
  id: string;
  full_name: string;
  nickname: string | null;
  appearances: number;
  keeper_appearances: number;
  motm_count: number;
}
