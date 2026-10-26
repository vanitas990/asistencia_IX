BEGIN;

ALTER TABLE public.qr_supervisor
  DROP CONSTRAINT IF EXISTS qr_supervisor_supervisor_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS qr_supervisor_activo_por_supervisor_idx
  ON public.qr_supervisor (supervisor_id)
  WHERE activo = true;

COMMIT;
