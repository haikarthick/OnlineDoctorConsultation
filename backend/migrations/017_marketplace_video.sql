-- 017_marketplace_video.sql
-- Phase 4: optional video for listings (a hosted /uploads path or an external URL).
ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS video_url VARCHAR(2000);
