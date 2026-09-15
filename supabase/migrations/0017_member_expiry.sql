-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- El estado del socio (activo / vencido) se CALCULA comparando
-- members.activation_expires_at con hoy. No es un booleano que alguien
-- togglea: un flag manual es un recordatorio que nadie cumple, y a la semana
-- la lista miente. Una fecha es un dato objetivo que se puede ordenar,
-- filtrar y renovar.
--
-- La columna activation_expires_at YA EXISTE en members. Acá se agrega lo que
-- faltaba para operarla: renovar desde el dashboard y filtrar por vencidos.
--
-- NULL no es "vencido": es "sin datos". El gimnasio cobra por fuera de
-- SplitRaw, así que un socio del que todavía no cargamos vencimiento no tiene
-- por qué aparecer como moroso.

BEGIN;

-- ---------------------------------------------------------- renew_member
-- SECURITY DEFINER porque tras 0013 el socio ya no puede hacer UPDATE sobre
-- members (se dropeó members_update_self, que le dejaba correrse la fecha a
-- sí mismo por REST). El permiso se chequea explícito acá adentro, que es lo
-- que hay que hacer en una definer: la RLS del caller no aplica.
CREATE OR REPLACE FUNCTION public.renew_member(
  p_member_id uuid,
  p_days integer DEFAULT 30
)
RETURNS timestamp
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new timestamp;
BEGIN
  IF public.current_profile_role() NOT IN ('GYM_OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Solo el dueño o un administrador puede renovar un socio.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM members m
    WHERE m.id = p_member_id AND m.organization_id = public.current_profile_org()
  ) THEN
    -- Mismo mensaje para "no existe" y "es de otro gimnasio": distinguirlos
    -- le confirmaría a un caller ajeno que ese id existe en algún lado.
    RAISE EXCEPTION 'Ese socio no pertenece a tu gimnasio.';
  END IF;

  IF coalesce(p_days, 0) <= 0 OR p_days > 366 THEN
    RAISE EXCEPTION 'La renovación tiene que ser de entre 1 y 366 días.';
  END IF;

  -- greatest(now(), vencimiento) es la parte que importa: renovar a un socio
  -- VENCIDO arranca de hoy (no se le regalan los días que estuvo sin pagar),
  -- y renovar a uno ACTIVO extiende desde su vencimiento (no se le comen los
  -- días que le quedaban por pagar antes).
  UPDATE members m
  SET activation_expires_at =
        greatest(now()::timestamp, coalesce(m.activation_expires_at, now()::timestamp))
        + make_interval(days => p_days)
  WHERE m.id = p_member_id
  RETURNING m.activation_expires_at INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_member(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_member(uuid, integer) TO authenticated;

-- ------------------------------------- listados: filtro por estado del plan
-- Las dos funciones de 0009/0010 suman p_status ('expired' | 'active' | NULL).
-- El filtro va en la base y no en el cliente por la misma razón que la
-- búsqueda: con el paginado de 25, filtrar después de traer la página daría
-- páginas de tamaño variable y un total mal contado.
--
-- Se dropean las versiones viejas antes del CREATE. Un parámetro nuevo con
-- DEFAULT crea una SOBRECARGA, no reemplaza: quedarían dos list_org_members y
-- PostgREST no sabría a cuál llamar.
DROP FUNCTION IF EXISTS public.list_org_members(text, integer, integer);
DROP FUNCTION IF EXISTS public.list_branch_members(text, integer, integer);
DROP FUNCTION IF EXISTS public.list_org_members(text, integer, integer, text);
DROP FUNCTION IF EXISTS public.list_branch_members(text, integer, integer, text);

-- Las definiciones se arman con EXECUTE porque el nombre para mostrar depende
-- de si user_profiles tiene columna `surname`: el volcado de producción dice
-- que no, pero 0009:48 y 0010:50 la usan y están aplicadas. Ver la nota del
-- mismo tema en 0015 y en docs/decisions.md. Así la migración aplica en los
-- dos escenarios en vez de fallar en uno.
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

  -- El bloque compartido: filtro de texto, filtro de estado, rutina actual,
  -- total antes del LIMIT. Idéntico al de 0009/0010 salvo por p_status.
  v_common := $x$
  ),
  filtered AS (
    SELECT *
    FROM scoped
    WHERE (p_search IS NULL OR btrim(p_search) = ''
           OR profile_name ILIKE '%' || btrim(p_search) || '%'
           OR email ILIKE '%' || btrim(p_search) || '%')
      AND (
        p_status IS NULL OR btrim(p_status) = ''
        -- "Vencido" exige fecha cargada Y pasada. Un socio sin fecha no es
        -- moroso, es un socio del que no sabemos nada.
        OR (p_status = 'expired'
            AND activation_expires_at IS NOT NULL
            AND activation_expires_at < now())
        OR (p_status = 'active'
            AND activation_expires_at IS NOT NULL
            AND activation_expires_at >= now())
      )
  )$x$;

  EXECUTE format($f$
    CREATE FUNCTION public.list_org_members(
      p_search text DEFAULT NULL, p_limit integer DEFAULT 25,
      p_offset integer DEFAULT 0, p_status text DEFAULT NULL
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
      p_offset integer DEFAULT 0, p_status text DEFAULT NULL
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

-- Siguen siendo SECURITY INVOKER (sin SECURITY DEFINER), igual que en
-- 0009/0010: la RLS del caller aplica fila por fila y el filtro explícito por
-- organización es la segunda barrera, no la única.
GRANT EXECUTE ON FUNCTION public.list_org_members(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_branch_members(text, integer, integer, text) TO authenticated;

COMMIT;
