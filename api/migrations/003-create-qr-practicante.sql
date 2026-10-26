CREATE TABLE IF NOT EXISTS public.qr_practicante (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practicante_id integer NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_practicante ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qr_practicante_propio ON public.qr_practicante;

CREATE POLICY qr_practicante_propio ON public.qr_practicante
  FOR ALL
  USING (
    practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );
