-- Language app schema. Every learning table carries a `profile` column.

CREATE TABLE profiles_state (
  profile      TEXT PRIMARY KEY,
  active       INTEGER NOT NULL DEFAULT 0,
  start_date   TEXT,
  new_per_day  INTEGER NOT NULL DEFAULT 7
);
-- Arabic is active from day one; other profiles get a row when first activated.
INSERT INTO profiles_state (profile, active, start_date, new_per_day)
VALUES ('ar-lev', 1, date('now'), 7);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE cards (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile          TEXT NOT NULL,
  target_text      TEXT NOT NULL,
  translit_latin   TEXT,
  translit_hebrew  TEXT,
  english          TEXT,
  hebrew           TEXT,
  cognate_hint     TEXT,
  audio            TEXT,
  type             TEXT NOT NULL,            -- letter|syllable|word|phrase|grammar|sentence
  direction        TEXT NOT NULL DEFAULT 'produce',  -- primary direction: produce|recognize
  tags             TEXT NOT NULL DEFAULT '{}',       -- JSON grammar axes
  source           TEXT NOT NULL,            -- script|frequency|personal|mistake|grammar
  example_target   TEXT,
  example_en       TEXT,
  example_he       TEXT,
  seq              INTEGER NOT NULL DEFAULT 0,       -- introduction order for new cards
  flagged          INTEGER NOT NULL DEFAULT 0,
  flag_note        TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile, type, target_text)
);
CREATE INDEX idx_cards_profile_seq ON cards (profile, seq);

CREATE TABLE review_state (
  card_id      INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  direction    TEXT NOT NULL,
  due          TEXT NOT NULL,
  stability    REAL NOT NULL,
  difficulty   REAL NOT NULL,
  reps         INTEGER NOT NULL DEFAULT 0,
  lapses       INTEGER NOT NULL DEFAULT 0,
  state        INTEGER NOT NULL DEFAULT 0,       -- 0 new, 1 learning/relearning, 2 review
  last_review  TEXT,
  PRIMARY KEY (card_id, direction)
);
CREATE INDEX idx_review_due ON review_state (due);

CREATE TABLE review_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  profile       TEXT NOT NULL,
  card_id       INTEGER NOT NULL,
  direction     TEXT NOT NULL,
  grade         INTEGER NOT NULL,                -- 1 again .. 4 easy
  state_before  INTEGER NOT NULL,
  elapsed_days  REAL,
  duration_ms   INTEGER,
  reviewed_at   TEXT NOT NULL,
  day           TEXT NOT NULL                    -- local date (user's timezone)
);
CREATE INDEX idx_log_profile_day ON review_log (profile, day);

CREATE TABLE module_progress (
  profile       TEXT NOT NULL,
  module        TEXT NOT NULL,                   -- script | pronunciation | ...
  data          TEXT NOT NULL DEFAULT '{}',
  completed_at  TEXT,
  PRIMARY KEY (profile, module)
);

CREATE TABLE daily_log (
  profile     TEXT NOT NULL,
  day         TEXT NOT NULL,
  minutes     REAL NOT NULL DEFAULT 0,
  reviews     INTEGER NOT NULL DEFAULT 0,
  new_items   INTEGER NOT NULL DEFAULT 0,
  steps_done  TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (profile, day)
);

-- Used from later phases; created now so no schema churn.
CREATE TABLE phrase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile TEXT NOT NULL, request_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile TEXT NOT NULL, day TEXT NOT NULL,
  title TEXT, body TEXT NOT NULL, new_words TEXT, grammar_focus TEXT, audio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile TEXT NOT NULL, day TEXT NOT NULL,
  topic TEXT, transcript TEXT NOT NULL DEFAULT '[]', summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, profile TEXT NOT NULL, conversation_id INTEGER,
  said TEXT NOT NULL, better TEXT NOT NULL, explanation TEXT, card_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
