export interface PigletReading {
  id: string;
  core_temperature: number;
  ambient_temperature: number;
  humidity: number;
  ammonia_ppm: number;
  cooling_fan_status: boolean;
  water_pump_status: boolean;
  spare_relay_status: boolean;
  heater_fan_status?: boolean;
  created_at: string;
}

export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface MetricStatus {
  value: number;
  level: AlertLevel;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}
