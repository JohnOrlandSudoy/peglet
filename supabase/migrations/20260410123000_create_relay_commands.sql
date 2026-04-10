CREATE TABLE IF NOT EXISTS public.relay_commands (
  device_id text PRIMARY KEY,
  spare_relay_on boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relay_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read relay commands" ON public.relay_commands;
CREATE POLICY "Allow anon read relay commands"
  ON public.relay_commands
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon update relay commands" ON public.relay_commands;
CREATE POLICY "Allow anon update relay commands"
  ON public.relay_commands
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert relay commands" ON public.relay_commands;
CREATE POLICY "Allow anon insert relay commands"
  ON public.relay_commands
  FOR INSERT
  TO anon
  WITH CHECK (true);

INSERT INTO public.relay_commands (device_id, spare_relay_on)
VALUES ('default', false)
ON CONFLICT (device_id) DO NOTHING;
