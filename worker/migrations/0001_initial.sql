-- Migration 0001: initial schema

CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
  password_hash TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE teams (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  season     TEXT NOT NULL,
  hs_team_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE players (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES organizations(id),
  full_name         TEXT NOT NULL,
  nickname          TEXT,
  birth_year        INTEGER,
  is_default_keeper INTEGER NOT NULL DEFAULT 0,
  hs_user_id        TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL
);

CREATE TABLE coaches (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  user_id    TEXT REFERENCES users(id),
  name       TEXT NOT NULL,
  hs_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE games (
  id             TEXT PRIMARY KEY,
  team_id        TEXT NOT NULL REFERENCES teams(id),
  season         TEXT NOT NULL,
  date           TEXT NOT NULL,
  time           TEXT,
  meetup_time    TEXT,
  opponent       TEXT NOT NULL,
  location       TEXT,
  is_home        INTEGER NOT NULL DEFAULT 1,
  status         TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'archived')),
  result_us      INTEGER,
  result_them    INTEGER,
  focus_1        TEXT,
  focus_2        TEXT,
  focus_3        TEXT,
  goal_1         TEXT,
  goal_2         TEXT,
  goal_3         TEXT,
  tally_1        INTEGER NOT NULL DEFAULT 0,
  tally_2        INTEGER NOT NULL DEFAULT 0,
  tally_3        INTEGER NOT NULL DEFAULT 0,
  went_well      TEXT,
  went_bad       TEXT,
  motm_player_id TEXT REFERENCES players(id),
  hs_activity_id TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE game_roster (
  id         TEXT PRIMARY KEY,
  game_id    TEXT NOT NULL REFERENCES games(id),
  player_id  TEXT REFERENCES players(id),
  coach_id   TEXT REFERENCES coaches(id),
  is_keeper  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (player_id IS NOT NULL OR coach_id IS NOT NULL)
);

CREATE TABLE player_teams (
  player_id TEXT NOT NULL REFERENCES players(id),
  team_id   TEXT NOT NULL REFERENCES teams(id),
  season    TEXT NOT NULL,
  PRIMARY KEY (player_id, team_id, season)
);

-- Indexes for common queries
CREATE INDEX idx_games_team_date    ON games(team_id, date);
CREATE INDEX idx_games_date         ON games(date);
CREATE INDEX idx_game_roster_game   ON game_roster(game_id);
CREATE INDEX idx_game_roster_player ON game_roster(player_id);
CREATE INDEX idx_players_org        ON players(org_id);
CREATE INDEX idx_player_teams_team  ON player_teams(team_id, season);
