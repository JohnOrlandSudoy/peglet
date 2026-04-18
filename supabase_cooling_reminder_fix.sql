-- 1. Create a table to track notification history
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type text NOT NULL,
    last_sent_at timestamptz DEFAULT now(),
    device_id text DEFAULT 'default'
);

-- 2. Enable the 'pg_net' extension to allow SQL to call Edge Functions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Create the function that will handle the logic
CREATE OR REPLACE FUNCTION handle_cooling_reminder()
RETURNS TRIGGER AS $$
DECLARE
    last_reminder_time timestamptz;
BEGIN
    -- Only proceed if the cooling fan is ON
    IF NEW.cooling_fan_status = true THEN
        
        -- Get the last time we sent a cooling reminder
        SELECT last_sent_at INTO last_reminder_time 
        FROM public.notification_logs 
        WHERE notification_type = 'cooling_reminder'
        ORDER BY last_sent_at DESC 
        LIMIT 1;

        -- If never sent OR more than 1 hour has passed (3600 seconds)
        IF last_reminder_time IS NULL OR (now() - last_reminder_time) > interval '1 hour' THEN
            
            -- Call the existing send_push_alert Edge Function
            -- Note: Replace the URL with your actual Supabase project URL if different
            PERFORM net.http_post(
                url := 'https://ipaonuxlvyjtfldjdpyb.supabase.co/functions/v1/send_push_alert',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'apikey', current_setting('request.headers')::jsonb->>'apikey' -- Uses the same key as the request
                ),
                body := jsonb_build_object(
                    'title', 'Cooling System Reminder',
                    'message', 'Ang cooling fan ay naka-ON pa rin nang mahigit isang oras na. Pakisuri ang kulungan.',
                    'level', 'info',
                    'category', 'cooling'
                )
            );

            -- Record this notification in the logs
            INSERT INTO public.notification_logs (notification_type, last_sent_at)
            VALUES ('cooling_reminder', now())
            ON CONFLICT DO NOTHING; -- Handle potential race conditions
            
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger that runs after every new reading
DROP TRIGGER IF EXISTS tr_cooling_reminder ON public.piglet_readings;
CREATE TRIGGER tr_cooling_reminder
AFTER INSERT ON public.piglet_readings
FOR EACH ROW
EXECUTE FUNCTION handle_cooling_reminder();
