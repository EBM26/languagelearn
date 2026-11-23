-- Phase 5: speaking practice. conversations/corrections already exist; add completion tracking.
ALTER TABLE conversations ADD COLUMN finished_at TEXT;
CREATE INDEX idx_conv_profile_day ON conversations (profile, day);
-- Phase 6: weekly "talk to a real person" log (one row per profile per week; week = Monday's date).
CREATE TABLE human_practice (
  profile  TEXT NOT NULL,
  week     TEXT NOT NULL,
  done_at  TEXT NOT NULL,
  PRIMARY KEY (profile, week)
);
