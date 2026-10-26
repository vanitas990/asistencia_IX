-- DESTRUCTIVE: run manually in Neon only after confirming that all data in these
-- six tables can be discarded. This drops existing users, attendance, QR codes,
-- links, and rate-limit state.
BEGIN;

DROP TABLE IF EXISTS public.asistencias;
DROP TABLE IF EXISTS public.qr_alumno;
DROP TABLE IF EXISTS public.qr_supervisor;
DROP TABLE IF EXISTS public.vinculaciones;
DROP TABLE IF EXISTS public.perfiles;
DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE public.perfiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE,
  dni char(8) NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
  rol text NOT NULL CHECK (rol IN ('supervisor', 'alumno')),
  nombres text NOT NULL,
  apellidos text NOT NULL,
  facultad text,
  carrera text NOT NULL,
  ciclo text,
  created_at timestamptz DEFAULT now(),
  password_hash text,
  avatar_url text
);

CREATE TABLE public.vinculaciones (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  alumno_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'activo')),
  metodo text NOT NULL CHECK (metodo IN ('id', 'qr')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (supervisor_id, alumno_id)
);

CREATE TABLE public.qr_supervisor (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.qr_alumno (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id integer NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.asistencias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
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

CREATE INDEX vinculaciones_alumno_estado_idx
  ON public.vinculaciones (alumno_id, estado);
CREATE INDEX vinculaciones_supervisor_estado_idx
  ON public.vinculaciones (supervisor_id, estado);
CREATE INDEX asistencias_alumno_timestamp_idx
  ON public.asistencias (alumno_id, timestamp DESC);
CREATE INDEX asistencias_supervisor_timestamp_idx
  ON public.asistencias (supervisor_id, timestamp DESC);
CREATE UNIQUE INDEX qr_supervisor_activo_por_supervisor_idx
  ON public.qr_supervisor (supervisor_id)
  WHERE activo = true;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_supervisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_alumno ENABLE ROW LEVEL SECURITY;
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
    OR alumno_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR alumno_id IN (
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

CREATE POLICY asistencias_propias ON public.asistencias
  FOR ALL
  USING (
    alumno_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
    OR supervisor_id IN (
      SELECT id FROM public.perfiles
      WHERE auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    alumno_id IN (
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
