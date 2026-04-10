import { createClient } from '@supabase/supabase-js';
import { PigletReading } from '@/types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getLatestReading = async (): Promise<PigletReading | null> => {
  const { data, error } = await supabase
    .from('piglet_readings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest reading:', error);
    return null;
  }

  return data;
};

export const getRecentReadings = async (minutes: number = 60): Promise<PigletReading[]> => {
  const fromTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('piglet_readings')
    .select('*')
    .gte('created_at', fromTime)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching recent readings:', error);
    return [];
  }

  return data || [];
};

export const getReadingsBetween = async (params: {
  fromIso: string;
  toIso: string;
  limit?: number;
}): Promise<PigletReading[]> => {
  const { fromIso, toIso, limit = 1000 } = params;

  const { data, error } = await supabase
    .from('piglet_readings')
    .select('*')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching readings between dates:', error);
    return [];
  }

  return data || [];
};

export const subscribeToReadings = (
  callback: (reading: PigletReading, event: 'INSERT' | 'UPDATE') => void
) => {
  const channel = supabase
    .channel('piglet_readings_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'piglet_readings'
      },
      (payload) => {
        callback(payload.new as PigletReading, payload.eventType as 'INSERT');
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'piglet_readings'
      },
      (payload) => {
        callback(payload.new as PigletReading, payload.eventType as 'UPDATE');
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateRelayStatus = async (
  readingId: string,
  field: 'cooling_fan_status' | 'water_pump_status' | 'spare_relay_status',
  value: boolean
) => {
  const { error } = await supabase
    .from('piglet_readings')
    .update({ [field]: value })
    .eq('id', readingId);

  if (error) {
    console.error('Error updating relay status:', error);
    throw error;
  }
};

export const setSpareRelayCommand = async (value: boolean) => {
  const { error } = await supabase
    .from('relay_commands')
    .upsert({
      device_id: 'default',
      spare_relay_on: value,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error updating relay command:', error);
    throw error;
  }
};
