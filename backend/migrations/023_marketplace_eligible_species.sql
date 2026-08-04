-- Migration 023: admin-configurable marketplace eligibility per species
--
-- Marketplace.tsx/PublicMarketplace.tsx picked their "which species can be listed for
-- sale" dropdown from two hardcoded arrays in speciesBreeds.ts (MARKETPLACE_FARMER_SPECIES /
-- MARKETPLACE_PET_OWNER_SPECIES), disconnected from the admin master-data CRUD shipped in
-- migration 022 - a species an admin adds there would never become sellable without a code
-- change. The two hardcoded lists differ by exactly one species (Rabbit, pet-owner only),
-- so this collapses them to a single admin-editable flag rather than two, matching how
-- similar the two lists actually are in practice.
--
-- Defaults to false so this is a pure additive capability, not a behavior change: every
-- species NOT explicitly backfilled below stays exactly as unsellable as it was before this
-- migration (all the small-pet/bird/reptile/exotic species that were never in either
-- hardcoded list). Only the species already in one or both of the old hardcoded arrays are
-- backfilled to true, preserving today's marketplace picker contents exactly.

ALTER TABLE master_species ADD COLUMN IF NOT EXISTS is_marketplace_eligible BOOLEAN NOT NULL DEFAULT false;

UPDATE master_species SET is_marketplace_eligible = true
WHERE code IN ('Cattle', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Camel', 'Pig', 'Chicken', 'Dog', 'Cat', 'Rabbit', 'Other');
