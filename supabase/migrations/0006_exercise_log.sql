-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Logging mínimo (ver docs/decisions.md, entrada "Logging mínimo: un botón
-- por día, no por ejercicio"): una fila por socio + rutina + día calendario.
-- No hay detalle por ejercicio a propósito.

CREATE TABLE IF NOT EXISTS public.exercise_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_profiles.id == auth.uid(), así las policies son directas.
  member_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- La rutina asignada al socio (la copia personal), no el template.
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  completado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Tocar el botón dos veces no puede generar dos filas del mismo día.
  CONSTRAINT exercise_log_member_routine_fecha_key UNIQUE (member_id, routine_id, fecha)
);

-- Lectura típica: "¿este socio ya registró hoy?".
CREATE INDEX IF NOT EXISTS exercise_log_member_fecha
  ON public.exercise_log (member_id, fecha DESC);

ALTER TABLE public.exercise_log ENABLE ROW LEVEL SECURITY;

-- SELECT: cada socio ve solo sus propios registros.
DROP POLICY IF EXISTS exercise_log_select_self ON public.exercise_log;
CREATE POLICY exercise_log_select_self
  ON public.exercise_log
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- INSERT: cada socio solo puede registrar a su propio nombre.
DROP POLICY IF EXISTS exercise_log_insert_self ON public.exercise_log;
CREATE POLICY exercise_log_insert_self
  ON public.exercise_log
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- DELETE: necesaria para el undo (segundo tap borra el registro del día).
-- No hay policy de UPDATE a propósito: una fila de log no se edita, se
-- crea o se borra.
DROP POLICY IF EXISTS exercise_log_delete_self ON public.exercise_log;
CREATE POLICY exercise_log_delete_self
  ON public.exercise_log
  FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());
