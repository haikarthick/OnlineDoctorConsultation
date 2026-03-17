-- ============================================================
-- VetCare Platform — Comprehensive Demo Seed Data
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

-- No global transaction — each section runs independently for resilience
-- (if a tier migration didn't create certain tables, other sections still succeed)

-- ============================================================
-- STEP 0: SKIP — DATA IS PRESERVED ACROSS DEPLOYMENTS
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
  ('a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',       'System',    'Administrator', 'admin',        '+1-555-100-0001', '$2a$10$tu6znQ3bZKCZlv38rEym8evqP0Q25.eMpF0CIrsN6rlyfuTcQzos2', true, 'USR-ADM-001'),
  -- Veterinarians (password: Doctor@123)
  ('b0000000-0000-0000-0000-000000000001', 'dr.james.carter@vetcare.com',  'James',   'Carter',   'veterinarian', '+1-555-200-0001', '$2a$10$HH1yq2osUEdtByarwBFq0eBy.ko6Rv33jI2TtIcSJqGh382x5tqeu', true, 'USR-VET-001'),
  ('b0000000-0000-0000-0000-000000000002', 'dr.sarah.bennett@vetcare.com', 'Sarah',   'Bennett',  'veterinarian', '+1-555-200-0002', '$2a$10$HH1yq2osUEdtByarwBFq0eBy.ko6Rv33jI2TtIcSJqGh382x5tqeu', true, 'USR-VET-002'),
  ('b0000000-0000-0000-0000-000000000003', 'dr.michael.reyes@vetcare.com', 'Michael',  'Reyes',   'veterinarian', '+1-555-200-0003', '$2a$10$HH1yq2osUEdtByarwBFq0eBy.ko6Rv33jI2TtIcSJqGh382x5tqeu', true, 'USR-VET-003'),
  -- Pet Owners (password: Owner@123)
  ('c0000000-0000-0000-0000-000000000001', 'emily.davis@email.com',    'Emily',     'Davis',    'pet_owner',    '+1-555-300-0001', '$2a$10$GXZlMN9itGYk/kxFAKpJme6HAOBIlfKtIcAZmBWGH264UDOGuebVC', true, 'USR-PET-001'),
  ('c0000000-0000-0000-0000-000000000002', 'robert.chen@email.com',   'Robert',    'Chen',     'pet_owner',    '+1-555-300-0002', '$2a$10$GXZlMN9itGYk/kxFAKpJme6HAOBIlfKtIcAZmBWGH264UDOGuebVC', true, 'USR-PET-002'),
  -- Farmers (password: Farmer@123)
  ('f0000000-0000-0000-0000-000000000001', 'john.miller@greenpastures.com','John',   'Miller',   'farmer',       '+1-555-400-0001', '$2a$10$bQIWJjkOSE6.KF9N7DM2YO1qZSLqV6MjI8AOxDX02gfk5/oRjroqC', true, 'USR-FRM-001'),
  ('f0000000-0000-0000-0000-000000000002', 'maria.garcia@sunrisefarm.com','Maria',   'Garcia',   'farmer',       '+1-555-400-0002', '$2a$10$bQIWJjkOSE6.KF9N7DM2YO1qZSLqV6MjI8AOxDX02gfk5/oRjroqC', true, 'USR-FRM-002')
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
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'monday',    '08:00','17:00', 30, 18, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'tuesday',   '08:00','17:00', 30, 18, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'wednesday', '08:00','17:00', 30, 18, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'thursday',  '08:00','17:00', 30, 18, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'friday',    '08:00','17:00', 30, 18, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'saturday',  '09:00','13:00', 30,  8, true),
  -- Dr. Bennett: Mon,Wed,Fri 9am-6pm
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'monday',    '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'wednesday', '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'friday',    '09:00','18:00', 45, 12, true),
  -- Dr. Reyes: Tue,Thu,Sat 10am-8pm (emergency hours)
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'tuesday',   '10:00','20:00', 30, 20, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'thursday',  '10:00','20:00', 30, 20, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', 'saturday',  '10:00','18:00', 30, 16, true);

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
-- Farmer John Miller's livestock
  ('aa000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'Daisy',      'Cattle','Holstein Friesian', '2021-04-08', 'female', 580.0,'Black/White', NULL, false, 'Top milk producer. Calved twice. Due for TB test.', true, 'ANI-COW-001'),
  ('aa000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', 'Thunder',    'Horse', 'Thoroughbred',      '2018-09-12', 'male',   520.0,'Bay',         'MCHP-EQ-8001', false, 'Retired racehorse. Occasional lameness in left foreleg.',    true, 'ANI-HRS-001'),
  ('aa000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000001', 'Rosie',      'Cattle','Jersey',            '2022-01-20', 'female', 420.0,'Fawn',        NULL, false, 'High butterfat milk. Gentle temperament.',                   true, 'ANI-COW-002'),
  ('aa000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'Rex',        'Dog',   'Border Collie',     '2020-08-05', 'male',    22.0,'Black/White', 'MCHP-BC-1001', true,  'Working farm dog. Excellent herder.',                        true, 'ANI-DOG-004'),
-- Farmer Maria Garcia's animals
  ('aa000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000002', 'Clucky',     'Poultry','Rhode Island Red',  '2023-03-01', 'female',   3.2,'Red',         NULL, false, 'Layer hen. Produces ~280 eggs/year.',  true, 'ANI-HEN-001'),
  ('aa000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'Bella',      'Goat',  'Saanen',            '2022-05-15', 'female',  65.0,'White',       'MCHP-GT-5001', false, 'Dairy goat. Milking 4L/day. Due for deworming.',             true, 'ANI-GOT-001')
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
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 5b: ENTERPRISE MEMBERS
-- ============================================================
INSERT INTO enterprise_members (id, enterprise_id, user_id, role, title, is_active) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'owner',    'Farm Owner & Manager', true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'farm_vet', 'On-Call Veterinarian',  true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'worker',   'Seasonal Worker',       true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'owner',    'Farm Owner',            true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'farm_vet', 'Avian & Goat Vet',      true);

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
   '2026-04-15', 'Weight management recommended — maintain 30-32kg. Low-impact exercise only.'),

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
   'Behavioral feather plucking — no underlying medical cause. Blood panel and crop culture normal. Likely stress-related (recent household move).',
   'Harrison''s Bird Foods pellet diet. Aloe vera spray mist 2x daily on feathers. Environmental enrichment — foraging toys, minimum 4 hours out-of-cage time.',
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
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'Good morning Emily! I can see Buddy on camera. Can you have him walk away and back toward the camera?', 'text', '2026-01-15 09:03:00'),
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Emily Davis', 'Sure! Let me get his leash. You can see the limp is more noticeable after he''s been resting.', 'text', '2026-01-15 09:04:30'),
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'I can see the gait asymmetry. Based on his breed and age, this is consistent with hip dysplasia. I''d recommend getting radiographs done at our clinic.', 'text', '2026-01-15 09:08:00'),
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter', 'I''m sending over the prescription for anti-inflammatory medication now.', 'text', '2026-01-15 09:22:00'),
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Dr. Sarah Bennett', 'Hi Emily! I''m reviewing the photos you uploaded. Can you hold Whiskers so I can see the belly area closer?', 'text', '2026-01-22 14:05:00'),
  (uuid_generate_v4(), 'dd000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Emily Davis', 'She doesn''t love being held but I''ll try! The patches have been getting worse over the past 2 weeks.', 'text', '2026-01-22 14:06:30');

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
   'MR-2026-00001', 'diagnosis', 'Hip Dysplasia Diagnosis — Buddy',
   'Physical examination revealed bilateral hip laxity (Ortolani sign positive). Radiographs show Grade II hip dysplasia with mild joint space narrowing. No subluxation. Conservative management recommended at this stage. Weight management critical — target 30-32kg. Started on Carprofen for inflammation and glucosamine supplementation for cartilage support.',
   'normal', 'active', '[{"name":"Carprofen","dosage":"75mg","frequency":"Daily","duration":"14 days","instructions":"With food"}]',
   false, '2026-04-15', ARRAY['orthopedics','hip-dysplasia','senior-care'], 'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',
   'MR-2026-00002', 'diagnosis', 'Atopic Dermatitis — Whiskers',
   'Skin scraping: negative for Demodex, Sarcoptes, and dermatophytes. Cytology showed mild secondary bacterial infection (cocci). Trichogram: broken hair shafts consistent with self-trauma. Diagnosis: feline atopic dermatitis secondary to environmental allergens. Treatment: steroid taper + long-term Apoquel. Diet trial with hypoallergenic food recommended.',
   'high', 'active', '[{"name":"Prednisolone","dosage":"5mg","frequency":"Every other day","duration":"10 days taper","instructions":"Start taper after day 10"}]',
   false, '2026-03-22', ARRAY['dermatology','allergy','skin'], 'b0000000-0000-0000-0000-000000000002'),

  ('ff000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00003', 'diagnosis', 'Osteoarthritis Assessment — Max',
   'Bilateral hip and right stifle osteoarthritis. Radiographs show osteophyte formation and narrowed joint spaces. Synovial fluid analysis: mildly increased viscosity, no crystals, low WBC (non-inflammatory). Muscle mass slightly decreased in hindquarters. Multimodal pain management initiated.',
   'normal', 'active', '[{"name":"Meloxicam","dosage":"1.5mg","frequency":"Daily","duration":"Ongoing","instructions":"With food"}]',
   false, '2026-05-01', ARRAY['orthopedics','arthritis','geriatric'], 'b0000000-0000-0000-0000-000000000001'),

  ('ff000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003',
   'MR-2026-00004', 'diagnosis', 'Behavioral Feather Plucking — Kiwi',
   'Complete avian physical exam: body condition 4/5, keel prominent but adequate muscle mass. Feather plucking limited to chest and ventral wing coverts. No skin lesions or parasites. CBC/chemistry panel within normal limits. Crop gram stain: normal bacterial flora. Chlamydia psittaci PCR: negative. Diagnosis: behavioral feather destructive behavior (FDB), likely triggered by environmental stress from recent move.',
   'normal', 'active', '[]',
   false, '2026-05-05', ARRAY['avian','behavioral','exotic'], 'b0000000-0000-0000-0000-000000000003'),

  ('ff000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
   'MR-2026-00005', 'diagnosis', 'Acute Milk Drop — Daisy (Holstein)',
   'Holstein cow presented with 30% decline in milk production over 48 hours. Slight bilateral nasal discharge (serous). Temp 39.8°C (mildly elevated). Rumen motility reduced. Differential diagnosis: early pneumonia vs. subclinical ketosis vs. transition cow syndrome. Blood sample collected — awaiting BHB, NEFA, and CBC results. Started on IV fluids and propylene glycol drench pending labs.',
   'high', 'active', '[]',
   false, NULL, ARRAY['bovine','production','emergency'], 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 10b: VACCINATION RECORDS
-- ============================================================
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, certificate_number, reaction_notes, is_valid) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'Rabies (3-year)',     'Core',      '2025-03-15', '2028-03-15', '1 mL SC', 'RB-3Y-8842', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'DHPP (DA2PP)',        'Core',      '2025-03-15', '2026-03-15', '1 mL SC', 'DH-5W-2210', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A002', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'Bordetella',          'Non-Core',  '2025-09-01', '2026-09-01', '0.5 mL IN','BD-IN-4410', 'Merck',                'b0000000-0000-0000-0000-000000000001', 'VAX-2025-A003', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'FVRCP',              'Core',      '2025-07-20', '2026-07-20', '1 mL SC', 'FV-3C-7781', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-B001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'Rabies (1-year)',     'Core',      '2025-07-20', '2026-07-20', '1 mL SC', 'RB-1Y-3319', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000002', 'VAX-2025-B002', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'Rabies (3-year)',     'Core',      '2024-06-10', '2027-06-10', '1 mL SC', 'RB-3Y-5501', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-C001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'DHPP (DA2PP)',        'Core',      '2024-06-10', '2025-06-10', '1 mL SC', 'DH-5W-1198', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2024-C002', 'Mild injection site swelling resolved in 24hrs', true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 'BVD + IBR',          'Core',      '2025-10-01', '2026-10-01', '5 mL IM', 'BV-IBR-4477','Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-D001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 'Clostridial 7-way',  'Core',      '2025-10-01', '2026-04-01', '2 mL SC', 'CL-7W-9902', 'Merck',                'b0000000-0000-0000-0000-000000000001', 'VAX-2025-D002', NULL, true);

-- ============================================================
-- STEP 10c: WEIGHT HISTORY
-- ============================================================
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 30.2, 'kg', 'Post-neuter recovery weight',  'b0000000-0000-0000-0000-000000000001', '2025-06-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 31.8, 'kg', 'Gaining well — slight overweight', 'b0000000-0000-0000-0000-000000000001', '2025-09-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 32.5, 'kg', 'Annual checkup weight',        'b0000000-0000-0000-0000-000000000001', '2026-01-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002',  3.8, 'kg', 'First year weight',            'b0000000-0000-0000-0000-000000000002', '2025-07-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002',  4.2, 'kg', 'Dermatology visit weight',     'b0000000-0000-0000-0000-000000000002', '2026-01-22'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 39.5, 'kg', 'Pre-arthritis baseline',       'b0000000-0000-0000-0000-000000000001', '2025-08-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 38.0, 'kg', 'Weight loss goal on track',    'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 560.0,'kg', 'Quarterly herd weigh-in',      'f0000000-0000-0000-0000-000000000001', '2025-10-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 580.0,'kg', 'Pre-calving weight',           'f0000000-0000-0000-0000-000000000001', '2026-01-15');

-- ============================================================
-- STEP 10d: ALLERGY RECORDS
-- ============================================================
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'Dust Mites',     'Pruritus, erythema, alopecia on ventrum', 'severe',   '2026-01-22', true, 'Confirmed via intradermal allergy testing at Bennett Clinic', 'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'Grain (Wheat)',   'GI upset — vomiting, soft stool',         'moderate', '2025-11-10', true, 'Resolved on grain-free diet. Reoccurs if exposed.', 'c0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'Chicken Protein', 'Ear inflammation, itchy paws',            'mild',     '2024-09-15', true, 'Switched to salmon-based diet.',  'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'Bee Stings',      'Facial swelling, hives',                  'severe',   '2025-07-20', true, 'Emergency Benadryl given. Keep epinephrine on hand during outdoor activities.', 'b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 10e: LAB RESULTS
-- ============================================================
INSERT INTO lab_results (id, animal_id, consultation_id, test_name, test_category, test_date, result_value, normal_range, unit, is_abnormal, interpretation, status, lab_name, ordered_by, notes) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'Skin Scraping — Demodex',       'Dermatology', '2026-01-22', 'Negative',  'Negative', NULL,    false, 'No Demodex mites observed. Rules out demodicosis.',    'completed', 'Bennett Lab',     'b0000000-0000-0000-0000-000000000002', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'Fungal Culture (DTM)',           'Dermatology', '2026-01-22', 'Negative',  'Negative', NULL,    false, 'No dermatophyte growth at 14 days.',                   'completed', 'Bennett Lab',     'b0000000-0000-0000-0000-000000000002', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'CBC — Complete Blood Count',     'Hematology',  '2026-02-01', 'WBC 8.2, RBC 7.1, HCT 45%', 'WBC 5.5-16.9, RBC 5.5-8.5, HCT 37-55%', 'x10^9/L', false, 'All values within normal limits. No signs of infection.', 'completed', 'VetPath Diagnostics', 'b0000000-0000-0000-0000-000000000001', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'cc000000-0000-0000-0000-000000000003', 'Serum Chemistry Panel',          'Chemistry',   '2026-02-01', 'BUN 22, Creat 1.4, ALT 35', 'BUN 7-27, Creat 0.5-1.8, ALT 10-125', 'mg/dL', false, 'Kidney and liver values normal for age. Safe for NSAID therapy.', 'completed', 'VetPath Diagnostics', 'b0000000-0000-0000-0000-000000000001', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'Avian CBC + Chemistry',          'Hematology',  '2026-02-05', 'WBC 6.8, PCV 48%, Glucose 280', 'WBC 5-12, PCV 35-55%, Glucose 200-400', 'varied', false, 'All values within normal range for Green Cheek Conure.', 'completed', 'Avian Diagnostics Inc', 'b0000000-0000-0000-0000-000000000003', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000006', 'cc000000-0000-0000-0000-000000000004', 'Chlamydia psittaci PCR',         'Infectious',  '2026-02-05', 'Not Detected', 'Not Detected', NULL, false, 'Negative for Chlamydia. Rules out psittacosis.',          'completed', 'Avian Diagnostics Inc', 'b0000000-0000-0000-0000-000000000003', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 'cc000000-0000-0000-0000-000000000005', 'BHB (Beta-Hydroxybutyrate)',     'Chemistry',   '2026-02-18', '1.8',       '0.2-1.0', 'mmol/L', true,  'Elevated BHB indicates subclinical ketosis. Confirms metabolic cause for milk drop.', 'completed', 'Iowa Vet Diagnostics', 'b0000000-0000-0000-0000-000000000001', 'Urgent sample — results in 4 hours');

-- ============================================================
-- STEP 11: PAYMENTS
-- ============================================================
INSERT INTO payments (id, consultation_id, user_id, payer_id, payee_id, amount, currency, status, payment_method, transaction_id, invoice_number, gateway, tax_amount, paid_at) VALUES
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'credit_card', 'TXN-2026-A001', 'INV-2026-001', 'stripe', 7.65, '2026-01-15 09:30:00'),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   95.00, 'USD', 'completed', 'credit_card', 'TXN-2026-A002', 'INV-2026-002', 'stripe', 8.55, '2026-01-22 14:45:00'),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'debit_card', 'TXN-2026-B001', 'INV-2026-003', 'stripe', 7.65, '2026-02-01 10:35:00'),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
   120.00, 'USD', 'completed', 'credit_card', 'TXN-2026-B002', 'INV-2026-004', 'stripe', 10.80, '2026-02-05 11:40:00'),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'pending', 'bank_transfer', NULL, 'INV-2026-005', 'stripe', 7.65, NULL);

-- ============================================================
-- STEP 12: REVIEWS
-- ============================================================
INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, response_from_vet, is_public, status, helpful_count, report_count) VALUES
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   5, 'Dr. Carter was incredibly thorough with Buddy''s hip evaluation. He explained everything clearly over video and the prescription was ready before the call even ended. Highly recommend!',
   'Thank you Emily! Buddy is a wonderful patient. Don''t forget his follow-up in April.', true, 'active', 8, 0),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   4, 'Dr. Bennett diagnosed Whiskers'' skin condition quickly. The treatment plan is detailed and working well after 3 weeks. Only minor issue was a short wait before the video call started.',
   'Thank you for the kind words! Glad the Apoquel is helping. See you at the follow-up!', true, 'active', 5, 0),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   5, 'Max''s arthritis management plan from Dr. Carter has been life-changing. He''s climbing stairs again within 2 weeks of starting treatment. The Adequan injections are making a huge difference.',
   NULL, true, 'active', 12, 0),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
   5, 'Finding an avian specialist was difficult until we found Dr. Reyes. He was patient, knowledgeable about conure behavior, and his diagnosis for Kiwi''s feather plucking was spot on. The enrichment recommendations are already helping.',
   'Thank you Robert! Kiwi is a lovely bird. The foraging toys should make a big difference. See you in May!', true, 'active', 6, 0);

-- ============================================================
-- STEP 13: NOTIFICATIONS
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel) VALUES
  -- Pet owner notifications
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'booking',       'Booking Confirmed', 'Your appointment with Dr. Carter for Coco on Feb 25 at 2:00 PM has been confirmed.', false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'consultation',  'Prescription Ready', 'Dr. Bennett has issued a new prescription for Whiskers. View it in your medical records.', true, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'reminder',      'Follow-Up Reminder', 'Whiskers has a follow-up appointment due on March 22, 2026 with Dr. Bennett.', false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000002', 'booking',       'Booking Confirmed', 'Your appointment with Dr. Bennett for Luna on Feb 27 at 9:00 AM has been confirmed.', false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000002', 'review',        'Thank You for Your Review', 'Dr. Reyes appreciated your 5-star review for Kiwi''s consultation.', true, 'in_app'),
  -- Vet notifications
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'booking',       'New Booking Request', 'John Miller has requested an appointment for Thunder (Horse) on March 5.', false, 'in_app'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'consultation',  'Lab Results Ready', 'BHB results for Daisy (Holstein) are now available. Value: 1.8 mmol/L — elevated.', false, 'in_app'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'review',        'New Review Received', 'Robert Chen left a 5-star review for Max''s consultation.', true, 'in_app'),
  -- Admin notifications
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'system',        'System Health Check', 'All system services are operating normally. Uptime: 99.97%.', true,  'in_app'),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'payment',       'Payment Processing', '5 payments processed today totaling $470.00. No failed transactions.', false, 'in_app'),
  -- Farmer notifications
  (uuid_generate_v4(), 'f0000000-0000-0000-0000-000000000001', 'consultation',  'Urgent: Lab Results', 'Daisy''s BHB level is 1.8 mmol/L indicating subclinical ketosis. Contact your vet.', false, 'in_app'),
  (uuid_generate_v4(), 'f0000000-0000-0000-0000-000000000001', 'reminder',      'Vaccination Due',    'Clostridial 7-way booster for Daisy is due on April 1, 2026.', false, 'in_app');

-- ============================================================
-- STEP 14: AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (id, user_id, user_email, action, resource, entity_type, details, ip_address, timestamp) VALUES
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',            'LOGIN',        'auth',          'user',         '{"method":"email_password"}',                          '10.0.0.1', '2026-02-18 07:45:00'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', 'dr.james.carter@vetcare.com',  'START_CONSULTATION', 'consultations','consultation','{"consultationId":"cc000000-0000-0000-0000-000000000005","animalName":"Daisy"}', '10.0.0.5', '2026-02-18 08:05:00'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000001', 'emily.davis@email.com',        'CREATE_BOOKING', 'bookings',     'booking',      '{"bookingId":"bb000000-0000-0000-0000-000000000005","vetName":"Dr. Carter"}', '192.168.1.10', '2026-02-19 16:30:00'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', 'dr.sarah.bennett@vetcare.com', 'ISSUE_PRESCRIPTION','prescriptions','prescription','{"prescriptionId":"ee000000-0000-0000-0000-000000000002","animal":"Whiskers"}', '10.0.0.6', '2026-01-22 14:43:00'),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',            'UPDATE_SETTING', 'settings',     'system_setting','{"key":"display.timeFormat","oldValue":"24h","newValue":"12h"}', '10.0.0.1', '2026-02-17 10:00:00');

-- ============================================================
-- STEP 15: SYSTEM SETTINGS
-- ============================================================
INSERT INTO system_settings (id, key, value, category, description) VALUES
  (uuid_generate_v4(), 'display.timeFormat',              '12h',            'display',       'Time display format: 12h (AM/PM) or 24h'),
  (uuid_generate_v4(), 'display.dateFormat',              'MMM d, yyyy',    'display',       'Date display format'),
  (uuid_generate_v4(), 'consultation.joinWindowMinutes',  '5',              'consultation',  'Minutes before scheduled time when Join/Start button becomes available'),
  (uuid_generate_v4(), 'consultation.maxDurationMinutes', '60',             'consultation',  'Maximum consultation duration in minutes'),
  (uuid_generate_v4(), 'booking.advanceBookingDays',      '60',             'booking',       'How many days in advance bookings are allowed'),
  (uuid_generate_v4(), 'booking.cancellationWindowHours', '24',             'booking',       'Hours before appointment when cancellation is free'),
  (uuid_generate_v4(), 'booking.maxReschedules',          '1',              'booking',       'Maximum number of times a user can reschedule a booking before doctor acceptance'),
  (uuid_generate_v4(), 'booking.patientNoShowRescheduleLimit', '1',         'booking',       'Maximum times a patient can reschedule after a patient no-show (0 = unlimited)'),
  (uuid_generate_v4(), 'payment.currency',                'USD',            'payment',       'Default platform currency'),
  (uuid_generate_v4(), 'payment.taxRate',                 '9',              'payment',       'Default tax percentage applied to consultation fees'),
  (uuid_generate_v4(), 'notification.emailEnabled',       'true',           'notification',  'Enable email notifications'),
  (uuid_generate_v4(), 'video.maxParticipants',           '2',              'video',         'Maximum participants per video session'),
  (uuid_generate_v4(), 'security.maxLoginAttempts',       '5',              'security',      'Maximum login attempts before temporary lockout'),
  (uuid_generate_v4(), 'security.lockoutDurationMinutes', '15',             'security',      'Lockout duration after max failed login attempts'),
  (uuid_generate_v4(), 'payment.gatewayMode',             'demo',           'payment',       'Payment gateway mode: demo (stub payments), test (sandbox), live (real gateway)'),
  (uuid_generate_v4(), 'payment.gatewayUrl',              '',               'payment',       'Payment gateway API base URL (leave empty for demo/stub mode)'),
  (uuid_generate_v4(), 'payment.gatewayApiKey',           '',               'payment',       'Payment gateway API key (encrypted in production)'),
  (uuid_generate_v4(), 'payment.gatewayProvider',         'stripe',         'payment',       'Payment gateway provider: stripe, paypal, razorpay'),
  (uuid_generate_v4(), 'cancellation.autoRefundOnDoctorCancel', 'true',     'cancellation',  'Automatically refund patient when doctor cancels a paid booking'),
  (uuid_generate_v4(), 'cancellation.patientFreeWindowHours',  '24',        'cancellation',  'Hours before appointment when patient can cancel for free'),
  (uuid_generate_v4(), 'cancellation.partialRefundPercent',    '50',        'cancellation',  'Refund percentage for patient cancellation within partial window'),
  (uuid_generate_v4(), 'cancellation.partialRefundWindowHours','2',         'cancellation',  'Hours before appointment for partial refund (0 = direct no-refund)'),
  (uuid_generate_v4(), 'cancellation.goodwillBonusPercent',    '10',        'cancellation',  'Bonus wallet credit on top of refund when doctor cancels'),
  (uuid_generate_v4(), 'cancellation.doctorMaxCancellationsPerMonth', '3',  'cancellation',  'Max doctor cancellations per month before reliability penalty')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 16: MOVEMENT RECORDS
-- ============================================================
INSERT INTO movement_records (id, enterprise_id, animal_id, from_location_id, to_location_id, movement_type, reason, animal_count, transport_date, recorded_by, notes) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'transfer', 'Moved to barn for milking shift',      1, '2026-02-18 05:30:00', 'f0000000-0000-0000-0000-000000000001', 'Morning milking transfer'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'quarantine', 'Isolated for veterinary examination', 1, '2026-02-18 09:00:00', 'b0000000-0000-0000-0000-000000000001', 'Temperature elevated — isolating as precaution'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'transfer', 'Morning turnout to pasture',           1, '2026-02-18 07:00:00', 'f0000000-0000-0000-0000-000000000001', NULL);

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

  ('1c000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000005', 'deworming', 'Goat Herd Deworming — Spring',
   'FAMACHA-guided targeted deworming for Saanen dairy does.',
   'Cydectin (Moxidectin)', '0.2 mg/kg oral', 12, 8, 'in_progress', '2026-02-15', '2026-02-15 10:00:00', NULL,
   'b0000000-0000-0000-0000-000000000003', 180.00, '8 of 12 does treated so far. Remaining 4 have low FAMACHA scores — skipping.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 18: HEALTH OBSERVATIONS
-- ============================================================
INSERT INTO health_observations (id, enterprise_id, animal_id, observer_id, observation_type, severity, title, description, body_temperature, heart_rate, respiratory_rate, symptoms, is_resolved, resolved_at) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'illness', 'high', 'Daisy — Reduced Milk Yield & Nasal Discharge',
   'Daisy''s milk production dropped from 28L to 19L in 48 hours. Slight bilateral serous nasal discharge. Eating less than normal. Rumen sounds decreased on auscultation.',
   39.8, 72, 28, ARRAY['reduced_appetite','nasal_discharge','decreased_milk','lethargy'], false, NULL),

  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000001', 'lameness', 'medium', 'Thunder — Intermittent Left Foreleg Lameness',
   'Thunder shows grade 2/5 lameness on left foreleg after turnout exercise. Improves with rest. No heat or swelling palpated in fetlock or knee.',
   37.8, 36, 14, ARRAY['lameness','stiffness'], false, NULL),

  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'general', 'low', 'Bella — Routine Observation',
   'Bella appears healthy during morning feeding. Good appetite, active, producing 4.2L milk today. Body condition score 3.0/5.',
   38.9, 80, 22, NULL, true, NOW() - INTERVAL '3 days');

-- ============================================================
-- STEP 19: BREEDING RECORDS
-- ============================================================
INSERT INTO breeding_records (id, enterprise_id, dam_id, sire_id, breeding_method, breeding_date, expected_due_date, status, technician_id, pregnancy_confirmed, pregnancy_check_date, notes) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000009', NULL, 'artificial_insemination', '2025-11-10', '2026-08-20', 'confirmed_pregnant',
   'b0000000-0000-0000-0000-000000000001', true, '2025-12-15', 'AI with sexed semen from XYZ bull. Pregnancy confirmed by rectal palpation at 35 days. Due August 2026.'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000012', NULL, 'natural', '2025-12-01', '2026-04-30', 'confirmed_pregnant',
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
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 210, 'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 88.20, 'Morning + evening feeding for Holstein herd'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-000000000001', 380, 'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 106.40, 'Alfalfa hay — ad libitum access'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-000000000004', 18,  'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000002', 6.84,  'Layer mash for 150 hens'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-000000000005', 8,   'kg', '2026-02-18', 'f0000000-0000-0000-0000-000000000002', 4.40,  'Dairy ration for 12 Saanen does');

-- ============================================================
-- STEP 21: COMPLIANCE DOCUMENTS
-- ============================================================
INSERT INTO compliance_documents (id, enterprise_id, document_type, title, description, reference_number, issued_date, expiry_date, issuing_authority, status, verified_by, verified_at, is_active) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'license',        'USDA Organic Certification',              'Annual organic dairy certification for milk and cheese products.',                     'ORG-IA-2026-0482', '2025-09-01', '2026-09-01', 'USDA National Organic Program', 'active', 'a0000000-0000-0000-0000-000000000001', '2025-09-05', true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'permit',         'Grade A Milk Permit',                     'State permit for Grade A pasteurized milk production and sales.',                      'MILK-IA-2026-1123', '2025-07-01', '2026-07-01', 'Iowa Department of Agriculture', 'active', NULL, NULL, true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'test_report',    'Annual TB Test — Herd',                   'Tuberculosis testing for entire dairy herd. All negative.',                            'TB-IA-2025-8841',   '2025-12-01', '2026-12-01', 'Iowa State Veterinarian',       'active', 'b0000000-0000-0000-0000-000000000001', '2025-12-05', true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'certification',  'Humane Farm Animal Care Certified',       'Certified Humane designation for dairy cattle housing and handling.',                   'HFC-2024-DA-3319',  '2024-06-01', '2026-06-01', 'HFAC',                          'active', NULL, NULL, true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'license',        'NCDA Egg Handler License',                'State license for commercial egg handling and sale.',                                  'EGG-NC-2026-0119',  '2025-08-15', '2026-08-15', 'NC Dept of Agriculture',       'active', NULL, NULL, true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'permit',         'Goat Dairy Operating Permit',             'County permit for goat milk collection and farmstead cheese production.',              'GD-NC-2025-0844',   '2025-05-01', '2026-05-01', 'Buncombe County Health Dept',  'pending_renewal', NULL, NULL, true);

-- ============================================================
-- STEP 22: FINANCIAL RECORDS
-- ============================================================
INSERT INTO financial_records (id, enterprise_id, record_type, category, description, amount, currency, transaction_date, recorded_by, notes) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'income',  'milk_sales',     'Weekly milk sales to Midwest Dairy Co-op',     4250.00, 'USD', '2026-02-17', 'f0000000-0000-0000-0000-000000000001', '8,500L whole milk @ $0.50/L'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'income',  'cheese_sales',   'Artisan cheddar — farmers market + online',    1850.00, 'USD', '2026-02-15', 'f0000000-0000-0000-0000-000000000001', '74 blocks @ $25 each'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'feed',           'Dairy pellets — monthly purchase',             2520.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000001', '6000kg @ $0.42/kg from Midwest Feed'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'veterinary',     'Vet consultation — Daisy emergency',             85.00, 'USD', '2026-02-18', 'f0000000-0000-0000-0000-000000000001', 'Dr. Carter emergency visit'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'expense', 'labor',          'Part-time worker wages — February',            1600.00, 'USD', '2026-02-15', 'f0000000-0000-0000-0000-000000000001', 'Maria Garcia — 80 hrs @ $20/hr'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'income',  'egg_sales',      'Weekly egg sales — Asheville farmers market',    720.00, 'USD', '2026-02-16', 'f0000000-0000-0000-0000-000000000002', '240 dozen @ $3/dozen'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'income',  'goat_milk_sales','Goat milk delivery — Sunshine Market',           480.00, 'USD', '2026-02-17', 'f0000000-0000-0000-0000-000000000002', '60 gallons @ $8/gallon'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'expense', 'feed',           'Layer mash + goat ration — February',           560.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000002', 'Southern Feeds monthly order');

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
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'vaccination_due', 'critical', 'Vaccination Overdue: Clostridial 7-way Booster',
   'Daisy (Holstein #ANI-COW-001) is due for Clostridial 7-way booster. Original due date: April 1, 2026. Schedule vaccination immediately.', false, false),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000003', 'document_expiry', 'warning', 'Document Expiring: Humane Farm Animal Care Certificate',
   'The HFAC Certified Humane designation expires on June 1, 2026. Begin renewal process within 30 days.', false, false),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000003', 'document_expiry', 'warning', 'Document Expiring: Goat Dairy Permit',
   'The Goat Dairy Operating Permit (Buncombe County) expires May 1, 2026. Renewal application pending.', true, true);

-- ============================================================
-- STEP 24: IOT SENSORS
-- ============================================================
INSERT INTO iot_sensors (id, enterprise_id, location_id, sensor_type, sensor_name, serial_number, manufacturer, unit, min_threshold, max_threshold, reading_interval_seconds, status, battery_level, last_reading_at, firmware_version, metadata) VALUES
  ('a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'temperature', 'Barn Temp Sensor A',       'SN-TMP-001', 'FarmTech', '°C', 5, 30,   300, 'active', 87.5, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"main_floor"}'),
  ('a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'humidity',    'Barn Humidity Sensor',     'SN-HUM-001', 'FarmTech', '%',  40, 85,  300, 'active', 92.0, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"main_floor"}'),
  ('a5000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'flow_rate',   'Milking Parlor Flow Meter','SN-FLW-001', 'DairyTech','L/min', 0, 15, 60,  'active', 78.0, NOW() - INTERVAL '2 minutes', 'v3.0.1', '{}'),
  ('a5000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'weight',      'Feed Bin Scale',           'SN-WGT-001', 'AgriScale','kg',   0, 5000,3600,'active', 95.0, NOW() - INTERVAL '1 hour',    'v1.5.0', '{}'),
  ('a5000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'temperature', 'Hen House Temp Sensor',    'SN-TMP-002', 'FarmTech', '°C', 10, 35,  300, 'active', 63.0, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"nesting_area"}')
ON CONFLICT (id) DO NOTHING;;

-- Sensor readings (recent)
INSERT INTO sensor_readings (id, sensor_id, enterprise_id, value, unit, is_anomaly, anomaly_type, recorded_at) VALUES
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 14.2, '°C', false, NULL, NOW() - INTERVAL '5 minutes'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 14.5, '°C', false, NULL, NOW() - INTERVAL '10 minutes'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 68.0, '%',  false, NULL, NOW() - INTERVAL '5 minutes'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 89.5, '%',  true,  'above_threshold', NOW() - INTERVAL '2 hours'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 8.7,  'L/min', false, NULL, NOW() - INTERVAL '2 minutes'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 2180, 'kg', false, NULL, NOW() - INTERVAL '1 hour'),
  (uuid_generate_v4(), 'a5000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 22.1, '°C', false, NULL, NOW() - INTERVAL '5 minutes');

-- ============================================================
-- STEP 25: DISEASE PREDICTIONS & OUTBREAK ZONES
-- ============================================================
INSERT INTO disease_predictions (id, enterprise_id, animal_id, disease_name, risk_score, confidence, predicted_onset, risk_factors, recommended_actions, status, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'Subclinical Ketosis',
   78.5, 85.0, '2026-02-20', '["Recent calving","High milk yield genetics","Winter housing","Body condition loss"]',
   '["Propylene glycol drench 300mL daily","Increase energy density in TMR","Monitor BHB weekly","Reduce milking frequency temporarily"]',
   'active', 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', NULL, 'Bovine Respiratory Disease',
   42.0, 65.0, '2026-03-15', '["Season change","High barn humidity (89.5%)","New animal intake in January"]',
   '["Improve barn ventilation","Monitor barn humidity sensor","Vaccinate incoming animals","Reduce stocking density"]',
   'active', 'b0000000-0000-0000-0000-000000000001');

INSERT INTO outbreak_zones (id, enterprise_id, location_id, disease_name, severity, affected_count, total_at_risk, containment_status, containment_actions) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Subclinical Ketosis', 'medium', 1, 42, 'monitoring',
   '["Isolated affected cow to quarantine pen","Blood testing all fresh cows","Adjusted herd nutrition plan"]');

-- ============================================================
-- STEP 26: GENETIC PROFILES & LINEAGE PAIRS
-- ============================================================
INSERT INTO genetic_profiles (id, animal_id, enterprise_id, sire_id, dam_id, generation, inbreeding_coefficient, genetic_traits, dna_test_date, dna_lab, breed_purity_pct, notes) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', NULL, NULL, 3, 0.0312,
   '{"milk_yield":"high","butterfat":"average","protein":"above_average","somatic_cell":"low","fertility":"good"}',
   '2025-08-15', 'Neogen Genomics', 98.5, 'Purebred Holstein with excellent genomic milk production traits.'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000001', NULL, NULL, 2, 0.0156,
   '{"milk_yield":"average","butterfat":"very_high","protein":"high","somatic_cell":"low","fertility":"excellent"}',
   '2025-08-15', 'Neogen Genomics', 99.2, 'Purebred Jersey — exceptional butterfat genetics. Ideal for cheese production.');

INSERT INTO lineage_pairs (id, enterprise_id, sire_id, dam_id, compatibility_score, predicted_inbreeding, predicted_traits, recommendation, reason) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-000000000009',
   42.0, 0.0025, '{"expected_type":"crossbred calf","vigor":"high"}', 'not_recommended', 'Cross-species pairing (horse x cattle) is not genetically viable. System flagged for review.');

-- ============================================================
-- STEP 27: SUPPLY CHAIN — PRODUCT BATCHES, TRACEABILITY, QR CODES
-- ============================================================
INSERT INTO product_batches (id, enterprise_id, batch_number, product_type, description, quantity, unit, source_group_id, production_date, expiry_date, quality_grade, certifications, current_holder, status) VALUES
  ('a6000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'MILK-20260218-001', 'raw_milk',
   'Morning milking batch — Grade A raw milk from Holstein herd', 850, 'liters',
   'ab000000-0000-0000-0000-000000000001', '2026-02-18', '2026-02-22', 'A',
   '["USDA Organic","Grade A","Certified Humane"]', 'Green Pastures Processing', 'in_transit'),
  ('a6000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'CHDR-20260215-001', 'cheese',
   'Aged cheddar batch — 6-month aged organic cheddar', 74, 'blocks',
   'ab000000-0000-0000-0000-000000000001', '2025-08-15', '2026-08-15', 'Premium',
   '["USDA Organic","Certified Humane"]', 'Asheville Farmers Market', 'delivered'),
  ('a6000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'EGG-20260218-001', 'eggs',
   'Free-range eggs — daily collection from RIR flock', 240, 'dozen',
   'ab000000-0000-0000-0000-000000000004', '2026-02-18', '2026-03-18', 'AA',
   '["Free Range","NCDA Certified"]', 'Sunrise Farm Cold Storage', 'quality_check')
ON CONFLICT (id) DO NOTHING;

INSERT INTO traceability_events (id, enterprise_id, batch_id, event_type, title, description, location, recorded_by, event_date) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'collection',   'Morning Milking Complete',  'Collected 850L from 42 Holstein cows. Temperature at collection: 38°C.', 'Milking Parlor', 'f0000000-0000-0000-0000-000000000001', '2026-02-18 06:30:00'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'quality_check','Bacteria & SCC Test',       'Standard plate count: 8,000 CFU/mL (pass). SCC: 180,000 cells/mL (pass).','On-farm Lab',  'f0000000-0000-0000-0000-000000000001', '2026-02-18 07:00:00'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'shipping',     'Tank Truck Pickup',         'Midwest Dairy Co-op tank truck collected batch. Bill of Lading #BOL-4482.','Farm Gate',    'f0000000-0000-0000-0000-000000000001', '2026-02-18 08:15:00');

INSERT INTO qr_codes (id, enterprise_id, entity_type, entity_id, code_data, short_url, scan_count, is_active) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'product_batch', 'a6000000-0000-0000-0000-000000000001',
   '{"batch":"MILK-20260218-001","farm":"Green Pastures","organic":true,"grade":"A"}', 'https://vc.link/m/001', 12, true),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'product_batch', 'a6000000-0000-0000-0000-000000000002',
   '{"batch":"CHDR-20260215-001","product":"Aged Cheddar","aged_months":6}', 'https://vc.link/c/001', 34, true);

-- ============================================================
-- STEP 28: WORKFORCE (TASKS & SHIFTS)
-- ============================================================
INSERT INTO workforce_tasks (id, enterprise_id, title, description, task_type, priority, status, assigned_to, created_by, location_id, checklist, due_date, estimated_hours, notes) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Morning Milking — Holstein Herd',    'Milk all 42 Holstein cows in the rotary parlor. Record individual yields.', 'milking',     'high',    'completed', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '[{"label":"Sanitize parlor equipment","done":true},{"label":"Attach milking clusters","done":true},{"label":"Record individual yields","done":true},{"label":"Clean and flush lines","done":true}]', '2026-02-18 07:00:00', 3.0, 'Completed at 6:45 AM'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Repair Fence — North Pasture',       'Fix broken fence post in NE corner of North Pasture. Cattle have been pushing against it.', 'maintenance', 'medium',  'in_progress', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '[{"label":"Source replacement post","done":true},{"label":"Remove broken post","done":true},{"label":"Set new post in concrete","done":false},{"label":"Restring wire","done":false}]', '2026-02-20 17:00:00', 4.0, 'Maria started — needs concrete to set'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Monthly Feed Inventory Audit',        'Count all feed bins and reconcile with system records.', 'inventory',   'low',     'pending',  'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', '[{"label":"Count Bin A (Dairy Pellet)","done":false},{"label":"Count Hay Barn","done":false},{"label":"Count Mineral Blocks","done":false},{"label":"Update system records","done":false}]', '2026-02-28 17:00:00', 2.0, NULL),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'Egg Collection & Grading',            'Collect eggs from all nesting boxes and grade by size/quality.', 'collection',  'high',    'completed', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '[{"label":"Collect from all boxes","done":true},{"label":"Candle check","done":true},{"label":"Grade and pack","done":true},{"label":"Move to cold storage","done":true}]', '2026-02-18 10:00:00', 2.0, '240 dozen collected today');

INSERT INTO shift_schedules (id, enterprise_id, user_id, shift_date, start_time, end_time, role_on_shift, location_id, status, check_in_at, check_out_at) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-02-18', '05:00', '14:00', 'Farm Manager',    '10000000-0000-0000-0000-000000000001', 'completed', '2026-02-18 04:55:00', '2026-02-18 14:10:00'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '2026-02-18', '08:00', '16:00', 'General Worker',  '10000000-0000-0000-0000-000000000002', 'completed', '2026-02-18 07:58:00', '2026-02-18 16:05:00'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '2026-02-19', '05:00', '14:00', 'Farm Manager',    '10000000-0000-0000-0000-000000000001', 'scheduled', NULL, NULL),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '2026-02-18', '06:00', '12:00', 'Poultry Manager', '10000000-0000-0000-0000-000000000007', 'completed', '2026-02-18 05:55:00', '2026-02-18 12:15:00');

-- ============================================================
-- STEP 29: REPORT TEMPLATES & GENERATED REPORTS
-- ============================================================
INSERT INTO report_templates (id, enterprise_id, name, description, report_type, config, columns, filters, grouping, is_system, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Monthly Herd Health Summary',   'Overview of all health observations, treatments, and lab results for the month.', 'health',    '{"period":"monthly"}', '["animal_name","observation_type","severity","is_resolved","date"]', '{"severity":["high","critical"]}', '["observation_type"]', false, 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Financial P&L Report',          'Monthly profit and loss breakdown by category.',                                  'financial', '{"period":"monthly"}', '["category","income","expenses","net"]', '{}', '["category"]', false, 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), NULL,                                    'Animal Census by Species',      'System-wide report of animals grouped by species and breed.',                     'inventory', '{}', '["species","breed","count","avg_weight"]', '{}', '["species"]', true, NULL);

INSERT INTO generated_reports (id, enterprise_id, name, report_type, format, parameters, result_data, row_count, status, generated_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Herd Health — February 2026', 'health', 'json', '{"month":"2026-02","enterprise_id":"e0000000-0000-0000-0000-000000000001"}',
   '{"rows":[{"animal":"Daisy","type":"illness","severity":"high","resolved":false},{"animal":"Thunder","type":"lameness","severity":"medium","resolved":false}],"summary":{"total":2,"critical":0,"high":1,"medium":1}}',
   2, 'completed', 'f0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 30: DIGITAL TWINS & SIMULATIONS
-- ============================================================
INSERT INTO digital_twins (id, enterprise_id, name, twin_type, description, model_data, current_state, created_by) VALUES
  ('a7000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Green Pastures Farm Twin', 'farm',
   'Digital replica of the entire dairy farm — barns, pastures, herd, equipment, and supply chain.',
   '{"total_animals":59,"locations":6,"sensors":4,"active_campaigns":0}',
   '{"herd_health":"at_risk","milk_production_L":18200,"feed_stock_days":18,"revenue_mtd":6100,"active_alerts":2}',
   'f0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO simulation_runs (id, twin_id, enterprise_id, name, scenario_type, parameters, input_state, result_data, status, duration_ms, created_by) VALUES
  (uuid_generate_v4(), 'a7000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
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
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000001', 'user',      'Daisy''s milk production dropped 30% in 2 days and she has a slight nasal discharge. What could be wrong?', NULL, '[]', 28),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000001', 'assistant', 'Based on the symptoms you''ve described — a sudden 30% milk drop with nasal discharge in a Holstein dairy cow — the most likely causes include: 1) **Subclinical Ketosis** (especially if she calved recently — elevated BHB levels confirm this), 2) **Early Bovine Respiratory Disease** (barn humidity is 89.5% which increases BRD risk), or 3) **Transition cow syndrome**. Your vet has already collected a BHB test — if it comes back >1.4 mmol/L, ketosis is confirmed. Recommended: propylene glycol drench 300mL daily, increase energy density in her TMR, and investigate improving barn ventilation.', 88.5, '["Merck Vet Manual - Ketosis","USDA BRD Guidelines","Farm Sensor Data"]', 142),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000001', 'user',      'The BHB came back at 1.8 mmol/L. What should I do next?', NULL, '[]', 18),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000001', 'assistant', 'A BHB of 1.8 mmol/L confirms **subclinical ketosis**. Here''s your action plan: 1) **Immediate**: Continue propylene glycol 300mL orally once daily for 5 days. 2) **Nutrition**: Increase concentrate ratio in TMR by 10-15%, ensure she has access to fresh water at all times. 3) **Monitoring**: Retest BHB in 5-7 days — target is below 1.0 mmol/L. 4) **Milking**: Consider reducing to 2x daily milking temporarily to decrease energy demand. 5) **Herd prevention**: Test all cows within 30 days of calving. Your vet Dr. Carter can prescribe additional treatment if BHB doesn''t improve.', 92.0, '["AABP Ketosis Treatment Protocol","Herd-level Ketosis Prevention"]', 168),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000002', 'user',      'My Golden Retriever Buddy was diagnosed with Grade II hip dysplasia. Is swimming good for him?', NULL, '[]', 22),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000002', 'assistant', 'Yes! Swimming is one of the **best exercises** for dogs with hip dysplasia. It provides: 1) **Low-impact cardio** — no stress on joints while building muscle. 2) **Muscle strengthening** — particularly the gluteal and thigh muscles that support the hip joint. 3) **Weight management** — keeps Buddy''s weight in the target 30-32kg range. Start with 10-15 minute sessions 2-3 times per week. Avoid cold water which can stiffen joints. Your vet Dr. Carter also prescribed Carprofen and Dasuquin which complement the exercise program.', 95.0, '["ACVS Hip Dysplasia Guidelines","Canine Rehabilitation Literature"]', 128);

-- ============================================================
-- STEP 32: MARKETPLACE
-- ============================================================
INSERT INTO marketplace_listings (id, enterprise_id, seller_id, title, description, category, listing_type, price, currency, quantity, unit, condition, images, location, tags, status, featured, views_count) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'Organic Aged Cheddar — 6 Month (Bulk)',
   'Premium organic aged cheddar made from 100% grass-fed Holstein milk. USDA Organic & Certified Humane. Available in 5 lb blocks. Perfect for specialty retailers and restaurants.',
   'other', 'fixed_price', 45.00, 'USD', 30, 'blocks', 'new', '[]', 'Cedar Falls, Iowa', '["organic","cheese","dairy","bulk"]', 'active', true, 87),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002',
   'Free-Range RIR Laying Hens — 8 months old',
   'Healthy Rhode Island Red laying hens, 8 months old, producing ~5 eggs/week each. Raised free-range on organic feed. Great for backyard flocks or small farm startups.',
   'animal', 'fixed_price', 25.00, 'USD', 20, 'hens', 'new', '[]', 'Asheville, NC', '["poultry","layer","free-range","backyard"]', 'active', false, 42),
  (uuid_generate_v4(), NULL, 'b0000000-0000-0000-0000-000000000001',
   'Digital Livestock Weight Scale — Used',
   'AgriScale SB-500 digital livestock platform scale. Capacity 2000kg. Used for 2 years, recently calibrated. Includes Bluetooth module for data logging.',
   'equipment', 'auction', 800.00, 'USD', 1, 'unit', 'used', '[]', 'Austin, TX', '["scale","equipment","livestock","bluetooth"]', 'active', false, 23);

-- ============================================================
-- STEP 33: SUSTAINABILITY METRICS & GOALS
-- ============================================================
INSERT INTO sustainability_metrics (id, enterprise_id, metric_type, metric_name, value, unit, period_start, period_end, category, scope, data_source, recorded_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'ghg_emissions', 'Enteric Methane — Cattle',              4200, 'kgCO2e', '2026-01-01', '2026-01-31', 'emissions',     'scope_1', 'IPCC Tier 1 Calculation', 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'water_usage',   'Total Farm Water Consumption',          85000,'liters', '2026-01-01', '2026-01-31', 'water',         'scope_1', 'Water meter readings',    'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'energy',        'Electricity — Milking + Cooling',       3200, 'kWh',    '2026-01-01', '2026-01-31', 'energy',        'scope_2', 'Utility bill',            'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'waste',         'Manure Composted',                      18000,'kg',     '2026-01-01', '2026-01-31', 'waste_management','scope_1','Farm records',           'f0000000-0000-0000-0000-000000000001');

INSERT INTO sustainability_goals (id, enterprise_id, goal_name, description, metric_type, target_value, current_value, unit, baseline_value, baseline_date, target_date, status, progress_pct, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Reduce Methane by 20% by 2027',  'Implement methane-reducing feed additives (3-NOP) and improved manure management.',
   'ghg_emissions', 3360, 4200, 'kgCO2e/month', 4200, '2026-01-01', '2027-12-31', 'active', 0, 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Solar Power for Milking Parlor', 'Install 50kW solar array to offset electricity for milking, cooling, and lighting.',
   'energy', 0, 3200, 'kWh/month', 3200, '2026-01-01', '2026-12-31', 'active', 15, 'f0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 34: WELLNESS SCORECARDS & REMINDERS
-- ============================================================
INSERT INTO wellness_scorecards (id, animal_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by, assessed_at) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 82, 75, 70, 95, 85, 'overweight',  '2026-04-15',
   '["Reduce daily calories by 10%","Increase exercise to 45 min/day","Schedule hip dysplasia follow-up","Continue joint supplements"]',
   '["Hip dysplasia - monitor progression","Slightly overweight - target 30-32kg"]',
   'b0000000-0000-0000-0000-000000000001', '2026-01-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 74, 65, 80, 90, 90, 'normal', '2026-03-22',
   '["Continue hypoallergenic diet","Monitor skin condition weekly","Apply medicated shampoo as directed","Consider air purifier for dust mite control"]',
   '["Active atopic dermatitis","Grain allergy - strict avoidance"]',
   'b0000000-0000-0000-0000-000000000002', '2026-01-22'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 68, 80, 55, 85, 70, 'normal', '2026-05-01',
   '["Continue multimodal arthritis management","Hydrotherapy 2x/week recommended","Soft orthopedic bed","Dental cleaning due"]',
   '["Moderate osteoarthritis","DHPP vaccine overdue - schedule ASAP","Dental tartar buildup"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01');

INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, status, priority, recurrence) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'vaccination',  'DHPP Booster Due — Buddy',     'Annual DHPP vaccination is due. Schedule with Dr. Carter.', '2026-03-15', 'pending', 'high', 'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'checkup',      'Hip Dysplasia Follow-Up',       'Follow-up radiographs and joint assessment with Dr. Carter.', '2026-04-15', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'medication',   'Apoquel Refill Reminder',       'Refill Apoquel 16mg prescription. Contact Dr. Bennett.', '2026-03-01', 'pending', 'high', 'monthly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'checkup',      'Dermatology Follow-Up',         'Skin recheck with Dr. Bennett to evaluate treatment progress.', '2026-03-22', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'dental',       'Dental Cleaning — Max',         'Dental tartar buildup noted. Schedule professional cleaning.', '2026-03-01', 'pending', 'medium', 'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'vaccination',  'DHPP Booster Overdue — Max',    'DHPP vaccine was due June 2025. Schedule immediately.',  '2025-06-10', 'pending', 'urgent', 'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'checkup',      'Avian Wellness Recheck — Kiwi', 'Follow-up on feather plucking behavior with Dr. Reyes.', '2026-05-05', 'pending', 'low', NULL);

-- ============================================================
-- STEP 35: GEOFENCE ZONES & EVENTS
-- ============================================================
INSERT INTO geofence_zones (id, enterprise_id, name, zone_type, center_lat, center_lng, radius_meters, polygon_coords, color, alert_on_entry, alert_on_exit, is_restricted, status, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Farm Boundary',        'boundary',    42.5277, -92.4453, 1200, '[]', '#22c55e', false, true,  false, 'active', 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'Quarantine Zone',      'quarantine',  42.5280, -92.4460,  50,  '[]', '#ef4444', true,  true,  true,  'active', 'f0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'North Pasture Grazing','pasture',     42.5290, -92.4440, 400,  '[]', '#3b82f6', false, false, false, 'active', 'f0000000-0000-0000-0000-000000000001');

INSERT INTO geospatial_events (id, enterprise_id, animal_id, event_type, latitude, longitude, speed_kmh, metadata) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000007', 'location_update', 42.5278, -92.4455, 0, '{"source":"ear_tag_gps","battery":72}'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'location_update', 42.5291, -92.4442, 5.2, '{"source":"collar_gps","battery":85}'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000008', 'zone_exit',       42.5295, -92.4448, 8.1, '{"zone":"North Pasture Grazing","alert":"exited grazing zone at 4:15 PM"}');


-- ============================================================
-- STEP 36: ADDITIONAL USERS (4 new — 2 pet owners, 1 vet, 1 farmer)
-- ============================================================
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id) VALUES
  -- Pet Owners (password: Owner@123)
  ('c0000000-0000-0000-0000-000000000003', 'sarah.kim@email.com',         'Sarah',   'Kim',      'pet_owner',    '+1-555-300-0003', '$2a$10$GXZlMN9itGYk/kxFAKpJme6HAOBIlfKtIcAZmBWGH264UDOGuebVC', true, 'USR-PET-003'),
  ('c0000000-0000-0000-0000-000000000004', 'michael.torres@email.com',    'Michael', 'Torres',   'pet_owner',    '+1-555-300-0004', '$2a$10$GXZlMN9itGYk/kxFAKpJme6HAOBIlfKtIcAZmBWGH264UDOGuebVC', true, 'USR-PET-004'),
  -- Veterinarian (password: Doctor@123)
  ('b0000000-0000-0000-0000-000000000004', 'dr.priya.sharma@vetcare.com', 'Priya',   'Sharma',   'veterinarian', '+1-555-200-0004', '$2a$10$HH1yq2osUEdtByarwBFq0eBy.ko6Rv33jI2TtIcSJqGh382x5tqeu', true, 'USR-VET-004'),
  -- Farmer (password: Farmer@123)
  ('f0000000-0000-0000-0000-000000000003', 'thomas.green@greenmeadows.com','Thomas',  'Green',    'farmer',       '+1-555-400-0003', '$2a$10$bQIWJjkOSE6.KF9N7DM2YO1qZSLqV6MjI8AOxDX02gfk5/oRjroqC', true, 'USR-FRM-003')
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
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'monday',    '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'tuesday',   '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'wednesday', '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'thursday',  '09:00','18:00', 45, 12, true),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'friday',    '09:00','15:00', 45,  8, true)
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
ON CONFLICT (id) DO NOTHING;

INSERT INTO enterprise_members (enterprise_id, user_id, role, title, permissions, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'owner', 'Farm Owner', '["all"]', true),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'farm_vet', 'Consulting Veterinarian', '["health","breeding","treatment"]', true)
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, enterprise_id, name, location_type, capacity, current_occupancy, area, area_unit, gps_latitude, gps_longitude, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000003', 'Main Sheep Barn', 'barn', 80, 45, 4200, 'sqft', 44.4660, -72.6880, 'Climate-controlled barn for ewes and lambs', true),
  ('10000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000003', 'Pig House',       'pen',  30, 18, 2800, 'sqft', 44.4655, -72.6870, 'Heritage breed pig housing with outdoor access', true),
  ('10000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000003', 'Lambing Shed',    'barn', 20,  3, 1200, 'sqft', 44.4662, -72.6878, 'Dedicated lambing area with heat lamps', true),
  ('10000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000003', 'North Hill Pasture','pasture',60,40,120000,'sqft',44.4675, -72.6860, 'Rolling pasture for sheep grazing — rotational grazing system', true),
  ('10000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000003', 'Working Dog Kennel','kennel', 4, 1, 400, 'sqft', 44.4652, -72.6882, 'Heated kennel for Border Collie working dogs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO animal_groups (id, enterprise_id, name, group_type, species, breed, purpose, target_count, current_count, color_code, description, is_active) VALUES
  ('ab000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000003', 'Merino Ewe Flock', 'breeding_flock', 'Sheep', 'Merino', 'Wool production and breeding', 50, 42, '#a78bfa', 'Fine wool Merino breeding ewes — primary wool flock', true),
  ('ab000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000003', 'Heritage Pig Herd', 'production', 'Pig', 'Mixed Heritage', 'Artisan pork and breeding', 20, 18, '#f97316', 'Yorkshire and Berkshire pigs for heritage pork production', true),
  ('ab000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'Alpine Dairy Goats', 'dairy', 'Goat', 'Alpine', 'Goat milk production', 8, 6, '#22d3ee', 'Alpine dairy does for milk and cheese', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 39: ADDITIONAL ANIMALS (23 new — diverse species and breeds)
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
  ('aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'Copper',    'Dog',     'Beagle',             '2023-03-08', 'Male',   11.5, 'Tri-color',       '985121078901002', NULL, 'AKC-BG-2023-2205',  true,  'Trupanion',   'TP-2025-1143',  '2027-09-01', 'Very food-driven. Tends to overeat — strict portion control.',                              true, 'ANI-DOG-020', NULL, NULL, NULL, NULL, NULL, 11.5, 'kg', '2026-02-10', NULL),
  ('aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 'Oscar',     'Dog',     'Miniature Dachshund','2022-12-01', 'Male',   5.2,  'Red',             '985121078901003', NULL, 'AKC-DH-2022-6618',  true,  'Trupanion',   'TP-2025-1144',  '2027-09-01', 'IVDD risk — no jumping from furniture. Ramp access everywhere.',                            true, 'ANI-DOG-021', NULL, NULL, NULL, NULL, NULL, 5.2,  'kg', '2026-02-01', NULL),
  ('aa000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000004', 'Shadow',    'Cat',     'Bengal',             '2023-07-14', 'Male',   5.8,  'Brown Spotted',   '985121078901004', NULL, 'TICA-BG-2023-8901', false, 'Healthy Paws','HP-2025-5521',  '2027-07-01', 'Very active breed — needs daily play and climbing space. Raw diet supplemented.',           true, 'ANI-CAT-022', NULL, NULL, NULL, NULL, NULL, 5.8,  'kg', '2026-02-08', NULL),
  ('aa000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000004', 'Muffin',    'Cat',     'Ragdoll',            '2022-04-18', 'Female', 4.5,  'Seal Bicolor',    '985121078901005', NULL, 'CFA-RD-2022-3342',  true,  'Healthy Paws','HP-2025-5522',  '2027-07-01', 'Docile indoor cat. Annual blood panel recommended for HCM screening.',                      true, 'ANI-CAT-023', NULL, NULL, NULL, NULL, NULL, 4.5,  'kg', '2026-01-18', NULL),
  ('aa000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000004', 'Patches',   'Guinea Pig','Abyssinian',       '2024-08-20', 'Female', 0.95, 'Brown/White',     NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Vitamin C supplement daily. Needs hay ad libitum. Cage mate needed.',                       true, 'ANI-GP-024',  NULL, NULL, NULL, NULL, NULL, 0.95, 'kg', '2026-02-12', NULL),
  ('aa000000-0000-0000-0000-000000000025', 'c0000000-0000-0000-0000-000000000004', 'Nibbles',   'Hamster', 'Syrian Golden',      '2025-01-15', 'Male',   0.14, 'Golden',          NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         'Solitary — must be housed alone. Runs on wheel 5+ miles/night.',                            true, 'ANI-HAM-025', NULL, NULL, NULL, NULL, NULL, 0.14, 'kg', '2026-02-14', NULL),
  ('aa000000-0000-0000-0000-000000000026', 'c0000000-0000-0000-0000-000000000004', 'Neptune',   'Fish',    'Betta Splendens',    '2025-03-01', 'Male',   0.006,'Blue/Red Crown',  NULL,              NULL, NULL,                 false, NULL,          NULL,            NULL,         '5-gallon heated tank at 78°F. Eats Betta pellets + frozen bloodworms.',                     true, 'ANI-FSH-026', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,         NULL),

  -- Thomas Green's farm animals (sheep, pigs, goat, working dog)
  ('aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'Woolly',    'Sheep',   'Merino',             '2022-03-10', 'Female', 65.0, 'White',           NULL, 'VT-SH-001', 'NSIP-MR-2022-1101', false, NULL, NULL, NULL, 'Lead ewe. Excellent fine wool producer — 18 micron fleece.',                                  true, 'ANI-SHP-027', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'bred',   '2025-11-15', '2026-04-15', 65.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),
  ('aa000000-0000-0000-0000-000000000028', 'f0000000-0000-0000-0000-000000000003', 'Baxter',    'Sheep',   'Suffolk',            '2023-01-25', 'Male',   110.0,'Black Face/White',NULL, 'VT-SH-002', 'NSIP-SF-2023-2204', false, NULL, NULL, NULL, 'Primary stud ram. Excellent conformation and growth traits.',                                true, 'ANI-SHP-028', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'active', NULL,         NULL,         110.0,'kg', '2026-02-01', '10000000-0000-0000-0000-000000000013'),
  ('aa000000-0000-0000-0000-000000000029', 'f0000000-0000-0000-0000-000000000003', 'Dotty',     'Sheep',   'Dorper',             '2023-06-05', 'Female', 72.0, 'White/Black Head',NULL, 'VT-SH-003', 'NSIP-DP-2023-3305', false, NULL, NULL, NULL, 'Hair sheep — no shearing needed. Good meat production genetics.',                           true, 'ANI-SHP-029', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000006', 'open',   NULL,         NULL,         72.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),
  ('aa000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000003', 'Wilbur',    'Pig',     'Yorkshire',          '2024-04-12', 'Male',   180.0,'White/Pink',      NULL, 'VT-PG-001', NULL,                 false, NULL, NULL, NULL, 'Terminal sire. Excellent growth rate and loin depth.',                                       true, 'ANI-PIG-030', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000007', 'active', NULL,         NULL,         180.0,'kg', '2026-01-20', '10000000-0000-0000-0000-000000000011'),
  ('aa000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000003', 'Charlotte', 'Pig',     'Berkshire',          '2024-02-28', 'Female', 145.0,'Black/White pts', NULL, 'VT-PG-002', NULL,                 false, NULL, NULL, NULL, 'Heritage breed sow. Marbled meat genetics. First litter expected April.',                    true, 'ANI-PIG-031', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000007', 'bred',   '2025-12-10', '2026-04-08', 145.0,'kg', '2026-01-20', '10000000-0000-0000-0000-000000000011'),
  ('aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 'Scout',     'Dog',     'Border Collie',      '2021-08-05', 'Male',   19.5, 'Black/White',     '985121089012001', NULL, 'AKC-BC-2021-4401',  true,  NULL, NULL, NULL, 'Trained working sheepdog. Herds Merino flock. Needs high-energy diet.',                      true, 'ANI-DOG-032', 'e0000000-0000-0000-0000-000000000003', NULL, NULL, NULL, NULL, 19.5, 'kg', '2026-02-10', '10000000-0000-0000-0000-000000000014'),
  ('aa000000-0000-0000-0000-000000000033', 'f0000000-0000-0000-0000-000000000003', 'Heidi',     'Goat',    'Alpine',             '2023-03-18', 'Female', 62.0, 'Chamoisee',       NULL, 'VT-GT-001', 'ADGA-AP-2023-6601', false, NULL, NULL, NULL, 'Alpine dairy doe. Producing 3.8L/day. Clean bill of health.',                               true, 'ANI-GOT-033', 'e0000000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-000000000008', 'open',   NULL,         NULL,         62.0, 'kg', '2026-02-01', '10000000-0000-0000-0000-000000000010'),

  -- Additional farm animals for existing farmer John Miller
  ('aa000000-0000-0000-0000-000000000034', 'f0000000-0000-0000-0000-000000000001', 'Brutus',    'Cattle',  'Angus',              '2022-08-15', 'Male',   680.0,'Black',           NULL, 'IA-CT-003', 'AAA-AG-2022-8815',  false, NULL, NULL, NULL, 'Prime Angus bull. Sire for crossbreeding with Holsteins.',                                   true, 'ANI-COW-034', 'e0000000-0000-0000-0000-000000000001', NULL, 'active', NULL,         NULL,         680.0,'kg', '2026-01-15', '10000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000035', 'f0000000-0000-0000-0000-000000000001', 'Rosie',     'Cattle',  'Hereford',           '2023-04-20', 'Female', 520.0,'Red/White Face',  NULL, 'IA-CT-004', 'AHA-HF-2023-1122',  false, NULL, NULL, NULL, 'Hereford heifer. Good maternal genetics. First calf expected May 2026.',                     true, 'ANI-COW-035', 'e0000000-0000-0000-0000-000000000001', NULL, 'bred',   '2025-08-10', '2026-05-20', 520.0,'kg', '2026-01-15', '10000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 40: VET HOSPITALS (2 hospitals — ALL columns populated)
-- ============================================================
INSERT INTO vet_hospitals (id, name, hospital_type, tagline, registration_number, accreditation_body, accreditation_number, accreditation_expiry, description, address, city, state, country, postal_code, gps_latitude, gps_longitude, phone, emergency_phone, email, website, logo_url, cover_image_url, established_year, total_beds, icu_beds, is_24_hours, has_emergency, has_ambulance, has_pharmacy, has_lab, has_imaging, has_surgery, has_icu, specializations, facilities, accepted_species, operating_hours, owner_id, is_verified, is_active, verification_status, drug_license_expiry, trade_license_expiry, registration_renewal_date, rating, total_reviews, total_consultations, metadata) VALUES
  ('h0000000-0000-0000-0000-000000000001', 'VetCare Central Hospital', 'multi_specialty',
   'Excellence in Veterinary Care — 24/7 Emergency & Specialty Services',
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
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'hd000000-0000-0000-0000-000000000001', 'owner',            'Chief of Surgery & Hospital Director',  'full_time', true,  85.00,  true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'hd000000-0000-0000-0000-000000000003', 'department_head',  'Head of Dermatology',                   'full_time', true,  95.00,  true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'hd000000-0000-0000-0000-000000000004', 'consultant',       'Emergency & Exotic Consultant',         'part_time', false, 120.00, true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'hd000000-0000-0000-0000-000000000005', 'department_head',  'Head of Exotic Animal Medicine',         'full_time', true,  110.00, true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', NULL,                                   'medical_director', 'Medical Director',                      'full_time', false, 85.00,  true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', NULL,                                   'visiting',         'Visiting Exotic Specialist',             'visiting',  false, 120.00, true, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 43: HOSPITAL SERVICES
-- ============================================================
INSERT INTO hospital_services (id, hospital_id, service_name, category, description, price_min, price_max, currency, duration_minutes, requires_appointment, is_available) VALUES
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Wellness Exam',                 'consultation',   'Complete physical examination with wellness blood panel.',                   65.00, 120.00, 'USD', 30, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Emergency Triage & Stabilization','emergency',     '24/7 emergency assessment, triage, and stabilization.',                     150.00,500.00, 'USD', 60, false, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Dental Cleaning & Extractions',  'dental',         'Ultrasonic dental cleaning under anesthesia. Extractions priced separately.',250.00,600.00, 'USD', 90, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Spay/Neuter Surgery',            'surgery',        'Routine spay or neuter with pre-surgical blood work and post-op pain mgmt.',200.00,450.00, 'USD', 60, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Digital Radiographs (X-Ray)',     'diagnostics',    'High-resolution digital X-rays with same-day results.',                     120.00,220.00, 'USD', 20, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Ultrasound',                     'diagnostics',    'Abdominal or cardiac ultrasound by board-certified specialist.',             200.00,350.00, 'USD', 45, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'CT Scan',                        'diagnostics',    'Full-body or targeted CT scan under sedation.',                             800.00,1500.00,'USD', 60, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'TPLO Cruciate Surgery',          'surgery',        'Tibial plateau leveling osteotomy for cruciate ligament rupture.',           3500.00,5000.00,'USD',120,true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Allergy Testing (Intradermal)',   'diagnostics',    'Intradermal skin testing for environmental and food allergens.',             300.00,500.00, 'USD', 90, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Exotic Pet Consultation',         'consultation',   'Specialized consultation for reptiles, birds, and small mammals.',          110.00,150.00, 'USD', 45, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Boarding (Per Night)',             'boarding',       'Climate-controlled boarding with daily walks and feeding.',                  35.00, 65.00,  'USD', NULL, true, true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'Pet Grooming',                    'grooming',       'Full grooming service — bath, haircut, nail trim, ear cleaning.',            45.00, 120.00, 'USD', 90, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'Farm Call — Routine',              'consultation',   'On-farm visit for routine health checks, vaccinations, and herd assessment.',150.00,250.00, 'USD', 120,true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'Reproductive Ultrasound',          'reproduction',   'Pregnancy detection and fetal assessment for cattle, sheep, goats.',         75.00, 120.00, 'USD', 30, true,  true),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'Hoof Trimming & Treatment',        'other',          'Corrective hoof trimming and treatment for laminitis/foot rot.',             40.00, 80.00,  'USD', 20, true,  true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 44: HOSPITAL INVITES
-- ============================================================
INSERT INTO hospital_invites (id, hospital_id, email, first_name, last_name, phone, invite_token, hospital_role, department_id, status, invited_by, expires_at) VALUES
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'dr.new.intern@email.com',  'Alex',  'Rivera',  '+1-555-600-0001', 'inv_vetcare_central_001_' || md5(random()::text), 'intern',  'hd000000-0000-0000-0000-000000000001', 'pending',  'b0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '7 days'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'nurse.jen@email.com',      'Jennifer','Park',   '+1-555-600-0002', 'inv_vetcare_central_002_' || md5(random()::text), 'staff',   'hd000000-0000-0000-0000-000000000004', 'accepted', 'b0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '7 days'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'vet.locum@email.com',      'David',  'Walsh',   '+1-828-555-0301', 'inv_sunrise_rural_001_' || md5(random()::text),   'visiting','hd000000-0000-0000-0000-000000000001', 'pending',  'b0000000-0000-0000-0000-000000000002', NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 45: HOSPITAL DOCUMENTS
-- ============================================================
INSERT INTO hospital_documents (id, hospital_id, doc_type, file_name, file_url, expiry_date, status, reviewed_by, reviewed_at) VALUES
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'trade_license', 'vetcare_central_trade_license_2025.pdf', '/uploads/hospitals/docs/vetcare_trade_license.pdf', '2027-12-31', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'drug_license',  'vetcare_central_drug_license_2025.pdf',  '/uploads/hospitals/docs/vetcare_drug_license.pdf',  '2027-06-30', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'vet_council',   'vetcare_central_council_reg.pdf',        '/uploads/hospitals/docs/vetcare_council_reg.pdf',   '2027-03-15', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-01-15'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'trade_license', 'sunrise_rural_trade_license_2025.pdf',   '/uploads/hospitals/docs/sunrise_trade_license.pdf', '2027-10-31', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-03-10'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'drug_license',  'sunrise_rural_drug_license_2025.pdf',    '/uploads/hospitals/docs/sunrise_drug_license.pdf',  '2027-04-15', 'approved', 'a0000000-0000-0000-0000-000000000001', '2025-03-10'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'gst',           'sunrise_rural_gst_certificate.pdf',      '/uploads/hospitals/docs/sunrise_gst.pdf',           NULL,         'pending_review', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 46: STAFF POSITIONS
-- ============================================================
INSERT INTO staff_positions (id, hospital_id, user_id, position, department, is_active, hired_date, notes) VALUES
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'veterinarian',    'Surgery & Orthopedics',    true, '2020-01-15', 'Founding veterinarian and hospital owner.'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'veterinarian',    'Dermatology & Allergy',    true, '2021-06-01', 'Joined as dermatology specialist.'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'veterinarian',    'Emergency & Critical Care', true, '2022-03-15', 'Part-time emergency and exotic consultant.'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'veterinarian',    'Exotic & Avian Medicine',  true, '2023-09-01', 'Head of exotic animal department.'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'veterinarian',    'General Practice',         true, '2022-04-01', 'Medical director at Sunrise Rural.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 47: APPOINTMENT QUEUE
-- ============================================================
INSERT INTO appointment_queue (id, hospital_id, animal_id, owner_id, assigned_vet_id, queue_number, priority, triage_level, status, reason, triage_notes, triaged_by, checked_in_at, estimated_wait_minutes) VALUES
  ('aq000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   1, 'normal', 3, 'in_examination', 'Annual wellness exam for Duke (Standard Poodle)', 'Weight stable, no acute issues. Routine checkup.', 'b0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '25 minutes', 0),
  ('aq000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002',
   2, 'high', 2, 'in_triage', 'Copper (Beagle) ate chocolate — possible toxicity', 'Owner reports ~50g dark chocolate ingested 1hr ago. Weight 11.5kg. Calculating theobromine dose.', 'b0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '10 minutes', 15),
  ('aq000000-0000-0000-0000-000000000003', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   3, 'normal', 3, 'waiting', 'Monty (Ball Python) not eating for 3 weeks — wellness check', NULL, NULL, NOW() - INTERVAL '5 minutes', 30),
  ('aq000000-0000-0000-0000-000000000004', 'h0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', NULL,
   4, 'urgent', 2, 'waiting', 'Oscar (Dachshund) sudden hind leg weakness — possible IVDD', NULL, NULL, NOW() - INTERVAL '2 minutes', 20)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 48: WORKFLOW CASES
-- ============================================================
INSERT INTO workflow_cases (id, queue_entry_id, hospital_id, animal_id, owner_id, current_stage, assigned_vet_id, priority, chief_complaint, diagnosis, treatment_plan, status) VALUES
  ('wc000000-0000-0000-0000-000000000001', 'aq000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'examination',
   'b0000000-0000-0000-0000-000000000001', 'normal',
   'Annual wellness exam — Standard Poodle, 4 years old',
   'Healthy on physical exam. Mild tartar buildup on premolars. Joint palpation normal.',
   'Dental cleaning recommended within 3 months. Continue joint supplements. Update DHPP vaccine today.',
   'active'),
  ('wc000000-0000-0000-0000-000000000002', 'aq000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'treatment',
   'b0000000-0000-0000-0000-000000000002', 'high',
   'Chocolate toxicity — ~50g dark chocolate ingested by 11.5kg Beagle',
   'Theobromine dose estimated at 130mg/kg — toxic range. Mild tachycardia (HR 140).',
   'Induce emesis with apomorphine. Activated charcoal 2g/kg. IV fluids. Monitor ECG for 6 hours.',
   'active'),
  ('wc000000-0000-0000-0000-000000000003', NULL, 'h0000000-0000-0000-0000-000000000001',
   'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'discharge',
   'b0000000-0000-0000-0000-000000000001', 'normal',
   'Charlie (Lab) post-neuter recovery — day surgery',
   'Routine castration completed successfully. No complications.',
   'E-collar for 10 days. Restricted activity 14 days. Recheck incision day 10.',
   'completed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 49: WORKFLOW TRANSITIONS
-- ============================================================
INSERT INTO workflow_transitions (id, case_id, from_stage, to_stage, transitioned_by, staff_position, notes) VALUES
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000001', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Vitals normal. Transferred to Dr. Carter for wellness exam.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000002', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Priority elevated — chocolate toxicity. Immediate assessment.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000002', 'examination', 'treatment',   'b0000000-0000-0000-0000-000000000002', 'veterinarian', 'Emesis induced. Charcoal administered. Moving to treatment bay for IV and monitoring.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000003', 'triage',      'examination', 'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Pre-surgical assessment for neuter.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000003', 'examination', 'treatment',   'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Pre-op blood work normal. Proceeding to surgery.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000003', 'treatment',   'observation', 'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Surgery complete. Recovering from anesthesia in recovery ward.'),
  (uuid_generate_v4(), 'wc000000-0000-0000-0000-000000000003', 'observation', 'discharge',   'b0000000-0000-0000-0000-000000000001', 'veterinarian', 'Fully recovered. Discharged with post-op instructions and pain medication.')
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
   'Very shy cat — needs quiet room. Owner provided personal blanket from home.', 45.00)
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
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received — Buddy hip dysplasia consultation',       'consultation'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received — Max osteoarthritis assessment',          'consultation'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000002', 'credit',  85.00,  'Payment received — Daisy emergency farm call',              'consultation'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000002', 'debit',   50.00,  'Withdrawal to bank account',                                 'withdrawal'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000003', 'credit',  95.00,  'Payment received — Whiskers dermatology consultation',      'consultation'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000004', 'credit', 120.00,  'Payment received — Kiwi avian consultation',                'consultation'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000006', 'credit',  42.50,  'Refund — Doctor cancelled appointment (50% of $85)',        'refund'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000006', 'bonus',   12.50,  'Goodwill bonus — Doctor cancellation compensation',         'bonus'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000009', 'credit', 120.00,  'Added funds via credit card',                                'deposit'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000009', 'bonus',   25.00,  'Welcome bonus for new user',                                 'bonus'),
  (uuid_generate_v4(), 'w0000000-0000-0000-0000-000000000012', 'credit', 200.00,  'Added funds for marketplace purchase',                       'deposit')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 54: VET DATE OVERRIDES
-- ============================================================
INSERT INTO vet_date_overrides (id, veterinarian_id, override_date, override_type, start_time, end_time, slot_duration, reason, created_by) VALUES
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', '2026-03-14', 'unavailable',  NULL,    NULL,    NULL, 'Attending ACVS Conference in Chicago',   'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', '2026-03-15', 'unavailable',  NULL,    NULL,    NULL, 'Attending ACVS Conference in Chicago',   'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', '2026-02-28', 'custom_hours', '10:00', '14:00', 30,   'Half-day — annual vet license renewal',  'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000003', '2026-03-01', 'unavailable',  NULL,    NULL,    NULL, 'Personal day',                           'b0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', '2026-03-10', 'custom_hours', '09:00', '12:00', 45,   'Morning only — zoo consultation in PM',  'b0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 55: VET BLOCKED SLOTS
-- ============================================================
INSERT INTO vet_blocked_slots (id, veterinarian_id, block_date, start_time, end_time, reason, is_recurring, recurring_day) VALUES
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'monday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'tuesday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'wednesday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'thursday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', NULL,          '12:00', '13:00', 'Lunch break',                     true,  'friday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000001', '2026-02-20', '14:00', '15:30', 'Staff meeting',                   false, NULL),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'monday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'wednesday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000002', NULL,          '12:30', '13:30', 'Lunch break',                     true,  'friday'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', '2026-03-05', '15:00', '18:00', 'Research paper review deadline',  false, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 56: HOSPITAL HOLIDAYS
-- ============================================================
INSERT INTO hospital_holidays (id, hospital_id, holiday_date, name, holiday_type, is_full_day, start_time, end_time, created_by) VALUES
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', '2026-12-25', 'Christmas Day',       'general',           false, NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', '2026-01-01', 'New Year''s Day',      'general',           false, NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', '2026-07-04', 'Independence Day',    'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', '2026-11-26', 'Thanksgiving',        'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000001', '2026-03-20', 'Staff Training Day',  'hospital_specific', true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', '2026-12-25', 'Christmas Day',       'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', '2026-01-01', 'New Year''s Day',      'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', '2026-07-04', 'Independence Day',    'general',           true,  NULL, NULL, 'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'h0000000-0000-0000-0000-000000000002', '2026-02-16', 'Emergency Closure — Snowstorm', 'emergency_closure', true, NULL, NULL, 'b0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 57: MARKETPLACE BIDS
-- ============================================================
-- Bids on the livestock scale (auction listing from existing data)
INSERT INTO marketplace_bids (id, listing_id, bidder_id, amount, message, status, is_winning) VALUES
  (uuid_generate_v4(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000001', 650.00, 'Interested for our dairy farm. Can pick up in Austin.', 'active', false),
  (uuid_generate_v4(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000003', 750.00, 'Great condition. Would use for sheep weighing. Can pay via bank transfer.', 'active', false),
  (uuid_generate_v4(), (SELECT id FROM marketplace_listings WHERE title LIKE '%Digital Livestock Weight Scale%' LIMIT 1),
   'f0000000-0000-0000-0000-000000000002', 820.00, 'Willing to pay asking price. Need shipping to NC.', 'active', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 58: MARKETPLACE ORDERS
-- ============================================================
INSERT INTO marketplace_orders (id, listing_id, buyer_id, seller_id, quantity, unit_price, total_price, status, payment_status, shipping_address, tracking_number, notes) VALUES
  (uuid_generate_v4(),
   (SELECT id FROM marketplace_listings WHERE title LIKE '%Organic Aged Cheddar%' LIMIT 1),
   'c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001',
   3, 45.00, 135.00, 'shipped', 'paid',
   '{"name":"Sarah Kim","address":"890 Pine St","city":"San Diego","state":"CA","zip":"92101"}',
   'USPS-9400111899223344556677', 'Gift for friends who love artisan cheese.'),
  (uuid_generate_v4(),
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
  (uuid_generate_v4(), 'ff000000-0000-0000-0000-000000000001', 'medical_record', 'create', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter',
   NULL, '{"title":"Hip Dysplasia Diagnosis — Buddy","severity":"normal","status":"active"}', 'Initial diagnosis record created', '10.0.0.5'),
  (uuid_generate_v4(), 'ff000000-0000-0000-0000-000000000001', 'medical_record', 'update', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Dr. James Carter',
   '{"follow_up_date":null}', '{"follow_up_date":"2026-04-15"}', 'Added follow-up date after radiograph review', '10.0.0.5'),
  (uuid_generate_v4(), 'ff000000-0000-0000-0000-000000000002', 'medical_record', 'create', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Dr. Sarah Bennett',
   NULL, '{"title":"Atopic Dermatitis — Whiskers","severity":"high","status":"active"}', 'Diagnosis after skin scraping and culture', '10.0.0.6'),
  (uuid_generate_v4(), 'ff000000-0000-0000-0000-000000000005', 'medical_record', 'view', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'John Miller',
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
   'Bearded dragon Rex annual wellness check', 'Routine — no concerns'),
  ('bb000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000019',
   'h0000000-0000-0000-0000-000000000001', '2026-03-05', '09:00', '09:30', 'confirmed', 'in_person', 'normal',
   'Duke annual wellness exam', NULL),
  ('bb000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000022',
   'h0000000-0000-0000-0000-000000000001', '2026-03-08', '14:00', '14:30', 'pending', 'video_call', 'normal',
   'Bengal Shadow scratching ears — possible ear mites', 'Head shaking, dark ear discharge'),
  ('bb000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000015',
   'h0000000-0000-0000-0000-000000000001', '2026-03-12', '14:00', '14:45', 'pending', 'in_person', 'normal',
   'Rabbit Snowball dental check', 'Slightly reduced hay intake'),
  ('bb000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000027',
   NULL, '2026-03-15', '08:00', '09:00', 'confirmed', 'in_person', 'normal',
   'Pre-lambing check for Woolly (Merino ewe)', 'Pregnant — due mid-April')
ON CONFLICT (id) DO NOTHING;

-- Additional consultations for new pets
INSERT INTO consultations (id, user_id, veterinarian_id, animal_id, animal_type, symptom_description, status, priority, scheduled_at, started_at, completed_at, duration, diagnosis, prescription, follow_up_date, notes) VALUES
  ('cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-000000000014',
   'Cat - Persian', 'Excessive tearing and staining around eyes, sneezing',
   'completed', 'normal', '2026-01-20 10:00:00', '2026-01-20 10:05:00', '2026-01-20 10:35:00', 30,
   'Brachycephalic obstructive airway syndrome with secondary epiphora. Nasolacrimal duct partially blocked. Mild dental disease noted.',
   'Tobramycin ophthalmic drops 0.3% — 1 drop each eye twice daily for 10 days. Daily eye cleaning with sterile saline. Dental cleaning recommended.',
   '2026-04-20', 'Persian breed predisposition. Advised daily eye wiping routine. Dental under anesthesia needed within 3 months.'),
  ('cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000021',
   'Dog - Miniature Dachshund', 'Occasional yelping when jumping down from couch despite ramp availability',
   'completed', 'high', '2026-02-01 11:00:00', '2026-02-01 11:03:00', '2026-02-01 11:38:00', 35,
   'Mild IVDD — Stage 1. Cervical pain on palpation C3-C5. No neurological deficits. Radiographs show mild disc space narrowing at C4-C5.',
   'Gabapentin 50mg twice daily for 14 days. Strict cage rest for 4 weeks. Anti-inflammatory: Carprofen 12.5mg once daily for 7 days.',
   '2026-03-01', 'CRITICAL: No jumping, no stairs, no rough play. Carry dog up/down. Consider MRI if symptoms worsen. Weight management essential.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 61: ADDITIONAL VACCINATION RECORDS (new animals)
-- ============================================================
INSERT INTO vaccination_records (id, animal_id, vaccine_name, vaccine_type, date_administered, next_due_date, dosage, batch_number, manufacturer, administered_by, certificate_number, reaction_notes, is_valid) VALUES
  -- Charlie (Labrador)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'Rabies (3-year)',  'Core', '2025-06-10', '2028-06-10', '1 mL SC', 'RB-3Y-4421', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'DHPP (DA2PP)',     'Core', '2025-06-10', '2026-06-10', '1 mL SC', 'DH-5W-8812', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E002', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'Lyme Disease',    'Non-Core', '2025-06-10', '2026-06-10', '1 mL SC', 'LY-VX-1102', 'Zoetis', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-E003', NULL, true),
  -- Princess (Persian)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014', 'FVRCP',           'Core', '2025-11-20', '2026-11-20', '1 mL SC', 'FV-3C-2218', 'Zoetis',               'b0000000-0000-0000-0000-000000000004', 'VAX-2025-F001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014', 'Rabies (1-year)', 'Core', '2025-11-20', '2026-11-20', '1 mL SC', 'RB-1Y-9981', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000004', 'VAX-2025-F002', NULL, true),
  -- Duke (Poodle)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 'Rabies (3-year)',  'Core', '2024-09-22', '2027-09-22', '1 mL SC', 'RB-3Y-6654', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-G001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 'DHPP (DA2PP)',     'Core', '2025-09-22', '2026-09-22', '1 mL SC', 'DH-5W-7738', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-G002', NULL, true),
  -- Copper (Beagle)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 'Rabies (1-year)',  'Core', '2025-03-08', '2026-03-08', '1 mL SC', 'RB-1Y-5542', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-H001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 'DHPP (DA2PP)',     'Core', '2025-03-08', '2026-03-08', '1 mL SC', 'DH-5W-3390', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-H002', NULL, true),
  -- Oscar (Dachshund)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021', 'Rabies (3-year)',  'Core', '2025-12-01', '2028-12-01', '1 mL SC', 'RB-3Y-1178', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-I001', NULL, true),
  -- Shadow (Bengal)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000022', 'FVRCP',           'Core', '2025-07-14', '2026-07-14', '1 mL SC', 'FV-3C-5567', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-J001', NULL, true),
  -- Muffin (Ragdoll)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000023', 'FVRCP',           'Core', '2025-04-18', '2026-04-18', '1 mL SC', 'FV-3C-8891', 'Zoetis',               'b0000000-0000-0000-0000-000000000002', 'VAX-2025-K001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000023', 'Rabies (3-year)', 'Core', '2025-04-18', '2028-04-18', '1 mL SC', 'RB-3Y-2248', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000002', 'VAX-2025-K002', NULL, true),
  -- Scout (Border Collie)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000032', 'Rabies (3-year)',  'Core', '2024-08-05', '2027-08-05', '1 mL SC', 'RB-3Y-9914', 'Boehringer Ingelheim', 'b0000000-0000-0000-0000-000000000001', 'VAX-2024-L001', NULL, true),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000032', 'DHPP (DA2PP)',     'Core', '2025-08-05', '2026-08-05', '1 mL SC', 'DH-5W-4456', 'Zoetis',               'b0000000-0000-0000-0000-000000000001', 'VAX-2025-L002', NULL, true),
  -- Woolly (Merino Sheep)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000027', 'Clostridial 8-way','Core', '2025-09-01', '2026-09-01', '2 mL SC', 'CL-8W-7701', 'Merck', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-M001', NULL, true),
  -- Wilbur (Yorkshire Pig)
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000030', 'Erysipelas',      'Core', '2025-04-12', '2026-04-12', '2 mL IM', 'ER-PG-3301', 'Zoetis', 'b0000000-0000-0000-0000-000000000001', 'VAX-2025-N001', NULL, true);

-- ============================================================
-- STEP 62: ADDITIONAL WEIGHT HISTORY (new animals)
-- ============================================================
INSERT INTO weight_history (id, animal_id, weight, unit, notes, recorded_by, recorded_at) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 26.0, 'kg', 'Post-neuter weight',          'b0000000-0000-0000-0000-000000000001', '2025-06-10'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 28.5, 'kg', 'Annual checkup weight',       'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014',  3.5, 'kg', 'Spay recovery weight',        'b0000000-0000-0000-0000-000000000004', '2025-05-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014',  4.1, 'kg', 'Wellness visit weight',       'b0000000-0000-0000-0000-000000000004', '2026-01-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 26.2, 'kg', 'Year 3 checkup',              'b0000000-0000-0000-0000-000000000001', '2024-09-22'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 27.0, 'kg', 'Year 4 checkup',              'b0000000-0000-0000-0000-000000000001', '2025-09-22'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 10.8, 'kg', 'Puppy final weight',          'b0000000-0000-0000-0000-000000000001', '2025-03-08'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 11.5, 'kg', 'Slightly over ideal weight',  'b0000000-0000-0000-0000-000000000001', '2026-02-10'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021',  4.8, 'kg', 'Post-IVDD baseline',          'b0000000-0000-0000-0000-000000000001', '2025-12-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021',  5.2, 'kg', 'Gained weight during rest',   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000027', 58.0, 'kg', 'Pre-breeding weight',         'f0000000-0000-0000-0000-000000000003', '2025-11-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000027', 65.0, 'kg', 'Mid-pregnancy weight',        'f0000000-0000-0000-0000-000000000003', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000030', 155.0,'kg', 'Monthly weigh-in',            'f0000000-0000-0000-0000-000000000003', '2025-12-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000030', 180.0,'kg', 'Monthly weigh-in',            'f0000000-0000-0000-0000-000000000003', '2026-01-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000034', 650.0,'kg', 'Quarterly weigh-in',          'f0000000-0000-0000-0000-000000000001', '2025-10-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000034', 680.0,'kg', 'Quarterly weigh-in',          'f0000000-0000-0000-0000-000000000001', '2026-01-15');

-- ============================================================
-- STEP 63: ADDITIONAL ALLERGY RECORDS (new animals)
-- ============================================================
INSERT INTO allergy_records (id, animal_id, allergen, reaction, severity, identified_date, is_active, notes, reported_by) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 'Flea Saliva',   'Intense scratching, hot spots on lower back',     'moderate', '2025-04-15', true, 'Flea allergy dermatitis. Monthly flea prevention critical.',  'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021', 'Acepromazine',  'Paradoxical excitement, tremors',                  'severe',   '2025-01-10', true, 'Do NOT use acepromazine for sedation. Use alternative protocols.', 'b0000000-0000-0000-0000-000000000001'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000022', 'Pollen (Grass)','Watery eyes, sneezing, mild facial swelling',      'mild',     '2025-09-01', true, 'Seasonal — worse in spring/summer. Antihistamines PRN.',       'b0000000-0000-0000-0000-000000000002'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'Lamb Protein',  'Vomiting, diarrhea within 4 hours of ingestion',   'moderate', '2025-08-20', true, 'Confirmed via elimination diet. Feed chicken or fish based only.','b0000000-0000-0000-0000-000000000001');

-- ============================================================
-- STEP 64: ADDITIONAL WELLNESS SCORECARDS (new animals)
-- ============================================================
INSERT INTO wellness_scorecards (id, animal_id, owner_id, overall_score, nutrition_score, activity_score, vaccination_score, dental_score, weight_status, next_checkup, recommendations, risk_flags, assessed_by, assessed_at) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 90, 85, 95, 100, 90, 'normal', '2026-06-10',
   '["Maintain current exercise routine","Annual dental cleaning","Continue Lyme vaccine annually"]',
   '["Lamb protein allergy - strict avoidance"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 78, 80, 60, 95, 65, 'normal', '2026-04-20',
   '["Daily eye cleaning routine","Dental cleaning needed","Indoor-only — increase play/enrichment","Weight monitoring quarterly"]',
   '["Brachycephalic breed - airway monitoring","Dental disease - needs professional cleaning","Epiphora - chronic tear staining"]',
   'b0000000-0000-0000-0000-000000000004', '2026-01-20'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 88, 90, 85, 100, 75, 'normal', '2026-09-22',
   '["Monthly grooming essential","Dental cleaning within 3 months","Continue ear cleaning weekly","Joint supplements for breed predisposition"]',
   '["Mild ear canal inflammation - monitor","Flea allergy - monthly prevention critical"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-15'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 72, 65, 80, 92, 85, 'overweight', '2026-06-01',
   '["Reduce food by 15%","No table scraps","Increase walks to 45 min daily","Weight check monthly"]',
   '["Overweight - target 10.5kg","Beagle breed - high food drive, counter-surfing risk","Chocolate toxicity history"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-10'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 65, 75, 40, 95, 80, 'overweight', '2026-03-01',
   '["CRITICAL: No jumping - ramps everywhere","Cage rest 4 weeks","Weight loss program needed","Continue gabapentin as prescribed"]',
   '["IVDD Stage 1 - high risk breed","Acepromazine allergy - AVOID","Overweight - target 4.5kg","Cervical disc disease C4-C5"]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-01'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 95, 90, 100, 100, 95, 'normal', '2026-08-05',
   '["Continue high-energy working dog diet","Annual dental check","Paw pad check monthly during herding season"]',
   '[]',
   'b0000000-0000-0000-0000-000000000001', '2026-02-10');

-- ============================================================
-- STEP 65: ADDITIONAL WELLNESS REMINDERS (new animals)
-- ============================================================
INSERT INTO wellness_reminders (id, animal_id, owner_id, reminder_type, title, description, due_date, status, priority, recurrence) VALUES
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000003', 'vaccination', 'DHPP Booster Due — Charlie',       'Annual DHPP vaccination due. Schedule with clinic.',                  '2026-06-10', 'pending', 'high',   'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 'dental',      'Dental Cleaning — Princess',       'Professional dental cleaning under anesthesia recommended.',           '2026-04-01', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'Eye Follow-Up — Princess',         'Recheck epiphora and nasolacrimal duct status.',                       '2026-04-20', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'Annual Wellness — Monty (Python)', 'Annual fecal parasite test and weight check for ball python.',          '2026-05-01', 'pending', 'low',    'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000003', 'checkup',     'UVB Bulb Replacement — Rex',       'Replace UVB bulb every 6 months. Due for replacement.',                 '2026-03-15', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000004', 'dental',      'Dental Cleaning — Duke',           'Mild tartar noted at wellness exam. Schedule within 3 months.',         '2026-06-01', 'pending', 'medium', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'vaccination', 'Rabies Booster Due — Copper',      'Rabies vaccine due. Schedule ASAP.',                                    '2026-03-08', 'pending', 'urgent', 'yearly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000004', 'checkup',     'Weight Check — Copper',            'Monthly weight check — target 10.5kg. Currently 11.5kg.',              '2026-03-10', 'pending', 'high',   'monthly'),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000004', 'checkup',     'IVDD Follow-Up — Oscar',           'Recheck cervical pain and neurological status after rest period.',      '2026-03-01', 'pending', 'urgent', NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'checkup',     'Pre-Lambing Check — Woolly',       'Pregnancy ultrasound and condition scoring before lambing.',            '2026-03-15', 'pending', 'high',   NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000003', 'checkup',     'Pre-Farrowing Check — Charlotte',  'Berkshire sow due mid-April. Pre-farrowing health assessment.',         '2026-03-28', 'pending', 'high',   NULL),
  (uuid_generate_v4(), 'aa000000-0000-0000-0000-000000000032', 'f0000000-0000-0000-0000-000000000003', 'vaccination', 'DHPP Booster Due — Scout',         'Annual DHPP + Leptospirosis for Border Collie working dog.',            '2026-08-05', 'pending', 'medium', 'yearly');

-- ============================================================
-- STEP 66: ADDITIONAL NOTIFICATIONS (new users)
-- ============================================================
INSERT INTO notifications (id, user_id, type, title, message, is_read, channel) VALUES
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000003', 'booking',       'Booking Confirmed',          'Your appointment with Dr. Sharma for Monty on March 1 at 10:00 AM has been confirmed.', false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000003', 'consultation',  'Prescription Ready',         'Dr. Sharma has issued a prescription for Princess (Persian). View in medical records.',    true,  'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000003', 'reminder',      'Dental Cleaning Reminder',   'Princess needs a dental cleaning within 3 months. Schedule your appointment.',              false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000004', 'booking',       'Booking Confirmed',          'Your appointment with Dr. Carter for Duke on March 5 at 9:00 AM has been confirmed.',      false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000004', 'consultation',  'URGENT: IVDD Diagnosis',     'Oscar has been diagnosed with IVDD Stage 1. Follow strict rest protocol immediately.',     false, 'in_app'),
  (uuid_generate_v4(), 'c0000000-0000-0000-0000-000000000004', 'reminder',      'Weight Check Due — Copper',  'Monthly weight check for Copper is due. Target: 10.5kg. Currently: 11.5kg.',               false, 'in_app'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'booking',       'New Booking Request',        'Sarah Kim has requested an exotic pet consultation for Monty (Ball Python) on March 1.',    false, 'in_app'),
  (uuid_generate_v4(), 'b0000000-0000-0000-0000-000000000004', 'consultation',  'Referral Received',          'Dr. Carter referred Ball Python Monty for specialist evaluation. View referral details.',   false, 'in_app'),
  (uuid_generate_v4(), 'f0000000-0000-0000-0000-000000000003', 'reminder',      'Pre-Lambing Season',         'Woolly (Merino ewe) is due mid-April. Schedule pre-lambing veterinary check.',              false, 'in_app'),
  (uuid_generate_v4(), 'f0000000-0000-0000-0000-000000000003', 'reminder',      'Farrowing Preparation',      'Charlotte (Berkshire sow) expected to farrow April 8. Prepare farrowing pen.',              false, 'in_app');

-- ============================================================
-- STEP 67: ADDITIONAL FARM DATA (enterprise 3 records)
-- ============================================================
-- Health observations for enterprise 3
INSERT INTO health_observations (id, enterprise_id, animal_id, observer_id, observation_type, severity, title, description, body_temperature, heart_rate, respiratory_rate, symptoms, is_resolved, resolved_at) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'f0000000-0000-0000-0000-000000000003', 'pregnancy', 'normal', 'Woolly — Mid-Pregnancy Check',
   'Woolly at approximately 100 days gestation. Good body condition score 3.5/5. Eating well. Udder development starting.',
   39.0, 80, 20, ARRAY['normal_pregnancy'], true, NOW() - INTERVAL '5 days'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000003', 'general', 'low', 'Wilbur — Routine Observation',
   'Wilbur active and eating well. Good muscle development. Slight favoring of left hind leg after playing in mud — likely minor strain.',
   38.6, 90, 22, NULL, true, NOW() - INTERVAL '2 days');

-- Breeding records for enterprise 3
INSERT INTO breeding_records (id, enterprise_id, dam_id, sire_id, breeding_method, breeding_date, expected_due_date, status, technician_id, pregnancy_confirmed, pregnancy_check_date, notes) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'aa000000-0000-0000-0000-000000000028', 'natural', '2025-11-15', '2026-04-15', 'confirmed_pregnant',
   'b0000000-0000-0000-0000-000000000001', true, '2025-12-20', 'Natural mating with Suffolk ram Baxter. Confirmed pregnant by ultrasound — single or twin expected.'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000031', NULL, 'artificial_insemination', '2025-12-10', '2026-04-08', 'confirmed_pregnant',
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
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'income',  'wool_sales',     'Spring wool clip — 42 fleeces sold to Vermont Fiber Mill',  6300.00, 'USD', '2025-06-15', 'f0000000-0000-0000-0000-000000000003', '42 Merino fleeces @ $150 avg'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'income',  'lamb_sales',     'Market lambs — Stowe Farmers Market',                        4500.00, 'USD', '2025-10-20', 'f0000000-0000-0000-0000-000000000003', '15 lambs @ $300 avg'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'income',  'pork_sales',     'Heritage pork — direct to restaurants',                      3200.00, 'USD', '2026-01-30', 'f0000000-0000-0000-0000-000000000003', 'Artisan Berkshire pork to 4 restaurants'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'feed',           'Monthly feed purchase — sheep + pig ration',                 1800.00, 'USD', '2026-02-01', 'f0000000-0000-0000-0000-000000000003', 'Vermont Feed Supply February order'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'veterinary',     'Herd health check + pregnancy scanning',                      350.00, 'USD', '2025-12-20', 'f0000000-0000-0000-0000-000000000003', 'Dr. Carter farm visit — ultrasound scanning'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'expense', 'equipment',      'Electric fence charger replacement',                          420.00, 'USD', '2026-01-10', 'f0000000-0000-0000-0000-000000000003', 'Gallagher MBS800i — rotational grazing system');

-- Geofence zones for enterprise 3
INSERT INTO geofence_zones (id, enterprise_id, name, zone_type, center_lat, center_lng, radius_meters, polygon_coords, color, alert_on_entry, alert_on_exit, is_restricted, status, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'Farm Perimeter',       'boundary',    44.4660, -72.6875, 800,  '[]', '#22c55e', false, true,  false, 'active', 'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'Lambing Paddock',      'restricted',  44.4662, -72.6878, 100,  '[]', '#f59e0b', true,  true,  true,  'active', 'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'Rotational Pasture A', 'pasture',     44.4675, -72.6860, 250,  '[]', '#3b82f6', false, false, false, 'active', 'f0000000-0000-0000-0000-000000000003');

-- Geospatial events for enterprise 3
INSERT INTO geospatial_events (id, enterprise_id, animal_id, event_type, latitude, longitude, speed_kmh, metadata) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000032', 'location_update', 44.4676, -72.6862, 12.5, '{"source":"collar_gps","battery":91,"note":"Scout herding flock to north pasture"}'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000027', 'location_update', 44.4674, -72.6858, 1.2,  '{"source":"ear_tag_gps","battery":68,"note":"Woolly grazing in rotation A"}'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-000000000030', 'zone_exit',       44.4653, -72.6868, 3.5,  '{"zone":"Pig House","alert":"Wilbur escaped pig pen — recaptured within 10 min"}');

-- ============================================================
-- STEP 68: ADDITIONAL PAYMENTS (new consultations)
-- ============================================================
INSERT INTO payments (id, consultation_id, user_id, payer_id, payee_id, amount, currency, status, payment_method, transaction_id, invoice_number, gateway, tax_amount, paid_at) VALUES
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   110.00, 'USD', 'completed', 'credit_card', 'TXN-2026-C001', 'INV-2026-006', 'stripe', 9.90, '2026-01-20 10:40:00'),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
   85.00, 'USD', 'completed', 'wallet', 'TXN-2026-D001', 'INV-2026-007', 'wallet', 7.65, '2026-02-01 11:40:00');

-- ============================================================
-- STEP 69: ADDITIONAL REVIEWS (new consultations)
-- ============================================================
INSERT INTO reviews (id, consultation_id, reviewer_id, veterinarian_id, rating, comment, response_from_vet, is_public, status, helpful_count, report_count) VALUES
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004',
   5, 'Dr. Sharma was amazing with my Persian cat Princess! She immediately identified the eye issue and explained the brachycephalic syndrome link. Very gentle with cats. The eye drops are already helping after 1 week.',
   'Thank you Sarah! Princess is such a sweet patient. Keep up with the daily eye cleaning — it makes a huge difference for Persians.', true, 'active', 4, 0),
  (uuid_generate_v4(), 'cc000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001',
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
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000003', 'user',      'My ball python Monty hasn''t eaten in 3 weeks. His last shed was perfect. Husbandry is 88°F hot side, 78°F cool side, 60% humidity. What should I do?', NULL, '[]', 35),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000003', 'assistant', 'A 3-week fast for a ball python is common and usually not concerning — they can safely fast for 4-8 weeks. Since your husbandry looks good, here are things to try: 1) **Offer prey at night** — cover the tank, leave a thawed rat in a dark hide. 2) **Try a different prey type** — switch from rats to mice, or try African Soft Furs. 3) **Check for stress** — is the enclosure near high traffic? Ball pythons need seclusion. 4) **Breeding season** — adult males often fast Nov-March during breeding season. If he''s otherwise active and maintaining weight, this is likely normal seasonal behavior. See your vet if weight loss exceeds 10%.', 90.0, '["Ball Python Care Guide","Reptile Nutrition Manual"]', 145),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000003', 'user',      'He is a 2-year-old male. Could this be breeding season related?', NULL, '[]', 16),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000003', 'assistant', 'Yes! A 2-year-old male ball python is at prime breeding age. **Breeding season fasting** is extremely common from November through March. Males often refuse food for 2-4 months while seeking a mate. Signs this is breeding-season related: restless behavior, roaming the enclosure at night, refusing food but still drinking water, no weight loss. **Do not force-feed.** Continue offering prey every 10-14 days, and he should resume eating by April. Your vet Dr. Sharma can confirm he''s healthy at his upcoming appointment on March 1.', 94.0, '["Ball Python Breeding Biology","Reptile Veterinary Medicine"]', 132),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000004', 'user',      'Oscar was just diagnosed with Stage 1 IVDD. What exactly does cage rest mean and how long?', NULL, '[]', 20),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000004', 'assistant', '**Cage rest for IVDD** means strictly limiting Oscar''s movement to allow the disc to heal. Here''s your guide: 1) **Duration**: 4-6 weeks minimum. Dr. Carter prescribed 4 weeks. 2) **Space**: A crate just big enough to stand, turn, and lie down. ~24-30 inch crate for a Miniature Dachshund. 3) **NO**: jumping, stairs, rough play, running, being on furniture. 4) **YES**: Carry him outside for bathroom breaks (3-5 min only), gentle short leash walks after week 3 if improving. 5) **At home**: Ramps on ALL furniture permanently. Remove access to stairs. Non-slip flooring. 6) **Medications**: Continue gabapentin 50mg BID and carprofen as prescribed. The good news: Stage 1 IVDD (pain only, no neurological deficits) has an **85-90% recovery rate** with strict conservative management.', 96.0, '["ACVIM IVDD Treatment Guidelines","Dachshund Health Foundation"]', 178),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000005', 'user',      'This is our first lambing season with Merinos. What should I prepare?', NULL, '[]', 15),
  (uuid_generate_v4(), 'a8000000-0000-0000-0000-000000000005', 'assistant', 'Congratulations on your first Merino lambing season! Here''s your preparation checklist: **Supplies**: Iodine (7% for navel dipping), clean towels, lamb tube feeder, colostrum replacer (frozen ewe colostrum is best), heat lamps, digital thermometer, lubricant, lambing ropes. **Facility**: Clean and bed the lambing shed deeply with straw. Set up individual lambing jugs (5x5 ft pens) — you have a dedicated lambing shed which is perfect. Heat lamps at 18-20°C. **Timeline**: For Woolly (due ~April 15): Start monitoring 2 weeks before due date. Watch for udder development, vulvar swelling, behavioral changes (isolating from flock). **Nutrition**: Increase ewe nutrition in last 6 weeks — switch to higher energy feed. Provide selenium/vitamin E supplement. **Emergency contacts**: Have Dr. Carter''s emergency number ready. Most Merino lambings are natural, but dystocia rate is ~5-8%.', 88.0, '["Sheep Lambing Guide - Cornell Extension","Merino Breed Standards"]', 195);

-- ============================================================
-- STEP 71: ADDITIONAL SUSTAINABILITY DATA (enterprise 3)
-- ============================================================
INSERT INTO sustainability_metrics (id, enterprise_id, metric_type, metric_name, value, unit, period_start, period_end, category, scope, data_source, recorded_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'ghg_emissions',  'Enteric Methane — Sheep & Goats',     1200, 'kgCO2e', '2026-01-01', '2026-01-31', 'emissions',      'scope_1', 'IPCC Tier 1 Sheep Factor', 'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'water_usage',    'Total Farm Water Consumption',       42000, 'liters', '2026-01-01', '2026-01-31', 'water',           'scope_1', 'Well meter readings',      'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'energy',         'Electricity — Barn Heating & Lights', 1800, 'kWh',    '2026-01-01', '2026-01-31', 'energy',          'scope_2', 'Utility bill',             'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'waste',          'Manure Composted for Garden Sales',   8500, 'kg',     '2026-01-01', '2026-01-31', 'waste_management','scope_1', 'Farm records',             'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'biodiversity',   'Pasture Species Count',                18,  'species','2026-01-01', '2026-01-31', 'biodiversity',    'scope_1', 'Pasture survey',           'f0000000-0000-0000-0000-000000000003');

INSERT INTO sustainability_goals (id, enterprise_id, goal_name, description, metric_type, target_value, current_value, unit, baseline_value, baseline_date, target_date, status, progress_pct, created_by) VALUES
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'Carbon Neutral by 2028', 'Offset all Scope 1 and 2 emissions through composting, tree planting, and renewable energy.',
   'ghg_emissions', 0, 3000, 'kgCO2e/month', 3000, '2026-01-01', '2028-12-31', 'active', 0, 'f0000000-0000-0000-0000-000000000003'),
  (uuid_generate_v4(), 'e0000000-0000-0000-0000-000000000003', 'Rotational Grazing Optimization', 'Implement 8-paddock rotational grazing to improve pasture health and reduce overgrazing.',
   'biodiversity', 25, 18, 'species', 15, '2025-06-01', '2027-06-01', 'active', 30, 'f0000000-0000-0000-0000-000000000003');

-- (end of seed data)

