ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS origen_datos TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS correo_institucional TEXT,
  ADD COLUMN IF NOT EXISTS correo_personal TEXT,
  ADD COLUMN IF NOT EXISTS correo_preferido TEXT NOT NULL DEFAULT 'institucional';

UPDATE public.perfiles
SET origen_datos = CASE WHEN rol = 'alumno' THEN 'api' ELSE 'manual' END
WHERE origen_datos IS NULL;

ALTER TABLE public.perfiles
  ALTER COLUMN origen_datos SET DEFAULT 'manual',
  ALTER COLUMN origen_datos SET NOT NULL;

ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_origen_datos_check
    CHECK (origen_datos IN ('api', 'manual')),
  ADD CONSTRAINT perfiles_correo_preferido_check
    CHECK (correo_preferido IN ('institucional', 'personal'));
