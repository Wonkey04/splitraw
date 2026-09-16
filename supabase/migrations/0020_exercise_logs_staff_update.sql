-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Feature 2 (drill-down de miembro): el trainer necesita poder corregir
-- sets/reps/peso de una sesión ya cargada. exercise_logs (plural, la tabla
-- con esa forma — ver docs/decisions.md "Dos tablas de log en paralelo")
-- tenía SELECT e INSERT para staff (0013) pero ninguna policy de UPDATE:
-- "una fila de log no se edita" era la regla de exercise_log (singular,
-- 0006), no de esta. Acá sí hace falta, porque el pedido es explícito.
--
-- Mismo scope que exercise_logs_select_staff: org completa para
-- GYM_OWNER/ADMIN, sucursal propia para TRAINER. Sin requisito de
-- logged_by — el trainer puede corregir una carga que el socio cargó él
-- mismo (algún día, cuando exista esa vía), no solo las suyas.

BEGIN;

DROP POLICY IF EXISTS exercise_logs_update_staff ON public.exercise_logs;
CREATE POLICY exercise_logs_update_staff
  ON public.exercise_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id
        AND m.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND m.branch_id = public.current_profile_branch()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id
        AND m.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND m.branch_id = public.current_profile_branch()
          )
        )
    )
  );

COMMIT;
