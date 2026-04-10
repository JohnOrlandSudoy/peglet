ALTER TABLE piglet_readings
ADD COLUMN IF NOT EXISTS heater_fan_status boolean DEFAULT false;
