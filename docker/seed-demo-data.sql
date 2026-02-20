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

BEGIN;

-- ============================================================
-- STEP 0: CLEAN ALL TRANSACTIONAL DATA
-- ============================================================
-- CASCADE from root tables cleans all dependent tables.
-- Using separate statements to handle any missing tables gracefully.

TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE enterprises CASCADE;
TRUNCATE TABLE system_settings CASCADE;

-- ============================================================
-- STEP 1: USERS (4 roles, 8 users total)
-- ============================================================
-- Admin@123
INSERT INTO users (id, email, first_name, last_name, role, phone, password_hash, is_active, unique_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@vetcare.com',       'System',    'Administrator', 'admin',        '+1-555-100-0001', '$2a$10$00NZp4Yf7FUXO.8of0GD3OVBm/qx16ICcEJHInelAUzid1qY5LPDq', true, 'USR-ADM-001'),
  -- Veterinarians (password: Doctor@123)
  ('b0000000-0000-0000-0000-000000000001', 'dr.james.carter@vetcare.com',  'James',   'Carter',   'veterinarian', '+1-555-200-0001', '$2a$10$9aFDD5AIKpoIa1vKbSPcF.deHblZ5OOlPllX3dOvxsz8TJFDb.Ds6', true, 'USR-VET-001'),
  ('b0000000-0000-0000-0000-000000000002', 'dr.sarah.bennett@vetcare.com', 'Sarah',   'Bennett',  'veterinarian', '+1-555-200-0002', '$2a$10$9aFDD5AIKpoIa1vKbSPcF.deHblZ5OOlPllX3dOvxsz8TJFDb.Ds6', true, 'USR-VET-002'),
  ('b0000000-0000-0000-0000-000000000003', 'dr.michael.reyes@vetcare.com', 'Michael',  'Reyes',   'veterinarian', '+1-555-200-0003', '$2a$10$9aFDD5AIKpoIa1vKbSPcF.deHblZ5OOlPllX3dOvxsz8TJFDb.Ds6', true, 'USR-VET-003'),
  -- Pet Owners (password: Owner@123)
  ('c0000000-0000-0000-0000-000000000001', 'emily.davis@email.com',    'Emily',     'Davis',    'pet_owner',    '+1-555-300-0001', '$2a$10$v5rq0xPVzJ7zM1B8IEB3hOFzFBQg3V6WCMhn3bmi.5lU1IVpSgLaq', true, 'USR-PET-001'),
  ('c0000000-0000-0000-0000-000000000002', 'robert.chen@email.com',   'Robert',    'Chen',     'pet_owner',    '+1-555-300-0002', '$2a$10$v5rq0xPVzJ7zM1B8IEB3hOFzFBQg3V6WCMhn3bmi.5lU1IVpSgLaq', true, 'USR-PET-002'),
  -- Farmers (password: Farmer@123)
  ('f0000000-0000-0000-0000-000000000001', 'john.miller@greenpastures.com','John',   'Miller',   'farmer',       '+1-555-400-0001', '$2a$10$LKi/uyJ8wxy.CAhQc8/6l.AIwssM5NS6cIOS8ji7RICs9qPzWGJCq', true, 'USR-FRM-001'),
  ('f0000000-0000-0000-0000-000000000002', 'maria.garcia@sunrisefarm.com','Maria',   'Garcia',   'farmer',       '+1-555-400-0002', '$2a$10$LKi/uyJ8wxy.CAhQc8/6l.AIwssM5NS6cIOS8ji7RICs9qPzWGJCq', true, 'USR-FRM-002');

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
   120.00, 'USD', true, true, true, ARRAY['English','Spanish','Portuguese'], 4.93, 15, 52);

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
  ('aa000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000002', 'Bella',      'Goat',  'Saanen',            '2022-05-15', 'female',  65.0,'White',       'MCHP-GT-5001', false, 'Dairy goat. Milking 4L/day. Due for deworming.',             true, 'ANI-GOT-001');

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
   'f0000000-0000-0000-0000-000000000002', true);

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
  ('10000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000002', 'Processing Kitchen',     'warehouse',      0,  0, 600,  'sqft', 'USDA-inspected cheese and egg processing facility.', true);

-- ============================================================
-- STEP 5d: ANIMAL GROUPS
-- ============================================================
INSERT INTO animal_groups (id, enterprise_id, name, group_type, species, breed, purpose, target_count, current_count, description, color_code, is_active) VALUES
  ('ab000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Holstein Milking Herd',   'herd',  'Cattle', 'Holstein Friesian', 'dairy',     50, 42, 'Active milking herd of Holstein cows.',                '#3b82f6', true),
  ('ab000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Jersey Milking Herd',     'herd',  'Cattle', 'Jersey',            'dairy',     20, 15, 'Jersey cows for premium butterfat production.',        '#f59e0b', true),
  ('ab000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Young Calves Nursery',    'nursery','Cattle', NULL,                'breeding',  15,  8, 'Calves under 6 months in nursery care.',               '#10b981', true),
  ('ab000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'RIR Layer Flock',         'flock', 'Poultry','Rhode Island Red',  'layer',    200,150, 'Free-range layer hens for egg production.',            '#ef4444', true),
  ('ab000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'Saanen Dairy Does',       'herd',  'Goat',  'Saanen',            'dairy',     30, 12, 'Saanen dairy goats for milk and cheese production.',   '#8b5cf6', true);

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
   'Follow-up on Buddy hip dysplasia', NULL, 'Owner rescheduled due to travel');

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
   NULL, NULL, NULL, 'Brachycephalic airway assessment. May need soft palate evaluation.');

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
   'ended', '2026-01-22 14:04:00', '2026-01-22 14:42:00', 2280, 'high');

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
   '2026-08-01', true);

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
   false, NULL, ARRAY['bovine','production','emergency'], 'b0000000-0000-0000-0000-000000000001');

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
  (uuid_generate_v4(), 'payment.currency',                'USD',            'payment',       'Default platform currency'),
  (uuid_generate_v4(), 'payment.taxRate',                 '9',              'payment',       'Default tax percentage applied to consultation fees'),
  (uuid_generate_v4(), 'notification.emailEnabled',       'true',           'notification',  'Enable email notifications'),
  (uuid_generate_v4(), 'video.maxParticipants',           '2',              'video',         'Maximum participants per video session'),
  (uuid_generate_v4(), 'security.maxLoginAttempts',       '5',              'security',      'Maximum login attempts before temporary lockout'),
  (uuid_generate_v4(), 'security.lockoutDurationMinutes', '15',             'security',      'Lockout duration after max failed login attempts');

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
   'b0000000-0000-0000-0000-000000000003', 180.00, '8 of 12 does treated so far. Remaining 4 have low FAMACHA scores — skipping.');

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
  ('1f000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'Goat Dairy Ration',     'grain',   'kg', 350,  100,  0.55, 'Southern Feeds',      'GD-2026-0201', '2026-06-15', 'Goat Feed Shed',     true);

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
  ('1a000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'Health Observation Critical', 'health_threshold', '{"severity": "high"}',   'critical', true, 'f0000000-0000-0000-0000-000000000002');

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
  ('a5000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', 'temperature', 'Hen House Temp Sensor',    'SN-TMP-002', 'FarmTech', '°C', 10, 35,  300, 'active', 63.0, NOW() - INTERVAL '5 minutes', 'v2.1.4', '{"zone":"nesting_area"}');

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
   '["Free Range","NCDA Certified"]', 'Sunrise Farm Cold Storage', 'quality_check');

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
   'f0000000-0000-0000-0000-000000000001');

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
   'Buddy Hip Dysplasia Questions', 'animal', 'active', 2, NOW() - INTERVAL '1 day');

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

COMMIT;
