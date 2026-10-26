ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS password_hash text;
