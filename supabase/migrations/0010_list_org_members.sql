-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- REQUIERE 0007 (helper current_profile_org) y 0009 (de donde sale este
-- clon, y donde ya se crean los índices que esta función también usa).
--
-- Listado de miembros para el GYM_OWNER/ADMIN: lo mismo que
-- list_branch_members() pero SIN el filtro por sucursal — el owner ve toda
-- la organización — y con una columna extra `branch_name`, porque cuando el
-- gimnasio tiene más de una sucursal el nombre suelto no alcanza para saber
-- de quién es cada socio.
--
-- Todo lo demás se mantiene por las mismas razones que en 0009, que no
-- cambiaron al sacar el filtro:
--   * Es una función y no un .select() con .range() porque el NOMBRE del
--     socio no está en `members` (vive en user_profiles, ligado por
--     members.user_id): buscar por nombre desde el cliente obligaría a
--     traer todas las filas para filtrarlas después.
--   * El JOIN a user_profiles es LEFT a propósito: hay members SIN fila en
--     user_profiles, y con INNER JOIN desaparecerían del listado sin aviso.
--   * SECURITY INVOKER (el default): la RLS del caller sigue aplicando fila
--     por fila. El filtro explícito por organización es la segunda barrera,
--     no la única.

CREATE OR REPLACE FUNCTION public.list_org_members(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  member_id uuid,
  email text,
  display_name text,
  branch_name text,
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
      b.name AS branch_name,
      btrim(coalesce(up.name, '') || ' ' || coalesce(up.surname, '')) AS profile_name
    FROM members m
    LEFT JOIN user_profiles up ON up.id = m.user_id
    -- También LEFT: un member sin branch_id (o apuntando a una sucursal ya
    -- borrada) tiene que seguir apareciendo, con la celda vacía.
    LEFT JOIN branches b ON b.id = m.branch_id
    WHERE m.organization_id = public.current_profile_org()
  ),
  filtered AS (
    SELECT *
    FROM scoped
    WHERE p_search IS NULL
       OR btrim(p_search) = ''
       -- Se busca por nombre y también por email: hay socios sin perfil, y
       -- para esos el email es lo único con lo que se los puede encontrar.
       OR profile_name ILIKE '%' || btrim(p_search) || '%'
       OR email ILIKE '%' || btrim(p_search) || '%'
  )
  SELECT
    f.id,
    f.email,
    nullif(f.profile_name, '') AS display_name,
    f.branch_name,
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

REVOKE ALL ON FUNCTION public.list_org_members(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_org_members(text, integer, integer) TO authenticated;

-- Sin el filtro por sucursal, el índice (organization_id, branch_id) de 0009
-- igual sirve de prefijo, pero este deja explícito el acceso por org sola.
CREATE INDEX IF NOT EXISTS members_org_idx
  ON public.members (organization_id);
