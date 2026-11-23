-- Migration 063: farm feed - ONE place to record it (owner rule 2026-11-23: no duplicate screens or double entry)
--
-- Before: feed given was recorded in Daily records (farm_daily_records, kg only, no stock or cost) AND in Feed
-- Inventory's "Log use" (feed_consumption_logs, stock and cost). Two screens, two tables, different numbers.
-- After:
--   * Daily records is the only place feed given is recorded. A feed entry names WHICH feed (the farm's stock item,
--     or none for home-grown fodder), is for one animal, one group or ALL the farm's animals, and on save takes the
--     feed out of stock and stores its cost at that day's price (FarmRecordService).
--   * Feed Inventory keeps what is in store and its price; "how many kg is one bag / bale / litre" lets a farmer
--     record in kg while stock is kept in bags.
--   * Every feed_consumption_logs row is MOVED into farm_daily_records (converted to kg where the unit allows, stock
--     not deducted again - those logs already deducted it), the counts are checked, and the old table is removed.
--   * The low-stock alert, feed reports, group FCR and rations all read the one table.
--
-- Idempotent, never hardcodes a schema name. Mirrored at the end of docker/init.sql.

-- ─── 1. The feed entry names its feed, its cost, and whether stock was taken out ───
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES feed_inventory(id) ON DELETE SET NULL;
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2) CHECK (cost IS NULL OR cost >= 0);
-- Stock units taken out by this entry (in the feed's own unit), so an edit or delete puts back exactly that.
ALTER TABLE farm_daily_records ADD COLUMN IF NOT EXISTS stock_deducted NUMERIC(14,4) CHECK (stock_deducted IS NULL OR stock_deducted >= 0);
CREATE INDEX IF NOT EXISTS idx_farm_daily_records_feed ON farm_daily_records(feed_id, record_date DESC) WHERE feed_id IS NOT NULL;

-- ─── 2. "All my animals": a feed entry may be for the whole farm (no animal, no group) ───
ALTER TABLE farm_daily_records DROP CONSTRAINT IF EXISTS farm_daily_records_subject_ck;
DO $$ BEGIN
  ALTER TABLE farm_daily_records ADD CONSTRAINT farm_daily_records_subject_ck CHECK (
    ((animal_id IS NOT NULL) <> (group_id IS NOT NULL))
    OR (animal_id IS NULL AND group_id IS NULL AND record_type = 'feed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One entry per subject / type / day / session - and, for feed, per feed (green fodder AND concentrate the same day).
DROP INDEX IF EXISTS uq_farm_daily_records_slot;
CREATE UNIQUE INDEX IF NOT EXISTS uq_farm_daily_records_slot
  ON farm_daily_records ((COALESCE(animal_id, group_id, enterprise_id)), record_type, record_date, session,
                         (COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- ─── 3. Stock kept in bags / bales / litres: how many kg one of them is ───
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS kg_per_unit NUMERIC(10,3) CHECK (kg_per_unit IS NULL OR kg_per_unit > 0);
UPDATE feed_inventory SET kg_per_unit = CASE lower(unit) WHEN 'kg' THEN 1 WHEN 'g' THEN 0.001 WHEN 'ton' THEN 1000 WHEN 'lb' THEN 0.45359237 END
 WHERE kg_per_unit IS NULL AND lower(unit) IN ('kg', 'g', 'ton', 'lb');

-- ─── 4. Move every "Log use" row into Daily records, then remove the second table ───
DO $$
DECLARE
  moved_qty NUMERIC; source_qty NUMERIC;
BEGIN
  IF to_regclass('feed_consumption_logs') IS NULL THEN RETURN; END IF;

  -- Same subject / day / feed logged twice -> one entry with the sum (the one-entry-per-slot rule).
  INSERT INTO farm_daily_records (enterprise_id, animal_id, group_id, record_type, record_date, session, quantity, unit,
                                  feed_id, cost, stock_deducted, detail, notes, recorded_by, updated_by, created_at)
  SELECT l.enterprise_id,
         -- a log naming both an animal and a group belongs to the animal
         l.animal_id,
         CASE WHEN l.animal_id IS NULL THEN l.group_id END,
         'feed', l.consumption_date, 'day',
         SUM(CASE lower(COALESCE(l.unit, 'kg')) WHEN 'g' THEN l.quantity * 0.001 WHEN 'ton' THEN l.quantity * 1000
                  WHEN 'lb' THEN l.quantity * 0.45359237 WHEN 'kg' THEN l.quantity
                  ELSE l.quantity * COALESCE(fi.kg_per_unit, 1) END),
         CASE WHEN lower(COALESCE(MIN(l.unit), 'kg')) IN ('kg', 'g', 'ton', 'lb') OR MIN(fi.kg_per_unit) IS NOT NULL THEN 'kg' ELSE MIN(l.unit) END,
         l.feed_id, SUM(COALESCE(l.cost, 0)), SUM(l.quantity),
         jsonb_build_object('migratedFrom', 'feed_consumption_logs', 'logIds', jsonb_agg(l.id)),
         NULLIF(string_agg(NULLIF(l.notes, ''), ' / '), ''),
         MIN(l.recorded_by::text)::uuid, MIN(l.recorded_by::text)::uuid, MIN(l.created_at)
    FROM feed_consumption_logs l
    LEFT JOIN feed_inventory fi ON fi.id = l.feed_id
   GROUP BY l.enterprise_id, l.animal_id, CASE WHEN l.animal_id IS NULL THEN l.group_id END, l.consumption_date, l.feed_id
  ON CONFLICT ((COALESCE(animal_id, group_id, enterprise_id)), record_type, record_date, session,
               (COALESCE(feed_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO UPDATE SET quantity = COALESCE(farm_daily_records.quantity, 0) + EXCLUDED.quantity,
                cost = COALESCE(farm_daily_records.cost, 0) + EXCLUDED.cost,
                stock_deducted = COALESCE(farm_daily_records.stock_deducted, 0) + EXCLUDED.stock_deducted,
                detail = farm_daily_records.detail || EXCLUDED.detail,
                updated_at = NOW();

  -- Nothing may be lost: the stock units moved must equal the stock units logged.
  SELECT COALESCE(SUM(quantity), 0) INTO source_qty FROM feed_consumption_logs;
  SELECT COALESCE(SUM(stock_deducted), 0) INTO moved_qty FROM farm_daily_records WHERE detail ? 'logIds';
  IF moved_qty < source_qty THEN
    RAISE EXCEPTION 'feed_consumption_logs move incomplete: % of % stock units moved', moved_qty, source_qty;
  END IF;

  DROP TABLE feed_consumption_logs;
END $$;

-- ─── 5. The feed record asks WHICH feed: a "stock" field (the farm's stock items), instead of the unused picker ───
UPDATE master_record_types
   SET fields = '[{"key":"quantity","type":"number","required":true},{"key":"feedId","type":"stock"}]'::jsonb
 WHERE code = 'feed' AND fields::text NOT LIKE '%"stock"%';
