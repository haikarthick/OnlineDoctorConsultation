-- 072: one row per person per reaction to a review ("helpful" or "report"), so a count can only go up once per person
-- and a review is flagged by 3 DIFFERENT people, never by one person pressing a button three times.
-- The reason a person gives when reporting is kept for the admin moderating the review.
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.
CREATE TABLE IF NOT EXISTS review_reactions (
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('helpful', 'report')),
  reason VARCHAR(40),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);
