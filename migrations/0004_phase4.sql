-- Daily stories: structured story JSON lives in stories.body; one story per profile per day.
ALTER TABLE stories ADD COLUMN format TEXT;                 -- story | dialogue
ALTER TABLE stories ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN known_pct REAL;              -- % of words in the learner's deck when generated
ALTER TABLE stories ADD COLUMN read_at TEXT;
CREATE UNIQUE INDEX idx_stories_day ON stories (profile, day);
