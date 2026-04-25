export interface Team {
  id: string;
  name: string;
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
  tally_1: number;
  tally_2: number;
  tally_3: number;
  went_well: string | null;
  went_bad: string | null;
  motm_player_id: string | null;
  hs_activity_id: string | null;
}
