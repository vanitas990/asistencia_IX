ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS telefono_confirmado BOOLEAN NOT NULL DEFAULT false;
