-- ============================================
-- Smart Piglet Health Monitoring System
-- Database Setup SQL Script
-- ============================================
-- Copy and paste this entire script into your Supabase SQL Editor
-- to set up the database on a new account or project
-- ============================================

-- Drop existing table if you want to start fresh (CAUTION: This will delete all data)
-- DROP TABLE IF EXISTS piglet_readings CASCADE;

-- Create the piglet_readings table
CREATE TABLE IF NOT EXISTS piglet_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_temperature numeric NOT NULL,
  ambient_temperature numeric NOT NULL,
  humidity numeric NOT NULL,
  ammonia_ppm numeric NOT NULL,
  cooling_fan_status boolean DEFAULT false,
  water_pump_status boolean DEFAULT false,
  spare_relay_status boolean DEFAULT false,
  heater_fan_status boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE piglet_readings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- Policy for public read access (dashboard viewing)
DROP POLICY IF EXISTS "Allow public read access to piglet readings" ON piglet_readings;
CREATE POLICY "Allow public read access to piglet readings"
  ON piglet_readings
  FOR SELECT
  TO anon
  USING (true);

-- Policy for authenticated insert (IoT devices)
DROP POLICY IF EXISTS "Allow authenticated insert of piglet readings" ON piglet_readings;
CREATE POLICY "Allow authenticated insert of piglet readings"
  ON piglet_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for anon insert (IoT devices using anon key)
DROP POLICY IF EXISTS "Allow anon insert of piglet readings (IoT)" ON piglet_readings;
CREATE POLICY "Allow anon insert of piglet readings (IoT)"
  ON piglet_readings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy for service role full access
DROP POLICY IF EXISTS "Allow service role full access" ON piglet_readings;
CREATE POLICY "Allow service role full access"
  ON piglet_readings
  FOR ALL
  TO service_role
  USING (true);

-- ============================================
-- RELAY COMMANDS (for UI -> ESP32 control)
-- ============================================
CREATE TABLE IF NOT EXISTS relay_commands (
  device_id text PRIMARY KEY,
  spare_relay_on boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE relay_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read relay commands" ON relay_commands;
CREATE POLICY "Allow anon read relay commands"
  ON relay_commands
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon update relay commands" ON relay_commands;
CREATE POLICY "Allow anon update relay commands"
  ON relay_commands
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert relay commands" ON relay_commands;
CREATE POLICY "Allow anon insert relay commands"
  ON relay_commands
  FOR INSERT
  TO anon
  WITH CHECK (true);

INSERT INTO relay_commands (device_id, spare_relay_on)
VALUES ('default', false)
ON CONFLICT (device_id) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS piglet_readings_created_at_idx
  ON piglet_readings(created_at DESC);

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================
-- Insert various test scenarios to demonstrate the dashboard

-- Normal readings (optimal conditions)
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES
  (39.2, 25.0, 65.0, 8.5, false, false, false),
  (39.5, 26.0, 62.0, 9.0, false, false, false),
  (38.9, 25.5, 63.0, 7.5, false, false, false);

-- Warning scenario - High ammonia (water pump should activate)
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES
  (39.0, 26.0, 68.0, 12.0, false, true, false);

-- Critical scenario - High temperature
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES
  (40.5, 30.0, 70.0, 15.0, true, true, false);

-- Low temperature scenario
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES
  (33.5, 22.0, 60.0, 8.0, false, false, false);

-- Hazardous ammonia scenario
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES
  (39.0, 27.0, 65.0, 26.0, true, true, true);

-- ============================================
-- SIMULATING REALTIME DATA (Optional)
-- ============================================
-- This function can be used to continuously insert test data
-- Uncomment and run this if you want to simulate live data

/*
CREATE OR REPLACE FUNCTION insert_random_reading()
RETURNS void AS $$
BEGIN
  INSERT INTO piglet_readings (
    core_temperature,
    ambient_temperature,
    humidity,
    ammonia_ppm,
    cooling_fan_status,
    water_pump_status,
    spare_relay_status
  ) VALUES (
    38.5 + (random() * 2),  -- Temperature between 38.5-40.5°C
    24.0 + (random() * 6),   -- Ambient temp between 24-30°C
    55.0 + (random() * 20),  -- Humidity between 55-75%
    5.0 + (random() * 20),   -- Ammonia between 5-25 ppm
    random() < 0.3,          -- 30% chance fan is on
    random() < 0.4,          -- 40% chance pump is on
    random() < 0.2           -- 20% chance spare relay is on
  );
END;
$$ LANGUAGE plpgsql;

-- To insert a random reading, run:
-- SELECT insert_random_reading();

-- To insert readings every 5 seconds using pg_cron (if available):
-- SELECT cron.schedule('insert-piglet-reading', '*/5 * * * *', 'SELECT insert_random_reading()');
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify your setup

-- Check if table exists and has data
SELECT COUNT(*) as total_readings FROM piglet_readings;

-- View latest 10 readings
SELECT
  id,
  core_temperature,
  ambient_temperature,
  humidity,
  ammonia_ppm,
  cooling_fan_status,
  water_pump_status,
  spare_relay_status,
  created_at
FROM piglet_readings
ORDER BY created_at DESC
LIMIT 10;

-- Check for critical readings
SELECT
  core_temperature,
  ammonia_ppm,
  created_at
FROM piglet_readings
WHERE core_temperature >= 40 OR ammonia_ppm >= 25
ORDER BY created_at DESC;

-- ============================================
-- CLEANUP (Use with caution!)
-- ============================================
-- To delete all readings but keep the table structure:
-- DELETE FROM piglet_readings;

-- To completely remove the table:
-- DROP TABLE IF EXISTS piglet_readings CASCADE;

-- ============================================
-- END OF SETUP SCRIPT
-- ============================================
-- Your Smart Piglet Health Monitoring System is ready!
-- Don't forget to update your .env file with:
-- - VITE_SUPABASE_URL (from Supabase Project Settings)
-- - VITE_SUPABASE_ANON_KEY (from Supabase Project Settings > API)
-- - VITE_GEMINI_API_KEY (from Google AI Studio)
-- ============================================
