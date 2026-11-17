-- Non-destructive bootstrap for the seven tables used by the API.
-- Existing tables and their data are preserved. This is a schema snapshot,
-- not a migration for changing already-created columns.
BEGIN;

CREATE TABLE IF NOT EXISTS public.perfiles (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE,
  rol text NOT NULL CHECK (rol IN ('supervisor', 'alumno')),
  nombre text NOT NULL,
  carrera text NOT NULL,
  created_at timestamptz,
  password_hash text,
  avatar_url text,
  dni varchar NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
  facultad text,
  correo_personal varchar,
  telefono varchar,
  correo_institucional varchar,
  correo_preferido varchar,
  origen_datos varchar,
  requiere_cambio_password boolean,
  telefono_confirmado boolean
);

CREATE TABLE IF NOT EXISTS public.codigos_recuperacion_supervisor (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perfil_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vinculaciones (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  alumno_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estado text NOT NULL CHECK (estado IN ('pendiente', 'activo')),
  metodo text NOT NULL CHECK (metodo IN ('id', 'qr')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (supervisor_id, alumno_id)
);

CREATE TABLE IF NOT EXISTS public.qr_supervisor (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.qr_alumno (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id integer NOT NULL UNIQUE REFERENCES public.perfiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.asistencias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alumno_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  supervisor_id integer NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  qr_token text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida')),
  timestamp timestamptz DEFAULT now(),
  sincronizado boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  clave text PRIMARY KEY,
  contador integer DEFAULT 0,
  ventana_inicio timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vinculaciones_alumno_estado_idx
  ON public.vinculaciones (alumno_id, estado);
CREATE INDEX IF NOT EXISTS vinculaciones_supervisor_estado_idx
  ON public.vinculaciones (supervisor_id, estado);
CREATE INDEX IF NOT EXISTS asistencias_alumno_timestamp_idx
  ON public.asistencias (alumno_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS asistencias_supervisor_timestamp_idx
  ON public.asistencias (supervisor_id, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS qr_supervisor_activo_por_supervisor_idx
  ON public.qr_supervisor (supervisor_id)
  WHERE activo = true;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos_recuperacion_supervisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_supervisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_alumno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfil_propio ON public.perfiles;
CREATE POLICY perfil_propio ON public.perfiles
  FOR ALL
  USING (auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (auth_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

DROP POLICY IF EXISTS codigos_recuperacion_supervisor_propios ON public.codigos_recuperacion_supervisor;
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

DROP POLICY IF EXISTS vinculaciones_propias ON public.vinculaciones;
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

DROP POLICY IF EXISTS qr_supervisor_propio ON public.qr_supervisor;
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

DROP POLICY IF EXISTS asistencias_propias ON public.asistencias;
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
