CREATE TABLE season_config (
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  season     TEXT NOT NULL,
  webcal_url TEXT,
  PRIMARY KEY (org_id, season)
);
