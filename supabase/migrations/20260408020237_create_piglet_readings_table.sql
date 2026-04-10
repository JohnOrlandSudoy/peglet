/*
  # Smart Piglet Health Monitoring System
  
  1. New Tables
    - `piglet_readings`
      - `id` (uuid, primary key)
      - `core_temperature` (numeric) - Core body temperature in Celsius
      - `ambient_temperature` (numeric) - Ambient air temperature in Celsius
      - `humidity` (numeric) - Humidity percentage
      - `ammonia_ppm` (numeric) - Ammonia level in parts per million
      - `cooling_fan_status` (boolean) - Cooling fan relay state
      - `water_pump_status` (boolean) - Water pump relay state (auto at 11ppm+)
      - `spare_relay_status` (boolean) - Spare relay state
      - `created_at` (timestamptz) - Reading timestamp
  
  2. Security
    - Enable RLS on `piglet_readings` table
    - Add policy for public read access (for dashboard viewing)
    - Add policy for authenticated insert (for IoT device)
*/

CREATE TABLE IF NOT EXISTS piglet_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  core_temperature numeric NOT NULL,
  ambient_temperature numeric NOT NULL,
  humidity numeric NOT NULL,
  ammonia_ppm numeric NOT NULL,
  cooling_fan_status boolean DEFAULT false,
  water_pump_status boolean DEFAULT false,
  spare_relay_status boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE piglet_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to piglet readings"
  ON piglet_readings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated insert of piglet readings"
  ON piglet_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon insert of piglet readings (IoT)"
  ON piglet_readings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow service role full access"
  ON piglet_readings
  FOR ALL
  TO service_role
  USING (true);

-- Create index for faster queries on timestamp
CREATE INDEX IF NOT EXISTS piglet_readings_created_at_idx 
  ON piglet_readings(created_at DESC);

-- Insert sample data for testing
INSERT INTO piglet_readings (core_temperature, ambient_temperature, humidity, ammonia_ppm, cooling_fan_status, water_pump_status, spare_relay_status)
VALUES 
  (39.2, 28.5, 65.0, 8.5, false, false, false),
  (39.5, 29.0, 68.0, 12.0, true, true, false),
  (38.8, 27.5, 62.0, 7.0, false, false, false);
