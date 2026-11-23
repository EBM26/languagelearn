-- Reference tables (conjugations, pronouns, suffixes, case endings), generated when a grammar topic starts.
CREATE TABLE reference_tables (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile     TEXT NOT NULL,
  topic       TEXT NOT NULL,
  title       TEXT NOT NULL,          -- JSON {en, he}
  data        TEXT NOT NULL,          -- JSON {columns, rows, notes}
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reftables_profile ON reference_tables (profile, topic);
-- Grammar-card lookups by topic and for weak-spot queries.
CREATE INDEX idx_cards_source ON cards (profile, source);
