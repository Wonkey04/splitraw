-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Feature 3 (adherencia en la tabla de Miembros): list_org_members y
-- list_branch_members (0009/0010, extendidas en 0017 y 0018) suman
-- last_log_at — la fecha del último exercise_log del socio, para el
-- subtexto "Última carga: hace N días" bajo el nombre. Mismo patrón que
-- current_routine_id: un scalar subquery por fila, no un JOIN que multiplique
-- filas.
--
-- exercise_log.member_id = user_profiles.id (no members.id): por eso el
-- subquery cuelga de `up`, la misma columna que ya arma profile_name.

BEGIN;

DROP FUNCTION IF EXISTS public.list_org_members(text, integer, integer, text, boolean);
DROP FUNCTION IF EXISTS public.list_branch_members(text, integer, integer, text, boolean);

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
                  current_routine_name text, assigned_at timestamptz,
                  last_log_at date, total_count bigint)
    LANGUAGE sql STABLE AS $body$
      WITH scoped AS (
        SELECT m.id, m.email, m.activation_expires_at, b.name AS branch_name,
               %s AS profile_name,
               (SELECT max(el.fecha) FROM exercise_log el WHERE el.member_id = up.id) AS last_log_at
        FROM members m
        LEFT JOIN user_profiles up ON up.id = m.user_id
        LEFT JOIN branches b ON b.id = m.branch_id
        WHERE m.organization_id = public.current_profile_org()
      %s
      SELECT f.id, f.email, nullif(f.profile_name, ''), f.branch_name,
             f.activation_expires_at, r.routine_template_id, rt.name, r.assigned_at,
             f.last_log_at,
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
                  current_routine_name text, assigned_at timestamptz,
                  last_log_at date, total_count bigint)
    LANGUAGE sql STABLE AS $body$
      WITH scoped AS (
        SELECT m.id, m.email, m.activation_expires_at, %s AS profile_name,
               (SELECT max(el.fecha) FROM exercise_log el WHERE el.member_id = up.id) AS last_log_at
        FROM members m
        LEFT JOIN user_profiles up ON up.id = m.user_id
        WHERE m.organization_id = public.current_profile_org()
          AND m.branch_id = public.current_profile_branch()
      %s
      SELECT f.id, f.email, nullif(f.profile_name, ''),
             f.activation_expires_at, r.routine_template_id, rt.name, r.assigned_at,
             f.last_log_at,
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

COMMIT;
