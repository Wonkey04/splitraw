-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- REQUIERE 0007 (usa los helpers current_profile_org/branch) y 0008 (las
-- policies de TRAINER). Aplicar en orden.
--
-- Listado de miembros de la sucursal del trainer, paginado y con buscador.
--
-- Por qué esto es una función y no un .select() con .range() desde el
-- cliente: el NOMBRE del socio no está en `members` (esa tabla no tiene
-- columna de nombre, se verificó contra la base real) — vive en
-- user_profiles, ligado por members.user_id. Buscar por nombre desde el
-- cliente obligaría a traer todas las filas para filtrarlas después, que es
-- exactamente lo que hay que evitar con cientos de alumnos. Con el JOIN acá
-- adentro, el filtro y el LIMIT los resuelve Postgres.
--
-- El JOIN es LEFT a propósito: hay members SIN fila en user_profiles (el
-- signup mobile crea `members` pero no siempre el perfil). Con INNER JOIN
-- esos socios desaparecerían del listado del trainer sin aviso.
--
-- SECURITY INVOKER (el default, no lleva SECURITY DEFINER): la RLS del
-- caller sigue aplicando fila por fila. El filtro explícito por
-- organización + sucursal de abajo es la segunda barrera, no la única.

CREATE OR REPLACE FUNCTION public.list_branch_members(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  member_id uuid,
  email text,
  display_name text,
  activation_expires_at timestamp,
  current_routine_id uuid,
  current_routine_name text,
  assigned_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH scoped AS (
    SELECT
      m.id,
      m.email,
      m.activation_expires_at,
      btrim(coalesce(up.name, '') || ' ' || coalesce(up.surname, '')) AS profile_name
    FROM members m
    LEFT JOIN user_profiles up ON up.id = m.user_id
    WHERE m.organization_id = public.current_profile_org()
      AND m.branch_id = public.current_profile_branch()
  ),
  filtered AS (
    SELECT *
    FROM scoped
    WHERE p_search IS NULL
       OR btrim(p_search) = ''
       -- Se busca por nombre y también por email: hay socios sin perfil, y
       -- para esos el email es lo único con lo que el trainer los puede
       -- encontrar.
       OR profile_name ILIKE '%' || btrim(p_search) || '%'
       OR email ILIKE '%' || btrim(p_search) || '%'
  )
  SELECT
    f.id,
    f.email,
    nullif(f.profile_name, '') AS display_name,
    f.activation_expires_at,
    r.routine_template_id,
    rt.name,
    r.assigned_at,
    -- Total ANTES del LIMIT: es lo que necesita el paginador para saber
    -- cuántas páginas hay.
    count(*) OVER () AS total_count
  FROM filtered f
  -- `routines` es un historial: asignar de nuevo agrega una fila, no pisa la
  -- anterior. La rutina "actual" es la última asignada.
  LEFT JOIN LATERAL (
    SELECT ro.routine_template_id, ro.assigned_at
    FROM routines ro
    WHERE ro.member_id = f.id
    ORDER BY ro.assigned_at DESC NULLS LAST, ro.created_at DESC
    LIMIT 1
  ) r ON true
  LEFT JOIN routine_templates rt ON rt.id = r.routine_template_id
  ORDER BY coalesce(nullif(f.profile_name, ''), f.email), f.id
  LIMIT greatest(1, least(coalesce(p_limit, 25), 100))
  OFFSET greatest(0, coalesce(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.list_branch_members(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_branch_members(text, integer, integer) TO authenticated;

-- Acelera el filtro por sucursal cuando el gimnasio tenga cientos de socios.
CREATE INDEX IF NOT EXISTS members_org_branch_idx
  ON public.members (organization_id, branch_id);

-- El LATERAL de arriba pega una vez por socio de la página: sin esto, cada
-- una de esas 25 consultas escanea `routines` entero.
CREATE INDEX IF NOT EXISTS routines_member_assigned_idx
  ON public.routines (member_id, assigned_at DESC);
