CREATE TABLE IF NOT EXISTS public.qr_alumno (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id integer NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_alumno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_alumno_propio ON public.qr_alumno;

CREATE POLICY qr_alumno_propio ON public.qr_alumno
  FOR ALL
  USING (
    alumno_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    alumno_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
