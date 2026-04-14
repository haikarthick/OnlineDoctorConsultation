-- ============================================================
-- VetCare Platform â€” Comprehensive Demo Seed Data
-- ============================================================
-- Cleans ALL transactional data and populates every module with
-- realistic, interconnected demo data across all 4 roles:
--   Admin, Veterinarian, Pet Owner, Farmer (Enterprise)
--
-- Passwords (bcrypt of the values shown):
--   Admin:   Admin@123
--   Doctors: Doctor@123
--   Owners:  Owner@123
--   Farmer:  Farmer@123
-- ============================================================

-- No global transaction â€” each section runs independently for resilience
-- (if a tier migration didn't create certain tables, other sections still succeed)

-- ============================================================
-- STEP 0: SKIP â€” DATA IS PRESERVED ACROSS DEPLOYMENTS
-- ============================================================
-- Previously this section ran TRUNCATE CASCADE which wiped all
-- user data on every deploy. Removed to preserve records.
-- To do a full clean re-seed, use FORCE_RESEED=true env var
-- which triggers this script only on an empty database.
-- The INSERT statements below use ON CONFLICT DO NOTHING
-- so existing records are never overwritten.

-- ============================================================
-- STEP 1: USERS (4 roles, 8 users total)
-- ============================================================
-- Admin@123
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',       'System',    'Administrator', 'admin',        '+1-555-100-0001', '$2a$10$ygmN6ksCJOgVBm.AB0Wa3.OH.CjYNdNPLkGEPTWOJtPAnTRzP03TC', true, 'USR-ADM-001'),
  -- Veterinarians (password: Doctor@123)
  ('b0000000-0000-0000-0000-000000000001', 'dr.james.carter@vetcare.com',  'James',   'Carter',   'veterinarian', '+1-555-200-0001', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-VET-001'),
  ('b0000000-0000-0000-0000-000000000002', 'sarah.johnson@example.com',    'Sarah',   'Johnson',  'veterinarian', '+1-555-200-0002', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-VET-002'),
  ('b0000000-0000-0000-0000-000000000003', 'dr.michael.reyes@vetcare.com', 'Michael',  'Reyes',   'veterinarian', '+1-555-200-0003', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-VET-003'),
  -- Pet Owners (password: Owner@123)
  ('c0000000-0000-0000-0000-000000000001', 'emily.davis@example.com',  'Emily',     'Davis',    'pet_owner',    '+1-555-300-0001', '$2a$10$OtuDm/nGqi3c8ymKklb1h.0XXbr.MN.TSVXTTb.JTYZjuku6Oqv2W', true, 'USR-PET-001'),
  ('c0000000-0000-0000-0000-000000000002', 'robert.chen@email.com',   'Robert',    'Chen',     'pet_owner',    '+1-555-300-0002', '$2a$10$OtuDm/nGqi3c8ymKklb1h.0XXbr.MN.TSVXTTb.JTYZjuku6Oqv2W', true, 'USR-PET-002'),
  -- Farmers (password: Farmer@123)
  ('f0000000-0000-0000-0000-000000000001', 'tom.wilson@example.com',       'Tom',     'Wilson',   'farmer',       '+1-555-400-0001', '$2a$10$9lvpT/PhXramRLyjABSXfO7ks10U4KvWGlfYS6XZYeUNpTjuM.rtm', true, 'USR-FRM-001'),
  ('f0000000-0000-0000-0000-000000000002', 'maria.garcia@sunrisefarm.com','Maria',   'Garcia',   'farmer',       '+1-555-400-0002', '$2a$10$9lvpT/PhXramRLyjABSXfO7ks10U4KvWGlfYS6XZYeUNpTjuM.rtm', true, 'USR-FRM-002'),
  -- Hospital Network Demo Users (password: Demo@123 — fixDemoPasswords corrects hash at startup)
  ('d0000000-0000-0000-0000-000000000001', 'netadmin@vetcare.com',         'Rajesh',  'Sharma',   'corporate_admin', '+91-98765-43210', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-CRP-001'),
  ('d0000000-0000-0000-0000-000000000002', 'branch.director@vetcare.com', 'Priya',   'Nair',     'veterinarian',    '+91-98765-43211', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-VET-004'),
  ('d0000000-0000-0000-0000-000000000003', 'staff.nurse@vetcare.com',     'Anitha',  'Kumar',    'hospital_staff',  '+91-98765-43212', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-STF-001'),
  ('d0000000-0000-0000-0000-000000000004', 'staff.reception@vetcare.com', 'Karthik', 'Rajan',    'hospital_staff',  '+91-98765-43213', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-STF-002'),
  ('d0000000-0000-0000-0000-000000000005', 'staff.labtech@vetcare.com',   'Meena',   'Sundaram', 'hospital_staff',  '+91-98765-43214', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-STF-003')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role, phone = EXCLUDED.phone, is_active = EXCLUDED.is_active;

-- ============================================================
-- STEP 2: VET PROFILES
-- ============================================================
INSERT INTO vet_profiles (id, user_id, license_number, specializations, qualifications, years_of_experience, bio, clinic_name, clinic_address, consultation_fee, currency, is_verified, is_available, accepts_emergency, languages, rating, total_reviews, total_consultations) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'VET-2024-10482',
   ARRAY['General Practice','Surgery','Orthopedics'], ARRAY['DVM - Cornell University','Board Certified ACVS'],
   14, 'Dr. Carter is a board-certified veterinary surgeon with 14 years of experience in small and large animal medicine. He specializes in orthopedic surgery and emergency care for dogs, cats, and horses.',
   'Carter Veterinary Hospital', '245 Oak Valley Dr, Austin, TX 78701',
   85.00, 'USD', true, true, true, ARRAY['English','Spanish'], 4.85, 12, 38),

  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'VET-2024-20571',
   ARRAY['Dermatology','Internal Medicine','Nutrition'], ARRAY['DVM - UC Davis','Diplomate ACVD'],
   9, 'Dr. Bennett is a veterinary dermatology specialist with deep expertise in chronic skin conditions, food allergies, and autoimmune disorders. She provides holistic treatment plans for pets and livestock.',
   'Bennett Animal Skin & Wellness', '1820 River Bend Rd, Portland, OR 97201',
   95.00, 'USD', true, true, false, ARRAY['English','French'], 4.72, 8, 24),

  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'VET-2024-30689',
   ARRAY['Emergency Care','Exotic Animals','Avian Medicine'], ARRAY['DVM - University of Florida','DACZM','Board Certified ECZM'],
   18, 'Dr. Reyes is a leading exotic and avian medicine specialist with 18 years in emergency veterinary care, treating species from parrots to reptiles. He consults for zoos and wildlife reserves internationally.',
   'Reyes Exotic & Emergency Vet Center', '780 Sunrise Blvd, Miami, FL 33101',
   120.00, 'USD', true, true, true, ARRAY['English','Spanish','Portuguese'], 4.93, 15, 52)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: VET SCHEDULES
-- ============================================================
INSERT INTO vet_schedules (id, veterinarian_id, day_of_week, start_time, end_time, slot_duration, max_appointments, is_active) VALUES
  -- Dr. Carter: Mon-Fri 8am-5pm, Sat 9am-1pm
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'monday',    '08:00','17:00', 30, 18, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'tuesday',   '08:00','17:00', 30, 18, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'wednesday', '08:00','17:00', 30, 18, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'thursday',  '08:00','17:00', 30, 18, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'friday',    '08:00','17:00', 30, 18, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'saturday',  '09:00','13:00', 30,  8, true),
  -- Dr. Bennett: Mon,Wed,Fri 9am-6pm
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'monday',    '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'wednesday', '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'friday',    '09:00','18:00', 45, 12, true),
  -- Dr. Reyes: Tue,Thu,Sat 10am-8pm (emergency hours)
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', 'tuesday',   '10:00','20:00', 30, 20, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', 'thursday',  '10:00','20:00', 30, 20, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', 'saturday',  '10:00','18:00', 30, 16, true);

-- ============================================================
-- STEP 4: ANIMALS / PETS
-- ============================================================
-- Emily Davis's pets
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, is_neutered, medical_notes, is_active, unique_id) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Buddy',    'Dog', 'Golden Retriever',     '2020-03-15', 'male',   32.5, 'Golden',        'MCHP-9001-GR', true,  'Annual vaccines up to date. Mild hip dysplasia noted.',       true, 'ANI-DOG-001'),
  ('aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Whiskers', 'Cat', 'Siamese',              '2021-07-20', 'female',  4.2, 'Cream Point',   'MCHP-9002-SI', true,  'Sensitive stomach - grain-free diet recommended.',            true, 'ANI-CAT-001'),
  ('aa000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Coco',     'Dog', 'French Bulldog',       '2022-11-01', 'female',  11.8,'Brindle',       'MCHP-9003-FB', false, 'Brachycephalic breed - monitor breathing in hot weather.',    true, 'ANI-DOG-002'),
-- Robert Chen's pets
  ('aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Max',      'Dog', 'German Shepherd',      '2019-06-10', 'male',   38.0, 'Black & Tan',   'MCHP-9004-GS', true,  'Senior dog. Requires joint supplements. Slight arthritis.',   true, 'ANI-DOG-003'),
  ('aa000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Luna',     'Cat', 'Maine Coon',           '2020-12-25', 'female',  6.8, 'Silver Tabby',  'MCHP-9005-MC', true,  'Very long coat. Regular grooming essential.',                 true, 'ANI-CAT-002'),
  ('aa000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Kiwi',     'Bird','Green Cheek Conure',   '2023-02-14', 'female',  0.07,'Green/Grey',    NULL,            false, 'Exotic bird. Hand-raised. Needs annual avian wellness exam.',  true, 'ANI-BRD-001'),
-- Farmer Tom Wilson's livestock
  ('aa000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'Daisy',      'Cattle','Holstein Friesian', '2021-04-08', 'female', 580.0,'Black/White', NULL, false, 'Top milk producer. Calved twice. Due for TB test.', true, 'ANI-COW-001'),
  ('aa000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', 'Thunder',    'Horse', 'Thoroughbred',      '2018-09-12', 'male',   520.0,'Bay',         'MCHP-EQ-8001', false, 'Retired racehorse. Occasional lameness in left foreleg.',    true, 'ANI-HRS-001'),
  ('aa000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000001', 'Rosie',      'Cattle','Jersey',            '2022-01-20', 'female', 420.0,'Fawn',        NULL, false, 'High butterfat milk. Gentle temperament.',                   true, 'ANI-COW-002'),
  ('aa000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'Rex',        'Dog',   'Border Collie',     '2020-08-05', 'male',    22.0,'Black/White', 'MCHP-BC-1001', true,  'Working farm dog. Excellent herder.',                        true, 'ANI-DOG-004'),
-- Farmer Maria Garcia's animals
  ('aa000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000002', 'Clucky',     'Poultry','Rhode Island Red',  '2023-03-01', 'female',   3.2,'Red',         NULL, false, 'Layer hen. Produces ~280 eggs/year.',  true, 'ANI-HEN-001'),
  ('aa000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'Bella',      'Goat',  'Saanen',            '2022-05-15', 'female',  65.0,'White',       'MCHP-GT-5001', false, 'Dairy goat. Milking 4L/day. Due for deworming.',             true, 'ANI-GOT-001'),
-- New exotic/elite demo animals
  ('aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 'Rio',        'Parrot',  'African Grey',      '2021-06-10', 'male',    0.5, 'Grey/Red',    NULL,            false, 'Hand-tamed African Grey. Speaks 50+ words. Annual avian health check recommended.',  true, 'ANI-PAR-001'),
  ('aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000001', 'Shelly',     'Tortoise','Indian Star Tortoise','2019-03-22', 'female',  1.2, 'Brown/Yellow',NULL,            false, 'Indian Star Tortoise. UV-B lighting required. Herbivore diet.',                      true, 'ANI-TOR-001'),
  ('aa000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000002', 'Dragon',     'Arowana', 'Silver',            '2022-08-01', 'male',    2.8, 'Silver',      NULL,            false, 'Silver Arowana. 180L tank. Carnivore diet. Water temp 26-30C.',                      true, 'ANI-ARW-001'),
  ('aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000001', 'Peanut',     'Hamster', 'Syrian (Golden)',   '2023-09-15', 'male',    0.15,'Golden',      NULL,            false, 'Syrian Hamster. Nocturnal. Needs exercise wheel and tunnels.',                        true, 'ANI-HAM-001'),
  ('aa000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000001', 'Raja',       'Peacock', 'Indian Peafowl (Blue)','2020-04-12','male',   5.0, 'Blue/Green',  NULL,            false, 'Indian Blue Peacock. Free-range on farm. Displays full plumage seasonally.',          true, 'ANI-PCK-001'),
  ('aa000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000001', 'Goliath',    'Emu',     'Australian Emu',    '2021-11-05', 'female', 52.0, 'Grey-Brown',  NULL,            false, 'Emu farm bird. Produces eggs and oil. Regular deworming schedule.',                  true, 'ANI-EMU-001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 5: ENTERPRISES
-- ============================================================
INSERT INTO enterprises (id, name, enterprise_type, description, address, city, state, country, postal_code, gps_latitude, gps_longitude, total_area, area_unit, license_number, regulatory_id, phone, email, website, owner_id, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Green Pastures Dairy Farm', 'dairy_farm',
   'A 200-acre family-owned dairy farm specializing in Holstein and Jersey cattle. Produces organic whole milk, cream, and artisan cheese. Certified humane and USDA organic. Operating since 1998.',
   '4521 Country Road 12', 'Cedar Falls', 'Iowa', 'US', '50613',
   42.5277, -92.4453, 200.0, 'acres', 'FARM-IA-2024-0482', 'USDA-ORG-39201',
   '+1-555-400-0001', 'info@greenpastures.com', 'https://greenpastures.com',
   'f0000000-0000-0000-0000-000000000001', true),

  ('e0000000-0000-0000-0000-000000000002', 'Sunrise Poultry & Goat Farm', 'mixed_farm',
   'A 45-acre mixed farm raising free-range Rhode Island Red hens and Saanen dairy goats. Supplies local farmers markets with eggs, goat milk, and fresh goat cheese.',
   '890 Hilltop Lane', 'Asheville', 'North Carolina', 'US', '28801',
   35.5951, -82.5515, 45.0, 'acres', 'FARM-NC-2024-1193', 'NCDA-LK-77412',
   '+1-555-400-0002', 'hello@sunrisefarm.com', 'https://sunrisefarm.com',
   'f0000000-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, owner_id = EXCLUDED.owner_id,
  is_active = EXCLUDED.is_active, total_area = EXCLUDED.total_area,
  description = EXCLUDED.description;

-- ============================================================
-- STEP 5b: ENTERPRISE MEMBERS
-- ============================================================
INSERT INTO enterprise_members (enterprise_id, user_id, role, title, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'owner',    'Farm Owner & Manager', true),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'farm_vet', 'On-Call Veterinarian',  true),
  ('e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'worker',   'Seasonal Worker',       true),
  ('e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'owner',    'Farm Owner',            true),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'farm_vet', 'Avian & Goat Vet',      true)
ON CONFLICT (enterprise_id, user_id) DO NOTHING;

-- ============================================================
-- STEP 5c: FARM LOCATIONS
-- ============================================================
INSERT INTO locations (id, enterprise_id, name, location_type, capacity, current_occupancy, area, area_unit, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Main Dairy Barn',        'barn',          60, 42, 8000, 'sqft', 'Primary milking barn with 60-stall capacity. Climate-controlled.', true),
  ('10000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'North Pasture',          'pasture',      100, 35, 80,   'acres','Open grazing pasture with creek access. Rotational grazing.', true),
  ('10000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Horse Stable',           'stable',         8,  2, 3000, 'sqft', '8-stall equestrian stable with tack room and wash bay.', true),
  ('10000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'Quarantine Pen',         'quarantine',    10,  0, 500,  'sqft', 'Isolated area for sick or newly arrived animals.', true),
  ('10000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'Milking Parlor',         'milking_parlor',20, 20, 2000, 'sqft', 'Rotary milking parlor with automated cleaning.', true),
  ('10000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'Feed Storage',           'feed_storage',   0,  0, 1200, 'sqft', 'Climate-controlled grain and hay storage.', true),
  ('10000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000002', 'Hen House A',            'barn',         200,150, 1500, 'sqft', 'Main free-range layer house with nesting boxes.', true),
  ('10000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000002', 'Goat Paddock',           'paddock',       30, 12, 5,    'acres','Fenced paddock with shelter for Saanen dairy goats.', true),
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'Processing Kitchen',     'warehouse',      0,  0, 600,  'sqft', 'USDA-inspected cheese and egg processing facility.', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 5d: ANIMAL GROUPS
-- ============================================================
INSERT INTO animal_groups (id, enterprise_id, name, group_type, species, breed, purpose, target_count, current_count, description, color_code, is_active) VALUES
  ('ab000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Holstein Milking Herd',   'herd',  'Cattle', 'Holstein Friesian', 'dairy',     50, 42, 'Active milking herd of Holstein cows.',                '#3b82f6', true),
  ('ab000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Jersey Milking Herd',     'herd',  'Cattle', 'Jersey',            'dairy',     20, 15, 'Jersey cows for premium butterfat production.',        '#f59e0b', true),
  ('ab000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Young Calves Nursery',    'nursery','Cattle', NULL,                'breeding',  15,  8, 'Calves under 6 months in nursery care.',               '#10b981', true),
  ('ab000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'RIR Layer Flock',         'flock', 'Poultry','Rhode Island Red',  'layer',    200,150, 'Free-range layer hens for egg production.',            '#ef4444', true),
  ('ab000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'Saanen Dairy Does',       'herd',  'Goat',  'Saanen',            'dairy',     30, 12, 'Saanen dairy goats for milk and cheese production.',   '#8b5cf6', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 6: BOOKINGS (various statuses)
-- ============================================================
INSERT INTO bookings (id, pet_owner_id, veterinarian_id, animal_id, scheduled_date, time_slot_start, time_slot_end, status, booking_type, priority, reason_for_visit, symptoms, notes) VALUES
  -- Completed bookings (past)
  ('bb000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001',
   '2026-01-15', '09:00','09:30', 'completed', 'video_call', 'normal',
   'Annual wellness checkup for Buddy', 'Mild limping on right hind leg', 'Regular annual examination'),

  ('bb000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000002',
   '2026-01-22', '14:00','14:45', 'completed', 'video_call', 'high',
   'Persistent skin itching and hair loss', 'Excessive scratching, bald patches on belly', 'Referred by Dr. Carter'),

  ('bb000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000004',
   '2026-02-01', '10:00','10:30', 'completed', 'in_person', 'normal',
   'Joint stiffness in senior dog', 'Difficulty climbing stairs, slow to stand', NULL),

  ('bb000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000006',
   '2026-02-05', '11:00','11:30', 'completed', 'in_person', 'normal',
   'Avian wellness examination for Kiwi', 'Feather plucking observed', 'First visit with avian specialist'),

  -- Confirmed bookings (upcoming)
  ('bb000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000003',
   '2026-02-25', '14:00','14:30', 'confirmed', 'video_call', 'normal',
   'Breathing checkup for Coco (French Bulldog)', 'Occasional snoring louder than usual', 'Brachycephalic monitoring'),

  ('bb000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000005',
   '2026-02-27', '09:00','09:45', 'confirmed', 'video_call', 'normal',
   'Luna coat and skin evaluation', 'Matting and dandruff along spine', NULL),

  -- Pending booking
  ('bb000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008',
   '2026-03-05', '08:00','08:30', 'pending', 'in_person', 'high',
   'Lameness evaluation for Thunder', 'Recurring left foreleg lameness after exercise', 'Previously rested 6 weeks'),

  -- Cancelled booking
  ('bb000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000001',
   '2026-02-10', '15:00','15:30', 'cancelled', 'phone', 'low',
   'Follow-up on Buddy hip dysplasia', NULL, 'Owner rescheduled due to travel')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 7: CONSULTATIONS (linked to completed bookings + standalone)
-- ============================================================
INSERT INTO consultations (id, user_id, veterinarian_id, animal_id, animal_type, symptom_description, status, priority, scheduled_at, started_at, completed_at, duration, diagnosis, prescription, follow_up_date, notes) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001',
   'Dog - Golden Retriever', 'Mild limping on right hind leg during walks',
   'completed', 'normal', '2026-01-15 09:00:00', '2026-01-15 09:02:00', '2026-01-15 09:28:00', 26,
   'Mild bilateral hip dysplasia (Grade II). No surgical intervention needed at this time.',
   'Carprofen 75mg once daily with food for 14 days. Glucosamine-chondroitin supplement daily.',
   '2026-04-15', 'Weight management recommended â€” maintain 30-32kg. Low-impact exercise only.'),

  ('cc000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000002',
   'Cat - Siamese', 'Excessive scratching, bald patches on belly and inner thighs',
   'completed', 'high', '2026-01-22 14:00:00', '2026-01-22 14:04:00', '2026-01-22 14:42:00', 38,
   'Feline atopic dermatitis secondary to environmental allergens (dust mites). Skin scraping negative for mites/fungal.',
   'Prednisolone 5mg every other day for 10 days, then taper. Apoquel 16mg daily ongoing. Hypoallergenic shampoo weekly.',
   '2026-03-22', 'Switch to hypoallergenic diet (Royal Canin Hypoallergenic). Environmental management recommended.'),

  ('cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000004',
   'Dog - German Shepherd', 'Difficulty climbing stairs, slow to stand after rest',
   'completed', 'normal', '2026-02-01 10:00:00', '2026-02-01 10:05:00', '2026-02-01 10:32:00', 27,
   'Moderate degenerative joint disease (osteoarthritis) in both hips and right stifle. Radiographs confirm narrowed joint spaces.',
   'Meloxicam 1.5mg daily. Adequan injections every 4 weeks. Joint supplement with omega-3 fatty acids.',
   '2026-05-01', 'Consider hydrotherapy. Keep weight under 36kg. Soft bedding essential.'),

  ('cc000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000006',
   'Bird - Green Cheek Conure', 'Feather plucking on chest and under wings',
   'completed', 'normal', '2026-02-05 11:00:00', '2026-02-05 11:03:00', '2026-02-05 11:35:00', 32,
   'Behavioral feather plucking â€” no underlying medical cause. Blood panel and crop culture normal. Likely stress-related (recent household move).',
   'Harrison''s Bird Foods pellet diet. Aloe vera spray mist 2x daily on feathers. Environmental enrichment â€” foraging toys, minimum 4 hours out-of-cage time.',
   '2026-05-05', 'If plucking worsens, consider avian behaviorist. Recommend full-spectrum UV light 8 hours/day.'),

  -- Farm consultation (in_progress)
  ('cc000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007',
   'Cattle - Holstein Friesian', 'Sudden drop in milk production by 30%. Slight nasal discharge.',
   'in_progress', 'high', '2026-02-18 08:00:00', '2026-02-18 08:05:00', NULL, NULL,
   NULL, NULL, NULL, 'Urgent farm visit. Suspected respiratory infection or ketosis. Blood sample collected, awaiting lab results.'),

  -- Scheduled consultation (future)
  ('cc000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000003',
   'Dog - French Bulldog', 'Louder snoring and occasional reverse sneezing episodes',
   'scheduled', 'normal', '2026-02-25 14:00:00', NULL, NULL, NULL,
   NULL, NULL, NULL, 'Brachycephalic airway assessment. May need soft palate evaluation.')
ON CONFLICT (id) DO NOTHING;

-- Link completed bookings to consultations
UPDATE bookings SET consultation_id = 'cc000000-0000-0000-0000-000000000001' WHERE id = 'bb000000-0000-0000-0000-000000000001';
UPDATE bookings SET consultation_id = 'cc000000-0000-0000-0000-000000000002' WHERE id = 'bb000000-0000-0000-0000-000000000002';
UPDATE bookings SET consultation_id = 'cc000000-0000-0000-0000-000000000003' WHERE id = 'bb000000-0000-0000-0000-000000000003';
UPDATE bookings SET consultation_id = 'cc000000-0000-0000-0000-000000000004' WHERE id = 'bb000000-0000-0000-0000-000000000004';
UPDATE bookings SET consultation_id = 'cc000000-0000-0000-0000-000000000006' WHERE id = 'bb000000-0000-0000-0000-000000000005';

-- ============================================================
-- STEP 8: VIDEO SESSIONS
-- ============================================================
INSERT INTO video_sessions (id, consultation_id, room_id, host_user_id, participant_user_id, status, started_at, ended_at, duration, quality) VALUES
  ('dd000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'room-buddy-checkup-20260115',
   'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'ended', '2026-01-15 09:02:00', '2026-01-15 09:28:00', 1560, 'hd'),

  ('dd000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'room-whiskers-derm-20260122',
   'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'ended', '2026-01-22 14:04:00', '2026-01-22 14:42:00', 2280, 'high')
ON CONFLICT (id) DO NOTHING;

-- Chat messages from video sessions
INSERT INTO chat_messages (id, session_id, sender_id, sender_name, message, message_type, timestamp) VALUES
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'Good morning Emily! I can see Buddy on camera. Can you have him walk away and back toward the camera?', 'text', '2026-01-15 09:03:00'),
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Emily Davis', 'Sure! Let me get his leash. You can see the limp is more noticeable after he''s been resting.', 'text', '2026-01-15 09:04:30'),
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'I can see the gait asymmetry. Based on his breed and age, this is consistent with hip dysplasia. I''d recommend getting radiographs done at our clinic.', 'text', '2026-01-15 09:08:00'),
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'I''m sending over the prescription for anti-inflammatory medication now.', 'text', '2026-01-15 09:22:00'),
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Dr. Sarah Johnson', 'Hi Emily! I''m reviewing the photos you uploaded. Can you hold Whiskers so I can see the belly area closer?', 'text', '2026-01-22 14:05:00'),
  (gen_random_uuid(), 'dd000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Emily Davis', 'She doesn''t love being held but I''ll try! The patches have been getting worse over the past 2 weeks.', 'text', '2026-01-22 14:06:30');

-- ============================================================
-- STEP 9: PRESCRIPTIONS
-- ============================================================
INSERT INTO prescriptions (id, consultation_id, veterinarian_id, pet_owner_id, animal_id, medications, instructions, valid_until, is_active) VALUES
  ('ee000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001',
   '[{"name":"Carprofen","dosage":"75mg","frequency":"Once daily","duration":"14 days","instructions":"Give with food to prevent stomach upset"},{"name":"Dasuquin Advanced","dosage":"1 soft chew","frequency":"Once daily","duration":"Ongoing","instructions":"Joint support supplement. Give with or without food."}]',
   'Administer Carprofen with food. Monitor for vomiting or diarrhea. Continue Dasuquin indefinitely. Recheck in 3 months.',
   '2026-07-15', true),

  ('ee000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002',
   '[{"name":"Prednisolone","dosage":"5mg","frequency":"Every other day","duration":"10 days then taper","instructions":"Taper: 5mg every other day x10 days, then 2.5mg every other day x5 days, then stop"},{"name":"Apoquel (oclacitinib)","dosage":"16mg","frequency":"Once daily","duration":"Ongoing","instructions":"May take 4-14 days for full effect. Safe for long-term use."},{"name":"Douxo Calm Shampoo","dosage":"Apply topically","frequency":"Weekly","duration":"8 weeks","instructions":"Leave on coat for 10 minutes before rinsing."}]',
   'Start prednisolone immediately, begin Apoquel concurrently. Switch to hypoallergenic diet within 1 week. Weekly medicated baths.',
   '2026-07-22', true),

  ('ee000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000004',
   '[{"name":"Meloxicam","dosage":"1.5mg","frequency":"Once daily","duration":"Ongoing","instructions":"Give with food. Do not combine with other NSAIDs."},{"name":"Adequan Canine","dosage":"2mg/lb IM","frequency":"Every 4 weeks","duration":"6 months","instructions":"Administered at clinic by veterinary staff only."},{"name":"Nordic Naturals Omega-3","dosage":"2 capsules","frequency":"Once daily","duration":"Ongoing","instructions":"Pierce capsule and mix with food."}]',
   'Meloxicam daily with food. Adequan injections scheduled at clinic monthly. Omega-3 for joint inflammation support. Recheck radiographs in 3 months.',
   '2026-08-01', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 10: MEDICAL RECORDS
-- ============================================================
INSERT INTO medical_records (id, user_id, animal_id, consultation_id, veterinarian_id, record_number, record_type, title, content, severity, status, medications, is_confidential, follow_up_date, tags, created_by) VALUES
  ('ff000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00001', 'diagnosis', 'Hip Dysplasia Diagnosis â€” Buddy',
   'Physical examination revealed bilateral hip laxity (Ortolani sign positive). Radiographs show Grade II hip dysplasia with mild joint space narrowing. No subluxation. Conservative management recommended at this stage. Weight management critical â€” target 30-32kg. Started on Carprofen for inflammation and glucosamine supplementation for cartilage support.',
   'normal', 'active', '[{"name":"Carprofen","dosage":"75mg","frequency":"Daily","duration":"14 days","instructions":"With food"}]',
   false, '2026-04-15', ARRAY['orthopedics','hip-dysplasia','senior-care'], 'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'MR-2026-00002', 'diagnosis', 'Atopic Dermatitis â€” Whiskers',
   'Skin scraping: negative for Demodex, Sarcoptes, and dermatophytes. Cytology showed mild secondary bacterial infection (cocci). Trichogram: broken hair shafts consistent with self-trauma. Diagnosis: feline atopic dermatitis secondary to environmental allergens. Treatment: steroid taper + long-term Apoquel. Diet trial with hypoallergenic food recommended.',
   'high', 'active', '[{"name":"Prednisolone","dosage":"5mg","frequency":"Every other day","duration":"10 days taper","instructions":"Start taper after day 10"}]',
   false, '2026-03-22', ARRAY['dermatology','allergy','skin'], 'b0000000-0000-0000-0000-000000000002'),

  ('ff000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00003', 'diagnosis', 'Osteoarthritis Assessment â€” Max',
   'Bilateral hip and right stifle osteoarthritis. Radiographs show osteophyte formation and narrowed joint spaces. Synovial fluid analysis: mildly increased viscosity, no crystals, low WBC (non-inflammatory). Muscle mass slightly decreased in hindquarters. Multimodal pain management initiated.',
   'normal', 'active', '[{"name":"Meloxicam","dosage":"1.5mg","frequency":"Daily","duration":"Ongoing","instructions":"With food"}]',
   false, '2026-05-01', ARRAY['orthopedics','arthritis','geriatric'], 'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003',
   'MR-2026-00004', 'diagnosis', 'Behavioral Feather Plucking â€” Kiwi',
   'Complete avian physical exam: body condition 4/5, keel prominent but adequate muscle mass. Feather plucking limited to chest and ventral wing coverts. No skin lesions or parasites. CBC/chemistry panel within normal limits. Crop gram stain: normal bacterial flora. Chlamydia psittaci PCR: negative. Diagnosis: behavioral feather destructive behavior (FDB), likely triggered by environmental stress from recent move.',
   'normal', 'active', '[]',
   false, '2026-05-05', ARRAY['avian','behavioral','exotic'], 'b0000000-0000-0000-0000-000000000003'),

  ('ff000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00005', 'diagnosis', 'Acute Milk Drop â€” Daisy (Holstein)',
   'Holstein cow presented with 30% decline in milk production over 48 hours. Slight bilateral nasal discharge (serous). Temp 39.8Â°C (mildly elevated). Rumen motility reduced. Differential diagnosis: early pneumonia vs. subclinical ketosis vs. transition cow syndrome. Blood sample collected â€” awaiting BHB, NEFA, and CBC results. Started on IV fluids and propylene glycol drench pending labs.',
   'high', 'active', '[]',
   false, NULL, ARRAY['bovine','production','emergency'], 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 10b: VACCINATION RECORDS
-- ============================================================
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, certificate_number, reaction_notes, is_valid) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'Rabies (3-year)',     'Core',      '2025-03-15', '2028-03-15', '1 mL SC', 'RB-3Y-8842', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'DHPP (DA2PP)',        'Core',      '2025-03-15', '2026-03-15', '1 mL SC', 'DH-5W-2210', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A002', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'Bordetella',          'Non-Core',  '2025-09-01', '2026-09-01', '0.5 mL IN','BD-IN-4410', 'Merck',                'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A003', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'FVRCP',              'Core',      '2025-07-20', '2026-07-20', '1 mL SC', 'FV-3C-7781', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-B001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'Rabies (1-year)',     'Core',      '2025-07-20', '2026-07-20', '1 mL SC', 'RB-1Y-3319', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000002', 'VAX-2025-B002', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'Rabies (3-year)',     'Core',      '2024-06-10', '2027-06-10', '1 mL SC', 'RB-3Y-5501', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-C001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'DHPP (DA2PP)',        'Core',      '2024-06-10', '2025-06-10', '1 mL SC', 'DH-5W-1198', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2024-C002', 'Mild injection site swelling resolved in 24hrs', true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 'BVD + IBR',          'Core',      '2025-10-01', '2026-10-01', '5 mL IM', 'BV-IBR-4477','Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-D001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 'Clostridial 7-way',  'Core',      '2025-10-01', '2026-04-01', '2 mL SC', 'CL-7W-9902', 'Merck',                'b0000000-0000-0000-0000-000000000001', 'VAX-2025-D002', NULL, true);

-- ============================================================
-- STEP 10c: WEIGHT HISTORY
-- ============================================================
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 30.2, 'kg', 'Post-neuter recovery weight',  'b0000000-0000-0000-0000-000000000001', '2025-06-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 31.8, 'kg', 'Gaining well â€” slight overweight', 'b0000000-0000-0000-0000-000000000001', '2025-09-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 32.5, 'kg', 'Annual checkup weight',        'b0000000-0000-0000-0000-000000000001', '2026-01-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002',  3.8, 'kg', 'First year weight',            'b0000000-0000-0000-0000-000000000002', '2025-07-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002',  4.2, 'kg', 'Dermatology visit weight',     'b0000000-0000-0000-0000-000000000002', '2026-01-22'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 39.5, 'kg', 'Pre-arthritis baseline',       'b0000000-0000-0000-0000-000000000001', '2025-08-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 38.0, 'kg', 'Weight loss goal on track',    'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 560.0,'kg', 'Quarterly herd weigh-in',      'f0000000-0000-0000-0000-000000000001', '2025-10-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 580.0,'kg', 'Pre-calving weight',           'f0000000-0000-0000-0000-000000000001', '2026-01-15');

-- ============================================================
-- STEP 10d: ALLERGY RECORDS
-- ============================================================
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'Dust Mites',     'Pruritus, erythema, alopecia on ventrum', 'severe',   '2026-01-22', true, 'Confirmed via intradermal allergy testing at Bennett Clinic', 'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'Grain (Wheat)',   'GI upset â€” vomiting, soft stool',         'moderate', '2025-11-10', true, 'Resolved on grain-free diet. Reoccurs if exposed.', 'c0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'Chicken Protein', 'Ear inflammation, itchy paws',            'mild',     '2024-09-15', true, 'Switched to salmon-based diet.',  'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'Bee Stings',      'Facial swelling, hives',                  'severe',   '2025-07-20', true, 'Emergency Benadryl given. Keep epinephrine on hand during outdoor activities.', 'b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 10e: LAB RESULTS
-- ============================================================
INSERT INTO lab_results (id, animal_id, consultation_id, test_name, test_category, test_date, result_value, normal_range, unit, is_abnormal, interpretation, status, lab_name, ordered_by, notes) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'Skin Scraping â€” Demodex',       'Dermatology', '2026-01-22', 'Negative',  'Negative', NULL,    false, 'No Demodex mites observed. Rules out demodicosis.',    'completed', 'Bennett Lab',     'b0000000-0000-0000-0000-000000000002', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'Fungal Culture (DTM)',           'Dermatology', '2026-01-22', 'Negative',  'Negative', NULL,    false, 'No dermatophyte growth at 14 days.',                   'completed', 'Bennett Lab',     'b0000000-0000-0000-0000-000000000002', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'CBC â€” Complete Blood Count',     'Hematology',  '2026-02-01', 'WBC 8.2, RBC 7.1, HCT 45%', 'WBC 5.5-16.9, RBC 5.5-8.5, HCT 37-55%', 'x10^9/L', false, 'All values within normal limits. No signs of infection.', 'completed', 'VetPath Diagnostics', 'b0000000-0000-0000-0000-000000000001', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'Serum Chemistry Panel',          'Chemistry',   '2026-02-01', 'BUN 22, Creat 1.4, ALT 35', 'BUN 7-27, Creat 0.5-1.8, ALT 10-125', 'mg/dL', false, 'Kidney and liver values normal for age. Safe for NSAID therapy.', 'completed', 'VetPath Diagnostics', 'b0000000-0000-0000-0000-000000000001', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'Avian CBC + Chemistry',          'Hematology',  '2026-02-05', 'WBC 6.8, PCV 48%, Glucose 280', 'WBC 5-12, PCV 35-55%, Glucose 200-400', 'varied', false, 'All values within normal range for Green Cheek Conure.', 'completed', 'Avian Diagnostics Inc', 'b0000000-0000-0000-0000-000000000003', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'Chlamydia psittaci PCR',         'Infectious',  '2026-02-05', 'Not Detected', 'Not Detected', NULL, false, 'Negative for Chlamydia. Rules out psittacosis.',          'completed', 'Avian Diagnostics Inc', 'b0000000-0000-0000-0000-000000000003', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000005', 'BHB (Beta-Hydroxybutyrate)',     'Chemistry',   '2026-02-18', '1.8',       '0.2-1.0', 'mmol/L', true,  'Elevated BHB indicates subclinical ketosis. Confirms metabolic cause for milk drop.', 'completed', 'Iowa Vet Diagnostics', 'b0000000-0000-0000-0000-000000000001', 'Urgent sample â€” results in 4 hours');

-- ============================================================
-- STEP 11: PAYMENTS
-- ============================================================
INSERT INTO payments (id, consultation_id, user_id, payer_id, payee_id, amount, currency, status, payment_method, transaction_id, invoice_number, gateway, tax_amount, paid_at) VALUES
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'credit_card', 'TXN-2026-A001', 'INV-2026-001', 'stripe', 7.65, '2026-01-15 09:30:00'),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   95.00, 'USD', 'completed', 'credit_card', 'TXN-2026-A002', 'INV-2026-002', 'stripe', 8.55, '2026-01-22 14:45:00'),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'debit_card', 'TXN-2026-B001', 'INV-2026-003', 'stripe', 7.65, '2026-02-01 10:35:00'),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
   120.00, 'USD', 'completed', 'credit_card', 'TXN-2026-B002', 'INV-2026-004', 'stripe', 10.80, '2026-02-05 11:40:00'),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'pending', 'bank_transfer', NULL, 'INV-2026-005', 'stripe', 7.65, NULL);

-- ============================================================
-- STEP 12: REVIEWS
-- ============================================================
INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, response_from_vet, is_public, status, helpful_count, report_count) VALUES
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   5, 'Dr. Carter was incredibly thorough with Buddy''s hip evaluation. He explained everything clearly over video and the prescription was ready before the call even ended. Highly recommend!',
   'Thank you Emily! Buddy is a wonderful patient. Don''t forget his follow-up in April.', true, 'active', 8, 0),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   4, 'Dr. Bennett diagnosed Whiskers'' skin condition quickly. The treatment plan is detailed and working well after 3 weeks. Only minor issue was a short wait before the video call started.',
   'Thank you for the kind words! Glad the Apoquel is helping. See you at the follow-up!', true, 'active', 5, 0),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   5, 'Max''s arthritis management plan from Dr. Carter has been life-changing. He''s climbing stairs again within 2 weeks of starting treatment. The Adequan injections are making a huge difference.',
   NULL, true, 'active', 12, 0),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
   5, 'Finding an avian specialist was difficult until we found Dr. Reyes. He was patient, knowledgeable about conure behavior, and his diagnosis for Kiwi''s feather plucking was spot on. The enrichment recommendations are already helping.',
   'Thank you Robert! Kiwi is a lovely bird. The foraging toys should make a big difference. See you in May!', true, 'active', 6, 0);

-- ============================================================
-- STEP 13: NOTIFICATIONS
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel) VALUES
  -- Pet owner notifications
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'booking',       'Booking Confirmed', 'Your appointment with Dr. Carter for Coco on Feb 25 at 2:00 PM has been confirmed.', false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'consultation',  'Prescription Ready', 'Dr. Bennett has issued a new prescription for Whiskers. View it in your medical records.', true, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'reminder',      'Follow-Up Reminder', 'Whiskers has a follow-up appointment due on March 22, 2026 with Dr. Bennett.', false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'booking',       'Booking Confirmed', 'Your appointment with Dr. Bennett for Luna on Feb 27 at 9:00 AM has been confirmed.', false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'review',        'Thank You for Your Review', 'Dr. Reyes appreciated your 5-star review for Kiwi''s consultation.', true, 'in_app'),
  -- Vet notifications
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'booking',       'New Booking Request', 'Tom Wilson has requested an appointment for Thunder (Horse) on March 5.', false, 'in_app'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'consultation',  'Lab Results Ready', 'BHB results for Daisy (Holstein) are now available. Value: 1.8 mmol/L â€” elevated.', false, 'in_app'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'review',        'New Review Received', 'Robert Chen left a 5-star review for Max''s consultation.', true, 'in_app'),
  -- Admin notifications
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'system',        'System Health Check', 'All system services are operating normally. Uptime: 99.97%.', true,  'in_app'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'payment',       'Payment Processing', '5 payments processed today totaling $470.00. No failed transactions.', false, 'in_app'),
  -- Farmer notifications
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001', 'consultation',  'Urgent: Lab Results', 'Daisy''s BHB level is 1.8 mmol/L indicating subclinical ketosis. Contact your vet.', false, 'in_app'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001', 'reminder',      'Vaccination Due',    'Clostridial 7-way booster for Daisy is due on April 1, 2026.', false, 'in_app');

-- ============================================================
-- STEP 14: AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (id, user_id, user_email, action, resource, entity_type, details, ip_address, timestamp) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',            'LOGIN',        'auth',          'user',         '{"method":"email_password"}',                          '10.0.0.1', '2026-02-18 07:45:00'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', 'dr.james.carter@vetcare.com',  'START_CONSULTATION', 'consultations','consultation','{"consultationId":"cc000000-0000-0000-0000-000000000005","animalName":"Daisy"}', '10.0.0.5', '2026-02-18 08:05:00'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'emily.davis@example.com',      'CREATE_BOOKING', 'bookings',     'booking',      '{"bookingId":"bb000000-0000-0000-0000-000000000005","vetName":"Dr. Carter"}', '192.168.1.10', '2026-02-19 16:30:00'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'sarah.johnson@example.com',    'ISSUE_PRESCRIPTION','prescriptions','prescription','{"prescriptionId":"ee000000-0000-0000-0000-000000000002","animal":"Whiskers"}', '10.0.0.6', '2026-01-22 14:43:00'),
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',            'UPDATE_SETTING', 'settings',     'system_setting','{"key":"display.timeFormat","oldValue":"24h","newValue":"12h"}', '10.0.0.1', '2026-02-17 10:00:00');

-- ============================================================
-- STEP 15: SYSTEM SETTINGS
-- ============================================================
INSERT INTO system_settings (id, key, value, category, description) VALUES
  (gen_random_uuid(), 'display.timeFormat',              '12h',            'display',       'Time display format: 12h (AM/PM) or 24h'),
  (gen_random_uuid(), 'display.dateFormat',              'MMM d, yyyy',    'display',       'Date display format'),
  (gen_random_uuid(), 'consultation.joinWindowMinutes',  '5',              'consultation',  'Minutes before scheduled time when Join/Start button becomes available'),
  (gen_random_uuid(), 'consultation.maxDurationMinutes', '60',             'consultation',  'Maximum consultation duration in minutes'),
  (gen_random_uuid(), 'booking.advanceBookingDays',      '60',             'booking',       'How many days in advance bookings are allowed'),
  (gen_random_uuid(), 'booking.cancellationWindowHours', '24',             'booking',       'Hours before appointment when cancellation is free'),
  (gen_random_uuid(), 'booking.maxReschedules',          '1',              'booking',       'Maximum number of times a user can reschedule a booking before doctor acceptance'),
  (gen_random_uuid(), 'booking.patientNoShowRescheduleLimit', '1',         'booking',       'Maximum times a patient can reschedule after a patient no-show (0 = unlimited)'),
  (gen_random_uuid(), 'payment.currency',                'USD',            'payment',       'Default platform currency'),
  (gen_random_uuid(), 'payment.taxRate',                 '9',              'payment',       'Default tax percentage applied to consultation fees'),
  (gen_random_uuid(), 'notification.emailEnabled',       'true',           'notification',  'Enable email notifications'),
  (gen_random_uuid(), 'video.maxParticipants',           '2',              'video',         'Maximum participants per video session'),
  (gen_random_uuid(), 'security.maxLoginAttempts',       '5',              'security',      'Maximum login attempts before temporary lockout'),
  (gen_random_uuid(), 'security.lockoutDurationMinutes', '15',             'security',      'Lockout duration after max failed login attempts'),
  (gen_random_uuid(), 'payment.gatewayMode',             'demo',           'payment',       'Payment gateway mode: demo (stub payments), test (sandbox), live (real gateway)'),
  (gen_random_uuid(), 'payment.gatewayUrl',              '',               'payment',       'Payment gateway API base URL (leave empty for demo/stub mode)'),
  (gen_random_uuid(), 'payment.gatewayApiKey',           '',               'payment',       'Payment gateway API key (encrypted in production)'),
  (gen_random_uuid(), 'payment.gatewayProvider',         'stripe',         'payment',       'Payment gateway provider: stripe, paypal, razorpay'),
  (gen_random_uuid(), 'cancellation.autoRefundOnDoctorCancel', 'true',     'cancellation',  'Automatically refund patient when doctor cancels a paid booking'),
  (gen_random_uuid(), 'cancellation.patientFreeWindowHours',  '24',        'cancellation',  'Hours before appointment when patient can cancel for free'),
  (gen_random_uuid(), 'cancellation.partialRefundPercent',    '50',        'cancellation',  'Refund percentage for patient cancellation within partial window'),
  (gen_random_uuid(), 'cancellation.partialRefundWindowHours','2',         'cancellation',  'Hours before appointment for partial refund (0 = direct no-refund)'),
  (gen_random_uuid(), 'cancellation.goodwillBonusPercent',    '10',        'cancellation',  'Bonus wallet credit on top of refund when doctor cancels'),
  (gen_random_uuid(), 'cancellation.doctorMaxCancellationsPerMonth', '3',  'cancellation',  'Max doctor cancellations per month before reliability penalty')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 16: MOVEMENT RECORDS
-- ============================================================
INSERT INTO movement_records (id, enterprise_id, animal_id, from_location_id, to_location_id, movement_type, reason, animal_count, transport_date, recorded_by, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'transfer', 'Moved to barn for milking shift',      1, '2026-02-18 05:30:00', 'f0000000-0000-0000-0000-000000000001', 'Morning milking transfer'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'quarantine', 'Isolated for veterinary examination', 1, '2026-02-18 09:00:00', 'b0000000-0000-0000-0000-000000000001', 'Temperature elevated â€” isolating as precaution'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'transfer', 'Morning turnout to pasture',           1, '2026-02-18 07:00:00', 'f0000000-0000-0000-0000-000000000001', NULL);

-- ============================================================
-- STEP 17: TREATMENT CAMPAIGNS
-- ============================================================
INSERT INTO treatment_campaigns (id, enterprise_id, group_id, campaign_type, name, description, product_used, dosage, target_count, completed_count, status, scheduled_date, started_at, completed_at, administered_by, cost, notes) VALUES
  ('1c000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'vaccination', 'Spring BVD/IBR Booster Campaign',
   'Annual BVD and IBR vaccination for the entire Holstein milking herd.',
   'Bovi-Shield Gold 5', '5 mL IM', 42, 42, 'completed', '2025-10-01', '2025-10-01 08:00:00', '2025-10-01 16:00:00',
   'b0000000-0000-0000-0000-000000000001', 840.00, 'All 42 head vaccinated. No adverse reactions observed.'),

  ('1c000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000002', 'deworming', 'Jersey Herd Deworming',
   'Quarterly deworming treatment for Jersey milking herd.',
   'Ivermectin Pour-On', '1 mL/10kg', 15, 15, 'completed', '2026-01-15', '2026-01-15 09:00:00', '2026-01-15 12:00:00',
   'b0000000-0000-0000-0000-000000000001', 225.00, 'All 15 treated. Fecal egg count reduction test scheduled for Feb 15.'),

  ('1c000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000004', 'health_check', 'Flock Respiratory Health Screen',
   'Periodic respiratory health check for the RIR layer flock. Checking for IB, ND, and MG.',
   NULL, NULL, 150, 0, 'planned', '2026-03-01', NULL, NULL,
   'b0000000-0000-0000-0000-000000000003', 450.00, 'Dr. Reyes to perform. Tracheal swabs and blood serology.'),

  ('1c000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000005', 'deworming', 'Goat Herd Deworming â€” Spring',
   'FAMACHA-guided targeted deworming for Saanen dairy does.',
   'Cydectin (Moxidectin)', '0.2 mg/kg oral', 12, 8, 'in_progress', '2026-02-15', '2026-02-15 10:00:00', NULL,
   'b0000000-0000-0000-0000-000000000003', 180.00, '8 of 12 does treated so far. Remaining 4 have low FAMACHA scores â€” skipping.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 18: HEALTH OBSERVATIONS
-- ============================================================
INSERT INTO health_observations (id, enterprise_id, animal_id, observer_id, observation_type, severity, title, description, body_temperature, heart_rate, respiratory_rate, symptoms, is_resolved, resolved_at) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'illness', 'high', 'Daisy â€” Reduced Milk Yield & Nasal Discharge',
   'Daisy''s milk production dropped from 28L to 19L in 48 hours. Slight bilateral serous nasal discharge. Eating less than normal. Rumen sounds decreased on auscultation.',
   39.8, 72, 28, ARRAY['reduced_appetite','nasal_discharge','decreased_milk','lethargy'], false, NULL),

  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', 'lameness', 'medium', 'Thunder â€” Intermittent Left Foreleg Lameness',
   'Thunder shows grade 2/5 lameness on left foreleg after turnout exercise. Improves with rest. No heat or swelling palpated in fetlock or knee.',
   37.8, 36, 14, ARRAY['lameness','stiffness'], false, NULL),

  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'general', 'low', 'Bella â€” Routine Observation',
   'Bella appears healthy during morning feeding. Good appetite, active, producing 4.2L milk today. Body condition score 3.0/5.',
   38.9, 80, 22, NULL, true, NOW() - INTERVAL '3 days');

-- ============================================================
-- STEP 19: BREEDING RECORDS
-- ============================================================
INSERT INTO breeding_records (id, enterprise_id, dam_id, sire_id, breeding_method, breeding_date, expected_due_date, status, technician_id, pregnancy_confirmed, pregnancy_check_date, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000009', NULL, 'artificial_insemination', '2025-11-10', '2026-08-20', 'confirmed_pregnant',
   'b0000000-0000-0000-0000-000000000001', true, '2025-12-15', 'AI with sexed semen from XYZ bull. Pregnancy confirmed by rectal palpation at 35 days. Due August 2026.'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000012', NULL, 'natural', '2025-12-01', '2026-04-30', 'confirmed_pregnant',
   NULL, true, '2026-01-05', 'Natural mating with resident Saanen buck. Confirmed pregnant by ultrasound. Expected kidding late April.');

-- ============================================================
-- STEP 20: FEED INVENTORY
-- ============================================================
INSERT INTO feed_inventory (id, enterprise_id, feed_name, feed_type, unit, current_stock, minimum_stock, cost_per_unit, supplier, batch_number, expiry_date, storage_location, is_active) VALUES
  ('1f000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Dairy Pellet 18% CP',   'grain',   'kg', 2400, 500,  0.42, 'Midwest Feed Co.',    'DP-2026-0218', '2026-08-15', 'Feed Storage Bin A', true),
  ('1f000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Alfalfa Hay (Premium)', 'forage',  'kg', 8500, 2000, 0.28, 'Green Valley Hay',    'AH-2026-0112', '2026-12-01', 'Hay Barn',           true),
  ('1f000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Mineral Lick Block',    'supplement','pcs', 24,   5,  12.50, 'AgriSupply',          'ML-2025-1101', '2027-01-01', 'Feed Storage Bin B', true),
  ('1f000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'Layer Mash 16% CP',     'grain',   'kg', 800,  200,  0.38, 'Southern Feeds',      'LM-2026-0201', '2026-07-01', 'Hen House Storage',  true),
  ('1f000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'Goat Dairy Ration',     'grain',   'kg', 350,  100,  0.55, 'Southern Feeds',      'GD-2026-0201', '2026-06-15', 'Goat Feed Shed',     true)
ON CONFLICT (id) DO NOTHING;

-- Feed consumption logs
INSERT INTO feed_consumption_logs (id, enterprise_id, feed_id, group_id, quantity, unit, consumption_date, recorded_by, cost, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 210, 'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 88.20, 'Morning + evening feeding for Holstein herd'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001', 380, 'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 106.40, 'Alfalfa hay â€” ad libitum access'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-000000000004', 18,  'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000002', 6.84,  'Layer mash for 150 hens'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-000000000005', 8,   'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000002', 4.40,  'Dairy ration for 12 Saanen does');

-- ============================================================
-- STEP 21: COMPLIANCE DOCUMENTS
-- ============================================================
INSERT INTO compliance_documents (id, enterprise_id, document_type, title, description, reference_number, issued_date, expiry_date, issuing_authority, status, verified_by, verified_at, is_active) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'license',        'USDA Organic Certification',              'Annual organic dairy certification for milk and cheese products.',                     'ORG-IA-2026-0482', '2025-09-01', '2026-09-01', 'USDA National Organic Program', 'active', 'a0000000-0000-0000-0000-000000000001', '2025-09-05', true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'permit',         'Grade A Milk Permit',                     'State permit for Grade A pasteurized milk production and sales.',                      'MILK-IA-2026-1123', '2025-07-01', '2026-07-01', 'Iowa Department of Agriculture', 'active', NULL, NULL, true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'test_report',    'Annual TB Test â€” Herd',                   'Tuberculosis testing for entire dairy herd. All negative.',                            'TB-IA-2025-8841',   '2025-12-01', '2026-12-01', 'Iowa State Veterinarian',       'active', 'b0000000-0000-0000-0000-000000000001', '2025-12-05', true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'certification',  'Humane Farm Animal Care Certified',       'Certified Humane designation for dairy cattle housing and handling.',                   'HFC-2024-DA-3319',  '2024-06-01', '2026-06-01', 'HFAC',                          'active', NULL, NULL, true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'license',        'NCDA Egg Handler License',                'State license for commercial egg handling and sale.',                                  'EGG-NC-2026-0119',  '2025-08-15', '2026-08-15', 'NC Dept of Agriculture',       'active', NULL, NULL, true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'permit',         'Goat Dairy Operating Permit',             'County permit for goat milk collection and farmstead cheese production.',              'GD-NC-2025-0844',   '2025-05-01', '2026-05-01', 'Buncombe County Health Dept',  'pending_renewal', NULL, NULL, true);

-- ============================================================
-- STEP 22: FINANCIAL RECORDS
-- ============================================================
INSERT INTO financial_records (id, enterprise_id, record_type, category, description, amount, currency, transaction_date, recorded_by, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'income',  'milk_sales',     'Weekly milk sales to Midwest Dairy Co-op',     4250.00, 'USD', '2026-02-17', 'f0000000-0000-0000-0000-000000000001', '8,500L whole milk @ $0.50/L'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'income',  'cheese_sales',   'Artisan cheddar â€” farmers market + online',    1850.00, 'USD', '2026-02-15', 'f0000000-0000-0000-0000-000000000001', '74 blocks @ $25 each'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'feed',           'Dairy pellets â€” monthly purchase',             2520.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000001', '6000kg @ $0.42/kg from Midwest Feed'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'veterinary',     'Vet consultation â€” Daisy emergency',             85.00, 'USD', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 'Dr. Carter emergency visit'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'labor',          'Part-time worker wages â€” February',            1600.00, 'USD', '2026-02-15', 'f0000000-0000-0000-0000-000000000001', 'Maria Garcia â€” 80 hrs @ $20/hr'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'income',  'egg_sales',      'Weekly egg sales â€” Asheville farmers market',    720.00, 'USD', '2026-02-16', 'f0000000-0000-0000-0000-000000000002', '240 dozen @ $3/dozen'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'income',  'goat_milk_sales','Goat milk delivery â€” Sunshine Market',           480.00, 'USD', '2026-02-17', 'f0000000-0000-0000-0000-000000000002', '60 gallons @ $8/gallon'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'expense', 'feed',           'Layer mash + goat ration â€” February',           560.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000002', 'Southern Feeds monthly order');

-- ============================================================
-- STEP 23: ALERT RULES & EVENTS
-- ============================================================
INSERT INTO alert_rules (id, enterprise_id, name, alert_type, conditions, severity, is_enabled, created_by) VALUES
  ('1a000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Low Feed Stock Alert',        'low_feed_stock',   '{"threshold_pct": 20}',  'warning',  true, 'f0000000-0000-0000-0000-000000000001'),
  ('1a000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Vaccination Overdue Alert',   'vaccination_due',  '{"days_overdue": 14}',   'critical', true, 'f0000000-0000-0000-0000-000000000001'),
  ('1a000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Document Expiry Warning',     'document_expiry',  '{"days_before": 30}',    'warning',  true, 'f0000000-0000-0000-0000-000000000001'),
  ('1a000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'Health Observation Critical', 'health_threshold', '{"severity": "high"}',   'critical', true, 'f0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO alert_events (id, enterprise_id, rule_id, alert_type, severity, title, message, is_read, is_acknowledged) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'vaccination_due', 'critical', 'Vaccination Overdue: Clostridial 7-way Booster',
   'Daisy (Holstein #ANI-COW-001) is due for Clostridial 7-way booster. Original due date: April 1, 2026. Schedule vaccination immediately.', false, false),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'document_expiry', 'warning', 'Document Expiring: Humane Farm Animal Care Certificate',
   'The HFAC Certified Humane designation expires on June 1, 2026. Begin renewal process within 30 days.', false, false),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000003', 'document_expiry', 'warning', 'Document Expiring: Goat Dairy Permit',
   'The Goat Dairy Operating Permit (Buncombe County) expires May 1, 2026. Renewal application pending.', true, true);

-- ============================================================
-- STEP 24: IOT SENSORS
-- ============================================================
INSERT INTO iot_sensors (id, enterprise_id, location_id, sensor_type, sensor_name, serial_number, manufacturer, unit, min_threshold, max_threshold, reading_interval_seconds, status, battery_level, last_reading_at, firmware_version, metadata) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'temperature', 'Barn Temp Sensor A',       'SN-TMP-001', 'FarmTech', 'Â°C', 5, 30,   300, 'active', 87.5, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"main_floor"}'),
  ('a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'humidity',    'Barn Humidity Sensor',     'SN-HUM-001', 'FarmTech', '%',  40, 85,  300, 'active', 92.0, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"main_floor"}'),
  ('a5000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'flow_rate',   'Milking Parlor Flow Meter','SN-FLW-001', 'DairyTech','L/min', 0, 15, 60,  'active', 78.0, NOW() - INTERVAL '2 minutes', 'v3.0.1', '{}'),
  ('a5000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'weight',      'Feed Bin Scale',           'SN-WGT-001', 'AgriScale','kg',   0, 5000,3600,'active', 95.0, NOW() - INTERVAL '1 hour',    'v1.5.0', '{}'),
  ('a5000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'temperature', 'Hen House Temp Sensor',    'SN-TMP-002', 'FarmTech', 'Â°C', 10, 35,  300, 'active', 63.0, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"nesting_area"}')
ON CONFLICT (id) DO NOTHING;;

-- Sensor readings (recent)
INSERT INTO sensor_readings (id, sensor_id, enterprise_id, value, unit, is_anomaly, anomaly_type, recorded_at) VALUES
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 14.2, 'Â°C', false, NULL, NOW() - INTERVAL '5 minutes'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 14.5, 'Â°C', false, NULL, NOW() - INTERVAL '10 minutes'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 68.0, '%',  false, NULL, NOW() - INTERVAL '5 minutes'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 89.5, '%',  true,  'above_threshold', NOW() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 8.7,  'L/min', false, NULL, NOW() - INTERVAL '2 minutes'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 2180, 'kg', false, NULL, NOW() - INTERVAL '1 hour'),
  (gen_random_uuid(), 'a5000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 22.1, 'Â°C', false, NULL, NOW() - INTERVAL '5 minutes');

-- ============================================================
-- STEP 25: DISEASE PREDICTIONS & OUTBREAK ZONES
-- ============================================================
INSERT INTO disease_predictions (id, enterprise_id, animal_id, disease_name, risk_score, confidence, predicted_onset, risk_factors, recommended_actions, status, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'Subclinical Ketosis',
   78.5, 85.0, '2026-02-20', '["Recent calving","High milk yield genetics","Winter housing","Body condition loss"]',
   '["Propylene glycol drench 300mL daily","Increase energy density in TMR","Monitor BHB weekly","Reduce milking frequency temporarily"]',
   'active', 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', NULL, 'Bovine Respiratory Disease',
   42.0, 65.0, '2026-03-15', '["Season change","High barn humidity (89.5%)","New animal intake in January"]',
   '["Improve barn ventilation","Monitor barn humidity sensor","Vaccinate incoming animals","Reduce stocking density"]',
   'active', 'b0000000-0000-0000-0000-000000000001');

INSERT INTO outbreak_zones (id, enterprise_id, location_id, disease_name, severity, affected_count, total_at_risk, containment_status, containment_actions) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Subclinical Ketosis', 'medium', 1, 42, 'monitoring',
   '["Isolated affected cow to quarantine pen","Blood testing all fresh cows","Adjusted herd nutrition plan"]');

-- ============================================================
-- STEP 26: GENETIC PROFILES & LINEAGE PAIRS
-- ============================================================
INSERT INTO genetic_profiles (id, animal_id, enterprise_id, sire_id, dam_id, generation, inbreeding_coefficient, genetic_traits, dna_test_date, dna_lab, breed_purity_pct, notes) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', NULL, NULL, 3, 0.0312,
   '{"milk_yield":"high","butterfat":"average","protein":"above_average","somatic_cell":"low","fertility":"good"}',
   '2025-08-15', 'Neogen Genomics', 98.5, 'Purebred Holstein with excellent genomic milk production traits.'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', NULL, NULL, 2, 0.0156,
   '{"milk_yield":"average","butterfat":"very_high","protein":"high","somatic_cell":"low","fertility":"excellent"}',
   '2025-08-15', 'Neogen Genomics', 99.2, 'Purebred Jersey â€” exceptional butterfat genetics. Ideal for cheese production.');

INSERT INTO lineage_pairs (id, enterprise_id, sire_id, dam_id, compatibility_score, predicted_inbreeding, predicted_traits, recommendation, reason) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000009',
   42.0, 0.0025, '{"expected_type":"crossbred calf","vigor":"high"}', 'not_recommended', 'Cross-species pairing (horse x cattle) is not genetically viable. System flagged for review.');

-- ============================================================
-- STEP 27: SUPPLY CHAIN â€” PRODUCT BATCHES, TRACEABILITY, QR CODES
-- ============================================================
INSERT INTO product_batches (id, enterprise_id, batch_number, product_type, description, quantity, unit, source_group_id, production_date, expiry_date, quality_grade, certifications, current_holder, status) VALUES
  ('a6000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'MILK-20260218-001', 'raw_milk',
   'Morning milking batch â€” Grade A raw milk from Holstein herd', 850, 'liters',
   'ab000000-0000-0000-0000-000000000001', '2026-02-18', '2026-02-22', 'A',
   '["USDA Organic","Grade A","Certified Humane"]', 'Green Pastures Processing', 'in_transit'),
  ('a6000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'CHDR-20260215-001', 'cheese',
   'Aged cheddar batch â€” 6-month aged organic cheddar', 74, 'blocks',
   'ab000000-0000-0000-0000-000000000001', '2025-08-15', '2026-08-15', 'Premium',
   '["USDA Organic","Certified Humane"]', 'Asheville Farmers Market', 'delivered'),
  ('a6000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'EGG-20260218-001', 'eggs',
   'Free-range eggs â€” daily collection from RIR flock', 240, 'dozen',
   'ab000000-0000-0000-0000-000000000004', '2026-02-18', '2026-03-18', 'AA',
   '["Free Range","NCDA Certified"]', 'Sunrise Farm Cold Storage', 'quality_check')
ON CONFLICT (id) DO NOTHING;

INSERT INTO traceability_events (id, enterprise_id, batch_id, event_type, title, description, location, recorded_by, event_date) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'collection',   'Morning Milking Complete',  'Collected 850L from 42 Holstein cows. Temperature at collection: 38Â°C.', 'Milking Parlor', 'f0000000-0000-0000-0000-000000000001', '2026-02-18 06:30:00'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'quality_check','Bacteria & SCC Test',       'Standard plate count: 8,000 CFU/mL (pass). SCC: 180,000 cells/mL (pass).','On-farm Lab',  'f0000000-0000-0000-0000-000000000001', '2026-02-18 07:00:00'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'shipping',     'Tank Truck Pickup',         'Midwest Dairy Co-op tank truck collected batch. Bill of Lading #BOL-4482.','Farm Gate',    'f0000000-0000-0000-0000-000000000001', '2026-02-18 08:15:00');

INSERT INTO qr_codes (id, enterprise_id, entity_type, entity_id, code_data, short_url, scan_count, is_active) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'product_batch', 'a6000000-0000-0000-0000-000000000001',
   '{"batch":"MILK-20260218-001","farm":"Green Pastures","organic":true,"grade":"A"}', 'https://vc.link/m/001', 12, true),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'product_batch', 'a6000000-0000-0000-0000-000000000002',
   '{"batch":"CHDR-20260215-001","product":"Aged Cheddar","aged_months":6}', 'https://vc.link/c/001', 34, true);

-- ============================================================
-- STEP 28: WORKFORCE (TASKS & SHIFTS)
-- ============================================================
INSERT INTO workforce_tasks (id, enterprise_id, title, description, task_type, priority, status, assigned_to, created_by, location_id, checklist, due_date, estimated_hours, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Morning Milking â€” Holstein Herd',    'Milk all 42 Holstein cows in the rotary parlor. Record individual yields.', 'milking',     'high',    'completed', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '[{"label":"Sanitize parlor equipment","done":true},{"label":"Attach milking clusters","done":true},{"label":"Record individual yields","done":true},{"label":"Clean and flush lines","done":true}]', '2026-02-18 07:00:00', 3.0, 'Completed at 6:45 AM'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Repair Fence â€” North Pasture',       'Fix broken fence post in NE corner of North Pasture. Cattle have been pushing against it.', 'maintenance', 'medium',  'in_progress', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '[{"label":"Source replacement post","done":true},{"label":"Remove broken post","done":true},{"label":"Set new post in concrete","done":false},{"label":"Restring wire","done":false}]', '2026-02-20 17:00:00', 4.0, 'Maria started â€” needs concrete to set'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Monthly Feed Inventory Audit',        'Count all feed bins and reconcile with system records.', 'inventory',   'low',     'pending',  'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', '[{"label":"Count Bin A (Dairy Pellet)","done":false},{"label":"Count Hay Barn","done":false},{"label":"Count Mineral Blocks","done":false},{"label":"Update system records","done":false}]', '2026-02-28 17:00:00', 2.0, NULL),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'Egg Collection & Grading',            'Collect eggs from all nesting boxes and grade by size/quality.', 'collection',  'high',    'completed', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '[{"label":"Collect from all boxes","done":true},{"label":"Candle check","done":true},{"label":"Grade and pack","done":true},{"label":"Move to cold storage","done":true}]', '2026-02-18 10:00:00', 2.0, '240 dozen collected today');

INSERT INTO shift_schedules (id, enterprise_id, user_id, shift_date, start_time, end_time, role_on_shift, location_id, status, check_in_at, check_out_at) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-02-18', '05:00', '14:00', 'Farm Manager',    '10000000-0000-0000-0000-000000000001', 'completed', '2026-02-18 04:55:00', '2026-02-18 14:10:00'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '2026-02-18', '08:00', '16:00', 'General Worker',  '10000000-0000-0000-0000-000000000002', 'completed', '2026-02-18 07:58:00', '2026-02-18 16:05:00'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-02-19', '05:00', '14:00', 'Farm Manager',    '10000000-0000-0000-0000-000000000001', 'scheduled', NULL, NULL),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '2026-02-18', '06:00', '12:00', 'Poultry Manager', '10000000-0000-0000-0000-000000000007', 'completed', '2026-02-18 05:55:00', '2026-02-18 12:15:00');

-- ============================================================
-- STEP 29: REPORT TEMPLATES & GENERATED REPORTS
-- ============================================================
INSERT INTO report_templates (id, enterprise_id, name, description, report_type, config, columns, filters, grouping, is_system, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Monthly Herd Health Summary',   'Overview of all health observations, treatments, and lab results for the month.', 'health',    '{"period":"monthly"}', '["animal_name","observation_type","severity","is_resolved","date"]', '{"severity":["high","critical"]}', '["observation_type"]', false, 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Financial P&L Report',          'Monthly profit and loss breakdown by category.',                                  'financial', '{"period":"monthly"}', '["category","income","expenses","net"]', '{}', '["category"]', false, 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), NULL,                                    'Animal Census by Species',      'System-wide report of animals grouped by species and breed.',                     'inventory', '{}', '["species","breed","count","avg_weight"]', '{}', '["species"]', true, NULL);

INSERT INTO generated_reports (id, enterprise_id, name, report_type, format, parameters, result_data, row_count, status, generated_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Herd Health â€” February 2026', 'health', 'json', '{"month":"2026-02","enterprise_id":"e0000000-0000-0000-0000-000000000001"}',
   '{"rows":[{"animal":"Daisy","type":"illness","severity":"high","resolved":false},{"animal":"Thunder","type":"lameness","severity":"medium","resolved":false}],"summary":{"total":2,"critical":0,"high":1,"medium":1}}',
   2, 'completed', 'f0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 30: DIGITAL TWINS & SIMULATIONS
-- ============================================================
INSERT INTO digital_twins (id, enterprise_id, name, twin_type, description, model_data, current_state, created_by) VALUES
  ('a7000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Green Pastures Farm Twin', 'farm',
   'Digital replica of the entire dairy farm â€” barns, pastures, herd, equipment, and supply chain.',
   '{"total_animals":59,"locations":6,"sensors":4,"active_campaigns":0}',
   '{"herd_health":"at_risk","milk_production_L":18200,"feed_stock_days":18,"revenue_mtd":6100,"active_alerts":2}',
   'f0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO simulation_runs (id, twin_id, enterprise_id, name, scenario_type, parameters, input_state, result_data, status, duration_ms, created_by) VALUES
  (gen_random_uuid(), 'a7000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   'What-If: Improve Barn Ventilation', 'resource_optimization',
   '{"action":"install_ventilation_fans","cost":4500,"expected_humidity_reduction":15}',
   '{"current_humidity":89.5,"current_brd_risk":42}',
   '{"rows":[{"metric":"humidity","before":89.5,"after":74.5},{"metric":"brd_risk","before":42,"after":18},{"metric":"milk_production_change","before":0,"after":5}],"summary":{"roi_months":8,"projected_savings_annual":6200},"totalRows":3}',
   'completed', 245, 'f0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 31: AI CHAT SESSIONS & MESSAGES
-- ============================================================
INSERT INTO ai_chat_sessions (id, enterprise_id, user_id, animal_id, title, context_type, status, message_count, last_message_at) VALUES
  ('a8000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007',
   'Help with Daisy''s Milk Drop', 'animal', 'active', 4, NOW() - INTERVAL '2 hours'),
  ('a8000000-0000-0000-0000-000000000002', NULL, 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001',
   'Buddy Hip Dysplasia Questions', 'animal', 'active', 2, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_chat_messages (id, session_id, role, content, confidence, sources, tokens_used) VALUES
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000001', 'user',      'Daisy''s milk production dropped 30% in 2 days and she has a slight nasal discharge. What could be wrong?', NULL, '[]', 28),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000001', 'assistant', 'Based on the symptoms you''ve described â€” a sudden 30% milk drop with nasal discharge in a Holstein dairy cow â€” the most likely causes include: 1) **Subclinical Ketosis** (especially if she calved recently â€” elevated BHB levels confirm this), 2) **Early Bovine Respiratory Disease** (barn humidity is 89.5% which increases BRD risk), or 3) **Transition cow syndrome**. Your vet has already collected a BHB test â€” if it comes back >1.4 mmol/L, ketosis is confirmed. Recommended: propylene glycol drench 300mL daily, increase energy density in her TMR, and investigate improving barn ventilation.', 88.5, '["Merck Vet Manual - Ketosis","USDA BRD Guidelines","Farm Sensor Data"]', 142),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000001', 'user',      'The BHB came back at 1.8 mmol/L. What should I do next?', NULL, '[]', 18),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000001', 'assistant', 'A BHB of 1.8 mmol/L confirms **subclinical ketosis**. Here''s your action plan: 1) **Immediate**: Continue propylene glycol 300mL orally once daily for 5 days. 2) **Nutrition**: Increase concentrate ratio in TMR by 10-15%, ensure she has access to fresh water at all times. 3) **Monitoring**: Retest BHB in 5-7 days â€” target is below 1.0 mmol/L. 4) **Milking**: Consider reducing to 2x daily milking temporarily to decrease energy demand. 5) **Herd prevention**: Test all cows within 30 days of calving. Your vet Dr. Carter can prescribe additional treatment if BHB doesn''t improve.', 92.0, '["AABP Ketosis Treatment Protocol","Herd-level Ketosis Prevention"]', 168),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000002', 'user',      'My Golden Retriever Buddy was diagnosed with Grade II hip dysplasia. Is swimming good for him?', NULL, '[]', 22),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000002', 'assistant', 'Yes! Swimming is one of the **best exercises** for dogs with hip dysplasia. It provides: 1) **Low-impact cardio** â€” no stress on joints while building muscle. 2) **Muscle strengthening** â€” particularly the gluteal and thigh muscles that support the hip joint. 3) **Weight management** â€” keeps Buddy''s weight in the target 30-32kg range. Start with 10-15 minute sessions 2-3 times per week. Avoid cold water which can stiffen joints. Your vet Dr. Carter also prescribed Carprofen and Dasuquin which complement the exercise program.', 95.0, '["ACVS Hip Dysplasia Guidelines","Canine Rehabilitation Literature"]', 128);

-- ============================================================
-- STEP 32: MARKETPLACE
-- ============================================================
INSERT INTO marketplace_listings (id, enterprise_id, seller_id, title, description, category, listing_type, price, currency, quantity, unit, condition, images, location, tags, status, featured, views_count) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'Organic Aged Cheddar â€” 6 Month (Bulk)',
   'Premium organic aged cheddar made from 100% grass-fed Holstein milk. USDA Organic & Certified Humane. Available in 5 lb blocks. Perfect for specialty retailers and restaurants.',
   'other', 'fixed_price', 45.00, 'USD', 30, 'blocks', 'new', '[]', 'Cedar Falls, Iowa', '["organic","cheese","dairy","bulk"]', 'active', true, 87),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002',
   'Free-Range RIR Laying Hens â€” 8 months old',
   'Healthy Rhode Island Red laying hens, 8 months old, producing ~5 eggs/week each. Raised free-range on organic feed. Great for backyard flocks or small farm startups.',
   'animal', 'fixed_price', 25.00, 'USD', 20, 'hens', 'new', '[]', 'Asheville, NC', '["poultry","layer","free-range","backyard"]', 'active', false, 42),
  (gen_random_uuid(), NULL, 'b0000000-0000-0000-0000-000000000001',
   'Digital Livestock Weight Scale â€” Used',
   'AgriScale SB-500 digital livestock platform scale. Capacity 2000kg. Used for 2 years, recently calibrated. Includes Bluetooth module for data logging.',
   'equipment', 'auction', 800.00, 'USD', 1, 'unit', 'used', '[]', 'Austin, TX', '["scale","equipment","livestock","bluetooth"]', 'active', false, 23);

-- ============================================================
-- STEP 33: SUSTAINABILITY METRICS & GOALS
-- ============================================================
INSERT INTO sustainability_metrics (id, enterprise_id, metric_type, metric_name, value, unit, period_start, period_end, category, scope, data_source, recorded_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'ghg_emissions', 'Enteric Methane â€” Cattle',              4200, 'kgCO2e', '2026-01-01', '2026-01-31', 'emissions',     'scope_1', 'IPCC Tier 1 Calculation', 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'water_usage',   'Total Farm Water Consumption',          85000,'liters', '2026-01-01', '2026-01-31', 'water',         'scope_1', 'Water meter readings',    'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'energy',        'Electricity â€” Milking + Cooling',       3200, 'kWh',    '2026-01-01', '2026-01-31', 'energy',        'scope_2', 'Utility bill',            'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'waste',         'Manure Composted',                      18000,'kg',     '2026-01-01', '2026-01-31', 'waste_management','scope_1','Farm records',           'f0000000-0000-0000-0000-000000000001');

INSERT INTO sustainability_goals (id, enterprise_id, goal_name, description, metric_type, target_value, current_value, unit, baseline_value, baseline_date, target_date, status, progress_pct, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Reduce Methane by 20% by 2027',  'Implement methane-reducing feed additives (3-NOP) and improved manure management.',
   'ghg_emissions', 3360, 4200, 'kgCO2e/month', 4200, '2026-01-01', '2027-12-31', 'active', 0, 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Solar Power for Milking Parlor', 'Install 50kW solar array to offset electricity for milking, cooling, and lighting.',
   'energy', 0, 3200, 'kWh/month', 3200, '2026-01-01', '2026-12-31', 'active', 15, 'f0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 34: WELLNESS SCORECARDS & REMINDERS
-- ============================================================
INSERT INTO wellness_scorecards (id, animal_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by, assessed_at) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 82, 75, 70, 95, 85, 'overweight',  '2026-04-15',
   '["Reduce daily calories by 10%","Increase exercise to 45 min/day","Schedule hip dysplasia follow-up","Continue joint supplements"]',
   '["Hip dysplasia - monitor progression","Slightly overweight - target 30-32kg"]',
   'b0000000-0000-0000-0000-000000000001', '2026-01-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 74, 65, 80, 90, 90, 'normal', '2026-03-22',
   '["Continue hypoallergenic diet","Monitor skin condition weekly","Apply medicated shampoo as directed","Consider air purifier for dust mite control"]',
   '["Active atopic dermatitis","Grain allergy - strict avoidance"]',
   'b0000000-0000-0000-0000-000000000002', '2026-01-22'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 68, 80, 55, 85, 70, 'normal', '2026-05-01',
   '["Continue multimodal arthritis management","Hydrotherapy 2x/week recommended","Soft orthopedic bed","Dental cleaning due"]',
   '["Moderate osteoarthritis","DHPP vaccine overdue - schedule ASAP","Dental tartar buildup"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01');

INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, status, priority, recurrence) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'vaccination',  'DHPP Booster Due â€” Buddy',     'Annual DHPP vaccination is due. Schedule with Dr. Carter.', '2026-03-15', 'pending', 'high', 'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'checkup',      'Hip Dysplasia Follow-Up',       'Follow-up radiographs and joint assessment with Dr. Carter.', '2026-04-15', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'medication',   'Apoquel Refill Reminder',       'Refill Apoquel 16mg prescription. Contact Dr. Bennett.', '2026-03-01', 'pending', 'high', 'monthly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'checkup',      'Dermatology Follow-Up',         'Skin recheck with Dr. Bennett to evaluate treatment progress.', '2026-03-22', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'dental',       'Dental Cleaning â€” Max',         'Dental tartar buildup noted. Schedule professional cleaning.', '2026-03-01', 'pending', 'medium', 'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'vaccination',  'DHPP Booster Overdue â€” Max',    'DHPP vaccine was due June 2025. Schedule immediately.',  '2025-06-10', 'pending', 'urgent', 'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'checkup',      'Avian Wellness Recheck â€” Kiwi', 'Follow-up on feather plucking behavior with Dr. Reyes.', '2026-05-05', 'pending', 'low', NULL);

-- ============================================================
-- STEP 35: GEOFENCE ZONES & EVENTS
-- ============================================================
INSERT INTO geofence_zones (id, enterprise_id, name, zone_type, center_lat, center_lng, radius_meters, polygon_coords, color, alert_on_entry, alert_on_exit, is_restricted, status, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Farm Boundary',        'boundary',    42.5277, -92.4453, 1200, '[]', '#22c55e', false, true,  false, 'active', 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'Quarantine Zone',      'quarantine',  42.5280, -92.4460,  50,  '[]', '#ef4444', true,  true,  true,  'active', 'f0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'North Pasture Grazing','pasture',     42.5290, -92.4440, 400,  '[]', '#3b82f6', false, false, false, 'active', 'f0000000-0000-0000-0000-000000000001');

INSERT INTO geospatial_events (id, enterprise_id, animal_id, event_type, latitude, longitude, speed_kmh, metadata) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'location_update', 42.5278, -92.4455, 0, '{"source":"ear_tag_gps","battery":72}'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'location_update', 42.5291, -92.4442, 5.2, '{"source":"collar_gps","battery":85}'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'zone_exit',       42.5295, -92.4448, 8.1, '{"zone":"North Pasture Grazing","alert":"exited grazing zone at 4:15 PM"}');


-- ============================================================
-- STEP 36: ADDITIONAL USERS (4 new â€” 2 pet owners, 1 vet, 1 farmer)
-- ============================================================
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id) VALUES
  -- Pet Owners (password: Owner@123)
  ('c0000000-0000-0000-0000-000000000003', 'sarah.kim@email.com',         'Sarah',   'Kim',      'pet_owner',    '+1-555-300-0003', '$2a$10$OtuDm/nGqi3c8ymKklb1h.0XXbr.MN.TSVXTTb.JTYZjuku6Oqv2W', true, 'USR-PET-003'),
  ('c0000000-0000-0000-0000-000000000004', 'michael.torres@email.com',    'Michael', 'Torres',   'pet_owner',    '+1-555-300-0004', '$2a$10$OtuDm/nGqi3c8ymKklb1h.0XXbr.MN.TSVXTTb.JTYZjuku6Oqv2W', true, 'USR-PET-004'),
  -- Veterinarian (password: Doctor@123)
  ('b0000000-0000-0000-0000-000000000004', 'dr.priya.sharma@vetcare.com', 'Priya',   'Sharma',   'veterinarian', '+1-555-200-0004', '$2a$10$gSdD95PyV8lmsQnsYQyL2ea0.pRa05fUxhFNv5w/aBNr6Tv.BsD/K', true, 'USR-VET-004'),
  -- Farmer (password: Farmer@123)
  ('f0000000-0000-0000-0000-000000000003', 'thomas.green@greenmeadows.com','Thomas',  'Green',    'farmer',       '+1-555-400-0003', '$2a$10$9lvpT/PhXramRLyjABSXfO7ks10U4KvWGlfYS6XZYeUNpTjuM.rtm', true, 'USR-FRM-003')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role, phone = EXCLUDED.phone, is_active = EXCLUDED.is_active;

-- ============================================================
-- STEP 37: ADDITIONAL VET PROFILE
-- ============================================================
INSERT INTO vet_profiles (id, user_id, license_number, specializations, qualifications, years_of_experience, bio, clinic_name, clinic_address, consultation_fee, currency, is_verified, is_available, accepts_emergency, languages, rating, total_reviews, total_consultations) VALUES
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'VET-2024-40718',
   ARRAY['Exotic Animals','Reptile Medicine','Small Mammal Medicine','Avian Medicine'], ARRAY['BVSc - Tamil Nadu Veterinary University','MVSc Exotic Animal Medicine','DACZM'],
   12, 'Dr. Sharma is an exotic animal specialist with expertise in reptiles, small mammals, birds, and aquatic species. She has worked with over 30 species and consults for wildlife rehabilitation centers across the US.',
   'Sharma Exotic Pet Clinic', '420 Palm Ave, San Diego, CA 92101',
   110.00, 'USD', true, true, true, ARRAY['English','Hindi','Tamil'], 4.88, 9, 31)
ON CONFLICT (id) DO NOTHING;

-- Additional vet schedule for Dr. Sharma
INSERT INTO vet_schedules (id, veterinarian_id, day_of_week, start_time, end_time, slot_duration, max_appointments, is_active) VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'monday',    '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'tuesday',   '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'wednesday', '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'thursday',  '09:00','18:00', 45, 12, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'friday',    '09:00','15:00', 45,  8, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 38: ADDITIONAL ENTERPRISE (Sheep & Pig Farm)
-- ============================================================
INSERT INTO enterprises (id, name, enterprise_type, description, address, city, state, country, postal_code, gps_latitude, gps_longitude, total_area, area_unit, license_number, regulatory_id, tax_id, phone, email, website, owner_id, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'Green Meadows Farm', 'mixed_livestock',
   'Family-owned sheep and pig farm in Vermont specializing in heritage breeds. Produces premium wool, lamb, and artisan pork products. Certified humane and pasture-raised.',
   '1455 Mountain View Rd', 'Stowe', 'Vermont', 'US', '05672',
   44.4654, -72.6874, 280.00, 'acres', 'VT-LIV-2025-0331', 'USDA-VT-2025-0871', '83-7614552',
   '+1-802-555-0103', 'info@greenmeadowsvt.com', 'https://greenmeadowsvt.com',
   'f0000000-0000-0000-0000-000000000003', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  owner_id = EXCLUDED.owner_id,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  city = EXCLUDED.city,
  state = EXCLUDED.state;

INSERT INTO enterprise_members (enterprise_id, user_id, role, title, permissions, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'owner', 'Farm Owner', '["all"]', true),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'farm_vet', 'Consulting Veterinarian', '["health","breeding","treatment"]', true)
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, enterprise_id, name, location_type, capacity, current_occupancy, area, area_unit, gps_latitude, gps_longitude, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000003', 'Main Sheep Barn', 'barn', 80, 45, 4200, 'sqft', 44.4660, -72.6880, 'Climate-controlled barn for ewes and lambs', true),
  ('10000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000003', 'Pig House',       'pen',  30, 18, 2800, 'sqft', 44.4655, -72.6870, 'Heritage breed pig housing with outdoor access', true),
  ('10000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000003', 'Lambing Shed',    'barn', 20,  3, 1200, 'sqft', 44.4662, -72.6878, 'Dedicated lambing area with heat lamps', true),
  ('10000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000003', 'North Hill Pasture','pasture',60,40,120000,'sqft',44.4675, -72.6860, 'Rolling pasture for sheep grazing â€” rotational grazing system', true),
  ('10000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000003', 'Working Dog Kennel','kennel', 4, 1, 400, 'sqft', 44.4652, -72.6882, 'Heated kennel for Border Collie working dogs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO animal_groups (id, enterprise_id, name, group_type, species, breed, purpose, target_count, current_count, color_code, description, is_active) VALUES
  ('ab000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000003', 'Merino Ewe Flock', 'breeding_flock', 'Sheep', 'Merino', 'Wool production and breeding', 50, 42, '#a78bfa', 'Fine wool Merino breeding ewes â€” primary wool flock', true),
  ('ab000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000003', 'Heritage Pig Herd', 'production', 'Pig', 'Mixed Heritage', 'Artisan pork and breeding', 20, 18, '#f97316', 'Yorkshire and Berkshire pigs for heritage pork production', true),
  ('ab000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'Alpine Dairy Goats', 'dairy', 'Goat', 'Alpine', 'Goat milk production', 8, 6, '#22d3ee', 'Alpine dairy does for milk and cheese', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 39: ADDITIONAL ANIMALS (23 new â€” diverse species and breeds)
-- ============================================================
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, ear_tag_id, registration_number, is_neutered, insurance_provider, insurance_policy_number, insurance_expiry, medical_notes, is_active, unique_id, enterprise_id, group_id, breeding_status, last_breeding_date, expected_due_date, current_weight, weight_unit, last_weighed_at, current_location_id) VALUES
  -- Sarah Kim's pets (exotic pet enthusiast)
  ('aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'Charlie',   'Dog',     'Labrador Retriever', '2022-06-10', 'Male',   28.5, 'Chocolate',       '985121067890001', NULL, 'AKC-LR-2022-7821',  true,  'Nationwide',  'NW-2025-3341',  '2027-06-01', 'Up to date on all vaccines. Energetic and food-motivated.',                                true, 'ANI-DOG-013', NULL, NULL, NULL, NULL, NULL, 28.5, 'kg', '2026-02-01', NULL),
  ('aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 'Princess',  'Cat',     'Persian',            '2021-11-20', 'Female', 4.1,  'White',           '985121067890002', NULL, 'CFA-PS-2021-5519',  true,  'ASPCA',       'ASP-2025-8872', '2027-03-15', 'Long coat requires daily grooming. Prone to tear staining.',                               true, 'ANI-CAT-014', NULL, NULL, NULL, NULL, NULL, 4.1,  'kg', '2026-01-20', NULL),
  ('aa000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000003', 'Snowball',  'Rabbit',  'Holland Lop',        '2024-02-14', 'Female', 1.8,  'White/Brown',     NULL,              NULL, NULL,                 true,  NULL,          NULL,            NULL,         'Indoor rabbit. Hay-based diet. Dental check due.',                                          true, 'ANI-RBT-015', NULL, NULL, NULL, NULL, NULL, 1.8,  'kg', '2026-01-15', NULL),
  ('aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', 'Monty',     'Reptile', 'Ball Python',        '2023-05-01', 'Male',   1.2,  'Normal morph',    NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Feeding on frozen-thawed rats every 10-14 days. Humidity 55-65%.',                          true, 'ANI-RPT-016', NULL, NULL, NULL, NULL, NULL, 1.2,  'kg', '2026-01-10', NULL),
  ('aa000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000003', 'Rex',       'Reptile', 'Bearded Dragon',     '2023-09-15', 'Male',   0.45, 'Citrus/Orange',   NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'UVB light 12hrs/day. Eats live crickets, greens, and calcium dusted insects.',               true, 'ANI-RPT-017', NULL, NULL, NULL, NULL, NULL, 0.45, 'kg', '2026-02-05', NULL),
  ('aa000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000003', 'Sunny',     'Bird',    'Cockatiel',          '2024-01-10', 'Female', 0.09, 'Lutino Yellow',   NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Hand-raised. Whistles tunes. Eats pellets + fresh fruit/veggies.',                          true, 'ANI-BRD-018', NULL, NULL, NULL, NULL, NULL, 0.09, 'kg', '2026-01-28', NULL),

  -- Michael Torres's pets (multi-pet household)
  ('aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'Duke',      'Dog',     'Standard Poodle',    '2021-09-22', 'Male',   27.0, 'Black',           '985121078901001', NULL, 'AKC-SP-2021-9312',  true,  'Trupanion',   'TP-2025-1142',  '2027-09-01', 'Hypoallergenic coat. Professional grooming every 6 weeks. Joint supplements started.',     true, 'ANI-DOG-019', NULL, NULL, NULL, NULL, NULL, 27.0, 'kg', '2026-01-28', NULL),
  ('aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'Copper',    'Dog',     'Beagle',             '2023-03-08', 'Male',   11.5, 'Tri-color',       '985121078901002', NULL, 'AKC-BG-2023-2205',  true,  'Trupanion',   'TP-2025-1143',  '2027-09-01', 'Very food-driven. Tends to overeat â€” strict portion control.',                              true, 'ANI-DOG-020', NULL, NULL, NULL, NULL, NULL, 11.5, 'kg', '2026-02-10', NULL),
  ('aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 'Oscar',     'Dog',     'Miniature Dachshund','2022-12-01', 'Male',   5.2,  'Red',             '985121078901003', NULL, 'AKC-DH-2022-6618',  true,  'Trupanion',   'TP-2025-1144',  '2027-09-01', 'IVDD risk â€” no jumping from furniture. Ramp access everywhere.',                            true, 'ANI-DOG-021', NULL, NULL, NULL, NULL, NULL, 5.2,  'kg', '2026-02-01', NULL),
  ('aa000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000004', 'Shadow',    'Cat',     'Bengal',             '2023-07-14', 'Male',   5.8,  'Brown Spotted',   '985121078901004', NULL, 'TICA-BG-2023-8901', false, 'Healthy Paws','HP-2025-5521',  '2027-07-01', 'Very active breed â€” needs daily play and climbing space. Raw diet supplemented.',           true, 'ANI-CAT-022', NULL, NULL, NULL, NULL, NULL, 5.8,  'kg', '2026-02-08', NULL),
  ('aa000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000004', 'Muffin',    'Cat',     'Ragdoll',            '2022-04-18', 'Female', 4.5,  'Seal Bicolor',    '985121078901005', NULL, 'CFA-RD-2022-3342',  true,  'Healthy Paws','HP-2025-5522',  '2027-07-01', 'Docile indoor cat. Annual blood panel recommended for HCM screening.',                      true, 'ANI-CAT-023', NULL, NULL, NULL, NULL, NULL, 4.5,  'kg', '2026-01-18', NULL),
  ('aa000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000004', 'Patches',   'Guinea Pig','Abyssinian',       '2024-08-20', 'Female', 0.95, 'Brown/White',     NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Vitamin C supplement daily. Needs hay ad libitum. Cage mate needed.',                       true, 'ANI-GP-024',  NULL, NULL, NULL, NULL, NULL, 0.95, 'kg', '2026-02-12', NULL),
  ('aa000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000004', 'Nibbles',   'Hamster', 'Syrian Golden',      '2025-01-15', 'Male',   0.14, 'Golden',          NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Solitary â€” must be housed alone. Runs on wheel 5+ miles/night.',                            true, 'ANI-HAM-025', NULL, NULL, NULL, NULL, NULL, 0.14, 'kg', '2026-02-14', NULL),
  ('aa000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000004', 'Neptune',   'Fish',    'Betta Splendens',    '2025-03-01', 'Male',   0.006,'Blue/Red Crown',  NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         '5-gallon heated tank at 78Â°F. Eats Betta pellets + frozen bloodworms.',                     true, 'ANI-FSH-026', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,         NULL),

  -- Thomas Green's farm animals (sheep, pigs, goat, working dog)
  ('aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'Woolly',    'Sheep',   'Merino',             '2022-03-10', 'Female', 65.0, 'White',           NULL, 'VT-SH-001', 'NSIP-MR-2022-1101', false, NULL, NULL, NULL, 'Lead ewe. Excellent fine wool producer â€” 18 micron fleece.',                                  true, 'ANI-SHP-027', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'bred',   '2025-11-15', '2026-04-15', 65.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),
  ('aa000000-0000-0000-0000-000000000028', 'f0000000-0000-0000-0000-000000000003', 'Baxter',    'Sheep',   'Suffolk',            '2023-01-25', 'Male',   110.0,'Black Face/White',NULL, 'VT-SH-002', 'NSIP-SF-2023-2204', false, NULL, NULL, NULL, 'Primary stud ram. Excellent conformation and growth traits.',                                true, 'ANI-SHP-028', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'active', NULL,         NULL,         110.0,'kg', '2026-02-01', '10000000-0000-0000-0000-000000000013'),
  ('aa000000-0000-0000-0000-000000000029', 'f0000000-0000-0000-0000-000000000003', 'Dotty',     'Sheep',   'Dorper',             '2023-06-05', 'Female', 72.0, 'White/Black Head',NULL, 'VT-SH-003', 'NSIP-DP-2023-3305', false, NULL, NULL, NULL, 'Hair sheep â€” no shearing needed. Good meat production genetics.',                           true, 'ANI-SHP-029', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'open',   NULL,         NULL,         72.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),
  ('aa000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000003', 'Wilbur',    'Pig',     'Yorkshire',          '2024-04-12', 'Male',   180.0,'White/Pink',      NULL, 'VT-PG-001', NULL,                 false, NULL, NULL, NULL, 'Terminal sire. Excellent growth rate and loin depth.',                                       true, 'ANI-PIG-030', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000007', 'active', NULL,         NULL,         180.0,'kg', '2026-01-20', '10000000-0000-0000-0000-000000000011'),
  ('aa000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000003', 'Charlotte', 'Pig',     'Berkshire',          '2024-02-28', 'Female', 145.0,'Black/White pts', NULL, 'VT-PG-002', NULL,                 false, NULL, NULL, NULL, 'Heritage breed sow. Marbled meat genetics. First litter expected April.',                    true, 'ANI-PIG-031', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000007', 'bred',   '2025-12-10', '2026-04-08', 145.0,'kg', '2026-01-20', '10000000-0000-0000-0000-000000000011'),
  ('aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 'Scout',     'Dog',     'Border Collie',      '2021-08-05', 'Male',   19.5, 'Black/White',     '985121089012001', NULL, 'AKC-BC-2021-4401',  true,  NULL, NULL, NULL, 'Trained working sheepdog. Herds Merino flock. Needs high-energy diet.',                      true, 'ANI-DOG-032', 'e0000000-0000-0000-0000-000000000003', NULL, NULL, NULL, NULL, 19.5, 'kg', '2026-02-10', '10000000-0000-0000-0000-000000000014'),
  ('aa000000-0000-0000-0000-000000000033', 'f0000000-0000-0000-0000-000000000003', 'Heidi',     'Goat',    'Alpine',             '2023-03-18', 'Female', 62.0, 'Chamoisee',       NULL, 'VT-GT-001', 'ADGA-AP-2023-6601', false, NULL, NULL, NULL, 'Alpine dairy doe. Producing 3.8L/day. Clean bill of health.',                               true, 'ANI-GOT-033', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000008', 'open',   NULL,         NULL,         62.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),

  -- Additional farm animals for existing farmer Tom Wilson
  ('aa000000-0000-0000-0000-000000000034', 'f0000000-0000-0000-0000-000000000001', 'Brutus',    'Cattle',  'Angus',              '2022-08-15', 'Male',   680.0,'Black',           NULL, 'IA-CT-003', 'AAA-AG-2022-8815',  false, NULL, NULL, NULL, 'Prime Angus bull. Sire for crossbreeding with Holsteins.',                                   true, 'ANI-COW-034', 'e0000000-0000-0000-0000-000000000001', NULL, 'active', NULL,         NULL,         680.0,'kg', '2026-01-15', '10000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000035', 'f0000000-0000-0000-0000-000000000001', 'Rosie',     'Cattle',  'Hereford',           '2023-04-20', 'Female', 520.0,'Red/White Face',  NULL, 'IA-CT-004', 'AHA-HF-2023-1122',  false, NULL, NULL, NULL, 'Hereford heifer. Good maternal genetics. First calf expected May 2026.',                     true, 'ANI-COW-035', 'e0000000-0000-0000-0000-000000000001', NULL, 'bred',   '2025-08-10', '2026-05-20', 520.0,'kg', '2026-01-15', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 40: VET HOSPITALS (2 hospitals â€” ALL columns populated)
-- ============================================================
INSERT INTO vet_hospitals (id, name, hospital_type, tagline, registration_number, accreditation_body, accreditation_number, accreditation_expiry, description, address, city, state, country, postal_code, gps_latitude, gps_longitude, phone, emergency_phone, email, website, logo_url, cover_image_url, established_year, total_beds, icu_beds, is_24_hours, has_emergency, has_ambulance, has_pharmacy, has_lab, has_imaging, has_surgery, has_icu, specializations, facilities, accepted_species, operating_hours, owner_id, is_verified, is_active, verification_status, drug_license_expiry, trade_license_expiry, registration_renewal_date, rating, total_reviews, total_consultations, metadata) VALUES
  ('h0000000-0000-0000-0000-000000000001', 'VetCare Central Hospital', 'multi_specialty',
   'Excellence in Veterinary Care â€” 24/7 Emergency & Specialty Services',
   'HOSP-TX-2020-0482', 'AAHA', 'AAHA-TX-2024-1182', '2027-03-15',
   'VetCare Central is a premier AAHA-accredited multi-specialty veterinary hospital offering 24/7 emergency care, advanced surgery, diagnostic imaging (CT, MRI, X-ray, ultrasound), in-house laboratory, ICU, and boarding. Our team of 12 doctors covers all species from companion animals to exotics.',
   '245 Oak Valley Dr', 'Austin', 'Texas', 'US', '78701',
   30.2672, -97.7431, '+1-512-555-0100', '+1-512-555-0199',
   'info@vetcarecentral.com', 'https://vetcarecentral.com',
   '/uploads/hospitals/vetcare-central-logo.png', '/uploads/hospitals/vetcare-central-cover.jpg',
   2020, 32, 8, true, true, true, true, true, true, true, true,
   ARRAY['General Practice','Surgery','Orthopedics','Dermatology','Cardiology','Oncology','Emergency Medicine','Exotic Animals'],
   ARRAY['CT Scanner','MRI','Digital X-Ray','Ultrasound','Endoscopy','Dental Suite','Surgical Theater x3','ICU','Isolation Ward','Rehabilitation Pool','Pharmacy','Grooming Salon','Boarding Kennels'],
   ARRAY['Dog','Cat','Rabbit','Bird','Reptile','Guinea Pig','Hamster','Ferret','Fish'],
   '{"monday":{"open":"00:00","close":"23:59","is_24h":true},"tuesday":{"open":"00:00","close":"23:59","is_24h":true},"wednesday":{"open":"00:00","close":"23:59","is_24h":true},"thursday":{"open":"00:00","close":"23:59","is_24h":true},"friday":{"open":"00:00","close":"23:59","is_24h":true},"saturday":{"open":"00:00","close":"23:59","is_24h":true},"sunday":{"open":"00:00","close":"23:59","is_24h":true}}',
   'b0000000-0000-0000-0000-000000000001', true, true, 'verified',
   '2027-06-30', '2027-12-31', '2027-03-15', 4.87, 156, 2480,
   '{"parking":"Free parking for 50 vehicles","wifi":"Free WiFi in waiting areas","payment_methods":["Visa","MasterCard","Amex","CareCredit","Scratchpay"],"insurance_accepted":["PetPlan","Nationwide","Trupanion","ASPCA","Healthy Paws"]}'),

  ('h0000000-0000-0000-0000-000000000002', 'Sunrise Rural Animal Clinic', 'general_practice',
   'Compassionate Care for Companions and Livestock',
   'HOSP-NC-2022-1104', 'AAHA', 'AAHA-NC-2024-0891', '2026-09-30',
   'Sunrise Rural Animal Clinic serves both companion animals and farm livestock in the Asheville area. We provide routine wellness, dentistry, soft tissue surgery, farm calls, and reproductive services. Our large-animal facilities include a bovine chute, equine stocks, and mobile ultrasound.',
   '340 Hilltop Farm Rd', 'Asheville', 'North Carolina', 'US', '28801',
   35.5951, -82.5515, '+1-828-555-0200', '+1-828-555-0299',
   'hello@sunriserural.com', 'https://sunriserural.com',
   '/uploads/hospitals/sunrise-rural-logo.png', '/uploads/hospitals/sunrise-rural-cover.jpg',
   2022, 12, 2, false, true, false, true, true, true, true, false,
   ARRAY['General Practice','Farm Animal Medicine','Dentistry','Reproductive Services','Surgery'],
   ARRAY['Digital X-Ray','Ultrasound (Portable)','Dental Suite','Surgical Theater','Bovine Chute','Equine Stocks','Pharmacy','Small Boarding Area'],
   ARRAY['Dog','Cat','Horse','Cattle','Sheep','Goat','Pig','Poultry','Rabbit'],
   '{"monday":{"open":"07:30","close":"18:00"},"tuesday":{"open":"07:30","close":"18:00"},"wednesday":{"open":"07:30","close":"18:00"},"thursday":{"open":"07:30","close":"18:00"},"friday":{"open":"07:30","close":"17:00"},"saturday":{"open":"08:00","close":"13:00"},"sunday":{"open":"closed","close":"closed"}}',
   'b0000000-0000-0000-0000-000000000002', true, true, 'verified',
   '2027-04-15', '2027-10-31', '2026-09-30', 4.65, 42, 890,
   '{"parking":"Gravel lot for 20 vehicles + trailer parking","farm_calls":"Available Mon-Fri within 30-mile radius","payment_methods":["Visa","MasterCard","Cash","CareCredit"]}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 41: HOSPITAL DEPARTMENTS
-- ============================================================
INSERT INTO hospital_departments (id, hospital_id, name, code, description, specializations, floor_number, room_numbers, head_doctor_id, is_active) VALUES
  ('hd000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'General Medicine',         'GEN', 'Primary care consultations, wellness exams, and preventive medicine.',       ARRAY['General Practice','Preventive Care','Geriatrics'],     '1', 'R101-R108', 'b0000000-0000-0000-0000-000000000001', true),
  ('hd000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'Surgery & Orthopedics',    'SRG', 'Orthopedic, soft tissue, and emergency surgical procedures.',                ARRAY['General Surgery','Orthopedics','TPLO','Fracture Repair'],'2', 'OR-201,OR-202,OR-203', 'b0000000-0000-0000-0000-000000000001', true),
  ('hd000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'Dermatology & Allergy',    'DRM', 'Skin conditions, allergy testing, immunotherapy, and ear disease.',           ARRAY['Dermatology','Allergy','Immunotherapy'],               '1', 'R109-R112', 'b0000000-0000-0000-0000-000000000002', true),
  ('hd000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000001', 'Emergency & Critical Care','ER',  'Round-the-clock emergency triage, stabilization, and critical care.',        ARRAY['Emergency Medicine','Critical Care','Toxicology'],     '1', 'ER-101,ER-102,ICU-1,ICU-2', NULL, true),
  ('hd000000-0000-0000-0000-000000000005', 'h0000000-0000-0000-0000-000000000001', 'Exotic & Avian Medicine',  'EXO', 'Specialized care for birds, reptiles, small mammals, and aquatic species.', ARRAY['Avian Medicine','Reptile Medicine','Small Mammals'],   '2', 'R213-R216', 'b0000000-0000-0000-0000-000000000004', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 42: HOSPITAL DOCTORS
-- ============================================================
INSERT INTO hospital_doctors (id, hospital_id, doctor_id, department_id, hospital_role, title, employment_type, is_primary_hospital, consultation_fee, is_accepting_patients, is_active) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'hd000000-0000-0000-0000-000000000001', 'owner',            'Chief of Surgery & Hospital Director',  'full_time', true,  85.00,  true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'hd000000-0000-0000-0000-000000000003', 'department_head',  'Head of Dermatology',                   'full_time', true,  95.00,  true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'hd000000-0000-0000-0000-000000000004', 'consultant',       'Emergency & Exotic Consultant',         'part_time', false, 120.00, true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'hd000000-0000-0000-0000-000000000005', 'department_head',  'Head of Exotic Animal Medicine',         'full_time', true,  110.00, true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', NULL,                                   'medical_director', 'Medical Director',                      'full_time', false, 85.00,  true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', NULL,                                   'visiting',         'Visiting Exotic Specialist',             'visiting',  false, 120.00, true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 43: HOSPITAL SERVICES
-- ============================================================
INSERT INTO hospital_services (id, hospital_id, service_name, category, description, price_min, price_max, currency, duration_minutes, requires_appointment, is_available) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Wellness Exam',                 'consultation',   'Complete physical examination with wellness blood panel.',                   65.00, 120.00, 'USD', 30, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Emergency Triage & Stabilization','emergency',     '24/7 emergency assessment, triage, and stabilization.',                     150.00,500.00, 'USD', 60, false, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Dental Cleaning & Extractions',  'dental',         'Ultrasonic dental cleaning under anesthesia. Extractions priced separately.',250.00,600.00, 'USD', 90, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Spay/Neuter Surgery',            'surgery',        'Routine spay or neuter with pre-surgical blood work and post-op pain mgmt.',200.00,450.00, 'USD', 60, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Digital Radiographs (X-Ray)',     'diagnostics',    'High-resolution digital X-rays with same-day results.',                     120.00,220.00, 'USD', 20, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Ultrasound',                     'diagnostics',    'Abdominal or cardiac ultrasound by board-certified specialist.',             200.00,350.00, 'USD', 45, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'CT Scan',                        'diagnostics',    'Full-body or targeted CT scan under sedation.',                             800.00,1500.00,'USD', 60, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'TPLO Cruciate Surgery',          'surgery',        'Tibial plateau leveling osteotomy for cruciate ligament rupture.',           3500.00,5000.00,'USD',120,true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Allergy Testing (Intradermal)',   'diagnostics',    'Intradermal skin testing for environmental and food allergens.',             300.00,500.00, 'USD', 90, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Exotic Pet Consultation',         'consultation',   'Specialized consultation for reptiles, birds, and small mammals.',          110.00,150.00, 'USD', 45, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Boarding (Per Night)',             'boarding',       'Climate-controlled boarding with daily walks and feeding.',                  35.00, 65.00,  'USD', NULL, true, true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'Pet Grooming',                    'grooming',       'Full grooming service â€” bath, haircut, nail trim, ear cleaning.',            45.00, 120.00, 'USD', 90, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'Farm Call â€” Routine',              'consultation',   'On-farm visit for routine health checks, vaccinations, and herd assessment.',150.00,250.00, 'USD', 120,true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'Reproductive Ultrasound',          'reproduction',   'Pregnancy detection and fetal assessment for cattle, sheep, goats.',         75.00, 120.00, 'USD', 30, true,  true),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'Hoof Trimming & Treatment',        'other',          'Corrective hoof trimming and treatment for laminitis/foot rot.',             40.00, 80.00,  'USD', 20, true,  true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 44: HOSPITAL INVITES
-- ============================================================
INSERT INTO hospital_invites (id, hospital_id, email, first_name, last_name, phone, invite_token, hospital_role, department_id, status, invited_by, expires_at) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'dr.new.intern@email.com',  'Alex',  'Rivera',  '+1-555-600-0001', 'inv_vetcare_central_001_' || md5(random()::text), 'intern',  'hd000000-0000-0000-0000-000000000001', 'pending',  'b0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '7 days'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'nurse.jen@email.com',      'Jennifer','Park',   '+1-555-600-0002', 'inv_vetcare_central_002_' || md5(random()::text), 'staff',   'hd000000-0000-0000-0000-000000000004', 'accepted', 'b0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '7 days'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'vet.locum@email.com',      'David',  'Walsh',   '+1-828-555-0301', 'inv_sunrise_rural_001_' || md5(random()::text),   'visiting','hd000000-0000-0000-0000-000000000001', 'pending',  'b0000000-0000-0000-0000-000000000002', NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 45: HOSPITAL DOCUMENTS
-- ============================================================
INSERT INTO hospital_documents (id, hospital_id, doc_type, file_name, file_url, expiry_date, status, reviewed_by, reviewed_at) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'trade_license', 'vetcare_central_trade_license_2025.pdf', '/uploads/hospitals/docs/vetcare_trade_license.pdf', '2027-12-31', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'drug_license',  'vetcare_central_drug_license_2025.pdf',  '/uploads/hospitals/docs/vetcare_drug_license.pdf',  '2027-06-30', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'vet_council',   'vetcare_central_council_reg.pdf',        '/uploads/hospitals/docs/vetcare_council_reg.pdf',   '2027-03-15', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'trade_license', 'sunrise_rural_trade_license_2025.pdf',   '/uploads/hospitals/docs/sunrise_trade_license.pdf', '2027-10-31', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-03-10'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'drug_license',  'sunrise_rural_drug_license_2025.pdf',    '/uploads/hospitals/docs/sunrise_drug_license.pdf',  '2027-04-15', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-03-10'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'gst',           'sunrise_rural_gst_certificate.pdf',      '/uploads/hospitals/docs/sunrise_gst.pdf',           NULL,         'pending_review', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 46: STAFF POSITIONS
-- ============================================================
INSERT INTO staff_positions (id, hospital_id, user_id, position, department, is_active, hired_date, notes) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'veterinarian',    'Surgery & Orthopedics',    true, '2020-01-15', 'Founding veterinarian and hospital owner.'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'veterinarian',    'Dermatology & Allergy',    true, '2021-06-01', 'Joined as dermatology specialist.'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'veterinarian',    'Emergency & Critical Care', true, '2022-03-15', 'Part-time emergency and exotic consultant.'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'veterinarian',    'Exotic & Avian Medicine',  true, '2023-09-01', 'Head of exotic animal department.'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'veterinarian',    'General Practice',         true, '2022-04-01', 'Medical director at Sunrise Rural.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 47: APPOINTMENT QUEUE
-- ============================================================
INSERT INTO appointment_queue (id, hospital_id, animal_id, owner_id, assigned_vet_id, queue_number, priority, triage_level, status, reason, triage_notes, triaged_by, checked_in_at, estimated_wait_minutes) VALUES
  ('aq000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   1, 'normal', 3, 'in_examination', 'Annual wellness exam for Duke (Standard Poodle)', 'Weight stable, no acute issues. Routine checkup.', 'b0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '25 minutes', 0),
  ('aq000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   2, 'high', 2, 'in_triage', 'Copper (Beagle) ate chocolate â€” possible toxicity', 'Owner reports ~50g dark chocolate ingested 1hr ago. Weight 11.5kg. Calculating theobromine dose.', 'b0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '10 minutes', 15),
  ('aq000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   3, 'normal', 3, 'waiting', 'Monty (Ball Python) not eating for 3 weeks â€” wellness check', NULL, NULL, NOW() - INTERVAL '5 minutes', 30),
  ('aq000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', NULL,
   4, 'urgent', 2, 'waiting', 'Oscar (Dachshund) sudden hind leg weakness â€” possible IVDD', NULL, NULL, NOW() - INTERVAL '2 minutes', 20)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 48: WORKFLOW CASES
-- ============================================================
INSERT INTO workflow_cases (id, queue_entry_id, hospital_id, animal_id, owner_id, current_stage, assigned_vet_id, priority, chief_complaint, diagnosis, treatment_plan, status) VALUES
  ('wc000000-0000-0000-0000-000000000001', 'aq000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'examination',
   'b0000000-0000-0000-0000-000000000001', 'normal',
   'Annual wellness exam â€” Standard Poodle, 4 years old',
   'Healthy on physical exam. Mild tartar buildup on premolars. Joint palpation normal.',
   'Dental cleaning recommended within 3 months. Continue joint supplements. Update DHPP vaccine today.',
   'active'),
  ('wc000000-0000-0000-0000-000000000002', 'aq000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'treatment',
   'b0000000-0000-0000-0000-000000000002', 'high',
   'Chocolate toxicity â€” ~50g dark chocolate ingested by 11.5kg Beagle',
   'Theobromine dose estimated at 130mg/kg â€” toxic range. Mild tachycardia (HR 140).',
   'Induce emesis with apomorphine. Activated charcoal 2g/kg. IV fluids. Monitor ECG for 6 hours.',
   'active'),
  ('wc000000-0000-0000-0000-000000000003', NULL, 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'discharge',
   'b0000000-0000-0000-0000-000000000001', 'normal',
   'Charlie (Lab) post-neuter recovery â€” day surgery',
   'Routine castration completed successfully. No complications.',
   'E-collar for 10 days. Restricted activity 14 days. Recheck incision day 10.',
   'completed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 49: WORKFLOW TRANSITIONS
-- ============================================================
INSERT INTO workflow_transitions (id, case_id, from_stage, to_stage, transitioned_by, staff_position, notes) VALUES
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000001', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Vitals normal. Transferred to Dr. Carter for wellness exam.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000002', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Priority elevated â€” chocolate toxicity. Immediate assessment.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000002', 'examination', 'treatment',   'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Emesis induced. Charcoal administered. Moving to treatment bay for IV and monitoring.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000003', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Pre-surgical assessment for neuter.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000003', 'examination', 'treatment',   'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Pre-op blood work normal. Proceeding to surgery.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000003', 'treatment',   'observation', 'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Surgery complete. Recovering from anesthesia in recovery ward.'),
  (gen_random_uuid(), 'wc000000-0000-0000-0000-000000000003', 'observation', 'discharge',   'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Fully recovered. Discharged with post-op instructions and pain medication.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 50: REFERRALS
-- ============================================================
INSERT INTO referrals (id, case_id, hospital_id, from_vet_id, to_vet_id, animal_id, reason, specialty_needed, priority, status, clinical_notes, response_notes) VALUES
  ('rf000000-0000-0000-0000-000000000001', 'wc000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   'aa000000-0000-0000-0000-000000000019',
   'Poodle Duke has mild chronic ear canal inflammation during wellness exam. Refer to Dr. Bennett for dermatology workup.',
   'Dermatology', 'normal', 'accepted',
   'Bilateral erythematous ear canals with slight ceruminous discharge. No pain on palpation. Recommend cytology and allergy evaluation.',
   'Will schedule intradermal allergy testing. Ear cytology added to next visit.'),
  ('rf000000-0000-0000-0000-000000000002', NULL, 'h0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004',
   'aa000000-0000-0000-0000-000000000016',
   'Ball python Monty has been anorexic for 3 weeks. Initial exam by Dr. Carter found no obvious issues. Referring to Dr. Sharma for exotic specialist evaluation.',
   'Reptile Medicine', 'normal', 'pending',
   'Physical exam: good body condition (BCS 3/5), no retained shed, no oral lesions, no respiratory signs. Husbandry appears adequate. Fecal parasite check negative.',
   NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 51: INPATIENT ADMISSIONS
-- ============================================================
INSERT INTO inpatient_admissions (id, hospital_id, animal_id, owner_id, admitted_by, case_id, admission_type, room_number, bed_number, status, estimated_discharge, care_instructions, medications, vitals_log, special_needs, daily_rate) VALUES
  ('ia000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   'wc000000-0000-0000-0000-000000000002', 'post_treatment', 'ER-102', 'B2',
   'in_treatment', NOW() + INTERVAL '6 hours',
   'Monitor ECG continuously. Check HR every 30 min. Offer water after 2 hours. No food for 4 hours after charcoal.',
   '[{"name":"Activated Charcoal","dosage":"23g","route":"oral","frequency":"single dose","given_at":"2026-02-19T10:15:00"},{"name":"IV Lactated Ringers","dosage":"20 mL/hr","route":"IV","frequency":"continuous","given_at":"2026-02-19T10:20:00"}]',
   '[{"time":"2026-02-19T10:10:00","hr":140,"rr":28,"temp":39.1,"spo2":98,"notes":"Pre-treatment. Tachycardic."},{"time":"2026-02-19T10:45:00","hr":128,"rr":24,"temp":38.9,"spo2":99,"notes":"Post-emesis. HR improving."},{"time":"2026-02-19T11:15:00","hr":118,"rr":22,"temp":38.8,"spo2":99,"notes":"Charcoal administered. Resting comfortably."}]',
   'Owner authorized all emergency treatments. Allergic to acepromazine (previous reaction).',
   125.00),
  ('ia000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'wc000000-0000-0000-0000-000000000003', 'surgery_recovery', 'R105', 'B1',
   'ready_to_discharge', NOW() - INTERVAL '1 hour',
   'E-collar must stay on at all times. Restrict running/jumping for 14 days. Monitor incision daily for redness/swelling.',
   '[{"name":"Meloxicam","dosage":"1.5mg","route":"oral","frequency":"once daily for 5 days","given_at":"2026-02-19T14:00:00"},{"name":"Cefpodoxime","dosage":"100mg","route":"oral","frequency":"twice daily for 7 days","given_at":"2026-02-19T14:00:00"}]',
   '[{"time":"2026-02-19T12:00:00","hr":92,"rr":18,"temp":38.4,"spo2":99,"notes":"Fully recovered from anesthesia. Alert and responsive."},{"time":"2026-02-19T14:00:00","hr":88,"rr":16,"temp":38.3,"spo2":100,"notes":"Ate small meal. Walked outside. Ready for discharge."}]',
   NULL, 0),
  ('ia000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   NULL, 'boarding', 'K-3', NULL,
   'admitted', NOW() + INTERVAL '3 days',
   'Feed Royal Canin Indoor Adult twice daily. Litter box cleaned twice daily. Brush coat once daily. Owner visiting Saturday.',
   '[]',
   '[]',
   'Very shy cat â€” needs quiet room. Owner provided personal blanket from home.', 45.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 52: WALLETS (one per user)
-- ============================================================
INSERT INTO wallets (id, user_id, balance, bonus_credits, currency) VALUES
  ('w0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',    0.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 1250.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002',  980.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 1560.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004',  520.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001',   42.50,  12.50, 'USD'),
  ('w0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002',   18.75,   8.50, 'USD'),
  ('w0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003',   75.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000004',  120.00,  25.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001',   85.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000002',   60.00,   0.00, 'USD'),
  ('w0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000003',  200.00,   0.00, 'USD')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 53: WALLET TRANSACTIONS
-- ============================================================
INSERT INTO wallet_transactions (id, wallet_id, type, amount, description, reference_type) VALUES
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received â€” Buddy hip dysplasia consultation',       'consultation'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received â€” Max osteoarthritis assessment',          'consultation'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received â€” Daisy emergency farm call',              'consultation'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000002', 'debit',   50.00,  'Withdrawal to bank account',                                 'withdrawal'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000003', 'credit',  95.00,  'Payment received â€” Whiskers dermatology consultation',      'consultation'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000004', 'credit', 120.00,  'Payment received â€” Kiwi avian consultation',                'consultation'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000006', 'credit',  42.50,  'Refund â€” Doctor cancelled appointment (50% of $85)',        'refund'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000006', 'bonus',   12.50,  'Goodwill bonus â€” Doctor cancellation compensation',         'bonus'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000009', 'credit', 120.00,  'Added funds via credit card',                                'deposit'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000009', 'bonus',   25.00,  'Welcome bonus for new user',                                 'bonus'),
  (gen_random_uuid(), 'w0000000-0000-0000-0000-000000000012', 'credit', 200.00,  'Added funds for marketplace purchase',                       'deposit')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 54: VET DATE OVERRIDES
-- ============================================================
INSERT INTO vet_date_overrides (id, veterinarian_id, override_date, override_type, start_time, end_time, slot_duration, reason, created_by) VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', '2026-03-14', 'unavailable',  NULL,    NULL,    NULL, 'Attending ACVS Conference in Chicago',   'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 'unavailable',  NULL,    NULL,    NULL, 'Attending ACVS Conference in Chicago',   'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', '2026-02-28', 'custom_hours', '10:00', '14:00', 30,   'Half-day â€” annual vet license renewal',  'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', '2026-03-01', 'unavailable',  NULL,    NULL,    NULL, 'Personal day',                           'b0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', '2026-03-10', 'custom_hours', '09:00', '12:00', 45,   'Morning only â€” zoo consultation in PM',  'b0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 55: VET BLOCKED SLOTS
-- ============================================================
INSERT INTO vet_blocked_slots (id, veterinarian_id, block_date, start_time, end_time, reason, is_recurring, recurring_day) VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'monday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'tuesday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'wednesday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'thursday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'friday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001', '2026-02-20', '14:00', '15:30', 'Staff meeting',                   false, NULL),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'monday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'wednesday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'friday'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', '2026-03-05', '15:00', '18:00', 'Research paper review deadline',  false, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 56: HOSPITAL HOLIDAYS
-- ============================================================
INSERT INTO hospital_holidays (id, hospital_id, holiday_date, name, holiday_type, is_full_day, start_time, end_time, created_by) VALUES
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', '2026-12-25', 'Christmas Day',       'general',           false, NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', '2026-01-01', 'New Year''s Day',      'general',           false, NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', '2026-07-04', 'Independence Day',    'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', '2026-11-26', 'Thanksgiving',        'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000001', '2026-03-20', 'Staff Training Day',  'hospital_specific', true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', '2026-12-25', 'Christmas Day',       'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', '2026-01-01', 'New Year''s Day',      'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', '2026-07-04', 'Independence Day',    'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'h0000000-0000-0000-0000-000000000002', '2026-02-16', 'Emergency Closure â€” Snowstorm', 'emergency_closure', true, NULL, NULL, 'b0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 57: MARKETPLACE BIDS
-- ============================================================
-- Bids on the livestock scale (auction listing from existing data)
INSERT INTO marketplace_bids (id, listing_id, bidder_id, amount, message, status, is_winning) VALUES
  (gen_random_uuid(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000001', 650.00, 'Interested for our dairy farm. Can pick up in Austin.', 'active', false),
  (gen_random_uuid(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000003', 750.00, 'Great condition. Would use for sheep weighing. Can pay via bank transfer.', 'active', false),
  (gen_random_uuid(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000002', 820.00, 'Willing to pay asking price. Need shipping to NC.', 'active', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 58: MARKETPLACE ORDERS
-- ============================================================
INSERT INTO marketplace_orders (id, listing_id, buyer_id, seller_id, quantity, unit_price, total_price, status, payment_status, shipping_address, tracking_number, notes) VALUES
  (gen_random_uuid(),
   (SELECT id FROM marketplace_listings WHERE title LIKE '%Organic Aged Cheddar%' LIMIT 1),
   'c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001',
   3, 45.00, 135.00, 'shipped', 'paid',
   '{"name":"Sarah Kim","address":"890 Pine St","city":"San Diego","state":"CA","zip":"92101"}',
   'USPS-9400111899223344556677', 'Gift for friends who love artisan cheese.'),
  (gen_random_uuid(),
   (SELECT id FROM marketplace_listings WHERE title LIKE '%Free-Range RIR%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
   6, 25.00, 150.00, 'completed', 'paid',
   '{"name":"Thomas Green","address":"1455 Mountain View Rd","city":"Stowe","state":"VT","zip":"05672"}',
   NULL, 'Picked up in person. Healthy birds, started laying within a week.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 59: MEDICAL RECORD AUDIT LOG
-- ============================================================
INSERT INTO medical_record_audit_log (id, record_id, record_type, action, performed_by, changed_by, changed_by_name, old_values, new_values, change_reason, ip_address) VALUES
  (gen_random_uuid(), 'ff000000-0000-0000-0000-000000000001', 'medical_record', 'create', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter',
   NULL, '{"title":"Hip Dysplasia Diagnosis â€” Buddy","severity":"normal","status":"active"}', 'Initial diagnosis record created', '10.0.0.5'),
  (gen_random_uuid(), 'ff000000-0000-0000-0000-000000000001', 'medical_record', 'update', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter',
   '{"follow_up_date":null}', '{"follow_up_date":"2026-04-15"}', 'Added follow-up date after radiograph review', '10.0.0.5'),
  (gen_random_uuid(), 'ff000000-0000-0000-0000-000000000002', 'medical_record', 'create', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Dr. Sarah Johnson',
   NULL, '{"title":"Atopic Dermatitis â€” Whiskers","severity":"high","status":"active"}', 'Diagnosis after skin scraping and culture', '10.0.0.6'),
  (gen_random_uuid(), 'ff000000-0000-0000-0000-000000000005', 'medical_record', 'view', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Tom Wilson',
   NULL, NULL, 'Owner viewed Daisy emergency record', '192.168.1.55')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 60: ADDITIONAL BOOKINGS & CONSULTATIONS (new users/animals)
-- ============================================================
INSERT INTO bookings (id, pet_owner_id, veterinarian_id, animal_id, hospital_id, scheduled_date, time_slot_start, time_slot_end, status, booking_type, priority, reason_for_visit, symptoms) VALUES
  ('bb000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000016',
   'h0000000-0000-0000-0000-000000000001', '2026-03-01', '10:00', '10:45', 'confirmed', 'in_person', 'normal',
   'Ball python Monty not eating for 3 weeks', 'Anorexia, hiding more than usual'),
  ('bb000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000017',
   'h0000000-0000-0000-0000-000000000001', '2026-03-01', '11:00', '11:45', 'confirmed', 'in_person', 'normal',
   'Bearded dragon Rex annual wellness check', 'Routine â€” no concerns'),
  ('bb000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000019',
   'h0000000-0000-0000-0000-000000000001', '2026-03-05', '09:00', '09:30', 'confirmed', 'in_person', 'normal',
   'Duke annual wellness exam', NULL),
  ('bb000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000022',
   'h0000000-0000-0000-0000-000000000001', '2026-03-08', '14:00', '14:30', 'pending', 'video_call', 'normal',
   'Bengal Shadow scratching ears â€” possible ear mites', 'Head shaking, dark ear discharge'),
  ('bb000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000015',
   'h0000000-0000-0000-0000-000000000001', '2026-03-12', '14:00', '14:45', 'pending', 'in_person', 'normal',
   'Rabbit Snowball dental check', 'Slightly reduced hay intake'),
  ('bb000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000027',
   NULL, '2026-03-15', '08:00', '09:00', 'confirmed', 'in_person', 'normal',
   'Pre-lambing check for Woolly (Merino ewe)', 'Pregnant â€” due mid-April')
ON CONFLICT (id) DO NOTHING;

-- Additional consultations for new pets
INSERT INTO consultations (id, user_id, veterinarian_id, animal_id, animal_type, symptom_description, status, priority, scheduled_at, started_at, completed_at, duration, diagnosis, prescription, follow_up_date, notes) VALUES
  ('cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000014',
   'Cat - Persian', 'Excessive tearing and staining around eyes, sneezing',
   'completed', 'normal', '2026-01-20 10:00:00', '2026-01-20 10:05:00', '2026-01-20 10:35:00', 30,
   'Brachycephalic obstructive airway syndrome with secondary epiphora. Nasolacrimal duct partially blocked. Mild dental disease noted.',
   'Tobramycin ophthalmic drops 0.3% â€” 1 drop each eye twice daily for 10 days. Daily eye cleaning with sterile saline. Dental cleaning recommended.',
   '2026-04-20', 'Persian breed predisposition. Advised daily eye wiping routine. Dental under anesthesia needed within 3 months.'),
  ('cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000021',
   'Dog - Miniature Dachshund', 'Occasional yelping when jumping down from couch despite ramp availability',
   'completed', 'high', '2026-02-01 11:00:00', '2026-02-01 11:03:00', '2026-02-01 11:38:00', 35,
   'Mild IVDD â€” Stage 1. Cervical pain on palpation C3-C5. No neurological deficits. Radiographs show mild disc space narrowing at C4-C5.',
   'Gabapentin 50mg twice daily for 14 days. Strict cage rest for 4 weeks. Anti-inflammatory: Carprofen 12.5mg once daily for 7 days.',
   '2026-03-01', 'CRITICAL: No jumping, no stairs, no rough play. Carry dog up/down. Consider MRI if symptoms worsen. Weight management essential.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 61: ADDITIONAL VACCINATION RECORDS (new animals)
-- ============================================================
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, certificate_number, reaction_notes, is_valid) VALUES
  -- Charlie (Labrador)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'Rabies (3-year)',  'Core', '2025-06-10', '2028-06-10', '1 mL SC', 'RB-3Y-4421', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'DHPP (DA2PP)',     'Core', '2025-06-10', '2026-06-10', '1 mL SC', 'DH-5W-8812', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E002', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'Lyme Disease',    'Non-Core', '2025-06-10', '2026-06-10', '1 mL SC', 'LY-VX-1102', 'Zoetis', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E003', NULL, true),
  -- Princess (Persian)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014', 'FVRCP',           'Core', '2025-11-20', '2026-11-20', '1 mL SC', 'FV-3C-2218', 'Zoetis',               'b0000000-0000-0000-0000-000000000004', 'VAX-2025-F001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014', 'Rabies (1-year)', 'Core', '2025-11-20', '2026-11-20', '1 mL SC', 'RB-1Y-9981', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000004', 'VAX-2025-F002', NULL, true),
  -- Duke (Poodle)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 'Rabies (3-year)',  'Core', '2024-09-22', '2027-09-22', '1 mL SC', 'RB-3Y-6654', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-G001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 'DHPP (DA2PP)',     'Core', '2025-09-22', '2026-09-22', '1 mL SC', 'DH-5W-7738', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-G002', NULL, true),
  -- Copper (Beagle)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 'Rabies (1-year)',  'Core', '2025-03-08', '2026-03-08', '1 mL SC', 'RB-1Y-5542', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-H001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 'DHPP (DA2PP)',     'Core', '2025-03-08', '2026-03-08', '1 mL SC', 'DH-5W-3390', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-H002', NULL, true),
  -- Oscar (Dachshund)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021', 'Rabies (3-year)',  'Core', '2025-12-01', '2028-12-01', '1 mL SC', 'RB-3Y-1178', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-I001', NULL, true),
  -- Shadow (Bengal)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000022', 'FVRCP',           'Core', '2025-07-14', '2026-07-14', '1 mL SC', 'FV-3C-5567', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-J001', NULL, true),
  -- Muffin (Ragdoll)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000023', 'FVRCP',           'Core', '2025-04-18', '2026-04-18', '1 mL SC', 'FV-3C-8891', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-K001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000023', 'Rabies (3-year)', 'Core', '2025-04-18', '2028-04-18', '1 mL SC', 'RB-3Y-2248', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000002', 'VAX-2025-K002', NULL, true),
  -- Scout (Border Collie)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000032', 'Rabies (3-year)',  'Core', '2024-08-05', '2027-08-05', '1 mL SC', 'RB-3Y-9914', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-L001', NULL, true),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000032', 'DHPP (DA2PP)',     'Core', '2025-08-05', '2026-08-05', '1 mL SC', 'DH-5W-4456', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-L002', NULL, true),
  -- Woolly (Merino Sheep)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000027', 'Clostridial 8-way','Core', '2025-09-01', '2026-09-01', '2 mL SC', 'CL-8W-7701', 'Merck', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-M001', NULL, true),
  -- Wilbur (Yorkshire Pig)
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000030', 'Erysipelas',      'Core', '2025-04-12', '2026-04-12', '2 mL IM', 'ER-PG-3301', 'Zoetis', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-N001', NULL, true);

-- ============================================================
-- STEP 62: ADDITIONAL WEIGHT HISTORY (new animals)
-- ============================================================
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 26.0, 'kg', 'Post-neuter weight',          'b0000000-0000-0000-0000-000000000001', '2025-06-10'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 28.5, 'kg', 'Annual checkup weight',       'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014',  3.5, 'kg', 'Spay recovery weight',        'b0000000-0000-0000-0000-000000000004', '2025-05-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014',  4.1, 'kg', 'Wellness visit weight',       'b0000000-0000-0000-0000-000000000004', '2026-01-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 26.2, 'kg', 'Year 3 checkup',              'b0000000-0000-0000-0000-000000000001', '2024-09-22'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 27.0, 'kg', 'Year 4 checkup',              'b0000000-0000-0000-0000-000000000001', '2025-09-22'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 10.8, 'kg', 'Puppy final weight',          'b0000000-0000-0000-0000-000000000001', '2025-03-08'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 11.5, 'kg', 'Slightly over ideal weight',  'b0000000-0000-0000-0000-000000000001', '2026-02-10'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021',  4.8, 'kg', 'Post-IVDD baseline',          'b0000000-0000-0000-0000-000000000001', '2025-12-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021',  5.2, 'kg', 'Gained weight during rest',   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000027', 58.0, 'kg', 'Pre-breeding weight',         'f0000000-0000-0000-0000-000000000003', '2025-11-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000027', 65.0, 'kg', 'Mid-pregnancy weight',        'f0000000-0000-0000-0000-000000000003', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000030', 155.0,'kg', 'Monthly weigh-in',            'f0000000-0000-0000-0000-000000000003', '2025-12-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000030', 180.0,'kg', 'Monthly weigh-in',            'f0000000-0000-0000-0000-000000000003', '2026-01-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000034', 650.0,'kg', 'Quarterly weigh-in',          'f0000000-0000-0000-0000-000000000001', '2025-10-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000034', 680.0,'kg', 'Quarterly weigh-in',          'f0000000-0000-0000-0000-000000000001', '2026-01-15');

-- ============================================================
-- STEP 63: ADDITIONAL ALLERGY RECORDS (new animals)
-- ============================================================
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 'Flea Saliva',   'Intense scratching, hot spots on lower back',     'moderate', '2025-04-15', true, 'Flea allergy dermatitis. Monthly flea prevention critical.',  'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021', 'Acepromazine',  'Paradoxical excitement, tremors',                  'severe',   '2025-01-10', true, 'Do NOT use acepromazine for sedation. Use alternative protocols.', 'b0000000-0000-0000-0000-000000000001'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000022', 'Pollen (Grass)','Watery eyes, sneezing, mild facial swelling',      'mild',     '2025-09-01', true, 'Seasonal â€” worse in spring/summer. Antihistamines PRN.',       'b0000000-0000-0000-0000-000000000002'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'Lamb Protein',  'Vomiting, diarrhea within 4 hours of ingestion',   'moderate', '2025-08-20', true, 'Confirmed via elimination diet. Feed chicken or fish based only.','b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 64: ADDITIONAL WELLNESS SCORECARDS (new animals)
-- ============================================================
INSERT INTO wellness_scorecards (id, animal_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by, assessed_at) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 90, 85, 95, 100, 90, 'normal', '2026-06-10',
   '["Maintain current exercise routine","Annual dental cleaning","Continue Lyme vaccine annually"]',
   '["Lamb protein allergy - strict avoidance"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 78, 80, 60, 95, 65, 'normal', '2026-04-20',
   '["Daily eye cleaning routine","Dental cleaning needed","Indoor-only â€” increase play/enrichment","Weight monitoring quarterly"]',
   '["Brachycephalic breed - airway monitoring","Dental disease - needs professional cleaning","Epiphora - chronic tear staining"]',
   'b0000000-0000-0000-0000-000000000004', '2026-01-20'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 88, 90, 85, 100, 75, 'normal', '2026-09-22',
   '["Monthly grooming essential","Dental cleaning within 3 months","Continue ear cleaning weekly","Joint supplements for breed predisposition"]',
   '["Mild ear canal inflammation - monitor","Flea allergy - monthly prevention critical"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-15'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 72, 65, 80, 92, 85, 'overweight', '2026-06-01',
   '["Reduce food by 15%","No table scraps","Increase walks to 45 min daily","Weight check monthly"]',
   '["Overweight - target 10.5kg","Beagle breed - high food drive, counter-surfing risk","Chocolate toxicity history"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-10'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 65, 75, 40, 95, 80, 'overweight', '2026-03-01',
   '["CRITICAL: No jumping - ramps everywhere","Cage rest 4 weeks","Weight loss program needed","Continue gabapentin as prescribed"]',
   '["IVDD Stage 1 - high risk breed","Acepromazine allergy - AVOID","Overweight - target 4.5kg","Cervical disc disease C4-C5"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 95, 90, 100, 100, 95, 'normal', '2026-08-05',
   '["Continue high-energy working dog diet","Annual dental check","Paw pad check monthly during herding season"]',
   '[]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-10');

-- ============================================================
-- STEP 65: ADDITIONAL WELLNESS REMINDERS (new animals)
-- ============================================================
INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, status, priority, recurrence) VALUES
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'vaccination', 'DHPP Booster Due â€” Charlie',       'Annual DHPP vaccination due. Schedule with clinic.',                  '2026-06-10', 'pending', 'high',   'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 'dental',      'Dental Cleaning â€” Princess',       'Professional dental cleaning under anesthesia recommended.',           '2026-04-01', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'Eye Follow-Up â€” Princess',         'Recheck epiphora and nasolacrimal duct status.',                       '2026-04-20', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'Annual Wellness â€” Monty (Python)', 'Annual fecal parasite test and weight check for ball python.',          '2026-05-01', 'pending', 'low',    'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'UVB Bulb Replacement â€” Rex',       'Replace UVB bulb every 6 months. Due for replacement.',                 '2026-03-15', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'dental',      'Dental Cleaning â€” Duke',           'Mild tartar noted at wellness exam. Schedule within 3 months.',         '2026-06-01', 'pending', 'medium', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'vaccination', 'Rabies Booster Due â€” Copper',      'Rabies vaccine due. Schedule ASAP.',                                    '2026-03-08', 'pending', 'urgent', 'yearly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'checkup',     'Weight Check â€” Copper',            'Monthly weight check â€” target 10.5kg. Currently 11.5kg.',              '2026-03-10', 'pending', 'high',   'monthly'),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 'checkup',     'IVDD Follow-Up â€” Oscar',           'Recheck cervical pain and neurological status after rest period.',      '2026-03-01', 'pending', 'urgent', NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'checkup',     'Pre-Lambing Check â€” Woolly',       'Pregnancy ultrasound and condition scoring before lambing.',            '2026-03-15', 'pending', 'high',   NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000003', 'checkup',     'Pre-Farrowing Check â€” Charlotte',  'Berkshire sow due mid-April. Pre-farrowing health assessment.',         '2026-03-28', 'pending', 'high',   NULL),
  (gen_random_uuid(), 'aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 'vaccination', 'DHPP Booster Due â€” Scout',         'Annual DHPP + Leptospirosis for Border Collie working dog.',            '2026-08-05', 'pending', 'medium', 'yearly');

-- ============================================================
-- STEP 66: ADDITIONAL NOTIFICATIONS (new users)
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel) VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'booking',       'Booking Confirmed',          'Your appointment with Dr. Sharma for Monty on March 1 at 10:00 AM has been confirmed.', false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'consultation',  'Prescription Ready',         'Dr. Sharma has issued a prescription for Princess (Persian). View in medical records.',    true,  'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'reminder',      'Dental Cleaning Reminder',   'Princess needs a dental cleaning within 3 months. Schedule your appointment.',              false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 'booking',       'Booking Confirmed',          'Your appointment with Dr. Carter for Duke on March 5 at 9:00 AM has been confirmed.',      false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 'consultation',  'URGENT: IVDD Diagnosis',     'Oscar has been diagnosed with IVDD Stage 1. Follow strict rest protocol immediately.',     false, 'in_app'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000004', 'reminder',      'Weight Check Due â€” Copper',  'Monthly weight check for Copper is due. Target: 10.5kg. Currently: 11.5kg.',               false, 'in_app'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'booking',       'New Booking Request',        'Sarah Kim has requested an exotic pet consultation for Monty (Ball Python) on March 1.',    false, 'in_app'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004', 'consultation',  'Referral Received',          'Dr. Carter referred Ball Python Monty for specialist evaluation. View referral details.',   false, 'in_app'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', 'reminder',      'Pre-Lambing Season',         'Woolly (Merino ewe) is due mid-April. Schedule pre-lambing veterinary check.',              false, 'in_app'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', 'reminder',      'Farrowing Preparation',      'Charlotte (Berkshire sow) expected to farrow April 8. Prepare farrowing pen.',              false, 'in_app');

-- ============================================================
-- STEP 67: ADDITIONAL FARM DATA (enterprise 3 records)
-- ============================================================
-- Health observations for enterprise 3
INSERT INTO health_observations (id, enterprise_id, animal_id, observer_id, observation_type, severity, title, description, body_temperature, heart_rate, respiratory_rate, symptoms, is_resolved, resolved_at) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'pregnancy', 'normal', 'Woolly â€” Mid-Pregnancy Check',
   'Woolly at approximately 100 days gestation. Good body condition score 3.5/5. Eating well. Udder development starting.',
   39.0, 80, 20, ARRAY['normal_pregnancy'], true, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000003', 'general', 'low', 'Wilbur â€” Routine Observation',
   'Wilbur active and eating well. Good muscle development. Slight favoring of left hind leg after playing in mud â€” likely minor strain.',
   38.6, 90, 22, NULL, true, NOW() - INTERVAL '2 days');

-- Breeding records for enterprise 3
INSERT INTO breeding_records (id, enterprise_id, dam_id, sire_id, breeding_method, breeding_date, expected_due_date, status, technician_id, pregnancy_confirmed, pregnancy_check_date, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'aa000000-0000-0000-0000-000000000028', 'natural', '2025-11-15', '2026-04-15', 'confirmed_pregnant',
   'b0000000-0000-0000-0000-000000000001', true, '2025-12-20', 'Natural mating with Suffolk ram Baxter. Confirmed pregnant by ultrasound â€” single or twin expected.'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000031', NULL, 'artificial_insemination', '2025-12-10', '2026-04-08', 'confirmed_pregnant',
   'b0000000-0000-0000-0000-000000000001', true, '2026-01-15', 'AI with premium Berkshire semen. Ultrasound confirmed 8-10 piglets estimated.');

-- Feed inventory for enterprise 3
INSERT INTO feed_inventory (id, enterprise_id, feed_name, feed_type, unit, current_stock, minimum_stock, cost_per_unit, supplier, batch_number, expiry_date, storage_location, is_active) VALUES
  ('1f000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000003', 'Sheep Pellet 14% CP',  'grain',      'kg', 1200, 300, 0.35, 'Vermont Feed Supply', 'SP-2026-0201', '2026-09-01', 'Main Barn Feed Room', true),
  ('1f000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000003', 'Timothy/Orchard Hay',  'forage',     'kg', 5500, 1500,0.22, 'Green Mountain Hay',  'TH-2026-0115', '2026-11-01', 'Hay Loft',            true),
  ('1f000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'Pig Grower 16% CP',    'grain',      'kg',  800, 200, 0.40, 'Vermont Feed Supply', 'PG-2026-0201', '2026-08-15', 'Pig House Feed Bin',  true),
  ('1f000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000003', 'Sheep Mineral Block',   'supplement', 'pcs',  12,   3, 14.00, 'AgriSupply',         'SM-2025-1201', '2027-06-01', 'Main Barn Feed Room', true)
ON CONFLICT (id) DO NOTHING;

-- Financial records for enterprise 3
INSERT INTO financial_records (id, enterprise_id, record_type, category, description, amount, currency, transaction_date, recorded_by, notes) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'income',  'wool_sales',     'Spring wool clip â€” 42 fleeces sold to Vermont Fiber Mill',  6300.00, 'USD', '2025-06-15', 'f0000000-0000-0000-0000-000000000003', '42 Merino fleeces @ $150 avg'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'income',  'lamb_sales',     'Market lambs â€” Stowe Farmers Market',                        4500.00, 'USD', '2025-10-20', 'f0000000-0000-0000-0000-000000000003', '15 lambs @ $300 avg'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'income',  'pork_sales',     'Heritage pork â€” direct to restaurants',                      3200.00, 'USD', '2026-01-30', 'f0000000-0000-0000-0000-000000000003', 'Artisan Berkshire pork to 4 restaurants'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'feed',           'Monthly feed purchase â€” sheep + pig ration',                 1800.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000003', 'Vermont Feed Supply February order'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'veterinary',     'Herd health check + pregnancy scanning',                      350.00, 'USD', '2025-12-20', 'f0000000-0000-0000-0000-000000000003', 'Dr. Carter farm visit â€” ultrasound scanning'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'equipment',      'Electric fence charger replacement',                          420.00, 'USD', '2026-01-10', 'f0000000-0000-0000-0000-000000000003', 'Gallagher MBS800i â€” rotational grazing system');

-- Geofence zones for enterprise 3
INSERT INTO geofence_zones (id, enterprise_id, name, zone_type, center_lat, center_lng, radius_meters, polygon_coords, color, alert_on_entry, alert_on_exit, is_restricted, status, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'Farm Perimeter',       'boundary',    44.4660, -72.6875, 800,  '[]', '#22c55e', false, true,  false, 'active', 'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'Lambing Paddock',      'restricted',  44.4662, -72.6878, 100,  '[]', '#f59e0b', true,  true,  true,  'active', 'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'Rotational Pasture A', 'pasture',     44.4675, -72.6860, 250,  '[]', '#3b82f6', false, false, false, 'active', 'f0000000-0000-0000-0000-000000000003');

-- Geospatial events for enterprise 3
INSERT INTO geospatial_events (id, enterprise_id, animal_id, event_type, latitude, longitude, speed_kmh, metadata) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000032', 'location_update', 44.4676, -72.6862, 12.5, '{"source":"collar_gps","battery":91,"note":"Scout herding flock to north pasture"}'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'location_update', 44.4674, -72.6858, 1.2,  '{"source":"ear_tag_gps","battery":68,"note":"Woolly grazing in rotation A"}'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000030', 'zone_exit',       44.4653, -72.6868, 3.5,  '{"zone":"Pig House","alert":"Wilbur escaped pig pen â€” recaptured within 10 min"}');

-- ============================================================
-- STEP 68: ADDITIONAL PAYMENTS (new consultations)
-- ============================================================
INSERT INTO payments (id, consultation_id, user_id, payer_id, payee_id, amount, currency, status, payment_method, transaction_id, invoice_number, gateway, tax_amount, paid_at) VALUES
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   110.00, 'USD', 'completed', 'credit_card', 'TXN-2026-C001', 'INV-2026-006', 'stripe', 9.90, '2026-01-20 10:40:00'),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'wallet', 'TXN-2026-D001', 'INV-2026-007', 'wallet', 7.65, '2026-02-01 11:40:00');

-- ============================================================
-- STEP 69: ADDITIONAL REVIEWS (new consultations)
-- ============================================================
INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, response_from_vet, is_public, status, helpful_count, report_count) VALUES
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   5, 'Dr. Sharma was amazing with my Persian cat Princess! She immediately identified the eye issue and explained the brachycephalic syndrome link. Very gentle with cats. The eye drops are already helping after 1 week.',
   'Thank you Sarah! Princess is such a sweet patient. Keep up with the daily eye cleaning â€” it makes a huge difference for Persians.', true, 'active', 4, 0),
  (gen_random_uuid(), 'cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   5, 'Dr. Carter caught Oscar''s IVDD early and his strict rest protocol has been critical. Oscar is already improving after 2 weeks. The ramp instructions for the whole house were incredibly detailed and helpful.',
   NULL, true, 'active', 7, 0);

-- ============================================================
-- STEP 70: ADDITIONAL AI CHAT SESSIONS (new users)
-- ============================================================
INSERT INTO ai_chat_sessions (id, enterprise_id, user_id, animal_id, title, context_type, status, message_count, last_message_at) VALUES
  ('a8000000-0000-0000-0000-000000000003', NULL, 'c0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000016',
   'Ball Python Feeding Issues', 'animal', 'active', 4, NOW() - INTERVAL '3 hours'),
  ('a8000000-0000-0000-0000-000000000004', NULL, 'c0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000021',
   'Dachshund IVDD Care Guide', 'animal', 'active', 2, NOW() - INTERVAL '12 hours'),
  ('a8000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', NULL,
   'Lambing Season Preparation', 'enterprise', 'active', 2, NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_chat_messages (id, session_id, role, content, confidence, sources, tokens_used) VALUES
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000003', 'user',      'My ball python Monty hasn''t eaten in 3 weeks. His last shed was perfect. Husbandry is 88Â°F hot side, 78Â°F cool side, 60% humidity. What should I do?', NULL, '[]', 35),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000003', 'assistant', 'A 3-week fast for a ball python is common and usually not concerning â€” they can safely fast for 4-8 weeks. Since your husbandry looks good, here are things to try: 1) **Offer prey at night** â€” cover the tank, leave a thawed rat in a dark hide. 2) **Try a different prey type** â€” switch from rats to mice, or try African Soft Furs. 3) **Check for stress** â€” is the enclosure near high traffic? Ball pythons need seclusion. 4) **Breeding season** â€” adult males often fast Nov-March during breeding season. If he''s otherwise active and maintaining weight, this is likely normal seasonal behavior. See your vet if weight loss exceeds 10%.', 90.0, '["Ball Python Care Guide","Reptile Nutrition Manual"]', 145),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000003', 'user',      'He is a 2-year-old male. Could this be breeding season related?', NULL, '[]', 16),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000003', 'assistant', 'Yes! A 2-year-old male ball python is at prime breeding age. **Breeding season fasting** is extremely common from November through March. Males often refuse food for 2-4 months while seeking a mate. Signs this is breeding-season related: restless behavior, roaming the enclosure at night, refusing food but still drinking water, no weight loss. **Do not force-feed.** Continue offering prey every 10-14 days, and he should resume eating by April. Your vet Dr. Sharma can confirm he''s healthy at his upcoming appointment on March 1.', 94.0, '["Ball Python Breeding Biology","Reptile Veterinary Medicine"]', 132),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000004', 'user',      'Oscar was just diagnosed with Stage 1 IVDD. What exactly does cage rest mean and how long?', NULL, '[]', 20),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000004', 'assistant', '**Cage rest for IVDD** means strictly limiting Oscar''s movement to allow the disc to heal. Here''s your guide: 1) **Duration**: 4-6 weeks minimum. Dr. Carter prescribed 4 weeks. 2) **Space**: A crate just big enough to stand, turn, and lie down. ~24-30 inch crate for a Miniature Dachshund. 3) **NO**: jumping, stairs, rough play, running, being on furniture. 4) **YES**: Carry him outside for bathroom breaks (3-5 min only), gentle short leash walks after week 3 if improving. 5) **At home**: Ramps on ALL furniture permanently. Remove access to stairs. Non-slip flooring. 6) **Medications**: Continue gabapentin 50mg BID and carprofen as prescribed. The good news: Stage 1 IVDD (pain only, no neurological deficits) has an **85-90% recovery rate** with strict conservative management.', 96.0, '["ACVIM IVDD Treatment Guidelines","Dachshund Health Foundation"]', 178),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000005', 'user',      'This is our first lambing season with Merinos. What should I prepare?', NULL, '[]', 15),
  (gen_random_uuid(), 'a8000000-0000-0000-0000-000000000005', 'assistant', 'Congratulations on your first Merino lambing season! Here''s your preparation checklist: **Supplies**: Iodine (7% for navel dipping), clean towels, lamb tube feeder, colostrum replacer (frozen ewe colostrum is best), heat lamps, digital thermometer, lubricant, lambing ropes. **Facility**: Clean and bed the lambing shed deeply with straw. Set up individual lambing jugs (5x5 ft pens) â€” you have a dedicated lambing shed which is perfect. Heat lamps at 18-20Â°C. **Timeline**: For Woolly (due ~April 15): Start monitoring 2 weeks before due date. Watch for udder development, vulvar swelling, behavioral changes (isolating from flock). **Nutrition**: Increase ewe nutrition in last 6 weeks â€” switch to higher energy feed. Provide selenium/vitamin E supplement. **Emergency contacts**: Have Dr. Carter''s emergency number ready. Most Merino lambings are natural, but dystocia rate is ~5-8%.', 88.0, '["Sheep Lambing Guide - Cornell Extension","Merino Breed Standards"]', 195);

-- ============================================================
-- STEP 71: ADDITIONAL SUSTAINABILITY DATA (enterprise 3)
-- ============================================================
INSERT INTO sustainability_metrics (id, enterprise_id, metric_type, metric_name, value, unit, period_start, period_end, category, scope, data_source, recorded_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'ghg_emissions',  'Enteric Methane â€” Sheep & Goats',     1200, 'kgCO2e', '2026-01-01', '2026-01-31', 'emissions',      'scope_1', 'IPCC Tier 1 Sheep Factor', 'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'water_usage',    'Total Farm Water Consumption',       42000, 'liters', '2026-01-01', '2026-01-31', 'water',           'scope_1', 'Well meter readings',      'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'energy',         'Electricity â€” Barn Heating & Lights', 1800, 'kWh',    '2026-01-01', '2026-01-31', 'energy',          'scope_2', 'Utility bill',             'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'waste',          'Manure Composted for Garden Sales',   8500, 'kg',     '2026-01-01', '2026-01-31', 'waste_management','scope_1', 'Farm records',             'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'biodiversity',   'Pasture Species Count',                18,  'species','2026-01-01', '2026-01-31', 'biodiversity',    'scope_1', 'Pasture survey',           'f0000000-0000-0000-0000-000000000003');

INSERT INTO sustainability_goals (id, enterprise_id, goal_name, description, metric_type, target_value, current_value, unit, baseline_value, baseline_date, target_date, status, progress_pct, created_by) VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'Carbon Neutral by 2028', 'Offset all Scope 1 and 2 emissions through composting, tree planting, and renewable energy.',
   'ghg_emissions', 0, 3000, 'kgCO2e/month', 3000, '2026-01-01', '2028-12-31', 'active', 0, 'f0000000-0000-0000-0000-000000000003'),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000003', 'Rotational Grazing Optimization', 'Implement 8-paddock rotational grazing to improve pasture health and reduce overgrazing.',
   'biodiversity', 25, 18, 'species', 15, '2025-06-01', '2027-06-01', 'active', 30, 'f0000000-0000-0000-0000-000000000003');

-- ============================================================
-- STEP 72: LINK EXISTING ANIMALS TO ENTERPRISES (idempotent)
-- ============================================================
UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000001',
  group_id             = 'ab000000-0000-0000-0000-000000000001',
  current_location_id  = '10000000-0000-0000-0000-000000000001',
  ear_tag_id           = 'IA-HF-2021-001',
  current_weight       = 580.0, weight_unit = 'kg',
  last_weighed_at      = '2026-02-01',
  breeding_status      = 'open'
WHERE id = 'aa000000-0000-0000-0000-000000000007' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000001',
  current_location_id  = '10000000-0000-0000-0000-000000000003',
  current_weight       = 520.0, weight_unit = 'kg',
  last_weighed_at      = '2026-02-01',
  breeding_status      = 'active'
WHERE id = 'aa000000-0000-0000-0000-000000000008' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000001',
  group_id             = 'ab000000-0000-0000-0000-000000000002',
  current_location_id  = '10000000-0000-0000-0000-000000000001',
  ear_tag_id           = 'IA-JR-2022-001',
  current_weight       = 420.0, weight_unit = 'kg',
  last_weighed_at      = '2026-02-01',
  breeding_status      = 'bred',
  last_breeding_date   = '2025-09-15',
  expected_due_date    = '2026-03-25'
WHERE id = 'aa000000-0000-0000-0000-000000000009' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000001',
  current_location_id  = '10000000-0000-0000-0000-000000000002',
  current_weight       = 22.0, weight_unit = 'kg',
  last_weighed_at      = '2026-02-01'
WHERE id = 'aa000000-0000-0000-0000-000000000010' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000002',
  current_location_id  = '10000000-0000-0000-0000-000000000007'
WHERE id = 'aa000000-0000-0000-0000-000000000011' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000002',
  current_location_id  = '10000000-0000-0000-0000-000000000008'
WHERE id = 'aa000000-0000-0000-0000-000000000012' AND enterprise_id IS NULL;

UPDATE animals SET
  enterprise_id        = 'e0000000-0000-0000-0000-000000000001',
  group_id             = 'ab000000-0000-0000-0000-000000000001',
  current_location_id  = '10000000-0000-0000-0000-000000000002',
  ear_tag_id           = 'IA-AG-2022-003',
  current_weight       = 680.0, weight_unit = 'kg',
  last_weighed_at      = '2026-01-15',
  breeding_status      = 'active'
WHERE id = 'aa000000-0000-0000-0000-000000000034' AND enterprise_id IS NOT NULL;

UPDATE animals SET
  group_id             = 'ab000000-0000-0000-0000-000000000001',
  current_location_id  = '10000000-0000-0000-0000-000000000002',
  ear_tag_id           = 'IA-HF-2023-035',
  current_weight       = 520.0, weight_unit = 'kg',
  last_weighed_at      = '2026-01-15',
  breeding_status      = 'bred',
  last_breeding_date   = '2025-08-10',
  expected_due_date    = '2026-05-20'
WHERE id = 'aa000000-0000-0000-0000-000000000035';

-- ============================================================
-- STEP 73: MORE ENTERPRISE ANIMALS – GREEN PASTURES DAIRY FARM
-- ============================================================
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, ear_tag_id, registration_number, is_neutered, insurance_provider, insurance_policy_number, insurance_expiry, medical_notes, is_active, unique_id, enterprise_id, group_id, breeding_status, last_breeding_date, expected_due_date, current_weight, weight_unit, last_weighed_at, current_location_id) VALUES
  -- Holstein Milking Herd (group 001)
  ('aa000000-0000-0000-0000-000000000036','f0000000-0000-0000-0000-000000000001','Bessie', 'Cattle','Holstein Friesian','2020-05-12','Female',610.0,'Black/White',NULL,'IA-HF-2020-036','NAAB-HF-2020-039',false,'Farm Bureau Mutual','FB-2025-4401','2027-05-12','Top milk producer – 42L/day. 3rd lactation. Dam of Misty (aa-038).',true,'ANI-COW-036','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','open',  NULL,         NULL,         610.0,'kg','2026-02-10','10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000037','f0000000-0000-0000-0000-000000000001','Clover', 'Cattle','Holstein Friesian','2021-08-22','Female',590.0,'Black/White',NULL,'IA-HF-2021-037','NAAB-HF-2021-043',false,'Farm Bureau Mutual','FB-2025-4402','2027-08-22','2nd lactation. Excellent somatic cell count – <100,000/mL.',true,'ANI-COW-037','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','bred',  '2025-10-05','2026-07-15',590.0,'kg','2026-02-10','10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000038','f0000000-0000-0000-0000-000000000001','Misty',  'Cattle','Holstein Friesian','2022-03-30','Female',545.0,'Black/White',NULL,'IA-HF-2022-038','NAAB-HF-2022-051',false,'Farm Bureau Mutual','FB-2025-4403','2028-03-30','1st calf heifer transitioning. Dam: Bessie. Growth index 110.',true,'ANI-COW-038','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','bred',  '2025-09-20','2026-06-30',545.0,'kg','2026-02-10','10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000039','f0000000-0000-0000-0000-000000000001','Pearl',  'Cattle','Holstein Friesian','2019-11-10','Female',640.0,'Black/White',NULL,'IA-HF-2019-039','NAAB-HF-2019-027',false,'Farm Bureau Mutual','FB-2025-4404','2025-11-10','4th lactation. Dry cow therapy initiated Nov 2025. Due to freshen Apr 2026.',true,'ANI-COW-039','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','bred',  '2025-11-01','2026-04-10',640.0,'kg','2026-02-01','10000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000040','f0000000-0000-0000-0000-000000000001','Flora',  'Cattle','Holstein Friesian','2023-01-14','Female',420.0,'Black/White',NULL,'IA-HF-2023-040',NULL,              false,NULL,            NULL,            NULL,         'Heifer – not yet bred. On heifer development program. Target breed weight 90% achieved.',true,'ANI-COW-040','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000003',NULL,    NULL,         NULL,         420.0,'kg','2026-01-28','10000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000041','f0000000-0000-0000-0000-000000000001','Tara',   'Cattle','Holstein Friesian','2023-04-05','Female',395.0,'Black/White',NULL,'IA-HF-2023-041',NULL,              false,NULL,            NULL,            NULL,         'Heifer – confirmed pregnant by ultrasound. Due Jul 2026.',true,'ANI-COW-041','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000003','bred',  '2025-10-10','2026-07-20',395.0,'kg','2026-01-28','10000000-0000-0000-0000-000000000002'),
  -- Jersey Milking Herd (group 002)
  ('aa000000-0000-0000-0000-000000000042','f0000000-0000-0000-0000-000000000001','Buttercup','Cattle','Jersey',          '2020-07-18','Female',430.0,'Fawn',       NULL,'IA-JR-2020-042','NAAB-JR-2020-088',false,'Farm Bureau Mutual','FB-2025-4405','2026-07-18','Premium cream producer. 6.2% butterfat – best in herd.',true,'ANI-COW-042','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002','open',  NULL,         NULL,         430.0,'kg','2026-02-08','10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000043','f0000000-0000-0000-0000-000000000001','Honey',  'Cattle','Jersey',          '2021-09-03','Female',415.0,'Fawn/White', NULL,'IA-JR-2021-043','NAAB-JR-2021-094',false,'Farm Bureau Mutual','FB-2025-4406','2027-09-03','2nd lactation. Mild mastitis episode Jan 2026 – resolved with intramammary therapy.',true,'ANI-COW-043','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002','bred',  '2025-11-12','2026-08-22',415.0,'kg','2026-02-08','10000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000044','f0000000-0000-0000-0000-000000000001','Maple',  'Cattle','Jersey',          '2022-05-20','Female',388.0,'Fawn',       NULL,'IA-JR-2022-044','NAAB-JR-2022-102',false,NULL,            NULL,            NULL,         '1st lactation. Excellent temperament. Sire: certified A2A2 Jersey bull.',true,'ANI-COW-044','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002','open',  NULL,         NULL,         388.0,'kg','2026-02-08','10000000-0000-0000-0000-000000000001'),
  -- Herd Bull
  ('aa000000-0000-0000-0000-000000000045','f0000000-0000-0000-0000-000000000001','Titan',  'Cattle','Holstein Friesian','2020-02-28','Male',  890.0,'Black/White',NULL,'IA-HF-2020-045','NAAB-HF-2020-B102',false,'Farm Bureau Mutual','FB-2025-4407','2026-02-28','Primary stud bull. NAAB-certified. NM$ +450. Clean BSE certificate Jan 2026.',true,'ANI-COW-045','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','active',NULL,         NULL,         890.0,'kg','2026-02-01','10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Additional enterprise animals for enterprise 2 (Maria Garcia)
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, ear_tag_id, registration_number, is_neutered, medical_notes, is_active, unique_id, enterprise_id, group_id, breeding_status, current_weight, weight_unit, last_weighed_at, current_location_id) VALUES
  ('aa000000-0000-0000-0000-000000000046','f0000000-0000-0000-0000-000000000002','Penny',   'Poultry','Rhode Island Red','2023-06-01','Female',3.4,'Reddish-brown',NULL,'NC-RIR-2023-046',NULL,false,'Production layer. Consistent 5-6 eggs/week. Annual Marek''s vaccine due.',true,'ANI-HEN-046','e0000000-0000-0000-0000-000000000002',NULL,'active',3.4,'kg','2026-01-15','10000000-0000-0000-0000-000000000007'),
  ('aa000000-0000-0000-0000-000000000047','f0000000-0000-0000-0000-000000000002','Nelly',   'Goat',   'Saanen',         '2023-02-14','Female',60.0,'White',       NULL,'NC-SAA-2023-047','ADGA-SA-2023-4421',false,'1st freshening – producing 2.8L/day. Progressing well.',true,'ANI-GOT-047','e0000000-0000-0000-0000-000000000002',NULL,'open',60.0,'kg','2026-02-01','10000000-0000-0000-0000-000000000008'),
  ('aa000000-0000-0000-0000-000000000048','f0000000-0000-0000-0000-000000000002','Billy',   'Goat',   'Boer',           '2022-11-05','Male',  82.0,'White/Brown', NULL,'NC-BOR-2022-048',NULL,              false,'Meat breed buck. Good conformation. Used for crossbreeding with Saanen does.',true,'ANI-GOT-048','e0000000-0000-0000-0000-000000000002',NULL,'active',82.0,'kg','2026-01-20','10000000-0000-0000-0000-000000000008'),
  ('aa000000-0000-0000-0000-000000000049','f0000000-0000-0000-0000-000000000002','Duchess', 'Poultry','Rhode Island Red','2023-06-01','Female',3.3,'Reddish-brown',NULL,'NC-RIR-2023-049',NULL,false,'Flock bird. Good egg quality – grade A. Healthy.',true,'ANI-HEN-049','e0000000-0000-0000-0000-000000000002',NULL,'active',3.3,'kg','2026-01-15','10000000-0000-0000-0000-000000000007')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 74: MEDICAL RECORDS FOR ENTERPRISE ANIMALS
-- ============================================================
INSERT INTO medical_records (id, user_id, animal_id, consultation_id, veterinarian_id, record_number, record_type, title, content, severity, status, medications, is_confidential, follow_up_date, tags, created_by) VALUES
  -- Green Pastures (enterprise 1) animals
  ('ff000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000036',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00006','diagnosis','Annual Wellness – Bessie (Holstein)',
   'Complete physical exam: BCS 3.5/5, temperature 38.6°C, HR 64bpm, good rumen motility. Hoof scoring 1/5 (excellent). Milk production 42L/day. CBC within normal limits. No respiratory, reproductive, or lameness issues. Udder health excellent – SCC 85,000/mL.',
   'normal','active','[]',false,'2027-02-01',ARRAY['bovine','wellness','dairy'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000007','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00007','diagnosis','Mastitis Treatment – Honey (Jersey)',
   'Quarter screening revealed elevated SCC in right rear quarter (1.2M/mL). CMT test 3+. Bacteria culture: Staphylococcus aureus. Intramammary infusion of cloxacillin initiated for 3 days. Milking management reviewed. Recommend dry cow therapy evaluation at end of lactation. Follow-up SCC in 2 weeks.',
   'high','active','[{"name":"Cloxacillin","dosage":"500mg/tube","frequency":"BID x3 days","duration":"3 days","instructions":"Intramammary – strip quarter prior"}]',
   false,'2026-03-01',ARRAY['bovine','mastitis','udder-health'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000008','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000039',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00008','follow_up','Dry Cow Monitoring – Pearl',
   'Pearl entered dry period Nov 2025. Dry cow therapy applied (Orbenin Extra). BCS at dry-off 3.8/5 – ideal. Udder showing normal involution. No signs of clinical mastitis. Colostrum quality expected to be high. Target freshening: April 10, 2026. Calving barn prepared.',
   'normal','active','[{"name":"Orbenin Extra","dosage":"one tube per quarter","frequency":"Single dose at dry-off","duration":"One time","instructions":"Administered at dry-off Nov 1"}]',
   false,'2026-04-10',ARRAY['bovine','dry-cow','transition'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000045',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00009','diagnosis','Annual BSE – Titan (Holstein Bull)',
   'Breeding soundness evaluation (BSE): motility 75% (pass > 70%), morphology 82% (pass > 70%), concentration 1.4B/mL. Physical: body condition 3.0/5. Hoof care done – slight overgrowth right rear hoof addressed. Testosterone levels normal. Libido score 5/5. Certified satisfactory potential breeder for 2026 season.',
   'normal','active','[]',false,'2027-01-15',ARRAY['bovine','bull','bse','reproduction'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000010','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000007',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00010','diagnosis','Subclinical Ketosis Follow-Up – Daisy',
   'Follow-up visit 10 days after initial diagnosis. BHB now 0.6 mmol/L (normal < 1.0). Milk production recovered to 36L/day. Appetite normal. Propylene glycol drench completed x5 days. Energy balance improving. Recommend monitoring BHB monthly for remainder of lactation. Consider rumen buffer supplementation.',
   'normal','active','[]',false,'2026-04-01',ARRAY['bovine','ketosis','metabolic'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000011','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000037',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00011','vaccination','Annual Vaccination Record – Clover',
   'Annual vaccination completed: IBR/BVD/PI3 combination vaccine + leptospirosis 5-way. Also administered: Bovilis Scour + rotavirus booster. Clostridial 7-way updated. No adverse reactions. See vaccination record for lot numbers.',
   'normal','active','[]',false,NULL,ARRAY['bovine','vaccination','preventive'],'b0000000-0000-0000-0000-000000000001'),

  -- Enterprise 2 (Sunrise Farm - Maria Garcia) medical records
  ('ff000000-0000-0000-0000-000000000012','f0000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000012',NULL,'b0000000-0000-0000-0000-000000000003',
   'MR-2026-00012','diagnosis','CAE Status Test – Bella (Saanen)',
   'Caprine Arthritis Encephalitis (CAE) serology: ELISA negative. Critical for maintaining CAE-negative herd status for premium milk sales. Test valid for 12 months. Hooves trimmed – mild overgrowth right rear. FAMACHA score 2 (acceptable). Worming not required at this time. Continue selenium supplementation.',
   'normal','active','[]',false,'2027-01-20',ARRAY['caprine','cae','infectious-disease'],'b0000000-0000-0000-0000-000000000003'),

  ('ff000000-0000-0000-0000-000000000013','f0000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000047',NULL,'b0000000-0000-0000-0000-000000000003',
   'MR-2026-00013','diagnosis','First Freshening Assessment – Nelly',
   'Nelly freshened naturally on Jan 28, 2026 with single buckling. Easy kidding – no intervention. Colostrum banked within 1 hour. Milk production at day 14: 2.8L/day, improving. Udder attachment excellent, no mastitis. Kid (not in system) sold at 3 weeks. Recommend re-breeding for second kidding by May 2026.',
   'normal','active','[]',false,'2026-04-15',ARRAY['caprine','freshening','reproduction'],'b0000000-0000-0000-0000-000000000003'),

  -- Enterprise 3 (Green Meadows - Thomas Green) medical records
  ('ff000000-0000-0000-0000-000000000014','f0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000027',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00014','diagnosis','Pre-Lambing Check – Woolly (Merino)',
   'Pre-lambing examination: BCS 3.5/5 (optimal for late pregnancy). Twin lambs confirmed by ultrasound on Jan 15. Udder development good. Vaginal tone 1/3 – approximately 3 weeks from lambing. Administered closantel for liver fluke prophylaxis. Bar VACC booster given for C. perfringens. Lambing kit assembled.',
   'normal','active','[{"name":"Closantel","dosage":"2.5mL SC","frequency":"Single dose","duration":"One time","instructions":"Pre-lambing liver fluke prevention"}]',
   false,'2026-04-15',ARRAY['ovine','lambing','reproduction'],'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000015','f0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000030',NULL,'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00015','surgery','Routine Castration & Ear Notching – Wilbur litter',
   'Castration of Yorkshire boar piglets at 3 days post-farrowing using open technique. 12 piglets processed. Iron dextran injections administered. Ear notching for litter identification. All procedures using good hygiene and minimal stress handling. Post-op: no complications. Dam (Charlotte) doing well.',
   'normal','active','[]',false,NULL,ARRAY['porcine','surgery','piglet','management'],'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 75: VACCINATION RECORDS FOR ENTERPRISE ANIMALS
-- ============================================================
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, certificate_number, reaction_notes, is_valid) VALUES
  -- Enterprise 1 cattle
  ('vr000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000036','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2026-01-15','2027-01-15','5mL IM','TRI10-2026-4401','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B036-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000036','Leptospirosis 5-way (Spirovac)','Core Cattle','2026-01-15','2027-01-15','4mL SC','SPV5-2026-9912','Zoetis','b0000000-0000-0000-0000-000000000001','BVAX-2026-B036-B',NULL,true),
  ('vr000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000036','Clostridial 7-way (Vision 7)','Core Cattle','2026-01-15','2027-01-15','2mL SC','VIS7-2026-3301','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B036-C',NULL,true),
  ('vr000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000037','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2026-01-15','2027-01-15','5mL IM','TRI10-2026-4401','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B037-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000005','aa000000-0000-0000-0000-000000000037','Leptospirosis 5-way (Spirovac)','Core Cattle','2026-01-15','2027-01-15','4mL SC','SPV5-2026-9912','Zoetis','b0000000-0000-0000-0000-000000000001','BVAX-2026-B037-B',NULL,true),
  ('vr000000-0000-0000-0000-000000000006','aa000000-0000-0000-0000-000000000038','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2026-01-15','2027-01-15','5mL IM','TRI10-2026-4401','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B038-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000007','aa000000-0000-0000-0000-000000000038','Clostridial 7-way (Vision 7)','Core Cattle','2026-01-15','2027-01-15','2mL SC','VIS7-2026-3301','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B038-B',NULL,true),
  ('vr000000-0000-0000-0000-000000000008','aa000000-0000-0000-0000-000000000039','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2025-11-01','2026-11-01','5mL IM','TRI10-2025-3892','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2025-B039-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000009','aa000000-0000-0000-0000-000000000045','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2026-01-10','2027-01-10','5mL IM','TRI10-2026-4401','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B045-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000010','aa000000-0000-0000-0000-000000000045','Clostridial 7-way (Vision 7)','Core Cattle','2026-01-10','2027-01-10','2mL SC','VIS7-2026-3301','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2026-B045-B',NULL,true),
  -- Heifers - overdue vaccines
  ('vr000000-0000-0000-0000-000000000011','aa000000-0000-0000-0000-000000000040','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2025-06-01','2026-06-01','5mL IM','TRI10-2025-2210','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2025-B040-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000012','aa000000-0000-0000-0000-000000000041','IBR/BVD/PI3 Combination (Triangle 10)','Core Cattle','2025-07-15','2026-07-15','5mL IM','TRI10-2025-2510','Merck Animal Health','b0000000-0000-0000-0000-000000000001','BVAX-2025-B041-A',NULL,true),
  -- Enterprise 2 goats
  ('vr000000-0000-0000-0000-000000000013','aa000000-0000-0000-0000-000000000012','CDT (C. perfringens + Tetanus)','Core Goat','2026-01-20','2027-01-20','2mL SC','CDT-2026-5521','Colorado Serum','b0000000-0000-0000-0000-000000000003','GVAX-2026-B012-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000014','aa000000-0000-0000-0000-000000000012','Soremouth (Orf) Vaccine','Non-Core Goat','2026-01-20','2027-01-20','scarification','ORF-2026-6612','Colorado Serum','b0000000-0000-0000-0000-000000000003','GVAX-2026-B012-B','Mild local reaction at scarification site – resolved in 3 days.',true),
  ('vr000000-0000-0000-0000-000000000015','aa000000-0000-0000-0000-000000000047','CDT (C. perfringens + Tetanus)','Core Goat','2026-01-20','2027-01-20','2mL SC','CDT-2026-5521','Colorado Serum','b0000000-0000-0000-0000-000000000003','GVAX-2026-B047-A',NULL,true),
  -- Enterprise 3 sheep
  ('vr000000-0000-0000-0000-000000000016','aa000000-0000-0000-0000-000000000027','Ovivac-P Plus (Clostridial 5-way)','Core Sheep','2026-01-10','2027-01-10','2mL SC','OVP-2026-8801','MSD Animal Health','b0000000-0000-0000-0000-000000000001','SVAX-2026-S027-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000017','aa000000-0000-0000-0000-000000000027','Footvax (Footrot)','Sheep-specific','2025-12-01','2026-06-01','1mL SC','FTV-2025-4401','MSD Animal Health','b0000000-0000-0000-0000-000000000001','SVAX-2025-S027-B',NULL,true),
  ('vr000000-0000-0000-0000-000000000018','aa000000-0000-0000-0000-000000000028','Ovivac-P Plus (Clostridial 5-way)','Core Sheep','2026-01-10','2027-01-10','2mL SC','OVP-2026-8801','MSD Animal Health','b0000000-0000-0000-0000-000000000001','SVAX-2026-S028-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000019','aa000000-0000-0000-0000-000000000029','Ovivac-P Plus (Clostridial 5-way)','Core Sheep','2026-01-10','2027-01-10','2mL SC','OVP-2026-8801','MSD Animal Health','b0000000-0000-0000-0000-000000000001','SVAX-2026-S029-A',NULL,true),
  -- Enterprise 3 pigs
  ('vr000000-0000-0000-0000-000000000020','aa000000-0000-0000-0000-000000000030','PRRS (Ingelvac PRRS MLV)','Core Swine','2026-01-05','2027-01-05','2mL IM','PRRS-2026-1122','Boehringer Ingelheim','b0000000-0000-0000-0000-000000000001','PVAX-2026-P030-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000021','aa000000-0000-0000-0000-000000000031','PRRS (Ingelvac PRRS MLV)','Core Swine','2026-01-05','2027-01-05','2mL IM','PRRS-2026-1122','Boehringer Ingelheim','b0000000-0000-0000-0000-000000000001','PVAX-2026-P031-A',NULL,true),
  ('vr000000-0000-0000-0000-000000000022','aa000000-0000-0000-0000-000000000031','Parvovirus + Erysipelas (FarmuneDAE)','Core Swine','2026-01-05','2027-01-05','2mL IM','FDE-2026-5310','Zoetis','b0000000-0000-0000-0000-000000000001','PVAX-2026-P031-B',NULL,true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 76: ALLERGY RECORDS FOR ENTERPRISE ANIMALS
-- ============================================================
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by) VALUES
  ('ar000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','Penicillin G (injectable)','Local swelling and wheal formation at injection site; mild urticaria on neck','high','2025-08-15',true,'Reaction occurred within 15 minutes of IM penicillin. Treated with epinephrine and dexamethasone. Avoid all penicillin-class antibiotics. Use cephalosporins or fluoroquinolones as alternatives.','b0000000-0000-0000-0000-000000000003'),
  ('ar000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000027','Ivermectin (injectable formulation)','Transient neurological signs – ataxia, head pressing for 4 hours post-injection','normal','2025-06-20',true,'Possible breed sensitivity (some Merino lines have MDR1-like sensitivity). Switched to doramectin at reduced dose. No further reactions.','b0000000-0000-0000-0000-000000000001'),
  ('ar000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000007','Amoxicillin-Clavulanate (oral)','Diarrhea and reduced feed intake lasting 5 days','normal','2025-03-10',false,'Mild GI reaction. Resolved on discontinuation. Not life-threatening. Document for reference.','b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 77: LAB RESULTS FOR ENTERPRISE ANIMALS
-- ============================================================
INSERT INTO lab_results (id, animal_id, consultation_id, test_name, test_category, test_date, result_value, normal_range, unit, is_abnormal, interpretation, status, lab_name, ordered_by, notes) VALUES
  ('lr000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000036',NULL,'Milk SCC (Somatic Cell Count)','Udder Health','2026-02-10','85000','< 200,000','cells/mL',false,'Excellent udder health – well below threshold. Continue current management.','completed','Green Pastures On-Farm Lab','b0000000-0000-0000-0000-000000000001',NULL),
  ('lr000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000043',NULL,'Milk SCC (Somatic Cell Count)','Udder Health','2026-01-25','1200000','< 200,000','cells/mL',true,'Markedly elevated SCC consistent with clinical mastitis. Confirms right rear quarter infection. See medical record MR-2026-00007.','completed','Green Pastures On-Farm Lab','b0000000-0000-0000-0000-000000000001','California Mastitis Test (CMT) 3+ confirmed'),
  ('lr000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000043',NULL,'Milk Culture & Sensitivity','Udder Health','2026-01-25','Staphylococcus aureus – susceptible to cephalosporins, resistant to penicillin','See report','N/A',true,'S. aureus mastitis. Penicillin resistance correlates with Honey''s known penicillin allergy. Use cephalosporin-based dry cow therapy at next dry-off.','completed','Iowa Vet Diagnostics','b0000000-0000-0000-0000-000000000001','Susceptibility: cefoperazone S, cephalexin S, cloxacillin I, penicillin R'),
  ('lr000000-0000-0000-0000-000000000004','aa000000-0000-0000-0000-000000000039',NULL,'Blood Ketone (BHB)','Chemistry','2025-11-01','0.4','0.2-1.0','mmol/L',false,'Normal BHB at dry-off. No subclinical ketosis. Good energy reserves entering dry period.','completed','Iowa Vet Diagnostics','b0000000-0000-0000-0000-000000000001','Tested at dry-off'),
  ('lr000000-0000-0000-0000-000000000005','aa000000-0000-0000-0000-000000000007',NULL,'Blood Ketone (BHB) Follow-Up','Chemistry','2026-03-01','0.6','0.2-1.0','mmol/L',false,'BHB normalized. Recovery from subclinical ketosis complete. No further treatment needed.','completed','Iowa Vet Diagnostics','b0000000-0000-0000-0000-000000000001','Follow-up from MR-2026-00010'),
  ('lr000000-0000-0000-0000-000000000006','aa000000-0000-0000-0000-000000000045',NULL,'Breeding Soundness Evaluation – Semen Analysis','Reproduction','2026-01-10','Motility 75%, Morphology 82%, Conc 1.4B/mL','Motility > 70%, Morph > 70%, Conc > 0.5B/mL','N/A',false,'Satisfactory potential breeder (SPB). All criteria met. Licensed for 2026 breeding season.','completed','Iowa Vet Diagnostics','b0000000-0000-0000-0000-000000000001','BSE report on file'),
  ('lr000000-0000-0000-0000-000000000007','aa000000-0000-0000-0000-000000000012',NULL,'CAE (Caprine Arthritis Encephalitis) ELISA','Infectious Disease','2026-01-20','Negative','Negative','N/A',false,'No CAE antibodies detected. Herd maintains CAE-negative status for ADGA certification.','completed','NC State CVM Diagnostic Lab','b0000000-0000-0000-0000-000000000003',NULL),
  ('lr000000-0000-0000-0000-000000000008','aa000000-0000-0000-0000-000000000027',NULL,'FAMACHA Score + Fecal Egg Count','Parasitology','2026-01-10','FAMACHA 2; FEC 350 EPG','FAMACHA 1-2; FEC < 500 EPG','N/A',false,'Acceptable parasite burden. No deworming currently required. Re-check in 6 weeks.','completed','Vermont Sheep & Goat Lab','b0000000-0000-0000-0000-000000000001','FAMACHA score of 2 = slightly pale conjunctiva')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 78: MORE HEALTH OBSERVATIONS FOR ALL ENTERPRISES
-- ============================================================
INSERT INTO health_observations (id, enterprise_id, animal_id, observer_id, observation_type, severity, title, description, body_temperature, heart_rate, respiratory_rate, symptoms, is_resolved, resolved_at) VALUES
  ('ho000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','f0000000-0000-0000-0000-000000000001','clinical','high','Mastitis – Honey (Right Rear Quarter)','Owner observed swelling and heat in right rear quarter. CMT test positive 3+. Reduced milk output from that quarter. Elevated SCC on prior milk test. Veterinarian notified immediately.',38.9,72,24,'Mammary swelling, heat, pain on palpation, watery secretion, reduced milk',false,NULL),
  ('ho000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000039','f0000000-0000-0000-0000-000000000001','behavioral','normal','Pre-Calving Restlessness – Pearl','Animal showing signs of imminent calving: udder filling, vulval relaxation score 2/3, pelvic ligaments relaxed. Moved to calving pen. Close monitoring initiated - check every 2 hours.',38.7,68,20,'Restless pacing, tail-head ligament relaxation, mammary engorgement',false,NULL),
  ('ho000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000001','clinical','high','Subclinical Ketosis – Daisy','Milk production down 30% over 2 days. Slight ketotic smell on breath. Urine ketone strip 2+. BHB confirmed elevated at 1.8 mmol/L. Initiated propylene glycol therapy and IV dextrose.',39.8,76,28,'Reduced feed intake, reduced milk production, ketotic odor, dull demeanor',true,'2026-02-28'),
  ('ho000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000012','f0000000-0000-0000-0000-000000000002','clinical','normal','Minor Hoof Overgrowth – Bella','Routine inspection revealed mild overgrowth of all 4 hooves. No lameness or foot rot. Trimming scheduled with mobile farrier. FAMACHA score 2. Condition score good.',38.6,80,22,'Mild hoof overgrowth, no lameness',true,'2026-01-20'),
  ('ho000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000027','f0000000-0000-0000-0000-000000000003','clinical','normal','Wool Break Check – Woolly','Pre-lambing wool evaluation. Fleece staple length 82mm. No significant wool break (stress fiber). Minimal vegetable matter contamination. Grade: fine fleece, 18 micron estimate. Expected shearing weight: 5.2 kg. Clipping schedule set for post-lambing.',38.8,82,26,'Wool evaluation – no clinical issues',true,'2026-01-25'),
  ('ho000000-0000-0000-0000-000000000015','e0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000031','f0000000-0000-0000-0000-000000000003','reproductive','normal','Charlotte Pre-Farrowing Check','Sow showing nesting behavior and udder development indicating farrowing within 24 hours. Temperature dropped 0.8°C from baseline (farrowing sign). Moving to farrowing crate. Iron dextran prepared for piglets. Oxytocin on standby.',38.4,90,24,'Nesting behavior, udder engorgement, temperature drop',false,NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 79: MORE TREATMENT CAMPAIGNS (comprehensive data)
-- ============================================================
INSERT INTO treatment_campaigns (id, enterprise_id, group_id, campaign_type, name, description, product_used, dosage, target_count, completed_count, status, scheduled_date, started_at, completed_at, administered_by, cost, notes) VALUES
  ('tc000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','vaccination','Spring Cattle Vaccination Program 2026','Annual IBR/BVD/PI3 + Leptospirosis 5-way for entire Holstein milking herd. Pre-breeding vaccination to ensure reproductive immunity.','Triangle 10 + Spirovac 5','5mL IM + 4mL SC',42,42,'completed','2026-01-15','2026-01-15 09:00:00','2026-01-15 16:30:00','b0000000-0000-0000-0000-000000000001',840.00,'All 42 cows completed in one day. No adverse reactions. Records filed per USDA requirements.'),
  ('tc000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000001','deworming','Periparturient Deworming – Pre-Calving Cows','Strategic deworming of cows 2-4 weeks prior to calving using macrocyclic lactones to reduce periparturient worm egg rise.','Dectomax Pour-On','0.5mL/10kg body weight topically',12,10,'in_progress','2026-02-01','2026-02-01 08:00:00',NULL,'f0000000-0000-0000-0000-000000000001',180.00,'2 cows still to be treated – awaiting calving confirmation for Pearl and Clover.'),
  ('tc000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002','hoof_care','Spring Hoof Trimming – Jersey Herd','Scheduled functional hoof trimming for Jersey milking herd to prevent lameness. Professional hoof trimmer engaged.','Professional Hoof Trim','N/A',15,15,'completed','2026-01-25','2026-01-25 07:00:00','2026-01-25 14:00:00','f0000000-0000-0000-0000-000000000001',750.00,'All 15 Jerseys trimmed. 3 cows had minor lesions dressed. Lameness score average improved from 2.1 to 1.3.'),
  ('tc000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000002',NULL,'vaccination','Q1 2026 Poultry Health Protocol','Quarterly vaccination and deworming program for all laying flocks. Marek''s, Newcastle, IBD boosters.','Marek''s + ND + IBD combo','per label IM/eye drop',150,150,'completed','2026-01-10','2026-01-10 07:00:00','2026-01-10 12:00:00','b0000000-0000-0000-0000-000000000003',420.00,'Entire flock vaccinated without incident. Egg production maintained at 94% during event.'),
  ('tc000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','ab000000-0000-0000-0000-000000000006','deworming','Pre-Lambing Targeted Selective Treatment (TST)','FAMACHA-guided deworming of Merino ewes with FAMACHA score 3+ prior to lambing to prevent barber''s pole worm impact on neonates.','Oral Moxidectin (Cydectin 0.1%)','0.2mg/kg bodyweight PO',12,12,'completed','2026-01-14','2026-01-14 09:00:00','2026-01-14 11:00:00','b0000000-0000-0000-0000-000000000001',132.00,'12 of 42 ewes treated (FAMACHA 3+). Drench resistance check scheduled for May 2026.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 80: MORE BREEDING RECORDS (all fields populated)
-- ============================================================
INSERT INTO breeding_records (id, enterprise_id, dam_id, sire_id, breeding_method, breeding_date, expected_due_date, status, technician_id, pregnancy_confirmed, pregnancy_check_date, notes) VALUES
  ('br000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000037','aa000000-0000-0000-0000-000000000045','ai','2025-10-05','2026-07-15','confirmed','b0000000-0000-0000-0000-000000000001',true,'2025-11-15','AI performed by Dr. Carter using Titan''s semen. Pregnancy confirmed by rectal palpation at 6 weeks. Strong single embryo. Projected calving Jul 2026.'),
  ('br000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000038','aa000000-0000-0000-0000-000000000045','ai','2025-09-20','2026-06-30','confirmed','b0000000-0000-0000-0000-000000000001',true,'2025-11-02','Misty''s first breeding. AI with Titan''s semen. Twin embryos at first check – one resorbed at 8 weeks. Single healthy calf expected Jun 30.'),
  ('br000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000009','aa000000-0000-0000-0000-000000000045','natural','2025-09-15','2026-03-25','confirmed','f0000000-0000-0000-0000-000000000001',true,'2025-10-20','Rosie bred naturally with Titan. First AI failed so switched to natural service. Pregnancy confirmed at 5 weeks via ultrasound.'),
  ('br000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','aa000000-0000-0000-0000-000000000045','ai','2025-11-12','2026-08-22','confirmed','b0000000-0000-0000-0000-000000000001',true,'2025-12-20','Honey to calve August 2026. Conception rate achieved on second AI attempt. Following mastitis resolution.'),
  ('br000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000027','aa000000-0000-0000-0000-000000000028','natural','2025-11-15','2026-04-15','confirmed','f0000000-0000-0000-0000-000000000003',true,'2025-12-10','Woolly bred with Baxter (Suffolk ram). Twins confirmed by ultrasound Dec 10. Excellent gestation progress. Lambing kit prepared.'),
  ('br000000-0000-0000-0000-000000000015','e0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000031',NULL,'natural','2025-12-10','2026-04-08','confirmed','f0000000-0000-0000-0000-000000000003',true,'2026-01-05','Charlotte bred with commercial Yorkshire boar (external service). Single litter confirmed. Farrowing crate prepared. Expected litter size 10-12.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 81: MORE FINANCIAL RECORDS (all categories)
-- ============================================================
INSERT INTO financial_records (id, enterprise_id, record_type, category, description, amount, currency, transaction_date, recorded_by, notes) VALUES
  -- Enterprise 1 income
  ('fr000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','income',  'milk_sales',   'February Bulk Milk Sales – Dairy Partners Cooperative',     28400.00,'USD','2026-02-28','f0000000-0000-0000-0000-000000000001','42 cows × avg 38L/day × 28 days × $0.64/L incentive pricing'),
  ('fr000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','income',  'milk_sales',   'January Bulk Milk Sales – Dairy Partners Cooperative',      26800.00,'USD','2026-01-31','f0000000-0000-0000-0000-000000000001','Slight dip due to Daisy illness. 42 cows avg 36L/day × 31 days × $0.61/L'),
  ('fr000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','income',  'cheese_sales', 'Artisan Cheese Sales – Green Pastures Farmers Market',       3840.00,'USD','2026-02-28','f0000000-0000-0000-0000-000000000001','48 kg aged cheddar @ $80/kg. February market'),
  ('fr000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000001','expense', 'feed',         'TMR Mix Components – Morrison Prairie Feed Co',            -8200.00,'USD','2026-02-15','f0000000-0000-0000-0000-000000000001','Corn silage, alfalfa hay, distillers grain, mineral mix for February'),
  ('fr000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000001','expense', 'veterinary',   'Herd Health Services – Dr. James Carter Feb 2026',          -2100.00,'USD','2026-02-20','f0000000-0000-0000-0000-000000000001','2 farm visits, ketosis treatment, mastitis treatment, pregnancy checks, BSE evaluation'),
  ('fr000000-0000-0000-0000-000000000015','e0000000-0000-0000-0000-000000000001','expense', 'labor',        'Farm Staff Wages – February 2026',                          -9600.00,'USD','2026-02-28','f0000000-0000-0000-0000-000000000001','Tom Wilson + 3 part-time workers. Includes overtime for calving season coverage'),
  ('fr000000-0000-0000-0000-000000000016','e0000000-0000-0000-0000-000000000001','expense', 'equipment',    'Milking Machine Maintenance & Parts – AgroTech Services',   -1450.00,'USD','2026-02-10','f0000000-0000-0000-0000-000000000001','Annual maintenance contract + pulsator replacement'),
  -- Enterprise 2 income/expense
  ('fr000000-0000-0000-0000-000000000017','e0000000-0000-0000-0000-000000000002','income',  'egg_sales',    'January Egg Sales – Local Grocery + Farmers Market',         2880.00,'USD','2026-01-31','f0000000-0000-0000-0000-000000000002','150 hens × avg 5.5 eggs/week × 4.3 weeks × $0.72/egg (market premium)'),
  ('fr000000-0000-0000-0000-000000000018','e0000000-0000-0000-0000-000000000002','income',  'cheese_sales', 'Artisan Goat Cheese Sales – Jan 2026',                       1920.00,'USD','2026-01-31','f0000000-0000-0000-0000-000000000002','24 lb fresh chèvre + 6 lb aged crottin @ premium organic pricing'),
  ('fr000000-0000-0000-0000-000000000019','e0000000-0000-0000-0000-000000000002','expense', 'feed',         'Layer Feed + Goat Mineral Supplement – Jan/Feb',           -1680.00,'USD','2026-02-05','f0000000-0000-0000-0000-000000000002','Purina Layena + Goat Mineral 12% + Selenium supplement'),
  -- Enterprise 3 income/expense
  ('fr000000-0000-0000-0000-000000000020','e0000000-0000-0000-0000-000000000003','income',  'wool_sales',   'Merino Fleece Auction – Vermont Wool Exchange',              6240.00,'USD','2026-01-20','f0000000-0000-0000-0000-000000000003','48 fleeces × avg 4.8 kg × $27/kg premium fine wool'),
  ('fr000000-0000-0000-0000-000000000021','e0000000-0000-0000-0000-000000000003','income',  'livestock_sales','Heritage Pork – Restaurant & Specialty Butcher Sales',    4800.00,'USD','2026-02-15','f0000000-0000-0000-0000-000000000003','2 Berkshire hogs × $2,400 each to specialty butcher'),
  ('fr000000-0000-0000-0000-000000000022','e0000000-0000-0000-0000-000000000003','expense', 'veterinary',   'Herd Health & Pre-Lambing Vet Services – Feb 2026',        -1850.00,'USD','2026-02-20','f0000000-0000-0000-0000-000000000003','Pre-lambing exams, TST deworming, ultrasound pregnancy checks, piglet procedures')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 82: MORE COMPLIANCE DOCUMENTS (all statuses)
-- ============================================================
INSERT INTO compliance_documents (id, enterprise_id, document_type, title, description, reference_number, issued_date, expiry_date, issuing_authority, status, verified_by, verified_at, is_active) VALUES
  ('cd000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','organic_cert','USDA Organic Certification – Green Pastures Dairy Farm','Annual organic certification covering all milk production, feed, pasture, and input materials. NOP compliant.','USDA-ORG-IA-2026-0482','2026-01-01','2026-12-31','USDA National Organic Program','active','a0000000-0000-0000-0000-000000000001','2026-01-05',true),
  ('cd000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','animal_welfare','Certified Humane® Raised & Handled – Dairy Cattle','Third-party animal welfare audit certification for all dairy cow housing, handling, feeding, and management practices.','CH-2026-IA-004821','2026-02-15','2027-02-14','Humane Farm Animal Care (HFAC)','active','a0000000-0000-0000-0000-000000000001','2026-02-20',true),
  ('cd000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','fda_registration','FDA Food Facility Registration – Fluid Milk & Cheese','Biennial renewal of FDA food facility registration for on-farm cheese processing and fluid milk tank.','FDA-FFR-IA-2024-88821','2024-10-01','2026-12-31','U.S. Food & Drug Administration','expiring','a0000000-0000-0000-0000-000000000001','2024-10-05',true),
  ('cd000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000002','food_safety','USDA GAP (Good Agricultural Practices) Audit – Egg Production','Annual third-party food safety audit for egg handling, collection, grading, and packing.','USDA-GAP-NC-2025-0071','2025-09-15','2026-09-14','USDA Agricultural Marketing Service','active','a0000000-0000-0000-0000-000000000001','2025-09-20',true),
  ('cd000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000002','organic_cert','USDA Organic Certification – Goat Milk & Cheese','Organic certification for all goat milk and cheese production including feed, pasture, and health management.','USDA-ORG-NC-2026-1193','2026-01-01','2026-12-31','USDA National Organic Program','active','a0000000-0000-0000-0000-000000000001','2026-01-08',true),
  ('cd000000-0000-0000-0000-000000000015','e0000000-0000-0000-0000-000000000003','animal_welfare','Animal Welfare Approved – Dairy Sheep & Heritage Pigs','AWA certification for Green Meadows covering outdoor access, humane treatment, slaughter practices for all certified species.','AWA-VT-2026-0331','2026-01-15','2027-01-14','A Greener World (AWA)','active','a0000000-0000-0000-0000-000000000001','2026-01-20',true),
  ('cd000000-0000-0000-0000-000000000016','e0000000-0000-0000-0000-000000000003','state_license','Vermont Agency of Agriculture – Livestock Dealer License','State license required for movement and sale of sheep and pigs. Includes premises identification number.','VT-AAFM-LIC-2026-0331','2026-01-01','2026-12-31','Vermont Agency of Agriculture, Food and Markets','active','a0000000-0000-0000-0000-000000000001','2026-01-05',true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 83: MORE WORKFORCE TASKS & SHIFT SCHEDULES
-- ============================================================
INSERT INTO workforce_tasks (id, enterprise_id, title, description, task_type, priority, status, assigned_to, created_by, location_id, checklist, due_date, estimated_hours, notes) VALUES
  ('wt000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','Prepare Calving Pen for Pearl','Deep clean and bed calving pen with fresh straw. Set up heat lamp, colostrum kit, and calving supplies. Post calving protocol checklist on barn wall.','facility','high','in_progress','f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','["Clean and disinfect pen","Lay deep straw bedding 6 inches","Install heat lamp and test","Prepare calving kit (lubricant, ropes, iodine)","Stock colostrum replacer","Post calving checklist"]','2026-04-05',3.0,'Pearl is 14 days from due date. Calving pen should be ready by April 5 at latest.'),
  ('wt000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','Monthly Milk Production Report','Compile and submit February milk production data to Dairy Partners Cooperative. Include individual cow production, SCC results, and butterfat/protein percentages.','reporting','normal','completed','f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001',NULL,'["Download DHIA herd test data","Calculate monthly totals per cow","Record SCC data by quarter","Compute butterfat and protein averages","Submit via cooperative portal","File physical copy"]','2026-03-05',2.0,NULL),
  ('wt000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','Morning Milking – West Parlor (Feb 15)','Complete morning milking for Holstein and Jersey milking herds. Verify milk weights, flag any SCC alerts, record strip test results.','routine','normal','completed','f0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','["Pre-dip all teats","Attach milking units sequentially","Monitor flow rates and auto-detach","Post-dip and check teat condition","Record individual milk weights in DHIA","Note any abnormal secretions"]','2026-02-15',3.5,NULL),
  ('wt000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000002','Q1 Egg Grading & Market Packing','Grade and pack February farmer market eggs into 1-dozen cartons. Maintain cold chain documentation for GAP audit compliance.','processing','normal','completed','f0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000009','["Collect eggs from all nest boxes","Grade by size (Jumbo/XL/L)","Discard cracked or soiled eggs","Pack in clean cartons with GAP stamp","Log date, candler ID, worker ID","Refrigerate at 45°F within 1 hour"]','2026-02-28',4.0,NULL),
  ('wt000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','Pre-Lambing Shed Preparation','Clean and prepare lambing shed for Merino ewes. Estimated 12 ewes to lamb in April. Set up individual lambing jugs.','facility','high','in_progress','f0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000012','["Power wash floor and walls","Apply lime to floor","Set up 5 individual lambing jugs 5x5ft","Install heat lamps","Stock lambing supplies (iodine, tube feeder, colostrum)","Post 24h watch schedule on door"]','2026-03-25',6.0,'First-time lambers should be in jugs within 2 hours of birth.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO shift_schedules (id, enterprise_id, user_id, shift_date, start_time, end_time, role_on_shift, location_id, status, check_in_at, check_out_at) VALUES
  ('ss000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','2026-02-15','05:00','09:00','Morning Milking Lead','10000000-0000-0000-0000-000000000005','completed','2026-02-15 05:02:00','2026-02-15 09:15:00'),
  ('ss000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','2026-02-15','15:00','19:00','Evening Milking Lead','10000000-0000-0000-0000-000000000005','completed','2026-02-15 15:00:00','2026-02-15 19:05:00'),
  ('ss000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002','2026-02-15','06:00','14:00','General Farm Hand','10000000-0000-0000-0000-000000000001','completed','2026-02-15 06:08:00','2026-02-15 14:00:00'),
  ('ss000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000003','2026-04-05','07:00','15:00','Lambing Watch (AM)','10000000-0000-0000-0000-000000000012','scheduled',NULL,NULL),
  ('ss000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000003','2026-04-06','07:00','15:00','Lambing Watch (AM)','10000000-0000-0000-0000-000000000012','scheduled',NULL,NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 84: MORE MARKETPLACE LISTINGS (all categories, ALL fields)
-- ============================================================
INSERT INTO marketplace_listings (id, enterprise_id, seller_id, title, description, category, listing_type, price, currency, quantity, unit, condition, images, location, tags, status, featured, views_count) VALUES
  ('ml000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','Premium Organic Whole Milk – 20L Weekly Subscription','USDA certified organic whole milk from Holstein and Jersey cows. A2/A2 tested. Non-homogenized for rich cream-top. Meets highest somatic cell count standards. Available in recurring weekly delivery or pickup.','food_products','service',48.00,'USD',20,'liters','new','["/uploads/market/milk-subscription.jpg","/uploads/market/milk-cows.jpg"]','Cedar Falls, Iowa, US',ARRAY['organic','milk','A2','subscription','dairy'],'active',true,234),
  ('ml000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','Holstein Heifer Calf – Flora (3rd Generation Top Genetics)','Registered NAAB Holstein heifer, 12 months, dam average 42L/day (3x top 10%), sire NM$ +450. All vaccines current. BVD-PI tested negative. Excellent frame and feet scoring. Ideal for high-production dairy operations.','livestock','for_sale',4800.00,'USD',1,'head','new','["/uploads/market/flora-heifer.jpg"]','Cedar Falls, Iowa, US',ARRAY['Holstein','heifer','genetics','registered'],'active',false,87),
  ('ml000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','Farm-Fresh Free-Range Eggs – Dozen (Grade A)','Rhode Island Red free-range eggs. Hens on pasture minimum 6 hours/day. USDA GAP certified. No antibiotics, no hormones. Orange yolks from insect forage. Available at Asheville Market Saturday or local delivery.','food_products','for_sale',6.50,'USD',50,'dozen','new','["/uploads/market/eggs-fresh.jpg","/uploads/market/hen-pasture.jpg"]','Asheville, North Carolina, US',ARRAY['eggs','free-range','organic','GAP-certified'],'active',true,412),
  ('ml000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','Raw Saanen Goat Milk – 4L Weekly Share','Raw certified goat milk from ADGA and CAE-negative Saanen herd. Rich in medium-chain fatty acids. Ideal for goat cheese, kefir, and soap making. Shares available for local pickup in Asheville.','food_products','service',22.00,'USD',10,'liters','new','["/uploads/market/goat-milk.jpg"]','Asheville, North Carolina, US',ARRAY['goat-milk','raw','Saanen','CAE-negative'],'active',false,156),
  ('ml000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000003','Merino Raw Fleece – Fine Wool 18-20 Micron (2026 Clip)','Merino ewe fleece from Animal Welfare Approved flock. 2026 spring clip. 18-20 micron (spinning count 70s). Superwash-compatible. Average staple 85mm. Vegetable matter low (<0.5%). Skirted and vacuum packed. Ideal for hand spinning and premium yarn manufacturers.','agricultural_supplies','for_sale',32.00,'USD',40,'kg','new','["/uploads/market/merino-fleece.jpg","/uploads/market/spinning-yarn.jpg"]','Stowe, Vermont, US',ARRAY['merino','wool','fine-fleece','spinning','AWA'],'active',true,98),
  ('ml000000-0000-0000-0000-000000000015','e0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000003','Heritage Berkshire Piglet Deposit – April 2026 Litter','Reserve a Berkshire piglet from Charlotte''s April 2026 litter. Wean at 8 weeks. All piglets will receive iron, standard vaccines, and ear notches. Premium heritage pork genetics. Option to raise to market weight with pastoral finishing program (add-on available).','livestock','for_sale',250.00,'USD',6,'head','new','["/uploads/market/berkshire-piglet.jpg"]','Stowe, Vermont, US',ARRAY['Berkshire','piglet','heritage-pork','AWA'],'active',false,71)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 85: MORE WELLNESS SCORECARDS & REMINDERS (pet owners)
-- ============================================================
INSERT INTO wellness_scorecards (id, animal_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by, assessed_at) VALUES
  ('ws000000-0000-0000-0000-000000000010','aa000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002',62,65,55,80,71,'overweight','2026-06-01',ARRAY['Reduce caloric intake by 15% – switch to weight management formula','Increase exercise to 45 min/day structured activity','NSAIDs for joint comfort – continue meloxicam','Schedule follow-up X-ray for hip progression'],ARRAY['Obesity risk – BCS 4/5','Osteoarthritis progression','Senior dog – annual bloodwork recommended'],'b0000000-0000-0000-0000-000000000001','2026-02-01'),
  ('ws000000-0000-0000-0000-000000000011','aa000000-0000-0000-0000-000000000019','c0000000-0000-0000-0000-000000000004',88,84,91,90,85,'healthy','2026-08-01',ARRAY['Maintain current hypoallergenic diet','Continue professional grooming every 6 weeks','Routine joint x-rays at annual exam'],ARRAY['Hypoallergenic breed – strict diet required'],'b0000000-0000-0000-0000-000000000004','2026-02-05'),
  ('ws000000-0000-0000-0000-000000000012','aa000000-0000-0000-0000-000000000021','c0000000-0000-0000-0000-000000000004',75,82,60,85,78,'healthy','2026-06-01',ARRAY['Strict IVDD protocol – no jumping','Ramp access on all furniture','Continue gabapentin 50mg BID for 4 weeks','Physiotherapy assessment recommended'],ARRAY['IVDD Stage 1 – active management required','Spine risk – no stairs'],'b0000000-0000-0000-0000-000000000001','2026-02-10'),
  ('ws000000-0000-0000-0000-000000000013','aa000000-0000-0000-0000-000000000016','c0000000-0000-0000-0000-000000000003',82,88,79,70,NULL,'healthy','2026-12-01',ARRAY['Continue frozen prey feeding schedule – thaw 24h prior','Maintain hot side 88°F / cool side 78°F gradient','Annual fecal parasite exam recommended','Weigh monthly – target 1.5kg'],ARRAY['Breeding-season anorexia – monitor weight'],NULL,'b0000000-0000-0000-0000-000000000004','2026-02-08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, status, priority, recurrence) VALUES
  ('wr000000-0000-0000-0000-000000000010','aa000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002','checkup','Senior Bloodwork – Max (Annual)','Annual comprehensive bloodwork panel for senior German Shepherd including CBC, chemistry, thyroid, urinalysis.','2026-06-10','pending','high','annual'),
  ('wr000000-0000-0000-0000-000000000011','aa000000-0000-0000-0000-000000000019','c0000000-0000-0000-0000-000000000004','grooming','Professional Grooming – Duke (Every 6 weeks)','Standard Poodle professional grooming appointment. Trim, blow-dry, ear cleaning, nail grind.','2026-03-15','pending','normal','every_6_weeks'),
  ('wr000000-0000-0000-0000-000000000012','aa000000-0000-0000-0000-000000000021','c0000000-0000-0000-0000-000000000004','medication','Oscar IVDD – Gabapentin refill due','Oscar gabapentin 50mg BID prescription runs out. Request refill from Dr. Carter.','2026-03-01','pending','high','monthly'),
  ('wr000000-0000-0000-0000-000000000013','aa000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000003','dental','Snowball Dental Check – Holland Lop','Holland Lop rabbits are prone to malocclusion. Annual dental exam and molar spur check.','2026-08-14','pending','normal','annual'),
  ('wr000000-0000-0000-0000-000000000014','aa000000-0000-0000-0000-000000000022','c0000000-0000-0000-0000-000000000004','vaccination','Shadow Bengal – Rabies & FVRCP Annual','Annual vaccinations due – Rabies 1-year + FVRCP booster for Shadow.','2026-07-14','pending','high','annual')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 86: MORE AI CHAT SESSIONS (Tom Wilson farm Q&A)
-- ============================================================
INSERT INTO ai_chat_sessions (id, enterprise_id, user_id, animal_id, title, context_type, status, message_count, last_message_at) VALUES
  ('a8000000-0000-0000-0000-000000000006','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000039','Pearl Calving Protocol – April 2026','animal','active',4,NOW() - INTERVAL '2 hours'),
  ('a8000000-0000-0000-0000-000000000007','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001',NULL,'Ketosis Prevention Strategy – Transition Cows','enterprise','active',6,NOW() - INTERVAL '1 day'),
  ('a8000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','Honey Mastitis Management – S. aureus','animal','active',5,NOW() - INTERVAL '18 hours'),
  ('a8000000-0000-0000-0000-000000000009',NULL,'b0000000-0000-0000-0000-000000000002','aa000000-0000-0000-0000-000000000003','Brachycephalic Airway Assessment – Coco','animal','active',3,NOW() - INTERVAL '3 days'),
  ('a8000000-0000-0000-0000-000000000010',NULL,'c0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000001','Buddy Hip Dysplasia – Long-Term Management','animal','active',5,NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_chat_messages (id, session_id, role, content, confidence, sources, tokens_used) VALUES
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000006','user','Pearl is my Holstein cow and she is due April 10. What are the exact signs I should watch for in the 48 hours before calving?',NULL,'[]',22),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000006','assistant','Great question – early recognition of pre-calving signs can make the difference between a smooth delivery and a complication. Here are **Pearl''s 48-hour calving signs** to monitor:\n\n**48-72 hours before calving:**\n- Udder fully filling with colostrum (very firm)\n- Vulva swelling and elongation\n- Tail-head ligaments softening (can insert 2 fingers on both sides)\n- Restless behavior: lying down/standing frequently\n- Off feed (reduced or no TMR intake)\n- Isolating from herd\n\n**2-6 hours before calving:**\n- Mucus discharge from vulva (thick, yellowish-white)\n- Frequent urination, tail switching\n- Stage 1 labor: repeated lying and rising, visible contraction waves\n- Amniotic sac visible at vulva\n\n**Intervention required if:**\n- Stage 2 labor >1 hour with no progress\n- Feet visible but no head after 30 min\n- Backwards (breech) presentation\n- Abnormal fetal posture\n\nAlways have Dr. Carter''s number ready. Pearl is a 4th-calver – she should know what to do, but her age increases dystocia risk slightly. Would you like guidance on assisted calving technique?',94.0,'["Bovine Parturition Atlas","Dairy Cattle Management - Iowa State Extension"]',245),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000006','user','What should I have in my calving kit for Pearl?',NULL,'[]',14),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000006','assistant','Here''s your complete **calving kit checklist** for Pearl:\n\n**Sanitation:** 7% tincture of iodine (navel dipping), clean bucket and warm water, betadine surgical scrub, latex gloves (long OB type), hand soap\n\n**Obstetrical:** OB sleeve/lubricant (J-Lube or similar), calving ropes x2, calf puller (mechanical or Vink), clean towels x6\n\n**Neonatal care:** Digital thermometer, bulb syringe (clear airways), dry towels to vigorously rub calf, colostrum tube feeder (calf esophageal feeder), heat lamp and extension cord for cold nights\n\n**Medications (consult Dr. Carter for doses):** Oxytocin (if uterus not contracting), dextrose/calcium solution (milk fever prevention), selenium/vitamin E injectable, propylene glycol (energy support), electrolytes for abomasal bloat if calf weak\n\n**Record keeping:** Ear tags ready, birth weight scale (or tape), calving notebook. I can generate a calving report template for you!',92.0,'["Bovine Neonatal Care Guide","Iowa Beef Center Calving Manual"]',198),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000007','user','3 of my transition cows developed ketosis last month. How do I prevent this in the spring calving group?',NULL,'[]',18),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000007','assistant','Losing 3 cows to ketosis in one month is a significant metabolic issue worth addressing proactively. Here''s your **transition cow ketosis prevention protocol** for the spring calving group:\n\n**Nutrition (3 weeks before calving):**\n- Reduce dietary energy in far-off dry cows (avoid overconditioned cows at dry-off – target BCS 3.25)\n- Begin close-up ration 3 weeks before calving: higher forage, add rumen-protected niacin (6g/cow/day)\n- Add propylene glycol 300mL/day per cow for 14 days pre-calving and 14 days post-calving\n- Ensure adequate vitamin E + selenium (key for transition)\n\n**Monitoring:**\n- BHB-test ALL cows at days 3, 7, 14 post-calving (Precision Xtra handheld ketone meter – costs ~$30)\n- Mark any cow with BHB >1.0 mmol/L for preventive treatment\n\n**Treatment trigger (subclinical ketosis BHB 1.0-2.9):**\n- Oral propylene glycol 300mL BID x5 days\n- Bump key (rumen bolus releasing niacin + propylene glycol)\n- Monitor appetite and milk production daily\n\n**Environmental factors:**\n- Ensure cows have adequate bunk space (30-inch minimum per cow)\n- Avoid overcrowding close-up pen (85% occupancy max)\n- Temperature stress worsens energy balance – shade and fans critical in warm weather\n\n**Expected impact:** With proper transition management, ketosis incidence should drop from 7% to <2%. Cost of prevention is ~$15/cow; cost of treatment is ~$300/cow. Want me to generate a transition cow monitoring schedule?',97.0,'["AABP Ketosis Prevention Guidelines","Cornell PRODAIRY Transition Cow Management"]',305),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000008','user','Honey has S. aureus mastitis. She''s being treated with cloxacillin. What is the milk withdrawal period and will she recover fully?',NULL,'[]',20),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000008','assistant','Important question – here''s what you need to know about Honey''s S. aureus mastitis treatment:\n\n**Milk Withdrawal Period for Cloxacillin Intramammary:**\n- **Milk: 48-72 hours** after LAST treatment (verify with specific product label – Orbenin Quick, Dariclox, or similar)\n- **Meat: 28 days** if Honey were to be culled\n- **Document all treatments** in your farm drug log for USDA GAP audit compliance\n- Use separate milk bucket and label milk as "DISCARD" during withdrawal\n\n**Will Honey recover fully? (Honest answer for S. aureus)**\n- S. aureus mastitis has **only 30-40% bacteriological cure rate** with intramammary therapy during lactation\n- She IS penicillin-resistant (confirmed by culture), so cloxacillin is the right choice over amoxicillin\n- Higher cure rates with: early detection, young cows, <3 affected quarters, low cell count prior to infection – Honey has some favorable factors\n- If she doesn''t culture-cure by 30 days post-treatment, consider: **dry cow therapy** at her next dry-off (more effective for S. aureus), or culling evaluation if she becomes a chronic spreader\n\n**Watch for:** Clinical cure (normal secretion within 3-5 days) vs. bacteriological cure (no growth on follow-up culture at 14-21 days). Clinical cure is common even when bacteriological cure fails. I recommend a follow-up culture within 21 days of treatment.\n\nShould I set a reminder for Honey''s follow-up culture on March 15?',96.0,'["NMC Mastitis Control Guidelines","Cloxacillin product insert – Orbenin Quick","USDA AMS Milk Drug Residue Database"]',287),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000009','user','Coco (French Bulldog) is 3 years old and I''ve noticed louder snoring and sometimes she makes a reverse sneezing sound. Should I be worried?',NULL,'[]',22),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000009','assistant','These are very common signs of **Brachycephalic Obstructive Airway Syndrome (BOAS)** in French Bulldogs – a breed routinely affected due to their flat facial anatomy. This is something to take seriously, but it''s very manageable.\n\n**What''s likely happening:**\nFrench Bulldogs typically have some combination of: elongated soft palate (obstructs airway during breathing), stenotic nares (narrowed nostrils), and sometimes hypoplastic trachea. As dogs age and potentially gain weight, these can worsen.\n\n**Immediate assessment:**\nDr. Sarah Johnson has a brachycephalic airway appointment scheduled for Coco on Feb 25 – that''s the right next step. She''ll assess nare width, soft palate length, and laryngeal function.\n\n**Factors that worsen BOAS:**\n- Obesity (weight management is CRITICAL)\n- Heat and humidity (avoid exercise in temperatures >25°C)\n- Excitement and stress\n- Collar pressure (use a harness instead)\n\n**Potential treatment:**\nIf exam confirms significant BOAS: soft palate resection and nare widening surgery is highly effective and has a >90% improvement rate. Recovery is 2-3 weeks.\n\n**Warning signs to go to ER immediately:**\n- Blue/purple gums (cyanosis)\n- Collapse or loss of consciousness\n- Inability to breathe through nose or mouth\n- Continuous open-mouth breathing\n\nCoco''s scheduled appointment on Feb 25 is appropriate timing. No emergency action needed now unless signs worsen.',93.0,'["ACVS Brachycephalic Surgery Guidelines","BSAVA Respiratory Disease Manual","French Bulldog Club of America Health"]',258),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000010','user','Buddy had his hip dysplasia diagnosis 4 months ago. What should I expect for the next 2-3 years?',NULL,'[]',18),
  (gen_random_uuid(),'a8000000-0000-0000-0000-000000000010','assistant','Buddy''s hip dysplasia prognosis depends on severity and how well you manage it long-term. Since he was diagnosed with mild-moderate dysplasia at age 6, here''s your **2-3 year realistic outlook:**\n\n**Year 1 (2026) – Stabilization Phase:**\n- Pain management with Carprofen (current prescription) is appropriate\n- Dasuquin Advanced joint supplement should show benefits within 4-8 weeks\n- Weight management is THE most impactful intervention – every extra pound is 4-7 lbs of joint pressure\n- Physical therapy (hydrotherapy/swimming) can significantly slow progression\n- Repeat radiographs recommended in October 2026 to assess arthritis progression\n\n**Year 2-3 (2027-2028) – Monitoring Phase:**\n- If well-managed, Buddy can maintain good quality of life with medications\n- Signs to watch for: progressive stiffness, difficulty with stairs, reduced activity, muscle atrophy\n- If medical management inadequate: FHO (femoral head ostectomy) surgery or total hip replacement are options – both effective in Golden Retrievers\n\n**Daily management now:**\n- 20-30 min low-impact walks (avoid running/jumping)\n- Swimming or hydrotherapy if accessible\n- Non-slip flooring at home\n- Orthopedic dog bed (memory foam)\n- Avoid high-impact activities (ball chasing, stairs)\n\n**Good news:** Golden Retrievers are stoic and adapt well. Many dogs with Buddy''s level of dysplasia live full happy lives to 12-14 years with proper management. His follow-up appointment on April 15 will be key to adjusting his plan.',95.0,'["OFA Hip Dysplasia Management Guidelines","WSAVA Pain Management Guidelines","Journal of Veterinary Internal Medicine – CHD outcomes"]',312);

-- ============================================================
-- STEP 87: MORE NOTIFICATIONS FOR ALL USERS
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel) VALUES
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','health_alert','⚠ Vaccination Due – Holstein Herd (June)','IBR/BVD/PI3 annual booster is due for your Holstein Milking Herd in June 2026. Schedule with Dr. Carter to ensure compliance.','f','in_app'),
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','calving_alert','🐮 Pearl – Calving in 14 Days','Your Holstein cow Pearl is due to calve on April 10, 2026. Prepare calving pen and calving kit. Monitor closely from April 5.','f','in_app'),
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','health_alert','📋 Mastitis Follow-Up – Honey','Follow up milk culture for Honey (S. aureus mastitis) on March 15, 2026. Confirm bacteriological cure of right rear quarter.','f','in_app'),
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000001','financial','💰 February Milk Payment Received','Dairy Partners Cooperative payment of $28,400.00 for February bulk milk sales has been processed to your bank account.','f','in_app'),
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000002','health_alert','⚠ CDT Booster Due – Saanen Herd','Annual CDT (Clostridium + Tetanus) boosters for your Saanen dairy goats are due in January 2027. Schedule with Dr. Reyes.','f','in_app'),
  (gen_random_uuid(),'c0000000-0000-0000-0000-000000000001','appointment','📅 Buddy – Follow-Up Appointment Apr 15','Reminder: Buddy''s hip dysplasia follow-up with Dr. Carter is on April 15, 2026 at 2:00 PM. Please arrive 10 minutes early.','f','in_app'),
  (gen_random_uuid(),'c0000000-0000-0000-0000-000000000001','vaccination','💉 Whiskers – FVRCP Booster Due Mar 2026','Whiskers is due for her annual FVRCP booster this month. Book an appointment online or call VetCare Central.','f','in_app'),
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000001','appointment','📋 New Consultation Request – Emily Davis','Emily Davis has booked a brachycephalic airway consultation for Coco (French Bulldog) on February 25, 2026 at 2:00 PM.','f','in_app'),
  (gen_random_uuid(),'b0000000-0000-0000-0000-000000000001','farm_visit','🐄 Farm Visit Scheduled – Green Pastures','Farm visit scheduled for February 20, 2026 at Green Pastures Dairy Farm for herd health services and pregnancy checks.','t','in_app'),
  (gen_random_uuid(),'a0000000-0000-0000-0000-000000000001','system','🏥 New Hospital Registration – Sunrise Rural','Sunrise Rural Animal Clinic has submitted verification documents for review. Accreditation docs uploaded.','f','in_app'),
  (gen_random_uuid(),'c0000000-0000-0000-0000-000000000004','wellness','🐾 Oscar''s IVDD Cage Rest – Day 14 of 28','Oscar is halfway through cage rest for IVDD Stage 1. Continue strict movement restriction. Check for gait improvement.','f','in_app'),
  (gen_random_uuid(),'f0000000-0000-0000-0000-000000000003','health_alert','🐑 Woolly – Lambing in ~21 Days','Merino ewe Woolly is due April 15, 2026 with twin lambs confirmed by ultrasound. Prepare lambing shed by March 25.','f','in_app')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 88: MORE WEIGHT HISTORY FOR ENTERPRISE ANIMALS
-- ============================================================
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at) VALUES
  ('wh000000-0000-0000-0000-000000000020','aa000000-0000-0000-0000-000000000036',615.0,'kg','Monthly weight check – on target for high production Holstein','f0000000-0000-0000-0000-000000000001','2026-01-10'),
  ('wh000000-0000-0000-0000-000000000021','aa000000-0000-0000-0000-000000000036',610.0,'kg','Slight weight decrease – normal for peak lactation','f0000000-0000-0000-0000-000000000001','2026-02-10'),
  ('wh000000-0000-0000-0000-000000000022','aa000000-0000-0000-0000-000000000039',655.0,'kg','Dry cow period – good BCS 3.8/5 at dry-off','f0000000-0000-0000-0000-000000000001','2025-11-01'),
  ('wh000000-0000-0000-0000-000000000023','aa000000-0000-0000-0000-000000000039',640.0,'kg','Mid-dry period – normal weight maintenance','f0000000-0000-0000-0000-000000000001','2026-02-01'),
  ('wh000000-0000-0000-0000-000000000024','aa000000-0000-0000-0000-000000000045',895.0,'kg','Bull weight check – slightly above ideal. Reduce grain 0.5kg/day','f0000000-0000-0000-0000-000000000001','2026-01-10'),
  ('wh000000-0000-0000-0000-000000000025','aa000000-0000-0000-0000-000000000045',890.0,'kg','Weight management working – approaching target BCS 3.0','f0000000-0000-0000-0000-000000000001','2026-02-01'),
  ('wh000000-0000-0000-0000-000000000026','aa000000-0000-0000-0000-000000000040',390.0,'kg','Heifer development program – on target','f0000000-0000-0000-0000-000000000001','2026-01-01'),
  ('wh000000-0000-0000-0000-000000000027','aa000000-0000-0000-0000-000000000040',420.0,'kg','Approaching breeding weight target (430kg for Holstein)','f0000000-0000-0000-0000-000000000001','2026-02-01'),
  ('wh000000-0000-0000-0000-000000000028','aa000000-0000-0000-0000-000000000027',64.0,'kg','Pre-lambing weight – twins confirmed – appropriate gain','f0000000-0000-0000-0000-000000000003','2026-01-15'),
  ('wh000000-0000-0000-0000-000000000029','aa000000-0000-0000-0000-000000000031',140.0,'kg','Sow pre-farrowing weight – on track','f0000000-0000-0000-0000-000000000003','2026-02-01')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 89: MORE MOVEMENT RECORDS (enterprise animals)
-- ============================================================
INSERT INTO movement_records (id, enterprise_id, animal_id, from_location_id, to_location_id, movement_type, reason, animal_count, transport_date, recorded_by, notes) VALUES
  ('mv000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000039','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','relocation','dry_period_start',1,'2025-11-01','f0000000-0000-0000-0000-000000000001','Pearl moved to quarantine pen for dry cow therapy initiation and isolation from milking herd.'),
  ('mv000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000039','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','relocation','pasture_access',1,'2025-12-01','f0000000-0000-0000-0000-000000000001','Pearl moved from quarantine to North Pasture for dry period grazing. Udder clear and healthy.'),
  ('mv000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','quarantine','health_treatment',1,'2026-01-25','f0000000-0000-0000-0000-000000000001','Honey quarantined during mastitis treatment. Milk discarded into separate bucket. Milk withdrawal 72h.'),
  ('mv000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000043','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','relocation','health_cleared',1,'2026-01-30','f0000000-0000-0000-0000-000000000001','Honey returned to milking herd after 3-day treatment. CMT negative, clinical cure confirmed.'),
  ('mv000000-0000-0000-0000-000000000014','e0000000-0000-0000-0000-000000000003','aa000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000012','relocation','pre_lambing',1,'2026-03-25','f0000000-0000-0000-0000-000000000003','Woolly moved from North Hill Pasture to Lambing Shed 3 weeks before due date for close monitoring.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 90: MORE SENSOR READINGS & ALERT EVENTS (recent data)
-- ============================================================
INSERT INTO sensor_readings (id, sensor_id, enterprise_id, value, unit, is_anomaly, anomaly_type, recorded_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM iot_sensors WHERE enterprise_id = 'e0000000-0000-0000-0000-000000000001' LIMIT 1),
  'e0000000-0000-0000-0000-000000000001',
  ROUND((CAST(20.5 + (random() * 4 - 2) AS NUMERIC)), 1),
  '°C',
  false,
  NULL,
  NOW() - (interval '1 hour' * generate_series)
FROM generate_series(1, 48);

INSERT INTO alert_events (id, enterprise_id, rule_id, alert_type, severity, title, message, is_read, is_acknowledged)
SELECT
  gen_random_uuid(),
  'e0000000-0000-0000-0000-000000000001',
  (SELECT id FROM alert_rules WHERE enterprise_id = 'e0000000-0000-0000-0000-000000000001' LIMIT 1),
  'health',
  'high',
  'Milk SCC Alert – Honey Exceeds Threshold',
  'Somatic cell count for Honey (Jersey) measured at 1,200,000 cells/mL, exceeding the 200,000 threshold. Mastitis confirmed.',
  false,
  false
WHERE EXISTS (SELECT 1 FROM alert_rules WHERE enterprise_id = 'e0000000-0000-0000-0000-000000000001' LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM alert_events WHERE title = 'Milk SCC Alert – Honey Exceeds Threshold' LIMIT 1);

-- ============================================================
-- STEP 91: MORE REPORT TEMPLATES & GENERATED REPORTS
-- ============================================================
INSERT INTO report_templates (id, enterprise_id, name, description, report_type, config, columns, filters, grouping, is_system, created_by) VALUES
  ('rt000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','Monthly Milk Production Report','Individual cow milk production, SCC, and butterfat/protein data for DHIA submission and cooperative reporting.','production','{"time_period":"monthly","include_dry_cows":false}',ARRAY['cow_id','name','lactation_number','days_in_milk','milk_yield_L','SCC','butterfat_pct','protein_pct'],ARRAY['species=Cattle','is_active=true'],ARRAY['group'],false,'f0000000-0000-0000-0000-000000000001'),
  ('rt000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','Herd Health Summary','Monthly veterinary event summary including treatments, vaccinations, reproductive events, and health observations.','health','{"time_period":"monthly","include_all_events":true}',ARRAY['animal_id','name','event_type','event_date','treatment','administered_by','follow_up'],ARRAY['enterprise_id','is_active=true'],ARRAY['event_type'],false,'b0000000-0000-0000-0000-000000000001'),
  ('rt000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','Financial P&L Summary','Monthly profit and loss summary with income by category (milk, cheese, livestock sales) vs. expenses (feed, labor, vet, equipment).','financial','{"time_period":"monthly","currency":"USD"}',ARRAY['category','description','amount','transaction_date','notes'],ARRAY['enterprise_id'],ARRAY['record_type','category'],false,'f0000000-0000-0000-0000-000000000001'),
  ('rt000000-0000-0000-0000-000000000013','e0000000-0000-0000-0000-000000000003','Pre-Lambing Animal Status Report','Status of all ewes and does approaching due dates including BCS, health status, breeding confirmation, and lambing supplies.','breeding','{"include_pregnant_only":true}',ARRAY['animal_id','name','expected_due_date','breeding_method','BCS','health_flag','location'],ARRAY['enterprise_id','breeding_status=bred'],ARRAY['expected_due_date'],false,'f0000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO generated_reports (id, enterprise_id, name, report_type, format, parameters, result_data, row_count, status, generated_by) VALUES
  ('gr000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000001','February 2026 Milk Production Report','production','json','{"month":"2026-02","include_dry_cows":false}','{"summary":{"total_cows":42,"total_milk_L":44688,"avg_per_cow_L":1064,"avg_SCC":118000,"avg_butterfat":3.9,"avg_protein":3.3},"top_producers":[{"name":"Bessie","yield_L":1176},{"name":"Daisy","yield_L":1008}]}',42,'completed','f0000000-0000-0000-0000-000000000001'),
  ('gr000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','Q1 2026 Financial Summary','financial','pdf','{"quarter":"Q1-2026","currency":"USD"}','{"income":{"milk_sales":55200,"cheese_sales":7680,"total":62880},"expenses":{"feed":-16400,"labor":-19200,"veterinary":-4200,"equipment":-1450,"total":-41250},"net_profit":21630}',24,'completed','f0000000-0000-0000-0000-000000000001'),
  ('gr000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','Herd Vaccination Status – Jan 2026','health','csv','{"date":"2026-01-15"}','{"vaccinated_today":42,"overdue":0,"upcoming_30_days":0,"compliance_pct":100}',42,'completed','b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- (end of seed data)


-- ================================================================
-- TIMELINE 10+ YEAR DEMO DATA (2012-2026)
-- 7 new long-lived animals + dense historical events across all 9 types
-- Existing user accounts/passwords unchanged
-- ================================================================

-- ── STEP TL-1: 7 NEW LONG-LIVED ANIMALS (born 2012-2015) ─────────
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, is_neutered, medical_notes, is_active, unique_id) VALUES
  ('aa000000-0000-9999-0000-000000000001','c0000000-0000-0000-0000-000000000001','Bruno','Dog','Golden Retriever','2013-06-15','male',34.0,'Golden','MCHP-TL-9001',true,'Senior dog. 13-year recorded history. Hip dysplasia grade II diagnosed 2019. Cardiac murmur grade II detected 2023. Ongoing joint management.',true,'ANI-TL-001'),
  ('aa000000-0000-9999-0000-000000000002','c0000000-0000-0000-0000-000000000002','Tiger','Cat','Domestic Shorthair','2014-03-10','male',5.1,'Orange Tabby','MCHP-TL-9002',true,'Senior cat. 12-year history. Hyperthyroidism managed since 2021 on methimazole. Dental disease grade III. CKD stage I suspected.',true,'ANI-TL-002'),
  ('aa000000-0000-9999-0000-000000000003','f0000000-0000-0000-0000-000000000001','Old Belle','Cattle','Holstein Friesian','2012-05-01','female',620.0,'Black/White',NULL,false,'Senior dairy cow. 14-year recorded history. Top lifetime milk producer. Mastitis episodes: 2016, 2019, 2022. Retirement planning 2026.',true,'ANI-TL-003'),
  ('aa000000-0000-9999-0000-000000000004','f0000000-0000-0000-0000-000000000002','Nanny','Goat','Saanen','2013-08-20','female',68.0,'White','MCHP-TL-9004',false,'Senior dairy goat. 13 years of records. CAE-negative. Exceptional milk producer 4.2L/d peak. Foot rot episodes 2015 and 2020.',true,'ANI-TL-004'),
  ('aa000000-0000-9999-0000-000000000005','c0000000-0000-0000-0000-000000000003','Celia','Rabbit','Holland Lop','2015-02-14','female',2.1,'Grey/White',NULL,true,'Senior rabbit. 11-year history. GI stasis 2018. Uterine adenocarcinoma + OHE 2020. Dental spur filed 2022 and 2024.',true,'ANI-TL-005'),
  ('aa000000-0000-9999-0000-000000000006','c0000000-0000-0000-0000-000000000004','Archie','Dog','Labrador Retriever','2014-11-01','male',35.5,'Yellow','MCHP-TL-9006',true,'Senior dog. 12-year history. Bilateral elbow dysplasia 2017. Mast cell tumor grade I resected 2021. Idiopathic epilepsy controlled since 2019.',true,'ANI-TL-006'),
  ('aa000000-0000-9999-0000-000000000007','f0000000-0000-0000-0000-000000000003','Bess','Sheep','Merino','2013-04-10','female',70.0,'White',NULL,false,'Senior ewe. 13-year history. Lead ewe since 2016. ARR/ARR scrapie-resistance. Foot rot 2015 and 2018. Outstanding fine-wool producer.',true,'ANI-TL-007')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- TIMELINE 10+ YEAR DEMO DATA (2012-2026)
-- 7 new long-lived animals + dense historical events across all 9 types
-- Existing user accounts/passwords unchanged
-- ================================================================

-- ── STEP TL-1: 7 NEW LONG-LIVED ANIMALS (born 2012-2015) ─────────
INSERT INTO animals (id, owner_id, name, species, breed, date_of_birth, gender, weight, color, microchip_id, is_neutered, medical_notes, is_active, unique_id) VALUES
  ('aa000000-0000-9999-0000-000000000001','c0000000-0000-0000-0000-000000000001','Bruno','Dog','Golden Retriever','2013-06-15','male',34.0,'Golden','MCHP-TL-9001',true,'Senior dog. 13-year recorded history. Hip dysplasia grade II diagnosed 2019. Cardiac murmur grade II detected 2023. Ongoing joint management.',true,'ANI-TL-001'),
  ('aa000000-0000-9999-0000-000000000002','c0000000-0000-0000-0000-000000000002','Tiger','Cat','Domestic Shorthair','2014-03-10','male',5.1,'Orange Tabby','MCHP-TL-9002',true,'Senior cat. 12-year history. Hyperthyroidism managed since 2021 on methimazole. Dental disease grade III. CKD stage I suspected.',true,'ANI-TL-002'),
  ('aa000000-0000-9999-0000-000000000003','f0000000-0000-0000-0000-000000000001','Old Belle','Cattle','Holstein Friesian','2012-05-01','female',620.0,'Black/White',NULL,false,'Senior dairy cow. 14-year recorded history. Top lifetime milk producer. Mastitis episodes: 2016, 2019, 2022. Retirement planning 2026.',true,'ANI-TL-003'),
  ('aa000000-0000-9999-0000-000000000004','f0000000-0000-0000-0000-000000000002','Nanny','Goat','Saanen','2013-08-20','female',68.0,'White','MCHP-TL-9004',false,'Senior dairy goat. 13 years of records. CAE-negative. Exceptional milk producer 4.2L/d peak. Foot rot episodes 2015 and 2020.',true,'ANI-TL-004'),
  ('aa000000-0000-9999-0000-000000000005','c0000000-0000-0000-0000-000000000003','Celia','Rabbit','Holland Lop','2015-02-14','female',2.1,'Grey/White',NULL,true,'Senior rabbit. 11-year history. GI stasis 2018. Uterine adenocarcinoma + OHE 2020. Dental spur filed 2022 and 2024.',true,'ANI-TL-005'),
  ('aa000000-0000-9999-0000-000000000006','c0000000-0000-0000-0000-000000000004','Archie','Dog','Labrador Retriever','2014-11-01','male',35.5,'Yellow','MCHP-TL-9006',true,'Senior dog. 12-year history. Bilateral elbow dysplasia 2017. Mast cell tumor grade I resected 2021. Idiopathic epilepsy controlled since 2019.',true,'ANI-TL-006'),
  ('aa000000-0000-9999-0000-000000000007','f0000000-0000-0000-0000-000000000003','Bess','Sheep','Merino','2013-04-10','female',70.0,'White',NULL,false,'Senior ewe. 13-year history. Lead ewe since 2016. ARR/ARR scrapie-resistance. Foot rot 2015 and 2018. Outstanding fine-wool producer.',true,'ANI-TL-007')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-2: VACCINATION RECORDS (2012-2026) ─────────────────
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, site_of_administration, certificate_number, reaction_notes, is_valid, created_by, created_at, updated_at) VALUES
  ('f1000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2013-08-15','2014-08-15','1 dose','BCH-2013-3334','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-76121',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-08-15 08:00:00','2013-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2014-08-15','2015-08-15','1 dose','BCH-2014-8402','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-44213',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-08-15 08:00:00','2014-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000003','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2015-08-15','2016-08-15','1 dose','BCH-2015-8687','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-33727',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-08-15 08:00:00','2015-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2016-08-15','2017-08-15','1 dose','BCH-2016-4336','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-49465',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-08-15 08:00:00','2016-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000005','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2017-08-15','2018-08-15','1 dose','BCH-2017-3986','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-13758',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-08-15 08:00:00','2017-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000006','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2018-08-15','2019-08-15','1 dose','BCH-2018-2044','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-70425',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-08-15 08:00:00','2018-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000007','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2019-08-15','2020-08-15','1 dose','BCH-2019-8167','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-16631',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-08-15 08:00:00','2019-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000008','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2020-08-15','2021-08-15','1 dose','BCH-2020-8204','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-25180',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-08-15 08:00:00','2020-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000009','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2021-08-15','2022-08-15','1 dose','BCH-2021-3985','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-13596',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-08-15 08:00:00','2021-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000010','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2022-08-15','2023-08-15','1 dose','BCH-2022-4913','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-46700',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-15 08:00:00','2022-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000011','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2023-08-15','2024-08-15','1 dose','BCH-2023-8227','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-43164',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-08-15 08:00:00','2023-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000012','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2024-08-15','2025-08-15','1 dose','BCH-2024-2235','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-12622',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-08-15 08:00:00','2024-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000013','aa000000-0000-9999-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2025-08-15','2026-08-15','1 dose','BCH-2025-6030','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-77634',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-15 08:00:00','2025-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000014','aa000000-0000-9999-0000-000000000001','Rabies','core','2013-08-15','2016-08-15','1 dose','BCH-2013-7502','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-26156',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-08-15 08:00:00','2013-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000015','aa000000-0000-9999-0000-000000000001','Rabies','core','2016-08-15','2019-08-15','1 dose','BCH-2016-4835','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-69833',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-08-15 08:00:00','2016-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000016','aa000000-0000-9999-0000-000000000001','Rabies','core','2019-08-15','2022-08-15','1 dose','BCH-2019-2883','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-84477',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-08-15 08:00:00','2019-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000017','aa000000-0000-9999-0000-000000000001','Rabies','core','2022-08-15','2025-08-15','1 dose','BCH-2022-1378','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-23207',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-15 08:00:00','2022-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000018','aa000000-0000-9999-0000-000000000001','Rabies','core','2025-08-15','2028-08-15','1 dose','BCH-2025-1475','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-62270',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-15 08:00:00','2025-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000019','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2014-03-01','2015-03-01','1 dose','BCH-2014-3487','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-53950',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-03-01 08:00:00','2014-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000020','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2015-03-01','2016-03-01','1 dose','BCH-2015-5165','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-52835',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-03-01 08:00:00','2015-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000021','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2016-03-01','2017-03-01','1 dose','BCH-2016-8282','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-61881',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-03-01 08:00:00','2016-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000022','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2017-03-01','2018-03-01','1 dose','BCH-2017-8508','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-27495',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-03-01 08:00:00','2017-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000023','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2018-03-01','2019-03-01','1 dose','BCH-2018-9981','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-71914',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-03-01 08:00:00','2018-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000024','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2019-03-01','2020-03-01','1 dose','BCH-2019-9192','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-87812',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-03-01 08:00:00','2019-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000025','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2020-03-01','2021-03-01','1 dose','BCH-2020-2849','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-84210',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-03-01 08:00:00','2020-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000026','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2021-03-01','2022-03-01','1 dose','BCH-2021-3009','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-84972',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-03-01 08:00:00','2021-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000027','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2022-03-01','2023-03-01','1 dose','BCH-2022-7870','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-34157',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-03-01 08:00:00','2022-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000028','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2023-03-01','2024-03-01','1 dose','BCH-2023-5195','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-13569',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-03-01 08:00:00','2023-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000029','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2024-03-01','2025-03-01','1 dose','BCH-2024-8020','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-32300',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-03-01 08:00:00','2024-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000030','aa000000-0000-9999-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2025-03-01','2026-03-01','1 dose','BCH-2025-1133','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-28082',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-03-01 08:00:00','2025-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000031','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2015-08-15','2016-08-15','1 dose','BCH-2015-1886','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-48873',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-08-15 08:00:00','2015-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000032','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2016-08-15','2017-08-15','1 dose','BCH-2016-5847','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-95442',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-08-15 08:00:00','2016-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000033','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2017-08-15','2018-08-15','1 dose','BCH-2017-3344','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-85908',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-08-15 08:00:00','2017-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000034','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2018-08-15','2019-08-15','1 dose','BCH-2018-1005','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-24313',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-08-15 08:00:00','2018-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000035','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2019-08-15','2020-08-15','1 dose','BCH-2019-8028','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-85197',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-08-15 08:00:00','2019-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000036','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2020-08-15','2021-08-15','1 dose','BCH-2020-7680','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-15341',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-08-15 08:00:00','2020-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000037','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2021-08-15','2022-08-15','1 dose','BCH-2021-9379','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-53016',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-08-15 08:00:00','2021-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000038','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2022-08-15','2023-08-15','1 dose','BCH-2022-6964','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-56013',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-15 08:00:00','2022-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000039','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2023-08-15','2024-08-15','1 dose','BCH-2023-4760','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-90885',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-08-15 08:00:00','2023-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000040','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2024-08-15','2025-08-15','1 dose','BCH-2024-1945','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-90489',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-08-15 08:00:00','2024-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000041','aa000000-0000-9999-0000-000000000001','Leptospirosis 4-way','lifestyle','2025-08-15','2026-08-15','1 dose','BCH-2025-5411','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-25330',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-15 08:00:00','2025-08-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000042','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2014-05-10','2015-05-10','1 dose','BCH-2014-1873','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2014-57131',NULL,false,'b0000000-0000-0000-0000-000000000002','2014-05-10 08:00:00','2014-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000043','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2015-05-10','2016-05-10','1 dose','BCH-2015-4725','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2015-11060',NULL,false,'b0000000-0000-0000-0000-000000000002','2015-05-10 08:00:00','2015-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000044','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2016-05-10','2017-05-10','1 dose','BCH-2016-6981','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2016-50077',NULL,false,'b0000000-0000-0000-0000-000000000002','2016-05-10 08:00:00','2016-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000045','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2017-05-10','2018-05-10','1 dose','BCH-2017-6554','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2017-93919',NULL,false,'b0000000-0000-0000-0000-000000000002','2017-05-10 08:00:00','2017-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000046','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2018-05-10','2019-05-10','1 dose','BCH-2018-3552','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2018-85220',NULL,false,'b0000000-0000-0000-0000-000000000002','2018-05-10 08:00:00','2018-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000047','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2019-05-10','2020-05-10','1 dose','BCH-2019-2413','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2019-90057',NULL,false,'b0000000-0000-0000-0000-000000000002','2019-05-10 08:00:00','2019-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000048','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2020-05-10','2021-05-10','1 dose','BCH-2020-6836','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2020-45300',NULL,false,'b0000000-0000-0000-0000-000000000002','2020-05-10 08:00:00','2020-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000049','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2021-05-10','2022-05-10','1 dose','BCH-2021-5880','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2021-90432',NULL,false,'b0000000-0000-0000-0000-000000000002','2021-05-10 08:00:00','2021-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000050','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2022-05-10','2023-05-10','1 dose','BCH-2022-5841','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2022-19532',NULL,false,'b0000000-0000-0000-0000-000000000002','2022-05-10 08:00:00','2022-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000051','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2023-05-10','2024-05-10','1 dose','BCH-2023-9025','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2023-19488',NULL,false,'b0000000-0000-0000-0000-000000000002','2023-05-10 08:00:00','2023-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000052','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2024-05-10','2025-05-10','1 dose','BCH-2024-5441','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2024-95243',NULL,true,'b0000000-0000-0000-0000-000000000002','2024-05-10 08:00:00','2024-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000053','aa000000-0000-9999-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2025-05-10','2026-05-10','1 dose','BCH-2025-1986','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2025-80741',NULL,true,'b0000000-0000-0000-0000-000000000002','2025-05-10 08:00:00','2025-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000054','aa000000-0000-9999-0000-000000000002','Rabies','core','2014-05-10','2017-05-10','1 dose','BCH-2014-8213','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2014-49556',NULL,false,'b0000000-0000-0000-0000-000000000002','2014-05-10 08:00:00','2014-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000055','aa000000-0000-9999-0000-000000000002','Rabies','core','2017-05-10','2020-05-10','1 dose','BCH-2017-2735','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2017-24480',NULL,false,'b0000000-0000-0000-0000-000000000002','2017-05-10 08:00:00','2017-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000056','aa000000-0000-9999-0000-000000000002','Rabies','core','2020-05-10','2023-05-10','1 dose','BCH-2020-2275','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2020-39101',NULL,false,'b0000000-0000-0000-0000-000000000002','2020-05-10 08:00:00','2020-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000057','aa000000-0000-9999-0000-000000000002','Rabies','core','2023-05-10','2026-05-10','1 dose','BCH-2023-1389','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2023-33969',NULL,false,'b0000000-0000-0000-0000-000000000002','2023-05-10 08:00:00','2023-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000058','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2014-05-10','2016-05-10','1 dose','BCH-2014-5543','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2014-63254',NULL,false,'b0000000-0000-0000-0000-000000000002','2014-05-10 08:00:00','2014-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000059','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2016-05-10','2018-05-10','1 dose','BCH-2016-5976','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2016-51755',NULL,false,'b0000000-0000-0000-0000-000000000002','2016-05-10 08:00:00','2016-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000060','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2018-05-10','2020-05-10','1 dose','BCH-2018-1753','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2018-44651',NULL,false,'b0000000-0000-0000-0000-000000000002','2018-05-10 08:00:00','2018-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000061','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2020-05-10','2022-05-10','1 dose','BCH-2020-9340','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2020-69274',NULL,false,'b0000000-0000-0000-0000-000000000002','2020-05-10 08:00:00','2020-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000062','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2022-05-10','2024-05-10','1 dose','BCH-2022-7149','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2022-12732',NULL,false,'b0000000-0000-0000-0000-000000000002','2022-05-10 08:00:00','2022-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000063','aa000000-0000-9999-0000-000000000002','FeLV (Feline Leukemia)','lifestyle','2024-05-10','2026-05-10','1 dose','BCH-2024-2242','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2024-96253',NULL,true,'b0000000-0000-0000-0000-000000000002','2024-05-10 08:00:00','2024-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000064','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2012-06-01','2013-06-01','1 dose','BCH-2012-7019','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2012-33172',NULL,false,'b0000000-0000-0000-0000-000000000001','2012-06-01 08:00:00','2012-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000065','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2013-06-01','2014-06-01','1 dose','BCH-2013-3333','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-76657',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-06-01 08:00:00','2013-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000066','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2014-06-01','2015-06-01','1 dose','BCH-2014-9048','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-46792',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-06-01 08:00:00','2014-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000067','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2015-06-01','2016-06-01','1 dose','BCH-2015-5130','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-51113',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-06-01 08:00:00','2015-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000068','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2016-06-01','2017-06-01','1 dose','BCH-2016-9123','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-92019',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-06-01 08:00:00','2016-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000069','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2017-06-01','2018-06-01','1 dose','BCH-2017-1026','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-49063',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-06-01 08:00:00','2017-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000070','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2018-06-01','2019-06-01','1 dose','BCH-2018-1404','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-46958',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-06-01 08:00:00','2018-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000071','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2019-06-01','2020-06-01','1 dose','BCH-2019-8489','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-21340',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-06-01 08:00:00','2019-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000072','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2020-06-01','2021-06-01','1 dose','BCH-2020-3180','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-75291',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-06-01 08:00:00','2020-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000073','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2021-06-01','2022-06-01','1 dose','BCH-2021-4861','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-20271',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000074','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2022-06-01','2023-06-01','1 dose','BCH-2022-5531','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-30604',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000075','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2023-06-01','2024-06-01','1 dose','BCH-2023-9814','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-78774',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000076','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2024-06-01','2025-06-01','1 dose','BCH-2024-4122','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-17065',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000077','aa000000-0000-9999-0000-000000000003','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2025-06-01','2026-06-01','1 dose','BCH-2025-7941','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-24829',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000078','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2012-06-01','2013-06-01','1 dose','BCH-2012-3769','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2012-10315',NULL,false,'b0000000-0000-0000-0000-000000000001','2012-06-01 08:00:00','2012-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000079','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2013-06-01','2014-06-01','1 dose','BCH-2013-3935','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-29042',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-06-01 08:00:00','2013-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000080','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2014-06-01','2015-06-01','1 dose','BCH-2014-9006','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-84680',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-06-01 08:00:00','2014-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000081','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2015-06-01','2016-06-01','1 dose','BCH-2015-2529','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-14291',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-06-01 08:00:00','2015-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000082','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2016-06-01','2017-06-01','1 dose','BCH-2016-4615','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-43342',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-06-01 08:00:00','2016-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000083','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2017-06-01','2018-06-01','1 dose','BCH-2017-7970','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-47847',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-06-01 08:00:00','2017-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000084','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2018-06-01','2019-06-01','1 dose','BCH-2018-8270','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-95832',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-06-01 08:00:00','2018-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000085','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2019-06-01','2020-06-01','1 dose','BCH-2019-6180','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-47781',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-06-01 08:00:00','2019-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000086','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2020-06-01','2021-06-01','1 dose','BCH-2020-1581','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-77794',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-06-01 08:00:00','2020-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000087','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2021-06-01','2022-06-01','1 dose','BCH-2021-3556','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-21682',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000088','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2022-06-01','2023-06-01','1 dose','BCH-2022-5170','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-15288',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000089','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2023-06-01','2024-06-01','1 dose','BCH-2023-6473','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-64523',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000090','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2024-06-01','2025-06-01','1 dose','BCH-2024-5296','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-49545',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000091','aa000000-0000-9999-0000-000000000003','Clostridial 7-way (CD-T + Blackleg)','core','2025-06-01','2026-06-01','1 dose','BCH-2025-2195','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-40595',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000092','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2012-06-01','2013-06-01','1 dose','BCH-2012-4673','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2012-90667',NULL,false,'b0000000-0000-0000-0000-000000000001','2012-06-01 08:00:00','2012-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000093','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2013-06-01','2014-06-01','1 dose','BCH-2013-9005','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-27165',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-06-01 08:00:00','2013-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000094','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2014-06-01','2015-06-01','1 dose','BCH-2014-7449','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-30173',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-06-01 08:00:00','2014-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000095','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2015-06-01','2016-06-01','1 dose','BCH-2015-3760','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-77485',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-06-01 08:00:00','2015-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000096','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2016-06-01','2017-06-01','1 dose','BCH-2016-8700','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-83843',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-06-01 08:00:00','2016-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000097','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2017-06-01','2018-06-01','1 dose','BCH-2017-2658','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-80191',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-06-01 08:00:00','2017-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000098','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2018-06-01','2019-06-01','1 dose','BCH-2018-2247','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-35356',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-06-01 08:00:00','2018-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000099','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2019-06-01','2020-06-01','1 dose','BCH-2019-3028','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-14155',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-06-01 08:00:00','2019-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000100','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2020-06-01','2021-06-01','1 dose','BCH-2020-2569','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-86706',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-06-01 08:00:00','2020-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000101','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2021-06-01','2022-06-01','1 dose','BCH-2021-8487','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-64093',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000102','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2022-06-01','2023-06-01','1 dose','BCH-2022-2264','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-15830',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000103','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2023-06-01','2024-06-01','1 dose','BCH-2023-2752','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-55017',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000104','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2024-06-01','2025-06-01','1 dose','BCH-2024-8794','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-49447',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000105','aa000000-0000-9999-0000-000000000003','Leptospirosis 5-way (Cattle)','core','2025-06-01','2026-06-01','1 dose','BCH-2025-9563','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-70514',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000106','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2013-10-01','2014-10-01','1 dose','BCH-2013-2631','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2013-57405',NULL,false,'b0000000-0000-0000-0000-000000000003','2013-10-01 08:00:00','2013-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000107','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2014-10-01','2015-10-01','1 dose','BCH-2014-1329','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2014-92773',NULL,false,'b0000000-0000-0000-0000-000000000003','2014-10-01 08:00:00','2014-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000108','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2015-10-01','2016-10-01','1 dose','BCH-2015-1550','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2015-57651',NULL,false,'b0000000-0000-0000-0000-000000000003','2015-10-01 08:00:00','2015-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000109','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2016-10-01','2017-10-01','1 dose','BCH-2016-6751','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2016-39227',NULL,false,'b0000000-0000-0000-0000-000000000003','2016-10-01 08:00:00','2016-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000110','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2017-10-01','2018-10-01','1 dose','BCH-2017-7517','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2017-19715',NULL,false,'b0000000-0000-0000-0000-000000000003','2017-10-01 08:00:00','2017-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000111','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2018-10-01','2019-10-01','1 dose','BCH-2018-7047','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2018-98288',NULL,false,'b0000000-0000-0000-0000-000000000003','2018-10-01 08:00:00','2018-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000112','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2019-10-01','2020-10-01','1 dose','BCH-2019-1226','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2019-81563',NULL,false,'b0000000-0000-0000-0000-000000000003','2019-10-01 08:00:00','2019-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000113','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2020-10-01','2021-10-01','1 dose','BCH-2020-7892','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2020-53415',NULL,false,'b0000000-0000-0000-0000-000000000003','2020-10-01 08:00:00','2020-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000114','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2021-10-01','2022-10-01','1 dose','BCH-2021-8755','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2021-59751',NULL,false,'b0000000-0000-0000-0000-000000000003','2021-10-01 08:00:00','2021-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000115','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2022-10-01','2023-10-01','1 dose','BCH-2022-4295','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2022-27826',NULL,false,'b0000000-0000-0000-0000-000000000003','2022-10-01 08:00:00','2022-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000116','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2023-10-01','2024-10-01','1 dose','BCH-2023-5357','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2023-91680',NULL,false,'b0000000-0000-0000-0000-000000000003','2023-10-01 08:00:00','2023-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000117','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2024-10-01','2025-10-01','1 dose','BCH-2024-4844','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2024-81780',NULL,true,'b0000000-0000-0000-0000-000000000003','2024-10-01 08:00:00','2024-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000118','aa000000-0000-9999-0000-000000000004','CDT 3-way (Clostridium perfringens C&D + Tetanus)','core','2025-10-01','2026-10-01','1 dose','BCH-2025-4058','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2025-90484',NULL,true,'b0000000-0000-0000-0000-000000000003','2025-10-01 08:00:00','2025-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000119','aa000000-0000-9999-0000-000000000004','Rabies (Goat)','core','2013-10-01','2016-10-01','1 dose','BCH-2013-1549','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2013-55316',NULL,false,'b0000000-0000-0000-0000-000000000003','2013-10-01 08:00:00','2013-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000120','aa000000-0000-9999-0000-000000000004','Rabies (Goat)','core','2016-10-01','2019-10-01','1 dose','BCH-2016-2034','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2016-55690',NULL,false,'b0000000-0000-0000-0000-000000000003','2016-10-01 08:00:00','2016-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000121','aa000000-0000-9999-0000-000000000004','Rabies (Goat)','core','2019-10-01','2022-10-01','1 dose','BCH-2019-6884','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2019-48520',NULL,false,'b0000000-0000-0000-0000-000000000003','2019-10-01 08:00:00','2019-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000122','aa000000-0000-9999-0000-000000000004','Rabies (Goat)','core','2022-10-01','2025-10-01','1 dose','BCH-2022-4960','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2022-47426',NULL,false,'b0000000-0000-0000-0000-000000000003','2022-10-01 08:00:00','2022-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000123','aa000000-0000-9999-0000-000000000004','Rabies (Goat)','core','2025-10-01','2028-10-01','1 dose','BCH-2025-8205','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2025-59441',NULL,true,'b0000000-0000-0000-0000-000000000003','2025-10-01 08:00:00','2025-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000124','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2015-04-14','2016-04-14','1 dose','BCH-2015-1524','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2015-14660',NULL,false,'b0000000-0000-0000-0000-000000000003','2015-04-14 08:00:00','2015-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000125','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2016-04-14','2017-04-14','1 dose','BCH-2016-1034','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2016-22856',NULL,false,'b0000000-0000-0000-0000-000000000003','2016-04-14 08:00:00','2016-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000126','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2017-04-14','2018-04-14','1 dose','BCH-2017-9070','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2017-77598',NULL,false,'b0000000-0000-0000-0000-000000000003','2017-04-14 08:00:00','2017-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000127','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2018-04-14','2019-04-14','1 dose','BCH-2018-6285','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2018-26411',NULL,false,'b0000000-0000-0000-0000-000000000003','2018-04-14 08:00:00','2018-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000128','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2019-04-14','2020-04-14','1 dose','BCH-2019-7651','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2019-56485',NULL,false,'b0000000-0000-0000-0000-000000000003','2019-04-14 08:00:00','2019-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000129','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2020-04-14','2021-04-14','1 dose','BCH-2020-2818','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2020-32520',NULL,false,'b0000000-0000-0000-0000-000000000003','2020-04-14 08:00:00','2020-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000130','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2021-04-14','2022-04-14','1 dose','BCH-2021-6430','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2021-64933',NULL,false,'b0000000-0000-0000-0000-000000000003','2021-04-14 08:00:00','2021-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000131','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2022-04-14','2023-04-14','1 dose','BCH-2022-5241','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2022-41381',NULL,false,'b0000000-0000-0000-0000-000000000003','2022-04-14 08:00:00','2022-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000132','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2023-04-14','2024-04-14','1 dose','BCH-2023-4915','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2023-12829',NULL,false,'b0000000-0000-0000-0000-000000000003','2023-04-14 08:00:00','2023-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000133','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2024-04-14','2025-04-14','1 dose','BCH-2024-2136','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2024-82532',NULL,true,'b0000000-0000-0000-0000-000000000003','2024-04-14 08:00:00','2024-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000134','aa000000-0000-9999-0000-000000000005','RHDV2 (Rabbit Hemorrhagic Disease Virus Type 2)','core','2025-04-14','2026-04-14','1 dose','BCH-2025-9421','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2025-66961',NULL,true,'b0000000-0000-0000-0000-000000000003','2025-04-14 08:00:00','2025-04-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000135','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2016-10-14','2017-10-14','1 dose','BCH-2016-3023','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2016-69518',NULL,false,'b0000000-0000-0000-0000-000000000003','2016-10-14 08:00:00','2016-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000136','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2017-10-14','2018-10-14','1 dose','BCH-2017-2180','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2017-76338',NULL,false,'b0000000-0000-0000-0000-000000000003','2017-10-14 08:00:00','2017-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000137','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2018-10-14','2019-10-14','1 dose','BCH-2018-3185','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2018-91580',NULL,false,'b0000000-0000-0000-0000-000000000003','2018-10-14 08:00:00','2018-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000138','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2019-10-14','2020-10-14','1 dose','BCH-2019-8561','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2019-49153',NULL,false,'b0000000-0000-0000-0000-000000000003','2019-10-14 08:00:00','2019-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000139','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2020-10-14','2021-10-14','1 dose','BCH-2020-5917','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2020-62628',NULL,false,'b0000000-0000-0000-0000-000000000003','2020-10-14 08:00:00','2020-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000140','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2021-10-14','2022-10-14','1 dose','BCH-2021-7640','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2021-96062',NULL,false,'b0000000-0000-0000-0000-000000000003','2021-10-14 08:00:00','2021-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000141','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2022-10-14','2023-10-14','1 dose','BCH-2022-7171','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2022-77445',NULL,false,'b0000000-0000-0000-0000-000000000003','2022-10-14 08:00:00','2022-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000142','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2023-10-14','2024-10-14','1 dose','BCH-2023-7569','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2023-54586',NULL,false,'b0000000-0000-0000-0000-000000000003','2023-10-14 08:00:00','2023-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000143','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2024-10-14','2025-10-14','1 dose','BCH-2024-6652','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2024-95194',NULL,true,'b0000000-0000-0000-0000-000000000003','2024-10-14 08:00:00','2024-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000144','aa000000-0000-9999-0000-000000000005','Myxomatosis','core','2025-10-14','2026-10-14','1 dose','BCH-2025-6988','VetCore Biologics','b0000000-0000-0000-0000-000000000003','subcutaneous','CERT-2025-64443',NULL,true,'b0000000-0000-0000-0000-000000000003','2025-10-14 08:00:00','2025-10-14 08:00:00'),
  ('f1000000-0000-0000-0000-000000000145','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2014-12-01','2015-12-01','1 dose','BCH-2014-3109','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-37413',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-12-01 08:00:00','2014-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000146','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2015-12-01','2016-12-01','1 dose','BCH-2015-6246','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-22704',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-12-01 08:00:00','2015-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000147','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2016-12-01','2017-12-01','1 dose','BCH-2016-2250','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-41931',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-12-01 08:00:00','2016-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000148','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2017-12-01','2018-12-01','1 dose','BCH-2017-7547','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-99759',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-12-01 08:00:00','2017-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000149','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2018-12-01','2019-12-01','1 dose','BCH-2018-1680','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-55763',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-12-01 08:00:00','2018-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000150','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2019-12-01','2020-12-01','1 dose','BCH-2019-8505','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-87315',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-12-01 08:00:00','2019-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000151','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2020-12-01','2021-12-01','1 dose','BCH-2020-2408','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-92684',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-12-01 08:00:00','2020-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000152','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2021-12-01','2022-12-01','1 dose','BCH-2021-1094','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-13701',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-12-01 08:00:00','2021-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000153','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2022-12-01','2023-12-01','1 dose','BCH-2022-1891','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-76378',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-12-01 08:00:00','2022-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000154','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2023-12-01','2024-12-01','1 dose','BCH-2023-8332','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-89095',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-12-01 08:00:00','2023-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000155','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2024-12-01','2025-12-01','1 dose','BCH-2024-4587','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-68488',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-12-01 08:00:00','2024-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000156','aa000000-0000-9999-0000-000000000006','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2025-12-01','2026-12-01','1 dose','BCH-2025-4785','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-93045',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-12-01 08:00:00','2025-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000157','aa000000-0000-9999-0000-000000000006','Rabies','core','2014-12-01','2017-12-01','1 dose','BCH-2014-6168','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-87734',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-12-01 08:00:00','2014-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000158','aa000000-0000-9999-0000-000000000006','Rabies','core','2017-12-01','2020-12-01','1 dose','BCH-2017-4976','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-97569',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-12-01 08:00:00','2017-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000159','aa000000-0000-9999-0000-000000000006','Rabies','core','2020-12-01','2023-12-01','1 dose','BCH-2020-2058','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-37769',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-12-01 08:00:00','2020-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000160','aa000000-0000-9999-0000-000000000006','Rabies','core','2023-12-01','2026-12-01','1 dose','BCH-2023-5529','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-29642',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-12-01 08:00:00','2023-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000161','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2015-06-01','2016-06-01','1 dose','BCH-2015-7743','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-86634',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-06-01 08:00:00','2015-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000162','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2016-06-01','2017-06-01','1 dose','BCH-2016-1437','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-95337',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-06-01 08:00:00','2016-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000163','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2017-06-01','2018-06-01','1 dose','BCH-2017-6389','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-96149',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-06-01 08:00:00','2017-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000164','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2018-06-01','2019-06-01','1 dose','BCH-2018-7811','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-71431',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-06-01 08:00:00','2018-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000165','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2019-06-01','2020-06-01','1 dose','BCH-2019-9624','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-12397',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-06-01 08:00:00','2019-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000166','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2020-06-01','2021-06-01','1 dose','BCH-2020-9760','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-27225',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-06-01 08:00:00','2020-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000167','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2021-06-01','2022-06-01','1 dose','BCH-2021-9543','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-34399',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000168','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2022-06-01','2023-06-01','1 dose','BCH-2022-9359','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-53376',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000169','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2023-06-01','2024-06-01','1 dose','BCH-2023-1790','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-74867',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000170','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2024-06-01','2025-06-01','1 dose','BCH-2024-4755','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-79739',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000171','aa000000-0000-9999-0000-000000000006','Bordetella (Kennel Cough)','lifestyle','2025-06-01','2026-06-01','1 dose','BCH-2025-1913','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-46039',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000172','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2016-12-01','2017-12-01','1 dose','BCH-2016-9005','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-40539',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-12-01 08:00:00','2016-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000173','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2017-12-01','2018-12-01','1 dose','BCH-2017-1833','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-39314',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-12-01 08:00:00','2017-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000174','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2018-12-01','2019-12-01','1 dose','BCH-2018-6402','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-34928',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-12-01 08:00:00','2018-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000175','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2019-12-01','2020-12-01','1 dose','BCH-2019-3315','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-52333',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-12-01 08:00:00','2019-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000176','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2020-12-01','2021-12-01','1 dose','BCH-2020-3440','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-30392',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-12-01 08:00:00','2020-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000177','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2021-12-01','2022-12-01','1 dose','BCH-2021-1405','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-79134',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-12-01 08:00:00','2021-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000178','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2022-12-01','2023-12-01','1 dose','BCH-2022-8450','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-14290',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-12-01 08:00:00','2022-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000179','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2023-12-01','2024-12-01','1 dose','BCH-2023-9357','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-62080',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-12-01 08:00:00','2023-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000180','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2024-12-01','2025-12-01','1 dose','BCH-2024-1174','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-46851',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-12-01 08:00:00','2024-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000181','aa000000-0000-9999-0000-000000000006','Leptospirosis 4-way','lifestyle','2025-12-01','2026-12-01','1 dose','BCH-2025-2062','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-10339',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-12-01 08:00:00','2025-12-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000182','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2013-05-10','2014-05-10','1 dose','BCH-2013-4259','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-39641',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-05-10 08:00:00','2013-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000183','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2014-05-10','2015-05-10','1 dose','BCH-2014-6037','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-92059',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-05-10 08:00:00','2014-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000184','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2015-05-10','2016-05-10','1 dose','BCH-2015-2670','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-46039',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-05-10 08:00:00','2015-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000185','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2016-05-10','2017-05-10','1 dose','BCH-2016-1268','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-30513',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-05-10 08:00:00','2016-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000186','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2017-05-10','2018-05-10','1 dose','BCH-2017-5823','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-71125',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-05-10 08:00:00','2017-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000187','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2018-05-10','2019-05-10','1 dose','BCH-2018-8902','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-73666',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-05-10 08:00:00','2018-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000188','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2019-05-10','2020-05-10','1 dose','BCH-2019-9007','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-21203',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-05-10 08:00:00','2019-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000189','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2020-05-10','2021-05-10','1 dose','BCH-2020-1499','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-71814',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-05-10 08:00:00','2020-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000190','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2021-05-10','2022-05-10','1 dose','BCH-2021-6143','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-92740',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-05-10 08:00:00','2021-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000191','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2022-05-10','2023-05-10','1 dose','BCH-2022-9380','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-42040',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-05-10 08:00:00','2022-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000192','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2023-05-10','2024-05-10','1 dose','BCH-2023-9319','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-56695',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-05-10 08:00:00','2023-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000193','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2024-05-10','2025-05-10','1 dose','BCH-2024-4667','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-36696',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-05-10 08:00:00','2024-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000194','aa000000-0000-9999-0000-000000000007','CDT 3-way Ovine (Pulpy Kidney/Tetanus/Enterotoxaemia)','core','2025-05-10','2026-05-10','1 dose','BCH-2025-7525','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-61628',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-05-10 08:00:00','2025-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000195','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2013-05-10','2014-05-10','1 dose','BCH-2013-9403','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2013-34959',NULL,false,'b0000000-0000-0000-0000-000000000001','2013-05-10 08:00:00','2013-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000196','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2014-05-10','2015-05-10','1 dose','BCH-2014-6141','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2014-35168',NULL,false,'b0000000-0000-0000-0000-000000000001','2014-05-10 08:00:00','2014-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000197','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2015-05-10','2016-05-10','1 dose','BCH-2015-7552','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2015-95152',NULL,false,'b0000000-0000-0000-0000-000000000001','2015-05-10 08:00:00','2015-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000198','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2016-05-10','2017-05-10','1 dose','BCH-2016-6717','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2016-57302',NULL,false,'b0000000-0000-0000-0000-000000000001','2016-05-10 08:00:00','2016-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000199','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2017-05-10','2018-05-10','1 dose','BCH-2017-3241','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2017-96584',NULL,false,'b0000000-0000-0000-0000-000000000001','2017-05-10 08:00:00','2017-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000200','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2018-05-10','2019-05-10','1 dose','BCH-2018-6555','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-84776',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-05-10 08:00:00','2018-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000201','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2019-05-10','2020-05-10','1 dose','BCH-2019-5448','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-38453',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-05-10 08:00:00','2019-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000202','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2020-05-10','2021-05-10','1 dose','BCH-2020-8993','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-81848',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-05-10 08:00:00','2020-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000203','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2021-05-10','2022-05-10','1 dose','BCH-2021-2459','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-65666',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-05-10 08:00:00','2021-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000204','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2022-05-10','2023-05-10','1 dose','BCH-2022-1730','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-68860',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-05-10 08:00:00','2022-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000205','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2023-05-10','2024-05-10','1 dose','BCH-2023-3447','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-98752',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-05-10 08:00:00','2023-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000206','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2024-05-10','2025-05-10','1 dose','BCH-2024-5126','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-37080',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-05-10 08:00:00','2024-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000207','aa000000-0000-9999-0000-000000000007','Clostridial 8-way (Blackleg + Malignant Oedema)','core','2025-05-10','2026-05-10','1 dose','BCH-2025-1626','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-83088',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-05-10 08:00:00','2025-05-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000208','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2020-05-15','2021-05-15','1 dose','BCH-2020-5442','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-71686',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-05-15 08:00:00','2020-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000209','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2021-05-15','2022-05-15','1 dose','BCH-2021-5247','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-99355',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-05-15 08:00:00','2021-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000210','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2022-05-15','2023-05-15','1 dose','BCH-2022-3520','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-46943',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-05-15 08:00:00','2022-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000211','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2023-05-15','2024-05-15','1 dose','BCH-2023-2592','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-29794',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-05-15 08:00:00','2023-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000212','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2024-05-15','2025-05-15','1 dose','BCH-2024-2490','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-34893',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-05-15 08:00:00','2024-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000213','aa000000-0000-0000-0000-000000000001','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2025-05-15','2026-05-15','1 dose','BCH-2025-4017','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-13416',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-05-15 08:00:00','2025-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000214','aa000000-0000-0000-0000-000000000001','Rabies','core','2020-05-15','2023-05-15','1 dose','BCH-2020-3646','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-98698',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-05-15 08:00:00','2020-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000215','aa000000-0000-0000-0000-000000000001','Rabies','core','2023-05-15','2026-05-15','1 dose','BCH-2023-8518','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-79629',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-05-15 08:00:00','2023-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000216','aa000000-0000-0000-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2021-03-01','2022-03-01','1 dose','BCH-2021-4836','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-37120',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-03-01 08:00:00','2021-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000217','aa000000-0000-0000-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2022-03-01','2023-03-01','1 dose','BCH-2022-6071','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-50998',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-03-01 08:00:00','2022-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000218','aa000000-0000-0000-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2023-03-01','2024-03-01','1 dose','BCH-2023-2636','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-14103',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-03-01 08:00:00','2023-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000219','aa000000-0000-0000-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2024-03-01','2025-03-01','1 dose','BCH-2024-2007','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-12777',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-03-01 08:00:00','2024-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000220','aa000000-0000-0000-0000-000000000001','Bordetella (Kennel Cough)','lifestyle','2025-03-01','2026-03-01','1 dose','BCH-2025-3550','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-74766',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-03-01 08:00:00','2025-03-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000221','aa000000-0000-0000-0000-000000000001','Leptospirosis 4-way','lifestyle','2021-05-15','2022-05-15','1 dose','BCH-2021-5284','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-31693',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-05-15 08:00:00','2021-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000222','aa000000-0000-0000-0000-000000000001','Leptospirosis 4-way','lifestyle','2022-05-15','2023-05-15','1 dose','BCH-2022-2689','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-22019',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-05-15 08:00:00','2022-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000223','aa000000-0000-0000-0000-000000000001','Leptospirosis 4-way','lifestyle','2023-05-15','2024-05-15','1 dose','BCH-2023-8761','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-60165',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-05-15 08:00:00','2023-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000224','aa000000-0000-0000-0000-000000000001','Leptospirosis 4-way','lifestyle','2024-05-15','2025-05-15','1 dose','BCH-2024-8395','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-26253',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-05-15 08:00:00','2024-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000225','aa000000-0000-0000-0000-000000000001','Leptospirosis 4-way','lifestyle','2025-05-15','2026-05-15','1 dose','BCH-2025-9099','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-32868',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-05-15 08:00:00','2025-05-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000226','aa000000-0000-0000-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2021-09-20','2022-09-20','1 dose','BCH-2021-5223','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2021-55202',NULL,false,'b0000000-0000-0000-0000-000000000002','2021-09-20 08:00:00','2021-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000227','aa000000-0000-0000-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2022-09-20','2023-09-20','1 dose','BCH-2022-8857','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2022-70303',NULL,false,'b0000000-0000-0000-0000-000000000002','2022-09-20 08:00:00','2022-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000228','aa000000-0000-0000-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2023-09-20','2024-09-20','1 dose','BCH-2023-9605','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2023-80841',NULL,false,'b0000000-0000-0000-0000-000000000002','2023-09-20 08:00:00','2023-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000229','aa000000-0000-0000-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2024-09-20','2025-09-20','1 dose','BCH-2024-5273','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2024-58760',NULL,true,'b0000000-0000-0000-0000-000000000002','2024-09-20 08:00:00','2024-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000230','aa000000-0000-0000-0000-000000000002','FVRCP (Feline Viral Rhinotracheitis/Calici/Panleukopenia)','core','2025-09-20','2026-09-20','1 dose','BCH-2025-5736','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2025-58124',NULL,true,'b0000000-0000-0000-0000-000000000002','2025-09-20 08:00:00','2025-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000231','aa000000-0000-0000-0000-000000000002','Rabies','core','2021-09-20','2024-09-20','1 dose','BCH-2021-4813','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2021-79800',NULL,false,'b0000000-0000-0000-0000-000000000002','2021-09-20 08:00:00','2021-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000232','aa000000-0000-0000-0000-000000000002','Rabies','core','2024-09-20','2027-09-20','1 dose','BCH-2024-3587','VetCore Biologics','b0000000-0000-0000-0000-000000000002','subcutaneous','CERT-2024-21767',NULL,true,'b0000000-0000-0000-0000-000000000002','2024-09-20 08:00:00','2024-09-20 08:00:00'),
  ('f1000000-0000-0000-0000-000000000233','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2019-08-10','2020-08-10','1 dose','BCH-2019-7647','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-47854',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-08-10 08:00:00','2019-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000234','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2020-08-10','2021-08-10','1 dose','BCH-2020-5120','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-99721',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-08-10 08:00:00','2020-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000235','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2021-08-10','2022-08-10','1 dose','BCH-2021-4933','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-38165',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-08-10 08:00:00','2021-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000236','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2022-08-10','2023-08-10','1 dose','BCH-2022-6388','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-83339',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-10 08:00:00','2022-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000237','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2023-08-10','2024-08-10','1 dose','BCH-2023-3271','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-77024',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-08-10 08:00:00','2023-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000238','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2024-08-10','2025-08-10','1 dose','BCH-2024-8294','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-27117',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-08-10 08:00:00','2024-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000239','aa000000-0000-0000-0000-000000000004','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2025-08-10','2026-08-10','1 dose','BCH-2025-4212','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-52839',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-10 08:00:00','2025-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000240','aa000000-0000-0000-0000-000000000004','Rabies','core','2019-08-10','2022-08-10','1 dose','BCH-2019-4801','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-80318',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-08-10 08:00:00','2019-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000241','aa000000-0000-0000-0000-000000000004','Rabies','core','2022-08-10','2025-08-10','1 dose','BCH-2022-9173','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-44264',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-10 08:00:00','2022-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000242','aa000000-0000-0000-0000-000000000004','Rabies','core','2025-08-10','2028-08-10','1 dose','BCH-2025-1140','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-40940',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-10 08:00:00','2025-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000243','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2020-02-01','2021-02-01','1 dose','BCH-2020-4454','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-62521',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-02-01 08:00:00','2020-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000244','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2021-02-01','2022-02-01','1 dose','BCH-2021-5633','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-28222',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-02-01 08:00:00','2021-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000245','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2022-02-01','2023-02-01','1 dose','BCH-2022-6651','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-38867',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-02-01 08:00:00','2022-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000246','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2023-02-01','2024-02-01','1 dose','BCH-2023-7190','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-34496',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-02-01 08:00:00','2023-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000247','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2024-02-01','2025-02-01','1 dose','BCH-2024-9400','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-91792',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-02-01 08:00:00','2024-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000248','aa000000-0000-0000-0000-000000000004','Bordetella (Kennel Cough)','lifestyle','2025-02-01','2026-02-01','1 dose','BCH-2025-1417','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-54184',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-02-01 08:00:00','2025-02-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000249','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2020-08-10','2021-08-10','1 dose','BCH-2020-3616','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-19493',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-08-10 08:00:00','2020-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000250','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2021-08-10','2022-08-10','1 dose','BCH-2021-5515','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-55594',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-08-10 08:00:00','2021-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000251','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2022-08-10','2023-08-10','1 dose','BCH-2022-1291','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-70685',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-08-10 08:00:00','2022-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000252','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2023-08-10','2024-08-10','1 dose','BCH-2023-3413','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-83391',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-08-10 08:00:00','2023-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000253','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2024-08-10','2025-08-10','1 dose','BCH-2024-8339','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-39573',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-08-10 08:00:00','2024-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000254','aa000000-0000-0000-0000-000000000004','Leptospirosis 4-way','lifestyle','2025-08-10','2026-08-10','1 dose','BCH-2025-9527','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-66586',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-08-10 08:00:00','2025-08-10 08:00:00'),
  ('f1000000-0000-0000-0000-000000000255','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2018-03-15','2019-03-15','1 dose','BCH-2018-6969','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-69788',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-03-15 08:00:00','2018-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000256','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2019-03-15','2020-03-15','1 dose','BCH-2019-8124','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-58004',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-03-15 08:00:00','2019-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000257','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2020-03-15','2021-03-15','1 dose','BCH-2020-2061','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-97228',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-03-15 08:00:00','2020-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000258','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2021-03-15','2022-03-15','1 dose','BCH-2021-6714','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-52035',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-03-15 08:00:00','2021-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000259','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2022-03-15','2023-03-15','1 dose','BCH-2022-9920','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-36568',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-03-15 08:00:00','2022-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000260','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2023-03-15','2024-03-15','1 dose','BCH-2023-1325','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-36211',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-03-15 08:00:00','2023-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000261','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2024-03-15','2025-03-15','1 dose','BCH-2024-9402','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-30496',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-03-15 08:00:00','2024-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000262','aa000000-0000-0000-0000-000000000008','EEE/WEE/WNV (Equine Encephalomyelitis + West Nile)','core','2025-03-15','2026-03-15','1 dose','BCH-2025-3932','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-95837',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-03-15 08:00:00','2025-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000263','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2018-04-01','2019-04-01','1 dose','BCH-2018-9535','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-38666',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-04-01 08:00:00','2018-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000264','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2019-04-01','2020-04-01','1 dose','BCH-2019-1831','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-51829',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-04-01 08:00:00','2019-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000265','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2020-04-01','2021-04-01','1 dose','BCH-2020-6136','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-10561',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-04-01 08:00:00','2020-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000266','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2021-04-01','2022-04-01','1 dose','BCH-2021-8755','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-67107',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-04-01 08:00:00','2021-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000267','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2022-04-01','2023-04-01','1 dose','BCH-2022-6731','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-96991',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-04-01 08:00:00','2022-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000268','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2023-04-01','2024-04-01','1 dose','BCH-2023-8133','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-59063',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-04-01 08:00:00','2023-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000269','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2024-04-01','2025-04-01','1 dose','BCH-2024-5892','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-28850',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-04-01 08:00:00','2024-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000270','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Spring)','core','2025-04-01','2026-04-01','1 dose','BCH-2025-7211','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-83734',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-04-01 08:00:00','2025-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000271','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2018-10-01','2019-10-01','1 dose','BCH-2018-8092','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-52553',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-10-01 08:00:00','2018-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000272','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2019-10-01','2020-10-01','1 dose','BCH-2019-6470','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-21034',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-10-01 08:00:00','2019-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000273','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2020-10-01','2021-10-01','1 dose','BCH-2020-8894','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-36532',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-10-01 08:00:00','2020-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000274','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2021-10-01','2022-10-01','1 dose','BCH-2021-3859','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-40539',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-10-01 08:00:00','2021-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000275','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2022-10-01','2023-10-01','1 dose','BCH-2022-4526','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-94007',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-10-01 08:00:00','2022-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000276','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2023-10-01','2024-10-01','1 dose','BCH-2023-9155','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-34777',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-10-01 08:00:00','2023-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000277','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2024-10-01','2025-10-01','1 dose','BCH-2024-1104','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-67464',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-10-01 08:00:00','2024-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000278','aa000000-0000-0000-0000-000000000008','Influenza/Rhinopneumonitis (Fall)','core','2025-10-01','2026-10-01','1 dose','BCH-2025-2920','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-64651',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-10-01 08:00:00','2025-10-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000279','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2018-03-15','2019-03-15','1 dose','BCH-2018-2124','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-33156',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-03-15 08:00:00','2018-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000280','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2019-03-15','2020-03-15','1 dose','BCH-2019-3295','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2019-76873',NULL,false,'b0000000-0000-0000-0000-000000000001','2019-03-15 08:00:00','2019-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000281','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2020-03-15','2021-03-15','1 dose','BCH-2020-9237','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-41637',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-03-15 08:00:00','2020-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000282','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2021-03-15','2022-03-15','1 dose','BCH-2021-8376','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-86910',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-03-15 08:00:00','2021-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000283','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2022-03-15','2023-03-15','1 dose','BCH-2022-3262','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-19449',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-03-15 08:00:00','2022-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000284','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2023-03-15','2024-03-15','1 dose','BCH-2023-8810','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-10748',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-03-15 08:00:00','2023-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000285','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2024-03-15','2025-03-15','1 dose','BCH-2024-5728','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-26823',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-03-15 08:00:00','2024-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000286','aa000000-0000-0000-0000-000000000008','Rabies (Equine)','core','2025-03-15','2026-03-15','1 dose','BCH-2025-4393','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-24707',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-03-15 08:00:00','2025-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000287','aa000000-0000-0000-0000-000000000008','Tetanus (Equine)','core','2018-03-15','2021-03-15','1 dose','BCH-2018-4961','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2018-10023',NULL,false,'b0000000-0000-0000-0000-000000000001','2018-03-15 08:00:00','2018-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000288','aa000000-0000-0000-0000-000000000008','Tetanus (Equine)','core','2021-03-15','2024-03-15','1 dose','BCH-2021-9218','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-53988',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-03-15 08:00:00','2021-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000289','aa000000-0000-0000-0000-000000000008','Tetanus (Equine)','core','2024-03-15','2027-03-15','1 dose','BCH-2024-5569','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-19288',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-03-15 08:00:00','2024-03-15 08:00:00'),
  ('f1000000-0000-0000-0000-000000000290','aa000000-0000-0000-0000-000000000007','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2021-06-01','2022-06-01','1 dose','BCH-2021-5406','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-92409',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000291','aa000000-0000-0000-0000-000000000007','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2022-06-01','2023-06-01','1 dose','BCH-2022-3120','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-58509',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000292','aa000000-0000-0000-0000-000000000007','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2023-06-01','2024-06-01','1 dose','BCH-2023-7521','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-33052',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000293','aa000000-0000-0000-0000-000000000007','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2024-06-01','2025-06-01','1 dose','BCH-2024-3805','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-86650',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000294','aa000000-0000-0000-0000-000000000007','BVD/IBR/PI3/BRSV 4-way Modified Live','core','2025-06-01','2026-06-01','1 dose','BCH-2025-5713','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-50181',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000295','aa000000-0000-0000-0000-000000000007','Clostridial 7-way (CD-T + Blackleg)','core','2021-06-01','2022-06-01','1 dose','BCH-2021-6491','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-66479',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000296','aa000000-0000-0000-0000-000000000007','Clostridial 7-way (CD-T + Blackleg)','core','2022-06-01','2023-06-01','1 dose','BCH-2022-8096','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-82239',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000297','aa000000-0000-0000-0000-000000000007','Clostridial 7-way (CD-T + Blackleg)','core','2023-06-01','2024-06-01','1 dose','BCH-2023-7596','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-56748',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000298','aa000000-0000-0000-0000-000000000007','Clostridial 7-way (CD-T + Blackleg)','core','2024-06-01','2025-06-01','1 dose','BCH-2024-1201','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-80074',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000299','aa000000-0000-0000-0000-000000000007','Clostridial 7-way (CD-T + Blackleg)','core','2025-06-01','2026-06-01','1 dose','BCH-2025-9447','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-95589',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000300','aa000000-0000-0000-0000-000000000007','Leptospirosis 5-way (Cattle)','core','2021-06-01','2022-06-01','1 dose','BCH-2021-5811','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-60012',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-06-01 08:00:00','2021-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000301','aa000000-0000-0000-0000-000000000007','Leptospirosis 5-way (Cattle)','core','2022-06-01','2023-06-01','1 dose','BCH-2022-2007','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-42892',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-06-01 08:00:00','2022-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000302','aa000000-0000-0000-0000-000000000007','Leptospirosis 5-way (Cattle)','core','2023-06-01','2024-06-01','1 dose','BCH-2023-3681','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-45087',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-06-01 08:00:00','2023-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000303','aa000000-0000-0000-0000-000000000007','Leptospirosis 5-way (Cattle)','core','2024-06-01','2025-06-01','1 dose','BCH-2024-5169','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-82389',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-06-01 08:00:00','2024-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000304','aa000000-0000-0000-0000-000000000007','Leptospirosis 5-way (Cattle)','core','2025-06-01','2026-06-01','1 dose','BCH-2025-6640','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-95277',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-06-01 08:00:00','2025-06-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000305','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2020-10-05','2021-10-05','1 dose','BCH-2020-9718','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-72628',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-10-05 08:00:00','2020-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000306','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2021-10-05','2022-10-05','1 dose','BCH-2021-5486','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-55269',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-10-05 08:00:00','2021-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000307','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2022-10-05','2023-10-05','1 dose','BCH-2022-8964','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-85247',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-10-05 08:00:00','2022-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000308','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2023-10-05','2024-10-05','1 dose','BCH-2023-8292','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-53851',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-10-05 08:00:00','2023-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000309','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2024-10-05','2025-10-05','1 dose','BCH-2024-4402','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-96480',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-10-05 08:00:00','2024-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000310','aa000000-0000-0000-0000-000000000010','DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)','core','2025-10-05','2026-10-05','1 dose','BCH-2025-3544','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-75718',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-10-05 08:00:00','2025-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000311','aa000000-0000-0000-0000-000000000010','Rabies','core','2020-10-05','2023-10-05','1 dose','BCH-2020-2699','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2020-93765',NULL,false,'b0000000-0000-0000-0000-000000000001','2020-10-05 08:00:00','2020-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000312','aa000000-0000-0000-0000-000000000010','Rabies','core','2023-10-05','2026-10-05','1 dose','BCH-2023-2641','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-56653',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-10-05 08:00:00','2023-10-05 08:00:00'),
  ('f1000000-0000-0000-0000-000000000313','aa000000-0000-0000-0000-000000000010','Bordetella (Kennel Cough)','lifestyle','2021-04-01','2022-04-01','1 dose','BCH-2021-3467','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2021-79861',NULL,false,'b0000000-0000-0000-0000-000000000001','2021-04-01 08:00:00','2021-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000314','aa000000-0000-0000-0000-000000000010','Bordetella (Kennel Cough)','lifestyle','2022-04-01','2023-04-01','1 dose','BCH-2022-1539','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2022-39803',NULL,false,'b0000000-0000-0000-0000-000000000001','2022-04-01 08:00:00','2022-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000315','aa000000-0000-0000-0000-000000000010','Bordetella (Kennel Cough)','lifestyle','2023-04-01','2024-04-01','1 dose','BCH-2023-2324','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2023-56448',NULL,false,'b0000000-0000-0000-0000-000000000001','2023-04-01 08:00:00','2023-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000316','aa000000-0000-0000-0000-000000000010','Bordetella (Kennel Cough)','lifestyle','2024-04-01','2025-04-01','1 dose','BCH-2024-3772','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2024-30817',NULL,true,'b0000000-0000-0000-0000-000000000001','2024-04-01 08:00:00','2024-04-01 08:00:00'),
  ('f1000000-0000-0000-0000-000000000317','aa000000-0000-0000-0000-000000000010','Bordetella (Kennel Cough)','lifestyle','2025-04-01','2026-04-01','1 dose','BCH-2025-3511','VetCore Biologics','b0000000-0000-0000-0000-000000000001','subcutaneous','CERT-2025-61789',NULL,true,'b0000000-0000-0000-0000-000000000001','2025-04-01 08:00:00','2025-04-01 08:00:00')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-3: WEIGHT HISTORY (quarterly 2012-2026) ─────────────
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at, created_at) VALUES
  ('f2000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',10.94,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2013-10-15 09:00:00','2013-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000001',13.2,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2014-01-15 09:00:00','2014-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000003','aa000000-0000-9999-0000-000000000001',15.74,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2014-04-15 09:00:00','2014-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000001',18.06,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2014-07-15 09:00:00','2014-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000005','aa000000-0000-9999-0000-000000000001',20.56,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-10-15 09:00:00','2014-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000006','aa000000-0000-9999-0000-000000000001',22.83,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-01-15 09:00:00','2015-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000007','aa000000-0000-9999-0000-000000000001',24.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000008','aa000000-0000-9999-0000-000000000001',27.18,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000009','aa000000-0000-9999-0000-000000000001',29.32,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000010','aa000000-0000-9999-0000-000000000001',32.09,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000011','aa000000-0000-9999-0000-000000000001',34.19,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000012','aa000000-0000-9999-0000-000000000001',34.18,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000013','aa000000-0000-9999-0000-000000000001',34.11,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000014','aa000000-0000-9999-0000-000000000001',34.01,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000015','aa000000-0000-9999-0000-000000000001',33.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000016','aa000000-0000-9999-0000-000000000001',34,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000017','aa000000-0000-9999-0000-000000000001',33.87,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000018','aa000000-0000-9999-0000-000000000001',33.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000019','aa000000-0000-9999-0000-000000000001',34.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000020','aa000000-0000-9999-0000-000000000001',34.09,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000021','aa000000-0000-9999-0000-000000000001',33.77,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000022','aa000000-0000-9999-0000-000000000001',33.85,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000023','aa000000-0000-9999-0000-000000000001',33.9,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000024','aa000000-0000-9999-0000-000000000001',34.08,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000025','aa000000-0000-9999-0000-000000000001',34.17,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000026','aa000000-0000-9999-0000-000000000001',34.08,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000027','aa000000-0000-9999-0000-000000000001',34.23,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000028','aa000000-0000-9999-0000-000000000001',34,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000029','aa000000-0000-9999-0000-000000000001',33.84,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000030','aa000000-0000-9999-0000-000000000001',34.13,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000031','aa000000-0000-9999-0000-000000000001',33.92,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000032','aa000000-0000-9999-0000-000000000001',33.78,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000033','aa000000-0000-9999-0000-000000000001',33.8,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000034','aa000000-0000-9999-0000-000000000001',34.05,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000035','aa000000-0000-9999-0000-000000000001',33.98,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000036','aa000000-0000-9999-0000-000000000001',34.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000037','aa000000-0000-9999-0000-000000000001',34.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000038','aa000000-0000-9999-0000-000000000001',34.04,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000039','aa000000-0000-9999-0000-000000000001',33.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000040','aa000000-0000-9999-0000-000000000001',34.27,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000041','aa000000-0000-9999-0000-000000000001',33.93,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000042','aa000000-0000-9999-0000-000000000001',33.74,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000043','aa000000-0000-9999-0000-000000000001',34.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000044','aa000000-0000-9999-0000-000000000001',33.99,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000045','aa000000-0000-9999-0000-000000000001',33.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000046','aa000000-0000-9999-0000-000000000001',33.76,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000047','aa000000-0000-9999-0000-000000000001',33.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000048','aa000000-0000-9999-0000-000000000001',33.95,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000049','aa000000-0000-9999-0000-000000000001',34.08,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000050','aa000000-0000-9999-0000-000000000001',33.9,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000051','aa000000-0000-9999-0000-000000000002',1.48,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2014-07-15 09:00:00','2014-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000052','aa000000-0000-9999-0000-000000000002',1.9,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2014-10-15 09:00:00','2014-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000053','aa000000-0000-9999-0000-000000000002',2.05,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2015-01-15 09:00:00','2015-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000054','aa000000-0000-9999-0000-000000000002',2.13,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000055','aa000000-0000-9999-0000-000000000002',2.48,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000056','aa000000-0000-9999-0000-000000000002',2.8,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000057','aa000000-0000-9999-0000-000000000002',3.01,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000058','aa000000-0000-9999-0000-000000000002',3.32,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000059','aa000000-0000-9999-0000-000000000002',3.41,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000060','aa000000-0000-9999-0000-000000000002',3.44,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000061','aa000000-0000-9999-0000-000000000002',3.97,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000062','aa000000-0000-9999-0000-000000000002',4.45,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000063','aa000000-0000-9999-0000-000000000002',4.6,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000064','aa000000-0000-9999-0000-000000000002',4.88,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000065','aa000000-0000-9999-0000-000000000002',5.12,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000066','aa000000-0000-9999-0000-000000000002',4.91,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000067','aa000000-0000-9999-0000-000000000002',5.03,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000068','aa000000-0000-9999-0000-000000000002',5.34,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000069','aa000000-0000-9999-0000-000000000002',5.32,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000070','aa000000-0000-9999-0000-000000000002',5.1,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000071','aa000000-0000-9999-0000-000000000002',5.31,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000072','aa000000-0000-9999-0000-000000000002',5.17,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000073','aa000000-0000-9999-0000-000000000002',5.19,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000074','aa000000-0000-9999-0000-000000000002',4.99,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000075','aa000000-0000-9999-0000-000000000002',4.91,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000076','aa000000-0000-9999-0000-000000000002',5.01,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000077','aa000000-0000-9999-0000-000000000002',5.01,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000078','aa000000-0000-9999-0000-000000000002',5.16,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000079','aa000000-0000-9999-0000-000000000002',5.29,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000080','aa000000-0000-9999-0000-000000000002',5.19,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000081','aa000000-0000-9999-0000-000000000002',5.47,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000082','aa000000-0000-9999-0000-000000000002',4.95,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000083','aa000000-0000-9999-0000-000000000002',5.01,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000084','aa000000-0000-9999-0000-000000000002',5.38,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000085','aa000000-0000-9999-0000-000000000002',5.29,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000086','aa000000-0000-9999-0000-000000000002',5.15,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000087','aa000000-0000-9999-0000-000000000002',5.25,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000088','aa000000-0000-9999-0000-000000000002',5.05,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000089','aa000000-0000-9999-0000-000000000002',5.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000090','aa000000-0000-9999-0000-000000000002',5.18,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000091','aa000000-0000-9999-0000-000000000002',5.43,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000092','aa000000-0000-9999-0000-000000000002',5.34,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000093','aa000000-0000-9999-0000-000000000002',5.03,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000094','aa000000-0000-9999-0000-000000000002',5.35,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000095','aa000000-0000-9999-0000-000000000002',5.48,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000096','aa000000-0000-9999-0000-000000000002',5.29,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000097','aa000000-0000-9999-0000-000000000002',5.28,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000098','aa000000-0000-9999-0000-000000000003',200.55,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2012-10-15 09:00:00','2012-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000099','aa000000-0000-9999-0000-000000000003',222.79,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2013-01-15 09:00:00','2013-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000100','aa000000-0000-9999-0000-000000000003',240,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2013-04-15 09:00:00','2013-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000101','aa000000-0000-9999-0000-000000000003',256.78,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2013-07-15 09:00:00','2013-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000102','aa000000-0000-9999-0000-000000000003',277,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2013-10-15 09:00:00','2013-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000103','aa000000-0000-9999-0000-000000000003',291.32,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-01-15 09:00:00','2014-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000104','aa000000-0000-9999-0000-000000000003',307.01,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-04-15 09:00:00','2014-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000105','aa000000-0000-9999-0000-000000000003',320.06,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-07-15 09:00:00','2014-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000106','aa000000-0000-9999-0000-000000000003',341.74,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2014-10-15 09:00:00','2014-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000107','aa000000-0000-9999-0000-000000000003',354.3,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-01-15 09:00:00','2015-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000108','aa000000-0000-9999-0000-000000000003',373.05,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000109','aa000000-0000-9999-0000-000000000003',386.62,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000110','aa000000-0000-9999-0000-000000000003',399.15,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000111','aa000000-0000-9999-0000-000000000003',415,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000112','aa000000-0000-9999-0000-000000000003',436.79,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000113','aa000000-0000-9999-0000-000000000003',450.89,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000114','aa000000-0000-9999-0000-000000000003',465.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000115','aa000000-0000-9999-0000-000000000003',482.8,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000116','aa000000-0000-9999-0000-000000000003',501.49,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000117','aa000000-0000-9999-0000-000000000003',514.43,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000118','aa000000-0000-9999-0000-000000000003',527.75,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000119','aa000000-0000-9999-0000-000000000003',544.94,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000120','aa000000-0000-9999-0000-000000000003',559.41,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000121','aa000000-0000-9999-0000-000000000003',579.15,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000122','aa000000-0000-9999-0000-000000000003',594.05,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000123','aa000000-0000-9999-0000-000000000003',610.32,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000124','aa000000-0000-9999-0000-000000000003',624.61,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000125','aa000000-0000-9999-0000-000000000003',624.8,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000126','aa000000-0000-9999-0000-000000000003',624.87,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000127','aa000000-0000-9999-0000-000000000003',625.07,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000128','aa000000-0000-9999-0000-000000000003',625.26,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000129','aa000000-0000-9999-0000-000000000003',625.18,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000130','aa000000-0000-9999-0000-000000000003',624.75,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000131','aa000000-0000-9999-0000-000000000003',624.83,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000132','aa000000-0000-9999-0000-000000000003',624.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000133','aa000000-0000-9999-0000-000000000003',625.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000134','aa000000-0000-9999-0000-000000000003',625.29,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000135','aa000000-0000-9999-0000-000000000003',625.16,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000136','aa000000-0000-9999-0000-000000000003',624.75,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000137','aa000000-0000-9999-0000-000000000003',625.17,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000138','aa000000-0000-9999-0000-000000000003',624.99,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000139','aa000000-0000-9999-0000-000000000003',625.14,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000140','aa000000-0000-9999-0000-000000000003',625.25,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000141','aa000000-0000-9999-0000-000000000003',625.17,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000142','aa000000-0000-9999-0000-000000000003',625.19,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000143','aa000000-0000-9999-0000-000000000003',625.2,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000144','aa000000-0000-9999-0000-000000000003',625.02,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000145','aa000000-0000-9999-0000-000000000003',624.71,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000146','aa000000-0000-9999-0000-000000000003',624.95,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000147','aa000000-0000-9999-0000-000000000003',625.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000148','aa000000-0000-9999-0000-000000000003',625.13,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000149','aa000000-0000-9999-0000-000000000003',624.77,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000150','aa000000-0000-9999-0000-000000000003',625.13,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000151','aa000000-0000-9999-0000-000000000003',624.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000152','aa000000-0000-9999-0000-000000000004',11.13,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2014-01-15 09:00:00','2014-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000153','aa000000-0000-9999-0000-000000000004',15.76,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2014-04-15 09:00:00','2014-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000154','aa000000-0000-9999-0000-000000000004',18.87,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2014-07-15 09:00:00','2014-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000155','aa000000-0000-9999-0000-000000000004',23.4,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2014-10-15 09:00:00','2014-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000156','aa000000-0000-9999-0000-000000000004',26.62,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2015-01-15 09:00:00','2015-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000157','aa000000-0000-9999-0000-000000000004',29.88,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000158','aa000000-0000-9999-0000-000000000004',33.18,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000159','aa000000-0000-9999-0000-000000000004',37.38,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000160','aa000000-0000-9999-0000-000000000004',39.7,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000161','aa000000-0000-9999-0000-000000000004',43.1,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000162','aa000000-0000-9999-0000-000000000004',46.47,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000163','aa000000-0000-9999-0000-000000000004',50.27,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000164','aa000000-0000-9999-0000-000000000004',54.69,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000165','aa000000-0000-9999-0000-000000000004',57.11,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000166','aa000000-0000-9999-0000-000000000004',60,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000167','aa000000-0000-9999-0000-000000000004',63.47,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000168','aa000000-0000-9999-0000-000000000004',65.96,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000169','aa000000-0000-9999-0000-000000000004',69.43,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000170','aa000000-0000-9999-0000-000000000004',69.9,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000171','aa000000-0000-9999-0000-000000000004',69.86,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000172','aa000000-0000-9999-0000-000000000004',69.92,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000173','aa000000-0000-9999-0000-000000000004',69.77,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000174','aa000000-0000-9999-0000-000000000004',69.81,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000175','aa000000-0000-9999-0000-000000000004',70.17,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000176','aa000000-0000-9999-0000-000000000004',69.72,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000177','aa000000-0000-9999-0000-000000000004',69.89,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000178','aa000000-0000-9999-0000-000000000004',70.25,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000179','aa000000-0000-9999-0000-000000000004',69.9,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000180','aa000000-0000-9999-0000-000000000004',69.75,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000181','aa000000-0000-9999-0000-000000000004',69.75,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000182','aa000000-0000-9999-0000-000000000004',70.09,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000183','aa000000-0000-9999-0000-000000000004',70,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000184','aa000000-0000-9999-0000-000000000004',70.07,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000185','aa000000-0000-9999-0000-000000000004',69.77,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000186','aa000000-0000-9999-0000-000000000004',70.06,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000187','aa000000-0000-9999-0000-000000000004',69.95,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000188','aa000000-0000-9999-0000-000000000004',70.19,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000189','aa000000-0000-9999-0000-000000000004',70,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000190','aa000000-0000-9999-0000-000000000004',70.28,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000191','aa000000-0000-9999-0000-000000000004',69.83,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000192','aa000000-0000-9999-0000-000000000004',69.77,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000193','aa000000-0000-9999-0000-000000000004',70.16,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000194','aa000000-0000-9999-0000-000000000004',70.25,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000195','aa000000-0000-9999-0000-000000000004',69.93,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000196','aa000000-0000-9999-0000-000000000004',70.16,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000197','aa000000-0000-9999-0000-000000000004',70.23,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000198','aa000000-0000-9999-0000-000000000004',70.01,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000199','aa000000-0000-9999-0000-000000000004',70.2,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000200','aa000000-0000-9999-0000-000000000004',70.29,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000201','aa000000-0000-9999-0000-000000000005',0.35,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000202','aa000000-0000-9999-0000-000000000005',0.74,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000203','aa000000-0000-9999-0000-000000000005',0.65,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000204','aa000000-0000-9999-0000-000000000005',0.68,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000205','aa000000-0000-9999-0000-000000000005',0.92,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000206','aa000000-0000-9999-0000-000000000005',0.94,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000207','aa000000-0000-9999-0000-000000000005',1.05,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000208','aa000000-0000-9999-0000-000000000005',1.05,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000209','aa000000-0000-9999-0000-000000000005',1.02,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000210','aa000000-0000-9999-0000-000000000005',1.12,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000211','aa000000-0000-9999-0000-000000000005',1.11,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000212','aa000000-0000-9999-0000-000000000005',1.51,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000213','aa000000-0000-9999-0000-000000000005',1.72,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000214','aa000000-0000-9999-0000-000000000005',1.84,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000215','aa000000-0000-9999-0000-000000000005',2.06,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000216','aa000000-0000-9999-0000-000000000005',1.89,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000217','aa000000-0000-9999-0000-000000000005',1.78,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000218','aa000000-0000-9999-0000-000000000005',1.59,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000219','aa000000-0000-9999-0000-000000000005',1.94,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000220','aa000000-0000-9999-0000-000000000005',1.75,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000221','aa000000-0000-9999-0000-000000000005',1.73,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000222','aa000000-0000-9999-0000-000000000005',1.96,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000223','aa000000-0000-9999-0000-000000000005',1.94,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000224','aa000000-0000-9999-0000-000000000005',1.98,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000225','aa000000-0000-9999-0000-000000000005',2.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000226','aa000000-0000-9999-0000-000000000005',1.96,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000227','aa000000-0000-9999-0000-000000000005',2.31,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000228','aa000000-0000-9999-0000-000000000005',2.12,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000229','aa000000-0000-9999-0000-000000000005',2.09,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000230','aa000000-0000-9999-0000-000000000005',2.22,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000231','aa000000-0000-9999-0000-000000000005',2.39,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000232','aa000000-0000-9999-0000-000000000005',2.07,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000233','aa000000-0000-9999-0000-000000000005',1.94,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000234','aa000000-0000-9999-0000-000000000005',2.05,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000235','aa000000-0000-9999-0000-000000000005',2.31,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000236','aa000000-0000-9999-0000-000000000005',2.26,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000237','aa000000-0000-9999-0000-000000000005',2.48,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000238','aa000000-0000-9999-0000-000000000005',2.26,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000239','aa000000-0000-9999-0000-000000000005',2.34,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000240','aa000000-0000-9999-0000-000000000005',2.18,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000241','aa000000-0000-9999-0000-000000000005',2.24,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000242','aa000000-0000-9999-0000-000000000005',2.41,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000243','aa000000-0000-9999-0000-000000000005',2.08,'kg',NULL,'b0000000-0000-0000-0000-000000000003','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000244','aa000000-0000-9999-0000-000000000005',1.91,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000003','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000245','aa000000-0000-9999-0000-000000000006',7.29,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000246','aa000000-0000-9999-0000-000000000006',10.91,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000247','aa000000-0000-9999-0000-000000000006',13.68,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000248','aa000000-0000-9999-0000-000000000006',16.72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000249','aa000000-0000-9999-0000-000000000006',19.92,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000250','aa000000-0000-9999-0000-000000000006',22.35,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000251','aa000000-0000-9999-0000-000000000006',25.52,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000252','aa000000-0000-9999-0000-000000000006',27.81,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000253','aa000000-0000-9999-0000-000000000006',30.95,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000254','aa000000-0000-9999-0000-000000000006',33.9,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000255','aa000000-0000-9999-0000-000000000006',36.63,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000256','aa000000-0000-9999-0000-000000000006',36.46,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000257','aa000000-0000-9999-0000-000000000006',36.79,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000258','aa000000-0000-9999-0000-000000000006',36.38,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000259','aa000000-0000-9999-0000-000000000006',36.31,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000260','aa000000-0000-9999-0000-000000000006',36.48,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000261','aa000000-0000-9999-0000-000000000006',36.71,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000262','aa000000-0000-9999-0000-000000000006',36.71,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000263','aa000000-0000-9999-0000-000000000006',36.72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000264','aa000000-0000-9999-0000-000000000006',36.3,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000265','aa000000-0000-9999-0000-000000000006',36.43,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000266','aa000000-0000-9999-0000-000000000006',36.64,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000267','aa000000-0000-9999-0000-000000000006',36.2,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000268','aa000000-0000-9999-0000-000000000006',36.73,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000269','aa000000-0000-9999-0000-000000000006',36.32,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000270','aa000000-0000-9999-0000-000000000006',36.69,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000271','aa000000-0000-9999-0000-000000000006',36.36,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000272','aa000000-0000-9999-0000-000000000006',36.4,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000273','aa000000-0000-9999-0000-000000000006',36.66,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000274','aa000000-0000-9999-0000-000000000006',36.64,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000275','aa000000-0000-9999-0000-000000000006',36.51,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000276','aa000000-0000-9999-0000-000000000006',36.45,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000277','aa000000-0000-9999-0000-000000000006',36.74,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000278','aa000000-0000-9999-0000-000000000006',36.26,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000279','aa000000-0000-9999-0000-000000000006',36.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000280','aa000000-0000-9999-0000-000000000006',36.68,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000281','aa000000-0000-9999-0000-000000000006',36.47,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000282','aa000000-0000-9999-0000-000000000006',36.43,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000283','aa000000-0000-9999-0000-000000000006',36.2,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000284','aa000000-0000-9999-0000-000000000006',36.41,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000285','aa000000-0000-9999-0000-000000000006',36.22,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000286','aa000000-0000-9999-0000-000000000006',36.36,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000287','aa000000-0000-9999-0000-000000000006',36.71,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000288','aa000000-0000-9999-0000-000000000006',36.75,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000289','aa000000-0000-9999-0000-000000000007',21.6,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2013-07-15 09:00:00','2013-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000290','aa000000-0000-9999-0000-000000000007',26.19,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2013-10-15 09:00:00','2013-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000291','aa000000-0000-9999-0000-000000000007',31.02,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-01-15 09:00:00','2014-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000292','aa000000-0000-9999-0000-000000000007',34.16,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-04-15 09:00:00','2014-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000293','aa000000-0000-9999-0000-000000000007',37.02,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2014-07-15 09:00:00','2014-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000294','aa000000-0000-9999-0000-000000000007',42.46,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2014-10-15 09:00:00','2014-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000295','aa000000-0000-9999-0000-000000000007',46.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-01-15 09:00:00','2015-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000296','aa000000-0000-9999-0000-000000000007',52.17,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-04-15 09:00:00','2015-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000297','aa000000-0000-9999-0000-000000000007',56.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-07-15 09:00:00','2015-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000298','aa000000-0000-9999-0000-000000000007',60.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2015-10-15 09:00:00','2015-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000299','aa000000-0000-9999-0000-000000000007',64.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2016-01-15 09:00:00','2016-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000300','aa000000-0000-9999-0000-000000000007',69.01,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-04-15 09:00:00','2016-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000301','aa000000-0000-9999-0000-000000000007',71.81,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-07-15 09:00:00','2016-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000302','aa000000-0000-9999-0000-000000000007',71.92,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2016-10-15 09:00:00','2016-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000303','aa000000-0000-9999-0000-000000000007',72.25,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-01-15 09:00:00','2017-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000304','aa000000-0000-9999-0000-000000000007',71.72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-04-15 09:00:00','2017-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000305','aa000000-0000-9999-0000-000000000007',72.12,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2017-07-15 09:00:00','2017-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000306','aa000000-0000-9999-0000-000000000007',71.8,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2017-10-15 09:00:00','2017-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000307','aa000000-0000-9999-0000-000000000007',72.15,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-01-15 09:00:00','2018-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000308','aa000000-0000-9999-0000-000000000007',71.76,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-04-15 09:00:00','2018-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000309','aa000000-0000-9999-0000-000000000007',72.09,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-07-15 09:00:00','2018-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000310','aa000000-0000-9999-0000-000000000007',72.07,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2018-10-15 09:00:00','2018-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000311','aa000000-0000-9999-0000-000000000007',72.2,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000312','aa000000-0000-9999-0000-000000000007',71.83,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000313','aa000000-0000-9999-0000-000000000007',72.22,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000314','aa000000-0000-9999-0000-000000000007',71.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000315','aa000000-0000-9999-0000-000000000007',71.82,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000316','aa000000-0000-9999-0000-000000000007',72.15,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000317','aa000000-0000-9999-0000-000000000007',72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000318','aa000000-0000-9999-0000-000000000007',71.86,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000319','aa000000-0000-9999-0000-000000000007',71.99,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000320','aa000000-0000-9999-0000-000000000007',71.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000321','aa000000-0000-9999-0000-000000000007',72.12,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000322','aa000000-0000-9999-0000-000000000007',72.17,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000323','aa000000-0000-9999-0000-000000000007',72.05,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000324','aa000000-0000-9999-0000-000000000007',71.72,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000325','aa000000-0000-9999-0000-000000000007',71.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000326','aa000000-0000-9999-0000-000000000007',72.17,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000327','aa000000-0000-9999-0000-000000000007',71.83,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000328','aa000000-0000-9999-0000-000000000007',71.97,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000329','aa000000-0000-9999-0000-000000000007',72.08,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000330','aa000000-0000-9999-0000-000000000007',71.89,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000331','aa000000-0000-9999-0000-000000000007',71.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000332','aa000000-0000-9999-0000-000000000007',72.22,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000333','aa000000-0000-9999-0000-000000000007',71.96,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000334','aa000000-0000-9999-0000-000000000007',72.21,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000335','aa000000-0000-9999-0000-000000000007',72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000336','aa000000-0000-9999-0000-000000000007',72.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000337','aa000000-0000-9999-0000-000000000007',72.21,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000338','aa000000-0000-9999-0000-000000000007',71.92,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000339','aa000000-0000-9999-0000-000000000007',72.18,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000340','aa000000-0000-0000-0000-000000000001',15.03,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000341','aa000000-0000-0000-0000-000000000001',18.08,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000342','aa000000-0000-0000-0000-000000000001',21.13,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000343','aa000000-0000-0000-0000-000000000001',23.69,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000344','aa000000-0000-0000-0000-000000000001',26.59,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000345','aa000000-0000-0000-0000-000000000001',29.46,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000346','aa000000-0000-0000-0000-000000000001',33.01,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000347','aa000000-0000-0000-0000-000000000001',33.14,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000348','aa000000-0000-0000-0000-000000000001',33.05,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000349','aa000000-0000-0000-0000-000000000001',32.82,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000350','aa000000-0000-0000-0000-000000000001',33.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000351','aa000000-0000-0000-0000-000000000001',33.24,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000352','aa000000-0000-0000-0000-000000000001',32.88,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000353','aa000000-0000-0000-0000-000000000001',32.91,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000354','aa000000-0000-0000-0000-000000000001',33.23,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000355','aa000000-0000-0000-0000-000000000001',32.96,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000356','aa000000-0000-0000-0000-000000000001',33.09,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000357','aa000000-0000-0000-0000-000000000001',33.25,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000358','aa000000-0000-0000-0000-000000000001',32.87,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000359','aa000000-0000-0000-0000-000000000001',33.06,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000360','aa000000-0000-0000-0000-000000000001',32.77,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000361','aa000000-0000-0000-0000-000000000001',33.04,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000362','aa000000-0000-0000-0000-000000000001',32.84,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000363','aa000000-0000-0000-0000-000000000002',1.57,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000364','aa000000-0000-0000-0000-000000000002',1.5,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000365','aa000000-0000-0000-0000-000000000002',1.67,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000366','aa000000-0000-0000-0000-000000000002',1.68,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000367','aa000000-0000-0000-0000-000000000002',1.86,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000368','aa000000-0000-0000-0000-000000000002',2.22,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000369','aa000000-0000-0000-0000-000000000002',2.7,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000370','aa000000-0000-0000-0000-000000000002',2.6,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000371','aa000000-0000-0000-0000-000000000002',2.89,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000372','aa000000-0000-0000-0000-000000000002',3.34,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000373','aa000000-0000-0000-0000-000000000002',3.63,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000374','aa000000-0000-0000-0000-000000000002',3.52,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000375','aa000000-0000-0000-0000-000000000002',3.73,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000376','aa000000-0000-0000-0000-000000000002',3.64,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000377','aa000000-0000-0000-0000-000000000002',3.64,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000378','aa000000-0000-0000-0000-000000000002',3.64,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000379','aa000000-0000-0000-0000-000000000002',3.86,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000380','aa000000-0000-0000-0000-000000000002',3.83,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000381','aa000000-0000-0000-0000-000000000004',18.52,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000382','aa000000-0000-0000-0000-000000000004',21.24,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000383','aa000000-0000-0000-0000-000000000004',24.31,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000384','aa000000-0000-0000-0000-000000000004',27.42,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000385','aa000000-0000-0000-0000-000000000004',29.53,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000386','aa000000-0000-0000-0000-000000000004',32.54,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000387','aa000000-0000-0000-0000-000000000004',35.09,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000388','aa000000-0000-0000-0000-000000000004',38.1,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000389','aa000000-0000-0000-0000-000000000004',38.72,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000390','aa000000-0000-0000-0000-000000000004',38.39,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000391','aa000000-0000-0000-0000-000000000004',38.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000392','aa000000-0000-0000-0000-000000000004',38.32,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000393','aa000000-0000-0000-0000-000000000004',38.49,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000394','aa000000-0000-0000-0000-000000000004',38.62,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000395','aa000000-0000-0000-0000-000000000004',38.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000396','aa000000-0000-0000-0000-000000000004',38.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000397','aa000000-0000-0000-0000-000000000004',38.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000398','aa000000-0000-0000-0000-000000000004',38.41,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000399','aa000000-0000-0000-0000-000000000004',38.21,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000400','aa000000-0000-0000-0000-000000000004',38.59,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000401','aa000000-0000-0000-0000-000000000004',38.33,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000402','aa000000-0000-0000-0000-000000000004',38.69,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000403','aa000000-0000-0000-0000-000000000004',38.27,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000404','aa000000-0000-0000-0000-000000000004',38.53,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000405','aa000000-0000-0000-0000-000000000004',38.21,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000406','aa000000-0000-0000-0000-000000000004',38.64,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000407','aa000000-0000-0000-0000-000000000008',304.08,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2019-01-15 09:00:00','2019-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000408','aa000000-0000-0000-0000-000000000008',324.7,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-04-15 09:00:00','2019-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000409','aa000000-0000-0000-0000-000000000008',352.79,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-07-15 09:00:00','2019-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000410','aa000000-0000-0000-0000-000000000008',368.87,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2019-10-15 09:00:00','2019-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000411','aa000000-0000-0000-0000-000000000008',386.11,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-01-15 09:00:00','2020-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000412','aa000000-0000-0000-0000-000000000008',406.84,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-04-15 09:00:00','2020-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000413','aa000000-0000-0000-0000-000000000008',432.51,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-07-15 09:00:00','2020-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000414','aa000000-0000-0000-0000-000000000008',452.57,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2020-10-15 09:00:00','2020-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000415','aa000000-0000-0000-0000-000000000008',479.29,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000416','aa000000-0000-0000-0000-000000000008',497.52,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000417','aa000000-0000-0000-0000-000000000008',522.71,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000418','aa000000-0000-0000-0000-000000000008',525.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000419','aa000000-0000-0000-0000-000000000008',524.78,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000420','aa000000-0000-0000-0000-000000000008',525.15,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000421','aa000000-0000-0000-0000-000000000008',525.18,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000422','aa000000-0000-0000-0000-000000000008',524.81,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000423','aa000000-0000-0000-0000-000000000008',525.07,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000424','aa000000-0000-0000-0000-000000000008',524.76,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000425','aa000000-0000-0000-0000-000000000008',525.19,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000426','aa000000-0000-0000-0000-000000000008',525.06,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000427','aa000000-0000-0000-0000-000000000008',524.97,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000428','aa000000-0000-0000-0000-000000000008',524.85,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000429','aa000000-0000-0000-0000-000000000008',525.18,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000430','aa000000-0000-0000-0000-000000000008',525.12,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000431','aa000000-0000-0000-0000-000000000008',525.17,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000432','aa000000-0000-0000-0000-000000000008',525.15,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000433','aa000000-0000-0000-0000-000000000008',525.14,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000434','aa000000-0000-0000-0000-000000000008',524.8,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000435','aa000000-0000-0000-0000-000000000008',524.93,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000436','aa000000-0000-0000-0000-000000000007',200.98,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000437','aa000000-0000-0000-0000-000000000007',230.82,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000438','aa000000-0000-0000-0000-000000000007',252.91,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000439','aa000000-0000-0000-0000-000000000007',282.55,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000440','aa000000-0000-0000-0000-000000000007',317.29,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000441','aa000000-0000-0000-0000-000000000007',347.22,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000442','aa000000-0000-0000-0000-000000000007',372.05,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000443','aa000000-0000-0000-0000-000000000007',393.9,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000444','aa000000-0000-0000-0000-000000000007',417.97,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000445','aa000000-0000-0000-0000-000000000007',452.19,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000446','aa000000-0000-0000-0000-000000000007',482.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000447','aa000000-0000-0000-0000-000000000007',514.28,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000448','aa000000-0000-0000-0000-000000000007',537.16,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000449','aa000000-0000-0000-0000-000000000007',564.46,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000450','aa000000-0000-0000-0000-000000000007',585.26,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000451','aa000000-0000-0000-0000-000000000007',584.85,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000452','aa000000-0000-0000-0000-000000000007',585.11,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000453','aa000000-0000-0000-0000-000000000007',584.84,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000454','aa000000-0000-0000-0000-000000000007',584.99,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000455','aa000000-0000-0000-0000-000000000010',9.51,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-01-15 09:00:00','2021-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000456','aa000000-0000-0000-0000-000000000010',10.9,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000457','aa000000-0000-0000-0000-000000000010',13.08,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000458','aa000000-0000-0000-0000-000000000010',15.04,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000459','aa000000-0000-0000-0000-000000000010',16.99,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000460','aa000000-0000-0000-0000-000000000010',19.07,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000461','aa000000-0000-0000-0000-000000000010',20.73,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000462','aa000000-0000-0000-0000-000000000010',22.75,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000463','aa000000-0000-0000-0000-000000000010',22.37,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000464','aa000000-0000-0000-0000-000000000010',22.21,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000465','aa000000-0000-0000-0000-000000000010',22.24,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000466','aa000000-0000-0000-0000-000000000010',22.55,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000467','aa000000-0000-0000-0000-000000000010',22.34,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000468','aa000000-0000-0000-0000-000000000010',22.75,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000469','aa000000-0000-0000-0000-000000000010',22.37,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000470','aa000000-0000-0000-0000-000000000010',22.75,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000471','aa000000-0000-0000-0000-000000000010',22.7,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000472','aa000000-0000-0000-0000-000000000010',22.46,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000473','aa000000-0000-0000-0000-000000000010',22.59,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000474','aa000000-0000-0000-0000-000000000010',22.45,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000475','aa000000-0000-0000-0000-000000000010',22.48,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000476','aa000000-0000-0000-0000-000000000003',6.63,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000477','aa000000-0000-0000-0000-000000000003',6.96,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000478','aa000000-0000-0000-0000-000000000003',7.52,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
('f2000000-0000-0000-0000-000000000479','aa000000-0000-0000-0000-000000000003',8.02,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000480','aa000000-0000-0000-0000-000000000003',8.27,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000481','aa000000-0000-0000-0000-000000000003',8.93,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000482','aa000000-0000-0000-0000-000000000003',9.29,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000483','aa000000-0000-0000-0000-000000000003',9.85,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000484','aa000000-0000-0000-0000-000000000003',10.06,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000485','aa000000-0000-0000-0000-000000000003',10.69,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000486','aa000000-0000-0000-0000-000000000003',11.04,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000487','aa000000-0000-0000-0000-000000000003',11.51,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000488','aa000000-0000-0000-0000-000000000005',2.67,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-04-15 09:00:00','2021-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000489','aa000000-0000-0000-0000-000000000005',2.88,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2021-07-15 09:00:00','2021-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000490','aa000000-0000-0000-0000-000000000005',3.76,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2021-10-15 09:00:00','2021-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000491','aa000000-0000-0000-0000-000000000005',4.59,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-01-15 09:00:00','2022-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000492','aa000000-0000-0000-0000-000000000005',4.91,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000493','aa000000-0000-0000-0000-000000000005',5.31,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000494','aa000000-0000-0000-0000-000000000005',6.3,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000495','aa000000-0000-0000-0000-000000000005',6.74,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000496','aa000000-0000-0000-0000-000000000005',6.75,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000497','aa000000-0000-0000-0000-000000000005',6.7,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000498','aa000000-0000-0000-0000-000000000005',7.23,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000499','aa000000-0000-0000-0000-000000000005',6.76,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000500','aa000000-0000-0000-0000-000000000005',6.87,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000501','aa000000-0000-0000-0000-000000000005',7.2,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000502','aa000000-0000-0000-0000-000000000005',7.15,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000503','aa000000-0000-0000-0000-000000000005',6.79,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000504','aa000000-0000-0000-0000-000000000005',6.71,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000505','aa000000-0000-0000-0000-000000000005',6.85,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000506','aa000000-0000-0000-0000-000000000005',6.9,'kg',NULL,'b0000000-0000-0000-0000-000000000002','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000507','aa000000-0000-0000-0000-000000000005',6.75,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000002','2026-01-15 09:00:00','2026-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000508','aa000000-0000-0000-0000-000000000009',115.79,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-04-15 09:00:00','2022-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000509','aa000000-0000-0000-0000-000000000009',131.37,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2022-07-15 09:00:00','2022-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000510','aa000000-0000-0000-0000-000000000009',156.73,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2022-10-15 09:00:00','2022-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000511','aa000000-0000-0000-0000-000000000009',184.61,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-01-15 09:00:00','2023-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000512','aa000000-0000-0000-0000-000000000009',210.51,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-15 09:00:00','2023-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000513','aa000000-0000-0000-0000-000000000009',230.64,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-07-15 09:00:00','2023-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000514','aa000000-0000-0000-0000-000000000009',250.15,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2023-10-15 09:00:00','2023-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000515','aa000000-0000-0000-0000-000000000009',271.8,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-15 09:00:00','2024-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000516','aa000000-0000-0000-0000-000000000009',293.58,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-04-15 09:00:00','2024-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000517','aa000000-0000-0000-0000-000000000009',314.28,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-07-15 09:00:00','2024-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000518','aa000000-0000-0000-0000-000000000009',339.64,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2024-10-15 09:00:00','2024-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000519','aa000000-0000-0000-0000-000000000009',366.63,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-15 09:00:00','2025-01-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000520','aa000000-0000-0000-0000-000000000009',391.43,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-04-15 09:00:00','2025-04-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000521','aa000000-0000-0000-0000-000000000009',408.4,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-15 09:00:00','2025-07-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000522','aa000000-0000-0000-0000-000000000009',425.1,'kg','Routine weight check. Animal in good body condition.','b0000000-0000-0000-0000-000000000001','2025-10-15 09:00:00','2025-10-15 09:00:00'),
  ('f2000000-0000-0000-0000-000000000523','aa000000-0000-0000-0000-000000000009',425,'kg',NULL,'b0000000-0000-0000-0000-000000000001','2026-01-15 09:00:00','2026-01-15 09:00:00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 92: VACCINE PROTOCOLS (India + Companion + Equine)
-- ============================================================

INSERT INTO vaccine_protocols (
  id, name, disease, species, applicable_gender, min_age_weeks, max_age_weeks,
  vaccine_category, is_zoonotic, initial_dose_age_weeks, booster_interval_days,
  series_dose_count, series_interval_days, route, dosage_ml, site,
  regulatory_body, regulatory_standard, seasonal_window, country, notes
) VALUES

-- ── INDIA LIVESTOCK ──────────────────────────────────────────────

-- FMD (Foot and Mouth Disease) — cattle/buffalo/sheep/goat — mandatory biannual
('a9000000-0000-0000-0000-000000000001',
 'FMD Vaccine (O+A+Asia1)', 'Foot and Mouth Disease (FMD)',
 ARRAY['cattle','buffalo','sheep','goat','pig'], 'all', 12, NULL,
 'mandatory_govt', false, 12, 182, 1, 0,
 'intramuscular', '2 ml', 'Neck muscle',
 'DAHD (India)', 'DAHD Policy 2019, Animal Husbandry Commissioner Circular',
 'May–June and November–December', 'IN',
 'Mandatory biannual vaccination drive under GoI FMD-CP. Trivalent O+A+Asia1 strains. Cold chain required.'),

-- Black Quarter (BQ / Blackleg) — cattle/buffalo — annual pre-monsoon
('a9000000-0000-0000-0000-000000000002',
 'BQ Vaccine (Black Quarter)', 'Black Quarter (Blackleg)',
 ARRAY['cattle','buffalo'], 'all', 6, NULL,
 'mandatory_govt', false, 6, 365, 1, 0,
 'subcutaneous', '2 ml', 'Shoulder',
 'DAHD (India)', 'DAHD Annual Vaccination Schedule',
 'Pre-monsoon (April–May)', 'IN',
 'Annual pre-monsoon vaccination. Particularly important for calves 6 months–3 years. Combined HS+BQ vaccines available.'),

-- Haemorrhagic Septicaemia (HS) — cattle/buffalo — annual pre-monsoon
('a9000000-0000-0000-0000-000000000003',
 'HS Vaccine (Haemorrhagic Septicaemia)', 'Haemorrhagic Septicaemia (HS)',
 ARRAY['cattle','buffalo'], 'all', 6, NULL,
 'mandatory_govt', false, 6, 365, 1, 0,
 'subcutaneous', '2 ml', 'Shoulder',
 'DAHD (India)', 'DAHD Annual Vaccination Schedule',
 'Pre-monsoon (April–May)', 'IN',
 'Annual pre-monsoon. High endemicity in India. Pasteurella multocida types B:2 and E:2. Often combined with BQ.'),

-- PPR (Peste des Petits Ruminants) — sheep/goat — once every 3 years
('a9000000-0000-0000-0000-000000000004',
 'PPR Vaccine', 'Peste des Petits Ruminants (PPR)',
 ARRAY['sheep','goat'], 'all', 4, NULL,
 'mandatory_govt', false, 4, 1095, 1, 0,
 'subcutaneous', '1 ml', 'Neck or shoulder',
 'DAHD (India)', 'DAHD PPR Eradication Programme 2021',
 'Any season', 'IN',
 'Single dose provides immunity for 3 years. National eradication programme target: 2030. OIE-listed disease.'),

-- Brucellosis S19 — heifers only (female cattle 4–8 months)
('a9000000-0000-0000-0000-000000000005',
 'Brucellosis S19 (Conjunctival)', 'Brucellosis (Contagious Abortion)',
 ARRAY['cattle'], 'female', 16, 32,
 'mandatory_govt', true, 16, 0, 1, 0,
 'intranasal', '2 ml', 'Conjunctival sac',
 'DAHD (India)', 'DAHD Brucellosis Control Programme',
 'Any season', 'IN',
 'One-time vaccination for female calves 4–8 months only. Zoonotic — precautions required. Do NOT vaccinate pregnant animals.'),

-- Anthrax — endemic areas, various species
('a9000000-0000-0000-0000-000000000006',
 'Anthrax Spore Vaccine', 'Anthrax',
 ARRAY['cattle','buffalo','sheep','goat','horse'], 'all', 8, NULL,
 'mandatory_govt', true, 8, 365, 1, 0,
 'subcutaneous', '1 ml', 'Shoulder or neck',
 'DAHD (India)', 'DAHD Regional Outbreak Protocol',
 'Pre-monsoon (April–May)', 'IN',
 'Annual vaccination in endemically affected districts. Sterne strain spore vaccine. Zoonotic — high risk.'),

-- Rabies — all species, zoonotic, legally mandated
('a9000000-0000-0000-0000-000000000007',
 'Rabies Vaccine (Annual)', 'Rabies',
 ARRAY['dog','cat','cattle','buffalo','sheep','goat','horse','rabbit'], 'all', 12, NULL,
 'legally_mandated', true, 12, 365, 1, 0,
 'intramuscular', '1 ml', 'Neck muscle',
 'DAHD / AHL (India)', 'Prevention of Cruelty to Animals Act 1960, NHM Rabies Control',
 'Any season', 'IN',
 'Annual booster mandatory for dogs and cats. Zoonotic — 100% fatal without prophylaxis. PrEP for high-risk exposure.'),

-- Etec/Rota Calf Scours — dairy calves
('a9000000-0000-0000-0000-000000000008',
 'Calf Scours Vaccine (Rotavirus/Coronavirus/E.coli)', 'Calf Scours (Neonatal Diarrhea)',
 ARRAY['cattle','buffalo'], 'female', 28, NULL,
 'non_core', false, 28, 365, 1, 0,
 'intramuscular', '2 ml', 'Neck muscle',
 'Manufacturer / IVRI', 'IVRI Recommendations',
 'Any season — vaccinate dry cows 3–6 weeks before calving', 'IN',
 'Vaccinate dry cows. Colostral antibodies protect newborn calves. Recommended for intensive dairy farms.'),

-- ── COMPANION ANIMALS ────────────────────────────────────────────

-- DA2PP (Core dogs) — distemper, adenovirus type 2, parvovirus, parainfluenza
('a9000000-0000-0000-0000-000000000009',
 'DA2PP (Core Dog Vaccine)', 'Canine Distemper / Parvovirus / Adenovirus-2 / Parainfluenza',
 ARRAY['dog'], 'all', 6, NULL,
 'core', false, 6, 365, 4, 28,
 'subcutaneous', '1 ml', 'Scruff of neck',
 'WSAVA', 'WSAVA Vaccination Guidelines 2022',
 'Any season', 'ALL',
 'Puppy series: doses at 6–8wk, 10–12wk, 14–16wk, 18–20wk. First adult booster at 1 year, then every 3 years (triennial). Killed or MLV.'),

-- FVRCP (Core cats) — feline viral rhinotracheitis, calicivirus, panleukopenia
('a9000000-0000-0000-0000-000000000010',
 'FVRCP (Core Cat Vaccine)', 'Feline Viral Rhinotracheitis / Calicivirus / Panleukopenia',
 ARRAY['cat'], 'all', 6, NULL,
 'core', false, 6, 365, 3, 28,
 'subcutaneous', '1 ml', 'Scruff of neck',
 'WSAVA', 'WSAVA Vaccination Guidelines 2022',
 'Any season', 'ALL',
 'Kitten series: doses at 6–8wk, 10–12wk, 14–16wk. Adult booster at 1 year, then triennial. Panleukopenia immunity may last 7+ years.'),

-- Bordetella (dogs) — kennel cough, non-core but recommended for social dogs
('a9000000-0000-0000-0000-000000000011',
 'Bordetella (Kennel Cough)', 'Canine Infectious Respiratory Disease (Bordetella bronchiseptica)',
 ARRAY['dog'], 'all', 8, NULL,
 'non_core', false, 8, 365, 1, 0,
 'intranasal', '1 ml', 'Nasal instillation',
 'WSAVA', 'WSAVA Non-Core Vaccination Recommendations 2022',
 'Any season — ideally 1–2 weeks before boarding/kennels', 'ALL',
 'Annual. Recommended for dogs attending kennels, dog shows, doggy daycare. Intranasal preferred over injectable.'),

-- Leptospirosis (dogs) — non-core but recommended in India
('a9000000-0000-0000-0000-000000000012',
 'Leptospirosis (Lepto4)', 'Leptospirosis',
 ARRAY['dog'], 'all', 8, NULL,
 'non_core', true, 8, 365, 2, 21,
 'subcutaneous', '1 ml', 'Scruff of neck',
 'WSAVA', 'WSAVA Non-Core + DAHD Zoonotic Risk Assessment India',
 'Any season — pre-monsoon ideal', 'ALL',
 'Annual. Zoonotic. High risk in India monsoon flooding areas. 2-dose primary series 3 weeks apart.'),

-- Feline Leukemia (FeLV) — non-core cats
('a9000000-0000-0000-0000-000000000013',
 'FeLV (Feline Leukemia Virus)', 'Feline Leukemia',
 ARRAY['cat'], 'all', 8, NULL,
 'non_core', false, 8, 365, 2, 21,
 'subcutaneous', '1 ml', 'Left hind limb',
 'WSAVA', 'WSAVA Non-Core Vaccination Recommendations 2022',
 'Any season', 'ALL',
 'For cats with outdoor access or in multi-cat households. 2-dose primary series then annual. Test before vaccinating.'),

-- ── EQUINE ───────────────────────────────────────────────────────

-- Equine Tetanus — annual
('a9000000-0000-0000-0000-000000000014',
 'Equine Tetanus Toxoid', 'Tetanus (Clostridium tetani)',
 ARRAY['horse'], 'all', 12, NULL,
 'core', false, 12, 365, 1, 0,
 'intramuscular', '1 ml', 'Neck muscle',
 'BEVA / AAEP', 'BEVA Vaccination Guidelines 2023',
 'Any season', 'ALL',
 'Annual core vaccination for all horses. Primary series: 2 doses 4 weeks apart. Foals: start at 3 months.'),

-- EHV-1/4 (Equine Herpesvirus) — biannual
('a9000000-0000-0000-0000-000000000015',
 'EHV-1/4 (Equine Herpesvirus)', 'Equine Herpesvirus Rhinopneumonitis',
 ARRAY['horse'], 'all', 12, NULL,
 'core', false, 12, 182, 1, 0,
 'intramuscular', '1 ml', 'Neck muscle',
 'BEVA / AAEP', 'BEVA Vaccination Guidelines 2023',
 'Any season — booster every 6 months', 'ALL',
 'Biannual. Particularly important for pregnant mares (booster at 5, 7, and 9 months gestation).'),

-- Equine Influenza — biannual
('a9000000-0000-0000-0000-000000000016',
 'Equine Influenza', 'Equine Influenza',
 ARRAY['horse'], 'all', 24, NULL,
 'core', false, 24, 182, 2, 21,
 'intramuscular', '1 ml', 'Neck muscle',
 'BEVA / OIE', 'OIE Terrestrial Animal Health Code, BEVA Guidelines 2023',
 'Any season', 'ALL',
 'Biannual. Primary series: 2 doses 3–6 weeks apart. Required for most competition events.'),

-- ── DOGS ─────────────────────────────────────────────────────

-- Rabies — dog — annual/triennial (required by law in most countries)
('a9000000-0000-0000-0000-000000000020',
 'Rabies (Canine)', 'Rabies',
 ARRAY['dog'], 'all', 12, NULL,
 'mandatory_govt', true, 12, 365, 1, 0,
 'subcutaneous', '1 ml', 'Right rear leg',
 'WSAVA / BVA', 'WSAVA Vaccination Guidelines 2022, Local Rabies Control Act',
 'Any season', 'ALL',
 'Core vaccine. Legally mandatory in most countries. First dose at 12 weeks, booster at 1 year, then annually or every 3 years depending on vaccine label and local law.'),

-- DHPP (Distemper-Hepatitis-Parvovirus-Parainfluenza) — core puppy series
('a9000000-0000-0000-0000-000000000021',
 'DHPP (Distemper, Hepatitis, Parvo, Para-Influenza)', 'Canine Distemper / Hepatitis / Parvovirus / Parainfluenza',
 ARRAY['dog'], 'all', 6, NULL,
 'core', false, 6, 1095, 3, 21,
 'subcutaneous', '1 ml', 'Right shoulder',
 'WSAVA / AAHA', 'WSAVA Vaccination Guidelines 2022, AAHA Canine Vaccination Guidelines 2022',
 'Any season', 'ALL',
 'Core. Puppy series: 6, 9, 12 weeks then booster at 1 year, then every 3 years. Do not skip - parvovirus is highly fatal in unvaccinated puppies.'),

-- Bordetella (Kennel Cough) — annual
('a9000000-0000-0000-0000-000000000022',
 'Bordetella bronchiseptica (Kennel Cough)', 'Infectious Tracheobronchitis',
 ARRAY['dog'], 'all', 8, NULL,
 'non_core', false, 8, 365, 1, 0,
 'intranasal', '1 ml', 'Intranasal',
 'WSAVA / AAHA', 'WSAVA Vaccination Guidelines 2022',
 'Any season — required before boarding/kenneling', 'ALL',
 'Non-core but recommended for all social dogs. Intranasal preferred. Required by most boarding facilities and dog parks.'),

-- Leptospirosis — annual
('a9000000-0000-0000-0000-000000000023',
 'Leptospirosis (L4)', 'Leptospirosis',
 ARRAY['dog'], 'all', 8, NULL,
 'non_core', true, 8, 365, 2, 21,
 'subcutaneous', '1 ml', 'Left shoulder',
 'WSAVA / AAHA', 'WSAVA Vaccination Guidelines 2022',
 'Any season — higher risk in monsoon/wet season', 'ALL',
 'Zoonotic. Non-core but strongly recommended in endemic areas. Annual boosters required for maintained immunity. L4 covers 4 serovars.'),

-- Canine Influenza (H3N2/H3N8) — biannual
('a9000000-0000-0000-0000-000000000024',
 'Canine Influenza (H3N2/H3N8)', 'Canine Influenza',
 ARRAY['dog'], 'all', 6, NULL,
 'non_core', false, 6, 182, 2, 21,
 'subcutaneous', '1 ml', 'Right shoulder',
 'AAHA', 'AAHA Canine Vaccination Guidelines 2022',
 'Any season', 'ALL',
 'Non-core. Recommended for dogs with frequent exposure (shows, boarding, shelters). Primary 2-dose series 3 weeks apart, then biannual boosters.'),

-- ── CATS ─────────────────────────────────────────────────────

-- Rabies (Feline) — annual
('a9000000-0000-0000-0000-000000000025',
 'Rabies (Feline)', 'Rabies',
 ARRAY['cat'], 'all', 12, NULL,
 'mandatory_govt', true, 12, 365, 1, 0,
 'subcutaneous', '1 ml', 'Right rear leg',
 'WSAVA / ABCD', 'WSAVA Vaccination Guidelines 2022, ABCD Guidelines 2023',
 'Any season', 'ALL',
 'Core. Legally mandatory in most jurisdictions. Annual or 3-year vaccine depending on product label.'),

-- FVRCP (Feline Distemper+Calici+Herpes) — triennial
('a9000000-0000-0000-0000-000000000026',
 'FVRCP (Feline Panleukopenia, Herpesvirus, Calicivirus)', 'Feline Panleukopenia / Herpesvirus / Calicivirus',
 ARRAY['cat'], 'all', 6, NULL,
 'core', false, 6, 1095, 3, 21,
 'subcutaneous', '1 ml', 'Right shoulder',
 'WSAVA / ABCD', 'WSAVA Vaccination Guidelines 2022',
 'Any season', 'ALL',
 'Core. Kitten series at 6, 9, 12 weeks. Booster at 1 year then every 3 years. Highly effective. Panleukopenia (feline parvo) is often fatal without vaccination.'),

-- FeLV (Feline Leukemia) — annual
('a9000000-0000-0000-0000-000000000027',
 'FeLV (Feline Leukemia Virus)', 'Feline Leukemia',
 ARRAY['cat'], 'all', 8, NULL,
 'non_core', false, 8, 365, 2, 21,
 'subcutaneous', '1 ml', 'Left rear leg',
 'WSAVA / ABCD', 'WSAVA Vaccination Guidelines 2022, ABCD Guidelines 2023',
 'Any season', 'ALL',
 'Non-core but recommended for outdoor or multi-cat household cats. Primary 2-dose series 3-4 weeks apart. Annual boosters for at-risk cats.')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 93: VACCINE PROTOCOL REGULATORY CHANGE HISTORY
-- ============================================================

INSERT INTO vaccine_protocol_changes (
  id, protocol_id, changed_field, old_value, new_value,
  change_reason, regulatory_standard, effective_date
) VALUES

-- FMD booster interval changed from annual to biannual per India policy update
('b9c00000-0000-0000-0000-000000000001',
 'a9000000-0000-0000-0000-000000000001',
 'booster_interval_days', '365', '182',
 'GoI FMD-CP revised schedule — biannual vaccination proven more effective in high-endemic zones',
 'DAHD Policy Notification 2019', '2019-04-01'),

-- PPR change from biannual to triennial following DAHD efficacy data
('b9c00000-0000-0000-0000-000000000002',
 'a9000000-0000-0000-0000-000000000004',
 'booster_interval_days', '730', '1095',
 'DAHD eradication programme data shows single dose provides 3-year immunity',
 'DAHD PPR Eradication Programme 2021', '2021-06-01'),

-- DA2PP triennial booster extended life per WSAVA 2022
('b9c00000-0000-0000-0000-000000000003',
 'a9000000-0000-0000-0000-000000000009',
 'booster_interval_days', '365', '1095',
 'WSAVA 2022 guideline update — adult dog triennial CDV/CPV-2 revaccination after 1-year booster',
 'WSAVA Vaccination Guidelines 2022', '2022-03-01')

ON CONFLICT (id) DO NOTHING;


-- ── STEP TL-4a: MEDICAL RECORDS (all types, 2013-2026) ───────────
INSERT INTO medical_records (id, user_id, animal_id, consultation_id, veterinarian_id, record_number, record_type, title, content, severity, status, medications, attachments, is_confidential, follow_up_date, tags, file_url, created_by, created_at, updated_at) VALUES
  ('f3000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00001','diagnosis','Puppy Wellness Examination','8-week old Golden Retriever puppy. Bright, alert, responsive. All reflexes normal. Healthy weight 8kg. No abnormalities detected. Started core vaccination series.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2013-09-23 10:00:00','2013-09-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00002','vaccination','Annual Vaccine Review - 1 Year','1 year checkup. Excellent health. DHPP booster administered. Heart, lungs, abdomen all normal. Neutered at 9 months - healing well.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2014-08-11 10:00:00','2014-08-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00003','diagnosis','Intermittent Vomiting - Dietary Indiscretion','Owner reports Bruno ate from trash can 2 days ago. Vomiting 3x. Mild gastroenteritis confirmed. No foreign body on palpation. Prescribed bland diet for 5 days.','low','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2015-09-12 10:00:00','2015-09-12 10:00:00'),
  ('f3000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00004','lab_report','Annual Blood Panel and Urinalysis','CBC: WBC 8.2, RBC 6.8, HGB 15.1, PLT 312 - all within normal limits. BMP: BUN 14, Creatinine 0.9, ALT 32, Alkaline Phosphatase 65 - normal. UA: specific gravity 1.025, no protein, no glucose.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2016-03-10 10:00:00','2016-03-10 10:00:00'),
  ('f3000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00005','diagnosis','Right Cruciate Ligament Partial Tear Suspected','Presented with intermittent right hind limb lameness. Positive drawer test. Radiographs show effusion in right stifle. Partial CCL tear suspected. Cage rest prescribed and weight management initiated. Surgery consultation recommended if no improvement in 6 weeks.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2016-11-23 10:00:00','2016-11-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00006','surgery','TPLO Surgery - Right Stifle (CCL Repair)','Tibial Plateau Leveling Osteotomy performed under general anesthesia. Duration 2.5 hours. Blood loss minimal. Recovery excellent. Immediate post-op radiographs confirm good plate and screw placement. Weight-bearing walking expected in 2 weeks.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2017-02-07 10:00:00','2017-02-07 10:00:00'),
  ('f3000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00007','follow_up','Post-TPLO 3 Month Recheck','Excellent recovery. Full weight bearing on right hind limb. Radiographs show good osseous healing. Range of motion 75% of normal. Hydrotherapy started 2x/week. Prognosis excellent. Expected full function in 3-4 more months.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2017-05-12 10:00:00','2017-05-12 10:00:00'),
  ('f3000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00008','lab_report','Annual Blood Panel - 5 Years','CBC and chemistry within normal limits. Heartworm test negative. Fecal: no parasites. Tick-borne disease panel negative. Excellent overall health. Gentle increase in ALP noted (88) - monitor annually.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2018-08-25 10:00:00','2018-08-25 10:00:00'),
  ('f3000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00009','imaging','Hip Radiographs - Hip Dysplasia Evaluation','OFA radiographs performed. Bilateral hip dysplasia confirmed - Grade II (moderate). Femoral head conformation irregular bilaterally. Joint space narrowing evident. Degenerative changes beginning. NSAIDs and glucosamine supplement initiated. Swimming highly recommended. Annual recheck.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-06-26 10:00:00','2019-06-26 10:00:00'),
  ('f3000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00010','prescription','Meloxicam + Joint Supplement - Hip Dysplasia Management','Meloxicam 1mg/kg daily with food for ongoing hip dysplasia management. Cosequin DS (glucosamine/chondroitin/MSM) 1 chew daily. Strict weight management - keep at 30-32kg. Low-impact exercise. Recheck in 6 months.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-09-21 10:00:00','2019-09-21 10:00:00'),
  ('f3000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00011','follow_up','Hip Dysplasia Annual Recheck - Year 1 on NSAIDs','Mobility improved significantly on meloxicam. Owner reports 70% improvement in morning stiffness. Weight maintained at 31.5kg. Radiographs show mild progression but manageable. Continue current protocol.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2020-03-21 10:00:00','2020-03-21 10:00:00'),
  ('f3000000-0000-0000-0000-000000000012','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00012','lab_report','Annual Comprehensive Blood Panel - 8 Years','CBC: mild normocytic normochromic anemia (HGB 12.8 - slightly low). Chemistry: ALT elevated at 115 (normal <80), ALP 210. Kidney values normal. U/A normal. Recommend recheck in 3 months and consider hepatic workup.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2021-07-17 10:00:00','2021-07-17 10:00:00'),
  ('f3000000-0000-0000-0000-000000000013','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00013','imaging','Abdominal Ultrasound - Hepatomegaly Investigation','Liver mildly enlarged with coarse echogenicity consistent with hepatopathy. No mass lesions identified. Gallbladder normal. Spleen, kidneys, bladder all normal. Hepatocutaneous syndrome and chronic steroid hepatopathy ruled out. Recommend liver biopsy if ALT persists.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2022-01-20 10:00:00','2022-01-20 10:00:00'),
  ('f3000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00014','diagnosis','Grade II Cardiac Murmur Detected - Dilated Cardiomyopathy Screening','Left apical systolic murmur grade II/VI detected on routine auscultation. Breed predisposition (Golden Retriever) for dilated cardiomyopathy noted. Chest radiograph shows mild cardiomegaly. Echocardiogram arranged. Pimobendan 0.25mg/kg q12h started prophylactically.','high','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2023-04-21 10:00:00','2023-04-21 10:00:00'),
  ('f3000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00015','imaging','Echocardiogram - DCM Staging','Echocardiogram reveals mild left ventricular dilation. EF 48% (borderline normal 50%). No significant mitral regurgitation. Pre-clinical DCM consistent. Pimobendan continued. Taurine supplementation added. Recheck echo in 6 months. Owner education on signs of decompensation provided.','high','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2023-07-14 10:00:00','2023-07-14 10:00:00'),
  ('f3000000-0000-0000-0000-000000000016','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00016','follow_up','Cardiac Recheck - Pre-clinical DCM Monitoring','Bruno stable on pimobendan + taurine. EF maintained at 49%. No signs of CHF. Good quality of life. Continue current protocol. Sodium-restricted diet initiated. Next echo 6 months.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2024-01-10 10:00:00','2024-01-10 10:00:00'),
  ('f3000000-0000-0000-0000-000000000017','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00017','lab_report','Senior Blood Panel - 12 Years','CBC: normocytic anemia stable (HGB 12.4). ALP elevated 285, ALT 142 - hepatopathy worsening mildly. BUN and creatinine normal. T4 within normal limits. Urine protein:creatinine ratio 0.28 (borderline). Recommend renal diet trial and hepatic supplement.','high','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2025-06-14 10:00:00','2025-06-14 10:00:00'),
  ('f3000000-0000-0000-0000-000000000018','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00018','diagnosis','Kitten Wellness - First Visit','8-week DSH kitten. Alert and playful. No abnormalities. Started FVRCP series. Discussed nutrition and indoor enrichment.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2014-06-25 10:00:00','2014-06-25 10:00:00'),
  ('f3000000-0000-0000-0000-000000000019','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00019','lab_report','Annual Wellness Blood Panel','CBC and chemistry unremarkable. FeLV/FIV negative. Fecal: Giardia identified. Fenbendazole 50mg/kg for 5 days prescribed.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2016-05-14 10:00:00','2016-05-14 10:00:00'),
  ('f3000000-0000-0000-0000-000000000020','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00020','diagnosis','Urinary Straining - Feline Lower Urinary Tract Disease','24-hour history of straining to urinate. Small amounts of blood-tinged urine. Bladder moderately distended on palpation. Urethral obstruction ruled out - can urinate. Idiopathic FLUTD confirmed. Hill''s c/d diet, increased water intake, Prazosin started.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2018-09-21 10:00:00','2018-09-21 10:00:00'),
  ('f3000000-0000-0000-0000-000000000021','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00021','follow_up','FLUTD Recheck - 6 Months Post Episode','No recurrence on Hill''s c/d. Tiger using water fountain. Urinalysis normal. Discuss transitioning to wet food only for long term management. Stressors in household evaluated.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2019-03-17 10:00:00','2019-03-17 10:00:00'),
  ('f3000000-0000-0000-0000-000000000022','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00022','diagnosis','Weight Loss and Polydipsia Investigation','Progressive weight loss 1.2kg over 3 months. Increased thirst and urination. Physical exam: poor coat quality, palpable goiter. T4 = 7.8 ug/dL (normal < 3.5). Hyperthyroidism confirmed.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2020-11-17 10:00:00','2020-11-17 10:00:00'),
  ('f3000000-0000-0000-0000-000000000023','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00023','prescription','Methimazole - Hyperthyroidism Management','Methimazole 2.5mg PO BID (every 12 hours) for feline hyperthyroidism. Recheck T4 in 4 weeks. Monitor for side effects: pruritus of face, anorexia, vomiting. CBC and chemistry at first recheck.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2021-01-10 10:00:00','2021-01-10 10:00:00'),
  ('f3000000-0000-0000-0000-000000000024','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00024','follow_up','Hyperthyroid Recheck - 4 Weeks on Methimazole','T4 = 2.1 ug/dL - excellent response! Weight stable. No side effects. CBC and chemistry normal including kidney values. Continue methimazole 2.5mg BID. Next recheck in 3 months.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2021-02-11 10:00:00','2021-02-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000025','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00025','diagnosis','Dental Disease Grade III - Dental Prophylaxis Required','Oral exam: severe calculus accumulation, grade III periodontal disease, 3 teeth with mobility (resorptive lesions). Dental radiographs show root resorption. Dental prophylaxis + extraction of 4 teeth (104, 204, 308, 408) scheduled.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2022-04-23 10:00:00','2022-04-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000026','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00026','surgery','Dental Prophylaxis + Tooth Extractions x4','Full-mouth dental radiographs. COHAT performed. Scaled and polished all teeth. Extracted 4 teeth due to stage III-IV feline tooth resorption. 2 lacerations sutured, dissolvable. Recovery uneventful. Soft food for 10 days.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2022-06-25 10:00:00','2022-06-25 10:00:00'),
  ('f3000000-0000-0000-0000-000000000027','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00027','lab_report','Annual Senior Panel + T4 Monitoring','T4 = 2.8 (within normal on methimazole). Creatinine slightly elevated 1.9 (normal < 2.1). BUN 28. USG 1.018. Early CKD stage I suspected. Maintain hydration. Renal diet introduced. Next T4 check 6 months.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2023-08-24 10:00:00','2023-08-24 10:00:00'),
  ('f3000000-0000-0000-0000-000000000028','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00028','diagnosis','CKD Stage II Progression + Anemia','Creatinine 2.6, BUN 42, phosphorus 5.8. USG 1.012. SDMA 22. CKD stage II confirmed with early phosphorus accumulation. PCV 24% - mild non-regenerative anemia. Started phosphate binder (aluminum hydroxide), Darbepoetin for anemia. Subcutaneous fluids at home.','high','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2024-10-26 10:00:00','2024-10-26 10:00:00'),
  ('f3000000-0000-0000-0000-000000000029','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002',NULL,'b0000000-0000-0000-0000-000000000002','MR-TL-00029','follow_up','CKD Recheck - 5 Months on Supportive Care','Creatinine 2.4 (slight improvement), BUN 38. Owner reports good appetite on renal diet. SubQ fluids well tolerated at home 150mL daily. PCV improved to 27%. Continue current protocol.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000002','2025-03-10 10:00:00','2025-03-10 10:00:00'),
  ('f3000000-0000-0000-0000-000000000030','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00030','diagnosis','Heifer Pre-breeding Examination','14-month Holstein heifer. Reproductive tract examination - uterus and ovaries normal for age. BCS 3.0. Recommended breeding at next heat cycle. Pre-breeding vaccines administered.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2013-05-09 10:00:00','2013-05-09 10:00:00'),
  ('f3000000-0000-0000-0000-000000000031','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00031','follow_up','First Calving - Normal Parturition','Uncomplicated calving. Bull calf 42kg born alive. Colostrum intake confirmed within 1 hour. Dam BCS 2.5 post-calving. Uterine involution normal. Oxytocin administered to aid placental expulsion.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2014-03-22 10:00:00','2014-03-22 10:00:00'),
  ('f3000000-0000-0000-0000-000000000032','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00032','diagnosis','Sub-acute Laminitis - Foot Lameness','Grade 2 lameness both rear limbs. White line disease identified. Sole hemorrhage present. Sub-acute laminitis secondary to transition cow management. Hoof trimming performed. 3-day NSAID course, wooden block applied to affected claw. Diet review recommended.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2015-07-10 10:00:00','2015-07-10 10:00:00'),
  ('f3000000-0000-0000-0000-000000000033','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00033','diagnosis','Clinical Mastitis - Left Rear Quarter','Acute onset. Left rear quarter: hot, swollen, milk watery with clots. SCC spike to >1M/mL. CMT strongly positive. Gram stain: gram-positive cocci (Strep. uberis suspected). Intramammary Pirsue + systemic Penicillin therapy. Strip quarter QID. NSAIDs.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2016-04-21 10:00:00','2016-04-21 10:00:00'),
  ('f3000000-0000-0000-0000-000000000034','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00034','lab_report','Mastitis Culture + Sensitivity - Left Rear','Culture confirmed Streptococcus uberis. Penicillin sensitive per MIC. Full clinical resolution after 10-day therapy. SCC returned to 150k/mL. Quarter producing normally. No permanent damage to mammary tissue.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2016-05-11 10:00:00','2016-05-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000035','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00035','lab_report','Annual TB Test + Bulk Milk Brucellosis','Intradermal tuberculin test: negative (clear). Bulk milk ring test for Brucellosis: negative. ELISA for BVD persistent infection: negative. Annual herd compliance testing complete.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2018-09-23 10:00:00','2018-09-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000036','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00036','diagnosis','Clinical Mastitis Recurrence - Right Front Quarter','Second mastitis episode. Right front quarter affected this time. E. coli suspected (peracute presentation, systemic signs, watery brown milk). Aggressive IV fluid therapy, ceftiofur, flunixin meglumine. Intensive monitoring.','critical','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-06-13 10:00:00','2019-06-13 10:00:00'),
  ('f3000000-0000-0000-0000-000000000037','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00037','follow_up','Mastitis Recovery - Right Front Quarter','E. coli mastitis recovered with aggressive treatment. Quarter still functional but SCC elevated at 400k. BCS declined to 2.0 during illness - recovered to 2.75 over 6 weeks. Dry cow therapy planned for next lactation.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-07-19 10:00:00','2019-07-19 10:00:00'),
  ('f3000000-0000-0000-0000-000000000038','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00038','diagnosis','Ketosis and Displaced Abomasum - Post-calving','Day 3 post-calving. Off feed, milk production dropped 40%. BHB 4.2 mmol/L (severe ketonemia). Right-sided ping on auscultation/percussion. Right Displaced Abomasum confirmed. Toggling corrective procedure performed on farm.','critical','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2021-02-26 10:00:00','2021-02-26 10:00:00'),
  ('f3000000-0000-0000-0000-000000000039','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00039','surgery','Left Displaced Abomasum - Utrecht Method Right Flank Laparotomy','DA recurrence 3 weeks post-toggle - now left-sided (LDA). Surgical correction via right flank laparotomy under standing sedation + local block. Abomasum repositioned and omentopexy performed. Full recovery in 14 days. Excellent prognosis.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2021-03-12 10:00:00','2021-03-12 10:00:00'),
  ('f3000000-0000-0000-0000-000000000040','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00040','diagnosis','Clinical Mastitis - Third Episode - Left Front Quarter','Third mastitis event. Chronic mastitis now classified. SCC consistently elevated >500k/mL. Staphylococcus aureus cultured (biofilm-producing strain). Multiple antibiotic protocols failed. Quarter recommended for dry amputation at next dry-off. Insurance claim submitted.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2022-08-15 10:00:00','2022-08-15 10:00:00'),
  ('f3000000-0000-0000-0000-000000000041','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00041','diagnosis','Arthritis and BCS Decline - Retirement Discussion','Progressive bilateral hind limb degenerative arthritis. BCS declining to 2.25 despite nutritional support. Milk production down 35% from peak. COW welfare assessment score 68/100. Retirement from milking herd recommended by end of 2024. Final lactation plan.','high','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2023-05-11 10:00:00','2023-05-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000042','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00042','follow_up','Final Year Health Assessment - Retirement Planning','14-year-old Belle now in dry lot. No longer milking. Good demeanor. Comfortable on meloxicam PRN and hoof trimming every 8 weeks. Retirement decision April 2026. Owner considering keeping as pasture companion. Life expectancy 2-3 more years with good management.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2025-01-24 10:00:00','2025-01-24 10:00:00'),
  ('f3000000-0000-0000-0000-000000000043','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00043','diagnosis','Puppy Wellness - First Visit (8 Weeks)','8-week Lab puppy. Healthy, 5kg. Normal examination. No hernia, no heart murmur. Started DHPP series. Discussed hip and elbow screening at 24 months given breed predisposition.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2015-01-18 10:00:00','2015-01-18 10:00:00'),
  ('f3000000-0000-0000-0000-000000000044','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00044','lab_report','Annual Wellness Blood Panel - 1.5 Years','CBC and chemistry WNL. Heartworm negative. Fecal negative. ETT: no evidence of elbow disease on survey radiographs. GP notes slight left elbow periosteal reaction - follow up at 2 years.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2016-04-16 10:00:00','2016-04-16 10:00:00'),
  ('f3000000-0000-0000-0000-000000000045','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00045','imaging','Bilateral Elbow Dysplasia - OFA/CT Diagnosis','CT scan of both elbows. Left: fragmented medial coronoid process (FMCP) grade II. Right: mild FMCP grade I. OFA Elbow Grade II bilateral recommended. Surgical intervention for left elbow considered. Orthopaedic specialist consultation arranged.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2017-03-15 10:00:00','2017-03-15 10:00:00'),
  ('f3000000-0000-0000-0000-000000000046','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00046','surgery','Left Elbow Arthroscopy - FMCP Fragment Removal','Left elbow arthroscopy performed under general anesthesia. 3 fragmented coronoid fragments identified and removed. Cartilage lesion grade II on humeral condyle. Excellent intraoperative visualization. Expected significant improvement in lameness. Post-op hydrotherapy protocol prescribed.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2017-06-11 10:00:00','2017-06-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000047','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00047','follow_up','Elbow Dysplasia - 1 Year Post Surgery','Excellent outcome. Left elbow: 85% function restored. Mild lameness on extended walks only. Right elbow managed conservatively - mild stiffness only. Continue glucosamine and low-impact exercise. Weight maintained 34kg.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2018-04-24 10:00:00','2018-04-24 10:00:00'),
  ('f3000000-0000-0000-0000-000000000048','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00048','diagnosis','First Seizure Episode - Generalized Tonic-Clonic','Presented immediately post-seizure. Full tonic-clonic seizure lasting 90 seconds, witnessed by owner. No post-ictal period. Full neurological exam normal. Bloodwork, glucose, electrolytes normal. MRI recommended to rule out structural lesion. Phenobarbital 2.5mg/kg BID initiated pending MRI results.','critical','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-08-23 10:00:00','2019-08-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000049','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00049','imaging','Brain MRI - Epilepsy Workup','1.5T MRI: no structural lesion, no mass, normal grey/white matter differentiation, no herniation. CSF: normal cytology, protein 22mg/dL (normal). Idiopathic (genetic) epilepsy confirmed. Continue phenobarbital. Phenobarbital level monitoring every 6 months.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2019-10-25 10:00:00','2019-10-25 10:00:00'),
  ('f3000000-0000-0000-0000-000000000050','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00050','lab_report','Phenobarbital Level + CBC - Epilepsy Monitoring','Serum phenobarbital 24 ug/mL (therapeutic range 20-40). CBC: normal hematocrit, no leukopenia. ALT 68 - mild phenobarbital hepatotoxicity watch. No seizures in 6 months on current dose. Add hepatoprotectant (SAMe/milk thistle). Recheck phenobarbital q6 months.','normal','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2020-03-12 10:00:00','2020-03-12 10:00:00'),
  ('f3000000-0000-0000-0000-000000000051','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00051','surgery','Mast Cell Tumor Grade I - Wide Margin Excision','1.8cm cutaneous mast cell tumor right flank confirmed by pre-op cytology. Wide margin excision under GA - 3cm margins achieved. Histopathology: Grade I MCT, Patnaik Grade I, Kiupel Low Grade. Margins clean. Excellent prognosis. No further therapy needed. Monthly skin checks.','high','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2021-05-23 10:00:00','2021-05-23 10:00:00'),
  ('f3000000-0000-0000-0000-000000000052','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00052','diagnosis','Repeat Seizure - Medication Adjustment','Cluster seizures - 3 events in 24 hours. Emergency presentation. Diazepam rescue successfully terminated seizure cluster. Phenobarbital trough level 18 (sub-therapeutic - missed doses per owner). Potassium bromide 30mg/kg daily added. Owner compliance counselling.','critical','archived','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2022-09-11 10:00:00','2022-09-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000053','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00053','lab_report','Annual Panel + Anti-epileptic Drug Monitoring','Phenobarbital 26 ug/mL, Potassium bromide 1850 ug/mL - both therapeutic. CBC: mild thrombocytopenia 140k (KBr effect). ALT 92 - escalating hepatotoxicity. Consider dose adjustment. No seizures past 11 months. Add ursodiol for hepatoprotection.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2023-06-11 10:00:00','2023-06-11 10:00:00'),
  ('f3000000-0000-0000-0000-000000000054','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00054','diagnosis','Hip Arthritis Onset - Senior Dog Mobility Assessment','Age-related bilateral hip osteoarthritis developing. Difficulty rising, muscle atrophy over hindquarters. Radiographs confirm early-moderate OA hips bilaterally. Librela (bedinvetmab) monoclonal antibody injection initiated monthly. Hydrotherapy referral. Ramp installed at home.','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2024-11-26 10:00:00','2024-11-26 10:00:00'),
  ('f3000000-0000-0000-0000-000000000055','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006',NULL,'b0000000-0000-0000-0000-000000000001','MR-TL-00055','follow_up','Senior Wellness Review - 11 Years','Archie stable. Epilepsy controlled (no seizures 18 months). Hip mobility improved 60% on Librela. Mast cell tumor: no recurrence on dermatological exam. Annual chest radiograph: clear. Senior diet transitioned. QOL excellent per validated questionnaire (87/100).','normal','active','[]','[]',false,NULL,'{}',NULL,'b0000000-0000-0000-0000-000000000001','2025-07-25 10:00:00','2025-07-25 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-4b: LAB RESULTS (linked to medical records) ──────────
INSERT INTO lab_results (id, animal_id, medical_record_id, test_name, test_category, test_date, result_value, normal_range, unit, is_abnormal, interpretation, status, lab_name, ordered_by, verified_by, consultation_id, attachments, notes, created_at, updated_at) VALUES
  ('f5000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','f3000000-0000-0000-0000-000000000004','Complete Blood Count + Chemistry Panel','hematology','2016-03-10','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2016-03-10 08:00:00','2016-03-10 14:00:00'),
  ('f5000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000001','f3000000-0000-0000-0000-000000000008','Complete Blood Count + Chemistry Panel','hematology','2018-08-25','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2018-08-25 08:00:00','2018-08-25 14:00:00'),
  ('f5000000-0000-0000-0000-000000000003','aa000000-0000-9999-0000-000000000001','f3000000-0000-0000-0000-000000000012','Complete Blood Count + Chemistry Panel','hematology','2021-07-17','Slightly elevated','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2021-07-17 08:00:00','2021-07-17 14:00:00'),
  ('f5000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000001','f3000000-0000-0000-0000-000000000017','Complete Blood Count + Chemistry Panel','hematology','2025-06-14','Normal','See reference ranges','multiple',true,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2025-06-14 08:00:00','2025-06-14 14:00:00'),
  ('f5000000-0000-0000-0000-000000000005','aa000000-0000-9999-0000-000000000002','f3000000-0000-0000-0000-000000000019','Complete Blood Count + Chemistry Panel','hematology','2016-05-14','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',NULL,'[]','Annual diagnostic panel.','2016-05-14 08:00:00','2016-05-14 14:00:00'),
  ('f5000000-0000-0000-0000-000000000006','aa000000-0000-9999-0000-000000000002','f3000000-0000-0000-0000-000000000027','Complete Blood Count + Chemistry Panel','hematology','2023-08-24','Within reference range','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',NULL,'[]','Annual diagnostic panel.','2023-08-24 08:00:00','2023-08-24 14:00:00'),
  ('f5000000-0000-0000-0000-000000000007','aa000000-0000-9999-0000-000000000003','f3000000-0000-0000-0000-000000000034','Complete Blood Count + Chemistry Panel','hematology','2016-05-11','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2016-05-11 08:00:00','2016-05-11 14:00:00'),
  ('f5000000-0000-0000-0000-000000000008','aa000000-0000-9999-0000-000000000003','f3000000-0000-0000-0000-000000000035','Complete Blood Count + Chemistry Panel','hematology','2018-09-23','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2018-09-23 08:00:00','2018-09-23 14:00:00'),
  ('f5000000-0000-0000-0000-000000000009','aa000000-0000-9999-0000-000000000006','f3000000-0000-0000-0000-000000000044','Complete Blood Count + Chemistry Panel','hematology','2016-04-16','Normal','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2016-04-16 08:00:00','2016-04-16 14:00:00'),
  ('f5000000-0000-0000-0000-000000000010','aa000000-0000-9999-0000-000000000006','f3000000-0000-0000-0000-000000000050','Complete Blood Count + Chemistry Panel','hematology','2020-03-12','Within reference range','See reference ranges','multiple',true,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2020-03-12 08:00:00','2020-03-12 14:00:00'),
  ('f5000000-0000-0000-0000-000000000011','aa000000-0000-9999-0000-000000000006','f3000000-0000-0000-0000-000000000053','Complete Blood Count + Chemistry Panel','hematology','2023-06-11','Within reference range','See reference ranges','multiple',false,'Results reviewed by attending veterinarian.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Annual diagnostic panel.','2023-06-11 08:00:00','2023-06-11 14:00:00')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-5a: ALLERGY RECORDS ──────────────────────────────────
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by, created_at, updated_at) VALUES
  ('f4000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','Chicken protein (dietary)','Facial swelling, hives on abdomen, pruritus within 30 min of eating chicken-based kibble','moderate','2016-07-15',false,'Resolved on hydrolyzed protein diet. No recurrence after diet change. Challenge test positive in 2017 confirming chicken allergy.','b0000000-0000-0000-0000-000000000002','2016-07-15','2017-06-01'),
  ('f4000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000001','Environmental pollens (seasonal)','Seasonal pruritus, paw licking, ear inflammation March-September','mild','2018-04-20',true,'Managed with Cytopoint injections every 6-8 weeks seasonally. Apoquel 16mg prn for breakthrough.','b0000000-0000-0000-0000-000000000002','2018-04-20','2025-03-15'),
  ('f4000000-0000-0000-0000-000000000003','aa000000-0000-9999-0000-000000000002','Amoxicillin-clavulanate (Clavamox)','Vomiting, diarrhea, anorexia within 24h of first dose','moderate','2017-09-10',true,'Documented drug allergy. Flagged in all records. Use clindamycin or doxycycline as alternatives. No penicillin-class antibiotics.','b0000000-0000-0000-0000-000000000002','2017-09-10','2017-09-10'),
  ('f4000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000002','Dust mites (environmental)','Miliary dermatitis, over-grooming, patchy alopecia','mild','2019-06-22',true,'Confirmed by intradermal allergy testing. HEPA filter in home, regular vacuuming. Cyclosporine 7mg/kg daily for flares.','b0000000-0000-0000-0000-000000000002','2019-06-22','2025-01-10'),
  ('f4000000-0000-0000-0000-000000000005','aa000000-0000-9999-0000-000000000006','Bee/wasp venom','Anaphylaxis - facial swelling, urticaria, cardiovascular collapse within 10 min of suspected sting','severe','2020-07-04',true,'Anaphylaxis treated emergently with epinephrine 0.01mg/kg IM, IV fluids, diphenhydramine, dexamethasone. Full recovery. EpiPen equivalent kept at home. Pre-medicate before outdoor activities late spring/summer.','b0000000-0000-0000-0000-000000000001','2020-07-04','2025-06-01'),
  ('f4000000-0000-0000-0000-000000000006','aa000000-0000-9999-0000-000000000006','Phenobarbital (hepatotoxicity marker)','Elevated ALT/ALP, mild hepatotoxicity at current doses - not true allergy but documented adverse reaction','mild','2020-03-15',true,'Not an allergy per se but significant adverse drug reaction on file. Continue with hepatoprotectants. Monitor liver enzymes every 3 months. Consider levetiracetam substitution in 2026.','b0000000-0000-0000-0000-000000000001','2020-03-15','2023-06-01'),
  ('f4000000-0000-0000-0000-000000000007','aa000000-0000-0000-0000-000000000001','Grain-based foods (wheat, corn)','Chronic flatulence, loose stools, mild pruritus','mild','2022-03-01',false,'Switched to grain-free food. Symptoms fully resolved. Reintroduction challenge confirmed sensitivity.','b0000000-0000-0000-0000-000000000001','2022-03-01','2022-09-01'),
  ('f4000000-0000-0000-0000-000000000008','aa000000-0000-0000-0000-000000000002','Feathers and down (environmental)','Sneezing, nasal discharge, watery eyes','mild','2023-05-15',true,'Cat allergy to bird feathers confirmed. Remove feathered toys and pillows from environment. Antihistamines prn.','b0000000-0000-0000-0000-000000000002','2023-05-15','2023-05-15'),
  ('f4000000-0000-0000-0000-000000000009','aa000000-0000-9999-0000-000000000005','Timothy grass hay','Sneezing, nasal discharge within 2 hours of fresh timothy hay application','mild','2019-08-10',true,'Switched to orchard grass and oat hay - no reaction. Avoid timothy grass exposure. Annual recurrence if accidental exposure.','b0000000-0000-0000-0000-000000000003','2019-08-10','2025-03-01'),
  ('f4000000-0000-0000-0000-000000000010','aa000000-0000-0000-0000-000000000004','Joint supplements with shellfish-derived glucosamine','GI upset, vomiting within 1 hour of dose','mild','2021-11-20',false,'Switched to shellfish-free glucosamine source (vegetarian). No further reactions. Max tolerates well now.','b0000000-0000-0000-0000-000000000001','2021-11-20','2022-01-10')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-5b: ADDITIONAL STANDALONE LAB RESULTS ─────────────────
INSERT INTO lab_results (id, animal_id, medical_record_id, test_name, test_category, test_date, result_value, normal_range, unit, is_abnormal, interpretation, status, lab_name, ordered_by, verified_by, consultation_id, attachments, notes, created_at, updated_at) VALUES
  ('f5000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001',NULL,'Thyroid Panel (T4, Free T4)','endocrinology','2023-04-20','T4: 2.8 ug/dL, Free T4: 1.4 ng/dL','T4: 1.0-4.0 ug/dL, Free T4: 0.8-3.0 ng/dL','ug/dL',false,'Thyroid function normal. No hypothyroidism detected in senior Golden Retriever.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Run as part of DCM monitoring panel.','2023-04-20','2023-04-21'),
  ('f5000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000001',NULL,'Cardiac Troponin I (cTnI)','cardiology','2023-07-15','0.08 ng/mL','< 0.06 ng/mL','ng/mL',true,'Mildly elevated cardiac troponin consistent with early myocardial stress. Monitor closely. Repeat in 3 months.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Part of ongoing DCM monitoring.','2023-07-15','2023-07-16'),
  ('f5000000-0000-0000-0000-000000000003','aa000000-0000-9999-0000-000000000001',NULL,'NT-proBNP (Cardiac Biomarker)','cardiology','2024-01-10','980 pmol/L','< 900 pmol/L','pmol/L',true,'NT-proBNP slightly elevated - cardiac biomarker supporting pre-clinical DCM staging. Continue pimobendan.','completed','IDEXX Laboratories','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Critical cardiac monitoring test for DCM.','2024-01-10','2024-01-11'),
  ('f5000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000002',NULL,'Renal Function Panel (BUN, Creatinine, SDMA, Phosphorus)','nephrology','2024-10-15','BUN: 42 mg/dL, Creatinine: 2.6 mg/dL, SDMA: 22 ug/dL, Phosphorus: 5.8 mg/dL','BUN: 14-36, Creatinine: 0.8-2.4, SDMA: 0-14, Phosphorus: 2.7-5.5','mg/dL',true,'CKD progression to stage II. Phosphorus above normal. SDMA significantly elevated indicating 25-40% loss of GFR. Initiate phosphate binder.','completed','IDEXX Laboratories','b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',NULL,'[]','Renal monitoring for CKD cat.','2024-10-15','2024-10-16'),
  ('f5000000-0000-0000-0000-000000000005','aa000000-0000-9999-0000-000000000006',NULL,'Phenobarbital Serum Level','toxicology','2022-09-25','18 ug/mL','20-40 ug/mL','ug/mL',true,'Sub-therapeutic phenobarbital level. Patient had breakthrough seizure cluster. Dose escalation and compliance counselling indicated.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Post-seizure cluster monitoring.','2022-09-25','2022-09-25'),
  ('f5000000-0000-0000-0000-000000000006','aa000000-0000-9999-0000-000000000006',NULL,'Potassium Bromide Serum Level','toxicology','2023-06-20','1850 ug/mL','1000-2000 ug/mL','ug/mL',false,'KBr within therapeutic range. Continue current dosing.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Routine AED monitoring.','2023-06-20','2023-06-20'),
  ('f5000000-0000-0000-0000-000000000007','aa000000-0000-9999-0000-000000000003',NULL,'Milk Culture + Somatic Cell Count - Left Rear Quarter','microbiology','2016-04-15','Streptococcus uberis isolated. SCC: 1,250,000 cells/mL','SCC < 200,000 cells/mL','cells/mL',true,'Clinical mastitis confirmed with Strep. uberis. Sensitive to penicillin on disk diffusion. Intramammary and systemic therapy indicated.','completed','State Veterinary Diagnostic Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Bulk milk SCC had been elevated for 2 weeks prior.','2016-04-15','2016-04-16'),
  ('f5000000-0000-0000-0000-000000000008','aa000000-0000-9999-0000-000000000003',NULL,'BHB (Beta-Hydroxybutyrate) - Ketosis Screening','metabolic','2021-02-20','4.2 mmol/L','< 1.0 mmol/L','mmol/L',true,'Severe hyperketonemia. Clinical ketosis confirmed. Immediate propylene glycol oral therapy and IV dextrose supplementation required.','completed','On-Farm Portable Analyzer','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Post-calving monitoring day 3.','2021-02-20','2021-02-20'),
  ('f5000000-0000-0000-0000-000000000009','aa000000-0000-0000-0000-000000000001',NULL,'Hip OFA Radiograph Evaluation','radiology','2019-06-18','Bilateral Grade II (Moderate) Hip Dysplasia','OFA Good/Excellent/Fair/Borderline/Mild/Moderate/Severe','grade',true,'OFA preliminary grade: Moderate bilateral HD. Not recommended for breeding. Surgical intervention not required at this time - medical management protocol initiated.','completed','OFA (Orthopedic Foundation for Animals)','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Breed health screening - Golden Retriever.','2019-06-18','2019-06-25'),
  ('f5000000-0000-0000-0000-000000000010','aa000000-0000-0000-0000-000000000004',NULL,'Joint Fluid Cytology - Right Stifle','cytology','2021-02-05','Mononuclear cells 85%, protein elevated 5.2 g/dL, no bacteria','Normal: 90-95% mononuclear, protein < 3.0 g/dL','cells/hpf',true,'Inflammatory joint disease confirmed. Degenerative arthritis consistent with osteoarthritis. No evidence of septic arthritis or immune-mediated polyarthritis.','completed','VetCare Reference Lab','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Part of comprehensive OA workup for Max GSD.','2021-02-05','2021-02-06'),
  ('f5000000-0000-0000-0000-000000000011','aa000000-0000-9999-0000-000000000004',NULL,'Rumen Fluid Analysis - Acidosis Screening','gastroenterology','2015-08-10','pH 5.8, protozoa motility 40%, colour dark green-grey','pH 6.5-7.0, protozoa motility >80%','pH',true,'Sub-acute rumen acidosis (SARA) confirmed. High grain diet adjustment required. Total mixed ration reformulation - reduce starch, increase effective fibre. Sodium bicarbonate buffer added.','completed','On-Farm Portable pH Meter','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Old Belle showing reduced milk fat - SARA suspected.','2015-08-10','2015-08-10'),
  ('f5000000-0000-0000-0000-000000000012','aa000000-0000-0000-0000-000000000008',NULL,'Lameness Evaluation + Flexion Test','orthopaedics','2025-02-20','Left forelimb lameness grade 2/5 at trot. Positive distal limb flexion test.','Grade 0 (no lameness)','grade',true,'Recurring left forelimb lameness. Suggests navicular region or distal DDFT involvement. MRI of distal limb indicated. Rest period, NSAID therapy, corrective shoeing.','completed','Equine Orthopaedic Specialists','b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',NULL,'[]','Thunder - ongoing lameness evaluation.','2025-02-20','2025-02-21')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-5c: PRESCRIPTIONS (historical, 2013-2026) ─────────────
INSERT INTO prescriptions (id, veterinarian_id, pet_owner_id, animal_id, medications, instructions, valid_until, is_active, created_at, updated_at) VALUES
  ('f6000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','[{"name":"Carprofen","dose":"75mg","frequency":"Once daily with food","duration":"60 days ongoing"}]','Administer with food to prevent gastric upset. Discontinue and contact immediately if decreased appetite, vomiting, or black stools observed.','2017-12-01',false,'2016-11-10','2016-11-10'),
  ('f6000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','[{"name":"Tramadol","dose":"100mg","frequency":"Every 8-12 hours as needed for pain","duration":"10 days"},{"name":"Gabapentin","dose":"300mg","frequency":"Every 12 hours","duration":"30 days post-op"}]','Pain management following TPLO surgery. Do not exceed stated doses. Keep incision site clean and dry. Cone collar mandatory.','2017-05-30',false,'2017-02-15','2017-02-15'),
  ('f6000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','[{"name":"Meloxicam","dose":"1mg/kg (34mg)","frequency":"Once daily with food","duration":"Ongoing - chronic"},{"name":"Cosequin DS","dose":"2 chews","frequency":"Once daily","duration":"Lifelong"},{"name":"Omega-3 Fish Oil","dose":"1000mg","frequency":"Once daily with food","duration":"Lifelong"}]','Long-term arthritis and hip dysplasia management plan. Monitor liver enzymes annually. Keep weight 30-33kg. Low-impact exercise only.','2020-09-01',false,'2019-09-10','2019-09-10'),
  ('f6000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','[{"name":"Pimobendan (Vetmedin)","dose":"0.25mg/kg BID (8.5mg)","frequency":"Every 12 hours - 1 hour before meals","duration":"Lifelong"},{"name":"Taurine supplement","dose":"500mg","frequency":"Twice daily","duration":"Lifelong"}]','Cardiac medication for pre-clinical DCM. Never miss a dose - set phone alarms. If breathing changes, coughing at night, or exercise intolerance develops, contact emergency vet immediately.','2024-12-31',true,'2023-04-25','2024-01-10'),
  ('f6000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','[{"name":"Methimazole (Felimazole)","dose":"2.5mg","frequency":"Every 12 hours for life","duration":"Lifelong - chronic thyroid disease"}]','Administer in food or as a pill. Wear gloves when handling - methimazole can cause skin sensitization. If cat stops eating or starts face-scratching excessively, contact clinic immediately.','2022-12-31',false,'2021-01-20','2021-02-25'),
  ('f6000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','[{"name":"Methimazole (Felimazole)","dose":"2.5mg","frequency":"Every 12 hours","duration":"Lifelong"},{"name":"Aluminum Hydroxide Gel (phosphate binder)","dose":"30mg/kg","frequency":"With each meal","duration":"Ongoing CKD management"},{"name":"Darbepoetin Alfa","dose":"1mcg/kg SQ","frequency":"Every 3 weeks","duration":"Until PCV > 30%"}]','Complex multi-drug protocol for hyperthyroidism + CKD. Keep refrigerated. SubQ fluids 150mL daily at home - technique confirmed by team.','2026-12-31',true,'2024-10-20','2024-10-20'),
  ('f6000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006','[{"name":"Phenobarbital","dose":"2.5mg/kg BID (87mg)","frequency":"Every 12 hours - NEVER skip","duration":"Lifelong - epilepsy control"}]','Epilepsy management - must be given exactly every 12 hours. Missing doses can trigger seizures. Store at room temperature. Emergency diazepam rectal gel kept at home for cluster seizures (instructions reviewed with owner).','2020-12-31',false,'2019-08-30','2019-10-15'),
  ('f6000000-0000-0000-0000-000000000008','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000004','aa000000-0000-9999-0000-000000000006','[{"name":"Phenobarbital","dose":"87mg","frequency":"Every 12 hours","duration":"Lifelong"},{"name":"Potassium Bromide","dose":"30mg/kg (1065mg)","frequency":"Once daily with food","duration":"Lifelong"},{"name":"SAMe (Denosyl)","dose":"400mg","frequency":"Once daily on empty stomach","duration":"Lifelong hepatoprotection"},{"name":"Ursodiol (Actigall)","dose":"10mg/kg (355mg)","frequency":"Once daily with food","duration":"Ongoing"}]','Updated epilepsy + hepatoprotection protocol. KBr must be given with food to avoid GI upset. Report any increase in thirst/urination (KBr side effect). Liver check every 3 months mandatory.','2026-12-31',true,'2022-09-28','2023-06-25'),
  ('f6000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','[{"name":"Ceftiofur Sodium (Naxcel)","dose":"1mg/kg IM","frequency":"Daily for 5 days","duration":"5 days"},{"name":"Flunixin Meglumine (Banamine)","dose":"1.1mg/kg IV or IM","frequency":"Every 12 hours for 2 days","duration":"2 days"}]','E. coli mastitis emergency treatment. Maintain milk discard - do not sell milk for 72h after last injection. Mark cow with chalk. Recheck in 48 hours. Call emergency line if temperature > 40.5C.','2019-07-20',false,'2019-06-20','2019-07-05'),
  ('f6000000-0000-0000-0000-000000000010','b0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000008','[{"name":"Meloxicam (Metacam Equine)","dose":"0.6mg/kg PO daily","duration":"14 days"},{"name":"Omeprazole (GastroGard)","dose":"4mg/kg PO daily","frequency":"30 min before feeding","duration":"28 days"}]','Post-lameness evaluation treatment for Thunder. Give meloxicam with wet feed to avoid gastric upset. GastroGard for ulcer prevention during NSAID use. Box rest for 2 weeks. Support shoe (heartbar) applied.','2025-03-20',true,'2025-02-22','2025-02-22')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-5d: HISTORICAL BOOKINGS (2013-2025) ─────────────────
INSERT INTO bookings (id, pet_owner_id, veterinarian_id, animal_id, scheduled_date, time_slot_start, time_slot_end, status, booking_type, priority, reason_for_visit, symptoms, notes) VALUES
  ('f7000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','2016-11-08','10:00','10:30','completed','in_person','high','Right hind limb lameness evaluation','Progressive lameness and reluctance to rise','Initial CCL evaluation'),
  ('f7000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','2017-02-12','09:00','11:30','completed','in_person','high','TPLO surgery right stifle','Partial CCL rupture confirmed on drawer test','Pre-surgical clearance obtained'),
  ('f7000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','2019-06-15','09:00','09:45','completed','in_person','normal','Hip radiographs and OFA evaluation','Annual musculoskeletal screen','Pre-sedation bloods normal'),
  ('f7000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','2023-04-18','10:00','10:45','completed','in_person','high','Heart murmur follow-up + cardiac workup','Grade II murmur detected on previous visit','Echocardiogram arranged at this visit'),
  ('f7000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','2025-06-20','11:00','11:30','completed','video_call','normal','Senior annual review - DCM + hip monitoring','Routine senior screen at 12 years','Owner reports reduced exercise tolerance'),
  ('f7000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','2020-11-15','14:00','14:45','completed','in_person','high','Weight loss investigation and polydipsia','Lost 1.2kg in 3 months, drinking more','Hyperthyroidism confirmed at this visit'),
  ('f7000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','2022-06-10','10:00','11:30','completed','in_person','normal','Dental prophylaxis + extractions','Grade III dental disease, resorptive lesions','Anaesthetic protocol for hyperthyroid cat modified'),
  ('f7000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','2024-10-12','09:00','09:45','completed','video_call','high','CKD monitoring recheck - elevated creatinine','Declining appetite, occasional vomiting','Monthly video check-in protocol established'),
  ('f7000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','2017-03-20','10:00','11:30','completed','in_person','high','Elbow CT scan and surgical planning','Bilateral elbow lameness since 14 months','OFA elbow radiographs already done'),
  ('f7000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','2019-08-28','09:00','09:30','completed','in_person','critical','Emergency - first seizure episode','Generalized tonic-clonic seizure, 90 seconds','Emergency same-day slot'),
  ('f7000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','2021-05-08','08:30','10:00','completed','in_person','high','MCT excision surgery - right flank mass','Pre-op cytology confirmed mast cell tumor','Staging done - no metastasis'),
  ('f7000000-0000-0000-0000-000000000012','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','2022-09-23','09:00','09:30','completed','in_person','critical','Emergency - cluster seizures','3 seizures in 24 hours','Subtherapeutic phenobarbital - missed doses'),
  ('f7000000-0000-0000-0000-000000000013','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','2016-04-12','08:00','09:00','completed','in_person','high','Mastitis treatment - left rear quarter','Acute onset swollen hot quarter with abnormal milk','Farm visit - emergency'),
  ('f7000000-0000-0000-0000-000000000014','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','2019-06-18','07:30','09:30','completed','in_person','critical','E. coli mastitis emergency - systemic signs','Down cow, fever 41.2C, toxic milk','Emergency farm call'),
  ('f7000000-0000-0000-0000-000000000015','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','2021-03-05','07:30','10:00','completed','in_person','high','Displaced abomasum surgical correction','LDA confirmed - left ping on auscultation','Food withheld 12h pre-op'),
  ('f7000000-0000-0000-0000-000000000016','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000008','2025-02-18','08:00','09:00','completed','in_person','high','Lameness evaluation - left forelimb','Recurring lameness after exercise','Radiographs and flexion tests performed')
ON CONFLICT (id) DO NOTHING;

-- ── STEP TL-5e: HISTORICAL CONSULTATIONS (2013-2025) ──────────────
INSERT INTO consultations (id, user_id, veterinarian_id, animal_id, animal_type, symptom_description, status, priority, scheduled_at, started_at, completed_at, duration, diagnosis, prescription, follow_up_date, notes) VALUES
  ('f8000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','Dog - Golden Retriever','Progressive right hind limb lameness, reluctance to rise, gait asymmetry','completed','high','2016-11-08 10:00:00','2016-11-08 10:05:00','2016-11-08 10:45:00',40,'Partial cranial cruciate ligament (CCL) rupture right stifle. Positive drawer test. Radiographic evidence of joint effusion and periarticular osteophytes.','Carprofen 75mg once daily with food. Rest for 6 weeks. No running or stairs. Weight management critical - target 30kg.','2017-02-12','Surgical correction (TPLO) scheduled at recheck if no improvement with conservative management.'),
  ('f8000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','Dog - Golden Retriever','Post-evaluation for TPLO surgery right stifle. Limb non-weight bearing at walk.','completed','high','2017-02-12 09:00:00','2017-02-12 09:05:00','2017-02-12 11:35:00',150,'TPLO surgery performed successfully. Tibial plateau angle corrected from 25 to 6 degrees. Implant stable on post-op radiographs.','Tramadol 100mg every 8h for 10 days. Gabapentin 300mg every 12h for 30 days. Restrict activity - leash walks only for 8 weeks.','2017-05-12','Excellent prognosis. Hydrotherapy to start at 6-week recheck. Return to normal function expected in 4-5 months.'),
  ('f8000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000001','Dog - Golden Retriever','Annual senior exam. Known hip dysplasia on meloxicam. Also cardiac murmur auscultated.','completed','high','2023-04-18 10:00:00','2023-04-18 10:05:00','2023-04-18 10:50:00',45,'Bilateral HD stable. New finding: Grade II/VI left apical systolic murmur. Chest radiographs show mild cardiac enlargement. Echocardiogram arranged - pre-clinical DCM suspected.','Pimobendan (Vetmedin) 8.5mg every 12h, 1 hour before feeding. Continue meloxicam and Cosequin. Add taurine 500mg twice daily.','2023-07-18','DCM very common in senior Golden Retrievers. Excellent prognosis with early pimobendan. No surgery indicated at this stage. Annual echocardiogram.'),
  ('f8000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','aa000000-0000-9999-0000-000000000002','Cat - Domestic Shorthair','Weight loss 1.2kg over 3 months. PU/PD. Poor coat quality. Goiter palpable.','completed','high','2020-11-15 14:00:00','2020-11-15 14:05:00','2020-11-15 14:50:00',45,'Feline hyperthyroidism confirmed. T4 = 7.8 ug/dL. Goiter consistent with adenomatous hyperplasia of thyroid gland. Radioiodine or methimazole options discussed.','Methimazole 2.5mg every 12 hours. Recheck T4 in 4 weeks. Full blood panel prior to treatment to assess baseline renal function.','2021-01-20','Kidney disease can be unmasked by treating hyperthyroidism. Monitor renal values closely. Radioiodine therapy considered as definitive treatment if methimazole not tolerated.'),
  ('f8000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','Dog - Labrador Retriever','Emergency - witnessed generalized tonic-clonic seizure lasting 90 seconds. First ever seizure event.','completed','critical','2019-08-28 09:00:00','2019-08-28 09:05:00','2019-08-28 10:10:00',65,'Post-ictal examination normal. Complete blood panel, glucose, electrolytes all normal. MRI brain recommended to rule out structural lesion. Idiopathic epilepsy most likely given age and breed.','Phenobarbital 87mg every 12 hours (2.5mg/kg). Recheck phenobarbital level in 2 weeks. MRI scheduled within 1 month.','2019-10-15','Owner instructed on home seizure management. Rescue diazepam prescribed for cluster seizures. Emergency number provided. Driver licence implications discussed (jurisdiction-specific).'),
  ('f8000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','Cattle - Holstein Friesian','Emergency farm call. Cow down, pyrexic 41.2C, peracute toxic mastitis right front quarter.','completed','critical','2019-06-18 07:30:00','2019-06-18 07:35:00','2019-06-18 09:30:00',115,'Peracute E. coli mastitis with endotoxemia. Quarter secretion: watery, brown, foul-smelling. Systemic signs: tachycardia, injected mucous membranes, weak.','IV 20L normal saline over 2 hours. Ceftiofur 1mg/kg IM daily for 5 days. Flunixin 1.1mg/kg IV. Frequent stripping of quarter. Oral electrolytes 6L twice daily.','2019-07-05','Guarded to fair prognosis for quarter survival. Economic decision on treatment warranted given milk value. NSAID critical for endotoxemia counteraction. Discuss dry cow therapy at next drying.'),
  ('f8000000-0000-0000-0000-000000000007','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000003','Cattle - Holstein Friesian','Third mastitis event. Chronic recurrence Staphylococcus aureus. Multiple antibiotics tried.','completed','high','2022-08-22 08:00:00','2022-08-22 08:05:00','2022-08-22 09:15:00',70,'Chronic Staph aureus mastitis left front quarter. Biofilm-producing strain. Cure rates with antibiotics < 20%. Quarter amputation recommended at next drying off. BCOC classification: CTOC.','Dry cow therapy (cloxacillin intramammary + bismuth subnitrate teat sealant) at drying in October. Quarter marked for amputation. Economic assessment: keep for one final lactation, then cull or surgical quarter ablation.','2022-11-01','Owner has sentimental attachment to animal. Counselled on welfare implications of persistent mastitis. Insurance claim documentation provided. Next visit October for drying off.'),
  ('f8000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','aa000000-0000-9999-0000-000000000006','Dog - Labrador Retriever','Emergency - cluster seizures. 3 events in 24 hours. Subtherapeutic phenobarbital due to missed doses.','completed','critical','2022-09-23 09:00:00','2022-09-23 09:05:00','2022-09-23 10:20:00',75,'Cluster seizures secondary to subtherapeutic phenobarbital (owner compliance issue - travel disrupted dosing). Diazepam rescue successful. Phenobarbital level confirmed 18 ug/mL (sub-therapeutic).','Potassium bromide 1065mg (30mg/kg) added once daily with food. Maintain phenobarbital 87mg BID. SAMe 400mg daily for hepatoprotection. Add ursodiol 355mg daily.','2023-06-20','Strict compliance counselling completed. Pillbox/phone alarm system established. Partner also trained on rescue medication. Next breakthrough seizure = hospital admission. Driving unsafe.'),
  ('f8000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','aa000000-0000-0000-0000-000000000008','Horse - Thoroughbred','Recurring left forelimb lameness grade 2/5 at trot. Previous 6-week rest unsuccessful.','completed','high','2025-02-18 08:00:00','2025-02-18 08:05:00','2025-02-18 09:30:00',85,'Grade 2/5 left forelimb lameness. Positive distal limb flexion test. Navicular region involvement suspected. MRI distal limb recommended for definitive diagnosis. Corrective heartbar shoe applied by farrier.','Meloxicam 0.6mg/kg daily for 14 days. Omeprazole (GastroGard) 4mg/kg daily for 28 days concurrent with NSAID. Box rest 14 days minimum.','2025-03-20','Prognosis depends on MRI findings. If DDFT lesion: stem cell/PRP injection + extended rest. If navicular bone sclerosis: corrective shoeing long-term. Return to work uncertain at this stage.')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- HOSPITAL NETWORK COMPREHENSIVE DEMO DATA
-- Two networks: one approved (DemoVetGroup), one pending (PawsCare Network)
-- Full lifecycle: branches, staff positions, members, patients, referrals, audit
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- NETWORK 1: DemoVetGroup (APPROVED) — owned by netadmin@vetcare.com
-- ═══════════════════════════════════════════════════════════
INSERT INTO hospital_networks (id, name, legal_name, registration_number, network_type, country, headquarters_address, headquarters_city, headquarters_state, contact_email, contact_phone, website, is_active, is_approved, approved_by, approved_at, id_prefix, created_by, metadata)
VALUES (
  'hn000000-0000-0000-0000-000000000001',
  'DemoVetGroup',
  'DemoVetGroup Healthcare Pvt. Ltd.',
  'DVHG-2024-001',
  'private',
  'IN',
  '42 Anna Salai, Guindy',
  'Chennai',
  'Tamil Nadu',
  'admin@demovetgroup.com',
  '+91-44-1234-5678',
  'https://demovetgroup.com',
  true,
  true,
  'a0000000-0000-0000-0000-000000000001',
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  'DVG',
  'd0000000-0000-0000-0000-000000000001',
  '{"specializations": ["small_animal", "large_animal", "exotic"], "accreditations": ["NABH", "ISO 9001"]}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, legal_name = EXCLUDED.legal_name, is_approved = EXCLUDED.is_approved,
  approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, created_by = EXCLUDED.created_by,
  headquarters_address = EXCLUDED.headquarters_address, website = EXCLUDED.website, metadata = EXCLUDED.metadata;

-- ═══════════════════════════════════════════════════════════
-- NETWORK 2: PawsCare Network (PENDING APPROVAL) — for admin to see in dashboard
-- ═══════════════════════════════════════════════════════════
INSERT INTO hospital_networks (id, name, legal_name, registration_number, network_type, country, headquarters_city, headquarters_state, contact_email, contact_phone, is_active, is_approved, id_prefix, created_by, metadata)
VALUES (
  'hn000000-0000-0000-0000-000000000002',
  'PawsCare Network',
  'PawsCare Animal Healthcare Ltd.',
  'PCAH-2025-042',
  'private',
  'IN',
  'Bangalore',
  'Karnataka',
  'contact@pawscare.in',
  '+91-80-9876-5432',
  true,
  false,
  'PCN',
  'd0000000-0000-0000-0000-000000000001',
  '{"specializations": ["small_animal"], "note": "Pending platform admin approval"}'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, is_approved = EXCLUDED.is_approved, created_by = EXCLUDED.created_by;

-- ═══════════════════════════════════════════════════════════
-- BRANCH HOSPITALS for DemoVetGroup
-- Mark existing demo hospitals as network branches
-- ═══════════════════════════════════════════════════════════
UPDATE vet_hospitals SET is_network_branch = true, branch_network_id = 'hn000000-0000-0000-0000-000000000001'
WHERE id IN ('h0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000002');

-- Link hospitals to network
INSERT INTO hospital_network_hospitals (network_id, hospital_id, is_active)
VALUES
  ('hn000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', true),
  ('hn000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000002', true)
ON CONFLICT (network_id, hospital_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- NETWORK MEMBERS — full role hierarchy
-- ═══════════════════════════════════════════════════════════

-- Corporate Admin (network owner)
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000001',
  'hn000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'corporate_admin',
  true,
  CURRENT_TIMESTAMP - INTERVAL '30 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- Hospital Director (Priya Nair — manages branch hospital 1)
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, hospital_id, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000002',
  'hn000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'hospital_director',
  'h0000000-0000-0000-0000-000000000001',
  true,
  CURRENT_TIMESTAMP - INTERVAL '25 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- Existing demo vet (Sarah Johnson) as hospital_director for branch 2
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, hospital_id, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000003',
  'hn000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'hospital_director',
  'h0000000-0000-0000-0000-000000000002',
  true,
  CURRENT_TIMESTAMP - INTERVAL '20 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- Nurse (Anitha Kumar) — hospital_staff at branch 1
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, hospital_id, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000004',
  'hn000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000003',
  'hospital_staff',
  'h0000000-0000-0000-0000-000000000001',
  true,
  CURRENT_TIMESTAMP - INTERVAL '15 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- Receptionist (Karthik Rajan) — hospital_staff at branch 1
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, hospital_id, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000005',
  'hn000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000004',
  'hospital_staff',
  'h0000000-0000-0000-0000-000000000001',
  true,
  CURRENT_TIMESTAMP - INTERVAL '10 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- Lab Tech (Meena Sundaram) — hospital_staff at branch 2
INSERT INTO hospital_network_members (id, network_id, user_id, network_role, hospital_id, is_active, granted_at, granted_by)
VALUES (
  'hnm00000-0000-0000-0000-000000000006',
  'hn000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000005',
  'hospital_staff',
  'h0000000-0000-0000-0000-000000000002',
  true,
  CURRENT_TIMESTAMP - INTERVAL '5 days',
  'd0000000-0000-0000-0000-000000000001'
) ON CONFLICT (network_id, user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- STAFF POSITIONS — clinical roles at branches
-- ═══════════════════════════════════════════════════════════
INSERT INTO staff_positions (id, hospital_id, user_id, position, department, is_active, hired_date)
VALUES
  ('sp000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'veterinarian', 'General Surgery', true, '2024-12-01'),
  ('sp000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'nurse', 'General Care', true, '2025-01-15'),
  ('sp000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'receptionist', 'Front Desk', true, '2025-02-01'),
  ('sp000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'lab_tech', 'Diagnostics Lab', true, '2025-03-01'),
  ('sp000000-0000-0000-0000-000000000005', 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Emergency Care', true, '2024-11-01')
ON CONFLICT (hospital_id, user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- FEATURE FLAGS for demo network
-- ═══════════════════════════════════════════════════════════
INSERT INTO hospital_network_feature_flags (network_id, feature_key, is_enabled, config)
VALUES
  ('hn000000-0000-0000-0000-000000000001', 'patient_data_isolation', true, '{"default_visibility": "private"}'),
  ('hn000000-0000-0000-0000-000000000001', 'corporate_audit_log', true, '{}'),
  ('hn000000-0000-0000-0000-000000000001', 'inter_hospital_referrals', true, '{"auto_approve": false}'),
  ('hn000000-0000-0000-0000-000000000001', 'shared_formulary', true, '{}')
ON CONFLICT (network_id, feature_key) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- ═══════════════════════════════════════════════════════════
-- PATIENT ENROLLMENT — demo animals enrolled in network
-- ═══════════════════════════════════════════════════════════
INSERT INTO animal_care_contexts (id, animal_id, network_id, hospital_id, platform_unique_id, corporate_patient_id, visibility, enrolled_by)
VALUES
  ('acc00000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'hn000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'VC-DOG-24-00001', 'DVG-P-00001', 'private', 'd0000000-0000-0000-0000-000000000001'),
  ('acc00000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'hn000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'VC-CAT-24-00001', 'DVG-P-00002', 'private', 'd0000000-0000-0000-0000-000000000001'),
  ('acc00000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'hn000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000002', 'VC-DOG-24-00002', 'DVG-P-00003', 'network_only', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (animal_id, network_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- PATIENT DATA CONSENTS
-- ═══════════════════════════════════════════════════════════
INSERT INTO patient_data_consent (id, animal_id, owner_id, granted_to_network_id, consent_scope, allow_medical_records, allow_vaccination_records, allow_prescriptions, allow_lab_results, allow_view, is_active)
VALUES
  ('dac00000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'hn000000-0000-0000-0000-000000000001', 'full_history', true, true, true, true, true, true),
  ('dac00000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'hn000000-0000-0000-0000-000000000001', 'basic_history', true, true, false, false, true, true),
  ('dac00000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'hn000000-0000-0000-0000-000000000001', 'basic_history', true, false, false, false, true, true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- CLINICAL DATA ACCESS LOG — sample audit trail entries
-- ═══════════════════════════════════════════════════════════
INSERT INTO clinical_data_access_log (id, accessed_by, accessor_role, accessor_network_id, animal_id, record_type, access_type, consent_id, access_granted, denial_reason)
VALUES
  ('cal00000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'veterinarian', 'hn000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'medical_record', 'view', 'dac00000-0000-0000-0000-000000000001', true, NULL),
  ('cal00000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'hospital_staff', 'hn000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'vaccination', 'view', 'dac00000-0000-0000-0000-000000000001', true, NULL),
  ('cal00000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005', 'hospital_staff', 'hn000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'lab_result', 'view', 'dac00000-0000-0000-0000-000000000002', true, NULL),
  ('cal00000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 'hospital_staff', 'hn000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'medical_record', 'view', NULL, false, 'No active consent for this patient'),
  ('cal00000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'corporate_admin', 'hn000000-0000-0000-0000-000000000001', NULL, 'audit', 'audit', NULL, true, NULL)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- INTER-HOSPITAL REFERRAL — sample referral between branch vets
-- ═══════════════════════════════════════════════════════════
INSERT INTO referrals (id, hospital_id, from_vet_id, to_vet_id, animal_id, reason, specialty_needed, priority, status, clinical_notes)
VALUES (
  'ihr00000-0000-0000-0000-000000000001',
  'h0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  'e0000000-0000-0000-0000-000000000001',
  'Advanced diagnostic imaging required — suspected cruciate ligament tear',
  'Orthopedic Surgery',
  'high',
  'accepted',
  'Patient presenting with grade 3/5 left hind lameness. Positive cranial drawer test. Radiographs inconclusive. MRI recommended at Branch 2 facility.'
) ON CONFLICT (id) DO NOTHING;
