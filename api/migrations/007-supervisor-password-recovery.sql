ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.codigos_recuperacion_supervisor (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perfil_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.codigos_recuperacion_supervisor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS codigos_recuperacion_supervisor_propios
  ON public.codigos_recuperacion_supervisor;

CREATE POLICY codigos_recuperacion_supervisor_propios
  ON public.codigos_recuperacion_supervisor
  FOR ALL
  USING (
    perfil_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND rol = 'supervisor'
    )
  )
  WITH CHECK (
    perfil_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        AND rol = 'supervisor'
    )
  );
