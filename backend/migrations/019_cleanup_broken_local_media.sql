-- 019_cleanup_broken_local_media.sql
-- Marketplace images/video uploaded before the Cloudinary storage driver
-- existed were written to Render's local disk, which is wiped on every
-- deploy/spin-down (no persistent disk on the free plan). Those URLs
-- (/uploads/...) are dead. Strip them so the UI shows a clean empty-media
-- state instead of a broken image icon; any surviving external/Cloudinary
-- URLs in the same array are left untouched.

-- jsonb_typeof guard: images is always written as a JSON array by the app
-- (Joi-validated), but jsonb_array_elements_text() errors on any JSONB value
-- that isn't structurally an array — guard defensively rather than assume.
UPDATE marketplace_listings
SET images = COALESCE(
  (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(images) AS elem WHERE elem NOT LIKE '/uploads/%'),
  '[]'::jsonb
)
WHERE jsonb_typeof(images) = 'array'
  AND images::text LIKE '%/uploads/%';

UPDATE marketplace_listings
SET video_url = NULL
WHERE video_url LIKE '/uploads/%';
