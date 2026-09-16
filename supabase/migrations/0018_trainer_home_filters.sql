-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Feature 1 (home del trainer): las tres tarjetas de estado necesitan que el
-- trainer pueda (a) contar y filtrar miembros sin rutina asignada, y (b)
-- filtrar por "vencen esta semana", que hoy solo existe como bucket
-- calculado en el cliente (planStatusOf en MembersSection.tsx), no como
-- filtro de servidor. Ambos se agregan a list_org_members/list_branch_members
-- (0009/0010, extendidas en 0017) siguiendo el mismo patrón que p_status.

BEGIN;

DROP FUNCTION IF EXISTS public.list_org_members(text, integer, integer, text);
DROP FUNCTION IF EXISTS public.list_branch_members(text, integer, integer, text);

DO $$
DECLARE
  v_name_expr text;
  v_common    text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
      AND column_name = 'surname'
  ) THEN
    v_name_expr := $x$btrim(coalesce(up.name, '') || ' ' || coalesce(up.surname, ''))$x$;
  ELSE
    v_name_expr := $x$btrim(coalesce(up.name, ''))$x$;
  END IF;

  -- p_status suma 'soon': vence dentro de los proximos 7 dias y todavia no
  -- vencio. Es el mismo bucket "por vencer" que ya calcula planStatusOf en
  -- el cliente (DAYS_TO_WARN = 7) — se expone como filtro de servidor porque
  -- "Vencimientos esta semana" del home necesita poder linkear a la lista ya
  -- filtrada, no solo mostrar un numero.
  --
  -- p_has_routine (nuevo): true = tiene una rutina asignada (current_routine_id
  -- no nulo), false = no tiene ninguna. NULL = sin filtro. Reemplaza tener que
  -- traer la pagina completa para contar "miembros sin rutina" a mano.
  v_common := $x$
  ),
  filtered_status AS (
    SELECT *
    FROM scoped
    WHERE (p_search IS NULL OR btrim(p_search) = ''
           OR profile_name ILIKE '%' || btrim(p_search) || '%'
           OR email ILIKE '%' || btrim(p_search) || '%')
      AND (
        p_status IS NULL OR btrim(p_status) = ''
        OR (p_status = 'expired'
            AND activation_expires_at IS NOT NULL
            AND activation_expires_at < now())
        OR (p_status = 'active'
            AND activation_expires_at IS NOT NULL
            AND activation_expires_at >= now())
        OR (p_status = 'soon'
            AND activation_expires_at IS NOT NULL
            AND activation_expires_at >= now()
            AND activation_expires_at < now() + interval '7 days')
      )
  ),
  filtered AS (
    SELECT f.*, r.routine_template_id AS current_routine_id_probe
    FROM filtered_status f
    LEFT JOIN LATERAL (
      SELECT ro.routine_template_id FROM routines ro
      WHERE ro.member_id = f.id
      ORDER BY ro.assigned_at DESC NULLS LAST, ro.created_at DESC LIMIT 1
    ) r ON true
    WHERE p_has_routine IS NULL
       OR (p_has_routine = true AND r.routine_template_id IS NOT NULL)
       OR (p_has_routine = false AND r.routine_template_id IS NULL)
  )$x$;

  EXECUTE format($f$
    CREATE FUNCTION public.list_org_members(
      p_search text DEFAULT NULL, p_limit integer DEFAULT 25,
      p_offset integer DEFAULT 0, p_status text DEFAULT NULL,
      p_has_routine boolean DEFAULT NULL
    )
    RETURNS TABLE(member_id uuid, email text, display_name text, branch_name text,
                  activation_expires_at timestamp, current_routine_id uuid,
                  current_routine_name text, assigned_at timestamptz, total_count bigint)
    LANGUAGE sql STABLE AS $body$
      WITH scoped AS (
        SELECT m.id, m.email, m.activation_expires_at, b.name AS branch_name,
               %s AS profile_name
        FROM members m
        LEFT JOIN user_profiles up ON up.id = m.user_id
        LEFT JOIN branches b ON b.id = m.branch_id
        WHERE m.organization_id = public.current_profile_org()
      %s
      SELECT f.id, f.email, nullif(f.profile_name, ''), f.branch_name,
             f.activation_expires_at, r.routine_template_id, rt.name, r.assigned_at,
             count(*) OVER () AS total_count
      FROM filtered f
      LEFT JOIN LATERAL (
        SELECT ro.routine_template_id, ro.assigned_at FROM routines ro
        WHERE ro.member_id = f.id
        ORDER BY ro.assigned_at DESC NULLS LAST, ro.created_at DESC LIMIT 1
      ) r ON true
      LEFT JOIN routine_templates rt ON rt.id = r.routine_template_id
      ORDER BY coalesce(nullif(f.profile_name, ''), f.email), f.id
      LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
      OFFSET greatest(0, coalesce(p_offset, 0));
    $body$;
  $f$, v_name_expr, v_common);

  EXECUTE format($f$
    CREATE FUNCTION public.list_branch_members(
      p_search text DEFAULT NULL, p_limit integer DEFAULT 25,
      p_offset integer DEFAULT 0, p_status text DEFAULT NULL,
      p_has_routine boolean DEFAULT NULL
    )
    RETURNS TABLE(member_id uuid, email text, display_name text,
                  activation_expires_at timestamp, current_routine_id uuid,
                  current_routine_name text, assigned_at timestamptz, total_count bigint)
    LANGUAGE sql STABLE AS $body$
      WITH scoped AS (
        SELECT m.id, m.email, m.activation_expires_at, %s AS profile_name
        FROM members m
        LEFT JOIN user_profiles up ON up.id = m.user_id
        WHERE m.organization_id = public.current_profile_org()
          AND m.branch_id = public.current_profile_branch()
      %s
      SELECT f.id, f.email, nullif(f.profile_name, ''),
             f.activation_expires_at, r.routine_template_id, rt.name, r.assigned_at,
             count(*) OVER () AS total_count
      FROM filtered f
      LEFT JOIN LATERAL (
        SELECT ro.routine_template_id, ro.assigned_at FROM routines ro
        WHERE ro.member_id = f.id
        ORDER BY ro.assigned_at DESC NULLS LAST, ro.created_at DESC LIMIT 1
      ) r ON true
      LEFT JOIN routine_templates rt ON rt.id = r.routine_template_id
      ORDER BY coalesce(nullif(f.profile_name, ''), f.email), f.id
      LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
      OFFSET greatest(0, coalesce(p_offset, 0));
    $body$;
  $f$, v_name_expr, v_common);
END $$;

GRANT EXECUTE ON FUNCTION public.list_org_members(text, integer, integer, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_branch_members(text, integer, integer, text, boolean) TO authenticated;

-- ------------------------------------------------- exercise_log: lectura staff
-- exercise_log (singular) es la canonica (ver docs/decisions.md, "Dos tablas
-- de log en paralelo"): es la que escribe la app hoy (WorkoutCompleteButton,
-- mobile). Hasta ahora solo tenia policy de SELECT para el propio socio
-- (0006) — el trainer no podia leer NADA de ahi, lo que bloquea "miembros
-- sin registrar hace 7+ dias" (home) y "ultima carga" (columna de
-- adherencia). Se agrega SELECT para staff de la organizacion, mismo patron
-- que exercise_logs_select_staff (0013): el trainer solo ve su sucursal.
--
-- No se toca INSERT/DELETE (siguen siendo self-only) ni la ambiguedad
-- exercise_log/exercise_logs: esto es únicamente una policy de lectura
-- adicional sobre la tabla que YA tiene datos reales.
DROP POLICY IF EXISTS exercise_log_select_staff ON public.exercise_log;
CREATE POLICY exercise_log_select_staff
  ON public.exercise_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = exercise_log.member_id
        AND up.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND up.branch_id = public.current_profile_branch()
          )
        )
    )
  );

COMMIT;
