-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- REQUIERE 0007 (helpers current_profile_org / current_profile_role).
--
-- Empleados del gimnasio para el panel del owner (/dashboard/employees).
-- Hasta ahora esa pantalla solo mostraba INVITACIONES: no había forma de ver
-- quién efectivamente trabaja en el gimnasio hoy.
--
-- Por qué es SECURITY DEFINER (a diferencia de list_org_members, que es
-- INVOKER): el EMAIL del empleado no está en user_profiles — vive en
-- auth.users, y ese esquema no es accesible desde el rol `authenticated`.
-- La única forma de traerlo es una función definer. Como acá la RLS del
-- caller NO aplica, el chequeo de permisos tiene que ser explícito y es lo
-- primero que hace la función: solo GYM_OWNER/ADMIN, y solo de su propia
-- organización (misma regla que las policies de trainer_invitations en
-- 0007). El search_path fijo es obligatorio en una definer para que nadie
-- pueda resolver `user_profiles` a otra tabla.
--
-- El JOIN a auth.users y el de branches son LEFT a propósito: un perfil
-- cuyo usuario de auth fue borrado, o con branch_id apuntando a una sucursal
-- que ya no está, tiene que seguir apareciendo en el listado con la celda
-- vacía, no desaparecer sin aviso.

CREATE OR REPLACE FUNCTION public.list_org_employees()
RETURNS TABLE(
  user_id uuid,
  name text,
  surname text,
  email text,
  role text,
  branch_id uuid,
  branch_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_profile_role() NOT IN ('GYM_OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'No tenés permiso para ver los empleados del gimnasio.';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.name,
    up.surname,
    u.email::text,
    up.role,
    up.branch_id,
    b.name,
    up.created_at
  FROM user_profiles up
  LEFT JOIN auth.users u ON u.id = up.id
  LEFT JOIN branches b ON b.id = up.branch_id
  WHERE up.organization_id = public.current_profile_org()
    -- MEMBER queda afuera: los socios tienen su propia pantalla
    -- (/dashboard/members). Esto es el panel de EMPLEADOS.
    AND up.role IN ('GYM_OWNER', 'ADMIN', 'TRAINER')
  -- Los dueños primero, después los entrenadores, y dentro de cada grupo por
  -- antigüedad: es el orden en el que el owner espera leer su propio equipo.
  ORDER BY
    CASE up.role WHEN 'GYM_OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
    up.created_at,
    up.id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_org_employees() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_org_employees() TO authenticated;

-- El listado siempre filtra por organización.
CREATE INDEX IF NOT EXISTS user_profiles_org_role_idx
  ON public.user_profiles (organization_id, role);
