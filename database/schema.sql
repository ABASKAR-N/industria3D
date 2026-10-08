-- ═══════════════════════════════════════════════════════
-- INDUSTRIA 3D — PostgreSQL Schema + Seed Data
-- Run: psql -U industria -d industria_db -f schema.sql
-- ═══════════════════════════════════════════════════════

-- Create DB (run as superuser first if needed):
-- CREATE USER industria WITH PASSWORD 'industria123';
-- CREATE DATABASE industria_db OWNER industria;
-- GRANT ALL PRIVILEGES ON DATABASE industria_db TO industria;

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS components (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    type        VARCHAR(100) NOT NULL,
    health_score FLOAT DEFAULT 100.0,
    status      VARCHAR(50) DEFAULT 'operational',
    model_path  VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
    id           SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    timestamp    TIMESTAMPTZ DEFAULT NOW(),
    health_score FLOAT NOT NULL,
    image_path   VARCHAR(255),
    model_path   VARCHAR(255),
    is_demo      BOOLEAN DEFAULT FALSE,
    notes        TEXT
);

CREATE TABLE IF NOT EXISTS defects (
    id            SERIAL PRIMARY KEY,
    inspection_id INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    type          VARCHAR(100) NOT NULL,
    confidence    FLOAT NOT NULL,
    severity      VARCHAR(50) NOT NULL,
    x             FLOAT,
    y             FLOAT,
    z             FLOAT,
    defect_size   FLOAT,
    description   TEXT,
    is_demo       BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS predictions (
    id            SERIAL PRIMARY KEY,
    component_id  INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    forecast_date TIMESTAMPTZ NOT NULL,
    health_score  FLOAT NOT NULL,
    risk_score    FLOAT NOT NULL,
    recommendation TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inspections_component ON inspections(component_id);
CREATE INDEX IF NOT EXISTS idx_inspections_timestamp ON inspections(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_defects_inspection ON defects(inspection_id);
CREATE INDEX IF NOT EXISTS idx_predictions_component ON predictions(component_id);

-- ─── Demo Seed Data ───────────────────────────────────────────────────────────
-- NOTE: All data below is DEMO data for hackathon demonstration purposes.

INSERT INTO components (name, type, health_score, status, model_path) VALUES
  ('PUMP-001', 'Centrifugal Pump',    72.0, 'warning',     '/3d_models/pump.glb'),
  ('COMP-002', 'Air Compressor',      85.5, 'operational',  '/3d_models/compressor.glb'),
  ('VALVE-003','Pressure Relief Valve',45.0,'critical',     NULL),
  ('MOTOR-004','Electric Motor',      91.2, 'operational',  NULL)
ON CONFLICT (name) DO NOTHING;

-- PUMP-001 historical inspections (14-day window, clearly labelled demo)
DO $$
DECLARE
  comp_id INTEGER;
  insp_id INTEGER;
BEGIN
  SELECT id INTO comp_id FROM components WHERE name = 'PUMP-001';

  -- Day -14
  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '14 days', 95.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES (insp_id, 'scratch', 0.71, 'low', 0.3, 0.5, 1.0, 3.2, '[DEMO] Minor surface scratch', TRUE);

  -- Day -10
  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '10 days', 88.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES
      (insp_id, 'scratch',   0.75, 'low',    0.3,  0.5,  1.0, 3.5, '[DEMO] Surface scratch — growing', TRUE),
      (insp_id, 'corrosion', 0.68, 'medium', -0.5, 0.2,  0.8, 5.1, '[DEMO] Early corrosion detected', TRUE);

  -- Day -6
  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '6 days', 80.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES
      (insp_id, 'scratch',   0.78, 'low',    0.3,  0.5,  1.0, 4.0, '[DEMO] Surface scratch — progressing', TRUE),
      (insp_id, 'corrosion', 0.82, 'medium', -0.5, 0.2,  0.8, 6.8, '[DEMO] Corrosion spreading', TRUE),
      (insp_id, 'crack',     0.65, 'high',   0.1, -0.3,  1.2, 2.1, '[DEMO] Small crack initiated', TRUE);

  -- Day -2 (most recent)
  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '2 days', 72.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES
      (insp_id, 'scratch',        0.81, 'medium',  0.3,  0.5,  1.0, 5.2, '[DEMO] Scratch deepening', TRUE),
      (insp_id, 'corrosion',      0.89, 'high',   -0.5,  0.2,  0.8, 8.4, '[DEMO] Significant corrosion', TRUE),
      (insp_id, 'crack',          0.94, 'high',    0.1, -0.3,  1.2, 4.7, '[DEMO] Crack propagating — HIGH RISK', TRUE),
      (insp_id, 'surface_damage', 0.72, 'medium', -0.2,  0.8,  0.5, 6.0, '[DEMO] Surface damage from vibration', TRUE);

END $$;

-- COMP-002 seed
DO $$
DECLARE
  comp_id INTEGER;
  insp_id INTEGER;
BEGIN
  SELECT id INTO comp_id FROM components WHERE name = 'COMP-002';

  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '5 days', 87.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES (insp_id, 'scratch', 0.68, 'low', 0.6, -0.4, 0.9, 2.8, '[DEMO] Minor surface scratch', TRUE);

  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '1 day', 85.5, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES (insp_id, 'scratch', 0.72, 'low', 0.6, -0.4, 0.9, 3.1, '[DEMO] Scratch slightly larger', TRUE);
END $$;

-- VALVE-003 seed (critical)
DO $$
DECLARE
  comp_id INTEGER;
  insp_id INTEGER;
BEGIN
  SELECT id INTO comp_id FROM components WHERE name = 'VALVE-003';

  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '7 days', 65.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES
      (insp_id, 'crack',     0.91, 'high',   0.0, 0.0, 1.0, 7.2, '[DEMO] Critical structural crack', TRUE),
      (insp_id, 'corrosion', 0.85, 'high',   0.4, 0.3, 0.8, 9.5, '[DEMO] Severe corrosion', TRUE);

  INSERT INTO inspections (component_id, timestamp, health_score, image_path, is_demo, notes)
    VALUES (comp_id, NOW() - INTERVAL '1 day', 45.0, NULL, TRUE, 'Demo inspection — automated seed')
    RETURNING id INTO insp_id;
  INSERT INTO defects (inspection_id, type, confidence, severity, x, y, z, defect_size, description, is_demo)
    VALUES
      (insp_id, 'crack',          0.96, 'high',   0.0,  0.0,  1.0, 11.3, '[DEMO] Crack critical — immediate action', TRUE),
      (insp_id, 'corrosion',      0.91, 'high',   0.4,  0.3,  0.8, 12.1, '[DEMO] Severe corrosion spreading', TRUE),
      (insp_id, 'surface_damage', 0.88, 'medium', -0.3, -0.5,  0.6, 8.7, '[DEMO] Extensive surface damage', TRUE);
END $$;

-- Update components health scores from latest inspection
UPDATE components c SET health_score = (
  SELECT i.health_score FROM inspections i
  WHERE i.component_id = c.id
  ORDER BY i.timestamp DESC LIMIT 1
) WHERE EXISTS (SELECT 1 FROM inspections WHERE component_id = c.id);
