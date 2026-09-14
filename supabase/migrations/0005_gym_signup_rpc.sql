-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- El signup mobile necesita, ANTES de que el usuario tenga sesión (rol
-- `anon`, todavía no hizo signIn/signUp), poder:
--   1. Resolver un gym_code a su organization_id + branch_id.
--   2. Chequear si un email ya está registrado como member (para mostrar
--      "Email no registrado" en login vs "Email ya registrado" en signup,
--      algo que supabase.auth.signInWithPassword no distingue a propósito).
--
-- En vez de abrir SELECT anónimo sobre gym_invitation_codes/branches/members
-- (esta última tiene full_name, organization_id, branch_id: bastante más de
-- lo que hace falta exponer a un caller sin sesión), exponemos dos funciones
-- SECURITY DEFINER que devuelven exactamente el dato mínimo necesario.

-- Devuelve organization_id + branch_id para un código, o cero filas si no
-- existe. `is_expired` distingue "no existe" de "existe pero fue borrado".
CREATE OR REPLACE FUNCTION public.resolve_gym_code(p_code text)
RETURNS TABLE(organization_id uuid, branch_id uuid, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_deleted_at timestamp;
  v_branch_id uuid;
BEGIN
  SELECT gic.organization_id, gic.deleted_at
    INTO v_org_id, v_deleted_at
    FROM gym_invitation_codes gic
    WHERE gic.code = upper(trim(p_code));

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT b.id INTO v_branch_id
    FROM branches b
    WHERE b.organization_id = v_org_id
    ORDER BY b.created_at ASC
    LIMIT 1;

  RETURN QUERY SELECT v_org_id, v_branch_id, (v_deleted_at IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_gym_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_gym_code(text) TO anon, authenticated;

-- Solo boolean: no expone ninguna columna de members.
CREATE OR REPLACE FUNCTION public.email_is_registered(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM members WHERE email = check_email);
$$;

REVOKE ALL ON FUNCTION public.email_is_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_registered(text) TO anon, authenticated;

-- Nota: la policy `gym_invitation_codes_select` de 0004 quedó de más para
-- este flujo (estaba scoped a `authenticated`, pero el lookup de gym_code
-- pasa ANTES de tener sesión, así que nunca hubiese aplicado). No hace
-- falta borrarla -- no molesta -- pero resolve_gym_code() de acá arriba es
-- el mecanismo real que usa el signup mobile.
