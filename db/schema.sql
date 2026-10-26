-- DESTRUCTIVE: run manually in Neon only after confirming that all data in these
-- six tables can be discarded. This drops existing users, attendance, QR codes,
-- links, and rate-limit state.
BEGIN;

DROP TABLE IF EXISTS public.asistencias;
DROP TABLE IF EXISTS public.qr_practicante;
DROP TABLE IF EXISTS public.qr_supervisor;
DROP TABLE IF EXISTS public.vinculaciones;
DROP TABLE IF EXISTS public.perfiles;
DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE public.perfiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE,
  codigo_6 char(6) NOT NULL UNIQUE CHECK (codigo_6 ~ '^[0-9]{6}$'),
  rol text NOT NULL CHECK (rol IN ('supervisor', 'practicante')),
  nombre text NOT NULL,
  apellido text NOT NULL,
  curso_carrera text NOT NULL,
  institucion text NOT NULL,
  created_at timestamptz DEFAULT now(),
  password_hash text,
  avatar_url text
);

CREATE TABLE public.vinculaciones (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  practicante_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'activo')),
  metodo text NOT NULL CHECK (metodo IN ('id', 'qr')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (supervisor_id, practicante_id)
);

CREATE TABLE public.qr_supervisor (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.qr_practicante (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practicante_id integer NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.asistencias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practicante_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  qr_token text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  timestamp timestamptz DEFAULT now(),
  sincronizado boolean DEFAULT true
);

CREATE TABLE public.rate_limits (
  clave text PRIMARY KEY,
  contador integer DEFAULT 0,
  ventana_inicio timestamptz DEFAULT now()
);

CREATE INDEX vinculaciones_practicante_estado_idx
  ON public.vinculaciones (practicante_id, estado);
CREATE INDEX vinculaciones_supervisor_estado_idx
  ON public.vinculaciones (supervisor_id, estado);
CREATE INDEX asistencias_practicante_timestamp_idx
  ON public.asistencias (practicante_id, timestamp DESC);
CREATE INDEX asistencias_supervisor_timestamp_idx
  ON public.asistencias (supervisor_id, timestamp DESC);
CREATE UNIQUE INDEX qr_supervisor_activo_por_supervisor_idx
  ON public.qr_supervisor (supervisor_id)
  WHERE activo = true;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_supervisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_practicante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY perfil_propio ON public.perfiles
  FOR ALL
  USING (auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

CREATE POLICY vinculaciones_propias ON public.vinculaciones
  FOR ALL
  USING (
    supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

CREATE POLICY qr_supervisor_propio ON public.qr_supervisor
  FOR ALL
  USING (
    supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

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

CREATE POLICY asistencias_propias ON public.asistencias
  FOR ALL
  USING (
    practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    practicante_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  );

-- rate_limits is API-internal; no public policy is created.
COMMIT;
