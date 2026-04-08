-- Migration 010: Network patient ID system
-- Adds id_prefix to hospital_networks and creates per-network sequence table

ALTER TABLE hospital_networks ADD COLUMN IF NOT EXISTS id_prefix VARCHAR(10);

CREATE TABLE IF NOT EXISTS network_patient_id_sequences (
  network_id  UUID        NOT NULL REFERENCES hospital_networks(id) ON DELETE CASCADE,
  species     VARCHAR(20) NOT NULL,
  year        INTEGER     NOT NULL,
  last_seq    INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (network_id, species, year)
);
