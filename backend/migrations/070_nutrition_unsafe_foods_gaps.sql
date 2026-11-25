-- 070: more feeding dangers in the safe-food guide (animal nutrition, domain review 2026-11-25).
--
-- Gaps found by the domain review: poultry had no chocolate or onion, pigs and poultry no urea (a non-ruminant cannot use it), horses
-- and ruminants no oleander (kaner), horses no lawn clippings, ruminants no cottonseed / mustard cake caution, dogs no raw dough and
-- dogs and cats no wild mushrooms. These rows are added as 'unvalidated' on purpose: they come from standard references (ASPCA, Merck
-- Veterinary Manual) but are NOT yet signed off by a vet, and the guide says so on screen (it already shows "unvalidated").
--
-- Idempotent (ON CONFLICT DO NOTHING), never hardcodes a schema name. Mirrored at the end of docker/init.sql.

INSERT INTO nutrition_unsafe_foods (code, species_code, label, label_key, match_terms, severity, source, status)
SELECT v.code, ms.code, v.label, 'nutrition.unsafe.' || regexp_replace(v.code, '_(bird|cat)$', ''), v.terms::text[], v.severity, v.source, 'unvalidated'
  FROM master_species ms
  JOIN (VALUES
    ('chocolate_bird', '{Chicken,Duck,Turkey,Quail}', 'Chocolate and cocoa', '{chocolate,cocoa}', 'danger', 'Merck Veterinary Manual - methylxanthine (theobromine) toxicosis in birds'),
    ('onion_bird', '{Chicken,Duck,Turkey,Quail}', 'Onion and garlic in large amounts', '{onion,garlic,pyaz,lahsun}', 'caution', 'Merck Veterinary Manual - Allium (onion) toxicosis'),
    ('urea_nonruminant', '{Pig,Chicken,Duck,Turkey,Quail}', 'Urea (pigs and poultry cannot use it)', '{urea}', 'danger', 'Non-protein nitrogen is not used by non-ruminants - urea toxicity'),
    ('oleander', '{Horse,Donkey,Cattle,Buffalo,Goat,Sheep,Camel}', 'Oleander (kaner) leaves or clippings', '{oleander,kaner,nerium}', 'danger', 'Merck Veterinary Manual - cardiac glycoside plant poisoning'),
    ('lawn_clippings', '{Horse,Donkey}', 'Lawn clippings and garden waste', '{"lawn clippings","grass clippings","garden waste"}', 'caution', 'Fermented clippings are linked to colic and laminitis in horses'),
    ('cottonseed_cake', '{Cattle,Buffalo,Goat,Sheep}', 'Cottonseed cake - not for young calves or breeding bulls (gossypol)', '{cottonseed,"cotton seed","kapas khal",binola}', 'caution', 'Merck Veterinary Manual - gossypol toxicity'),
    ('mustard_cake', '{Cattle,Buffalo,Goat,Sheep}', 'Mustard cake in large amounts (glucosinolates)', '{"mustard cake","sarson khal","mustard oil cake"}', 'caution', 'Glucosinolate-rich meals - limit the share in the ration'),
    ('dough_raw', '{Dog}', 'Raw bread or yeast dough', '{"raw dough","bread dough","yeast dough"}', 'danger', 'ASPCA Animal Poison Control - yeast dough expands in the stomach'),
    ('mushrooms_wild', '{Dog,Cat}', 'Wild mushrooms', '{"wild mushroom","wild mushrooms",toadstool}', 'danger', 'ASPCA Animal Poison Control - wild mushrooms')
  ) AS v(code, species, label, terms, severity, source) ON ms.code = ANY(v.species::text[])
ON CONFLICT (species_code, code) DO NOTHING;
