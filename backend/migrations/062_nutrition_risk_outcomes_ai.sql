-- Migration 062: animal nutrition - alert outcomes (Phase 4) and the AI explanation switch
--
--   * nutrition_outcomes: what happened to every alert - the owner / vet said it was right ("seen"), said it was
--     NOT right (false alarm), or the rules closed it because the cause went away. These are the labels a later
--     prediction model would be trained and checked on (docs/NUTRITION_PLAN.md §5.2, "collected from day one"), and
--     today they give the admin each rule's hit rate. One row per alert closure; the alert's own params and the rule
--     version are copied so a row stays explainable after the alert changes.
--   * nutrition.ai_assist.enabled: plain-language "explain this plan" through the platform's AI provider (owner
--     decision 2026-11-22: allowed, animal facts only, numbers never from AI). Default on; it does nothing until an
--     AI key is configured, and an admin can switch it off.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

CREATE TABLE IF NOT EXISTS nutrition_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID REFERENCES nutrition_risk_flags(id) ON DELETE SET NULL,
  animal_id UUID REFERENCES animals(id) ON DELETE CASCADE,
  group_id UUID REFERENCES animal_groups(id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  severity VARCHAR(10),
  rule_version VARCHAR(20),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('confirmed', 'false_alarm', 'resolved')),
  features JSONB NOT NULL DEFAULT '{}',
  labelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  labelled_role VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_outcomes_type ON nutrition_outcomes(flag_type, outcome);
CREATE INDEX IF NOT EXISTS idx_nutrition_outcomes_time ON nutrition_outcomes(created_at DESC);

INSERT INTO system_settings (key, value, category, description)
VALUES ('nutrition.ai_assist.enabled', 'true', 'nutrition',
        'Plain-language "explain this plan" in the user''s language through the AI provider (animal facts only; numbers come from the engine, never from AI). Needs GROQ_API_KEY or OPENAI_API_KEY.')
ON CONFLICT (key) DO NOTHING;
