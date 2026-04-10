import { MetricStatus } from '@/types';

export const PIGLET_THRESHOLDS = {
  coreTemperature: {
    lowBelow: 34,
    optimalMin: 38.7,
    optimalMax: 39.8,
    criticalHighAtOrAbove: 40
  },
  ammonia: {
    idealAtOrBelow: 10,
    harmfulMin: 11,
    harmfulMax: 15,
    hazardousAtOrAbove: 25,
    waterPumpAutoOnAtOrAbove: 11
  },
  humidity: {
    optimalMin: 50,
    optimalMax: 70,
    criticalLowBelow: 40,
    criticalHighAbove: 80
  },
  ambientTemperature: {
    optimalMin: 22,
    optimalMax: 28,
    criticalLowBelow: 18,
    criticalHighAbove: 32
  }
} as const;

export const getCoreTemperatureStatus = (temp: number): MetricStatus => {
  if (temp < 34) {
    return {
      value: temp,
      level: 'critical',
      label: 'Low - Hypothermia Risk',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    };
  } else if (temp >= 38.7 && temp <= 39.8) {
    return {
      value: temp,
      level: 'normal',
      label: 'Optimal',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    };
  } else if (temp >= 40) {
    return {
      value: temp,
      level: 'critical',
      label: 'Critical - Fever',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    };
  } else {
    return {
      value: temp,
      level: 'warning',
      label: 'Monitor',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400'
    };
  }
};

export const getAmmoniaStatus = (ppm: number): MetricStatus => {
  if (ppm <= 10) {
    return {
      value: ppm,
      level: 'normal',
      label: 'Ideal',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    };
  } else if (ppm >= 11 && ppm <= 15) {
    return {
      value: ppm,
      level: 'warning',
      label: 'Harmful - Pump Auto ON',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    };
  } else if (ppm >= 25) {
    return {
      value: ppm,
      level: 'critical',
      label: 'Hazardous',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    };
  } else {
    return {
      value: ppm,
      level: 'warning',
      label: 'Elevated',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    };
  }
};

export const getHumidityStatus = (humidity: number): MetricStatus => {
  if (humidity >= 50 && humidity <= 70) {
    return {
      value: humidity,
      level: 'normal',
      label: 'Optimal',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    };
  } else if (humidity < 40 || humidity > 80) {
    return {
      value: humidity,
      level: 'critical',
      label: 'Out of Range',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    };
  } else {
    return {
      value: humidity,
      level: 'warning',
      label: 'Monitor',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400'
    };
  }
};

export const getAmbientTemperatureStatus = (temp: number): MetricStatus => {
  if (temp >= 22 && temp <= 28) {
    return {
      value: temp,
      level: 'normal',
      label: 'Optimal',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    };
  } else if (temp < 18 || temp > 32) {
    return {
      value: temp,
      level: 'critical',
      label: 'Out of Range',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    };
  } else {
    return {
      value: temp,
      level: 'warning',
      label: 'Monitor',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400'
    };
  }
};
