ALTER TABLE cards ADD COLUMN request_id INTEGER;          -- phrase_requests.id for "I want to say…" cards
CREATE INDEX idx_cards_request ON cards (request_id);
ALTER TABLE phrase_requests ADD COLUMN input_lang TEXT;
ALTER TABLE phrase_requests ADD COLUMN result_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE phrase_requests ADD COLUMN error TEXT;
