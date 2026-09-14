-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Invitación de TRAINER: el GYM_OWNER carga nombre + email + sucursal y el
-- backend (route handler /api/trainer-invitations) inserta acá una fila con
-- un token de un solo uso que vence a los 30 minutos, y manda el mail por
-- Resend. El trainer abre /accept-invite?token=... y elige contraseña.
--
-- Por qué el token no se lee con un SELECT normal: el trainer abre el link
-- SIN sesión (rol `anon`), y hoy ninguna tabla tiene policy para anon (se
-- verificó contra la base real: anon recibe [] en todas). Mismo patrón que
-- resolve_gym_code() en 0005 -> dos funciones SECURITY DEFINER que exponen
-- exactamente el dato mínimo, en vez de abrir la tabla entera a anon.

CREATE TABLE IF NOT EXISTS public.trainer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  -- Nombre que cargó el owner en el form. Se usa para el saludo del mail y
  -- para prellenar user_profiles cuando el trainer acepta.
  name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  invited_by uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainer_invitations_org_idx
  ON public.trainer_invitations (organization_id, created_at DESC);

ALTER TABLE public.trainer_invitations ENABLE ROW LEVEL SECURITY;

-- Helpers: leen el perfil del caller SIN pasar por RLS de user_profiles
-- (si una policy sobre user_profiles consultara user_profiles se caería en
-- recursión infinita). STABLE porque no escriben y se llaman muchas veces
-- por query.
CREATE OR REPLACE FUNCTION public.current_profile_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_profile_branch()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_profile_org() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_branch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_branch() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

-- Solo GYM_OWNER/ADMIN de esa misma organización crean invitaciones.
-- (El route handler además valida lo mismo del lado del server antes de
-- insertar con el service role; esto cubre el acceso directo por REST.)
DROP POLICY IF EXISTS trainer_invitations_insert_owner ON public.trainer_invitations;
CREATE POLICY trainer_invitations_insert_owner
  ON public.trainer_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  );

-- Listar las invitaciones del propio gimnasio (pendientes/usadas/vencidas).
DROP POLICY IF EXISTS trainer_invitations_select_owner ON public.trainer_invitations;
CREATE POLICY trainer_invitations_select_owner
  ON public.trainer_invitations
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  );

-- NOTA: no hay policy de SELECT para `anon`. El trainer que abre el link
-- todavía no tiene sesión y valida el token por RPC (abajo), que devuelve
-- solo email / expires_at / used_at / nombre del gym.

-- Valida un token y devuelve el mínimo necesario para pintar la pantalla.
-- `status` distingue los tres errores que pide el brief:
--   'not_found' -> "Invitación inválida"
--   'expired'   -> "Invitación expirada"
--   'used'      -> "Esta invitación ya fue usada"
--   'valid'     -> mostrar el form de contraseña
CREATE OR REPLACE FUNCTION public.resolve_trainer_invitation(p_token uuid)
RETURNS TABLE(
  status text,
  email text,
  invited_name text,
  organization_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv trainer_invitations%ROWTYPE;
  v_org_name text;
BEGIN
  SELECT * INTO v_inv FROM trainer_invitations WHERE token = p_token;

  IF v_inv.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT o.name INTO v_org_name FROM organizations o WHERE o.id = v_inv.organization_id;

  IF v_inv.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, v_inv.email, v_inv.name, v_org_name, v_inv.expires_at;
    RETURN;
  END IF;

  IF now() > v_inv.expires_at THEN
    RETURN QUERY SELECT 'expired'::text, v_inv.email, v_inv.name, v_org_name, v_inv.expires_at;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'valid'::text, v_inv.email, v_inv.name, v_org_name, v_inv.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_trainer_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_trainer_invitation(uuid) TO anon, authenticated;

-- Post-signup: el trainer ya existe en auth.users (signUp desde el cliente)
-- pero todavía no tiene user_profiles. Esta función crea el perfil con role
-- TRAINER + org/branch tomados del token y quema la invitación, todo en la
-- misma transacción. El FOR UPDATE evita que dos pestañas la usen a la vez.
CREATE OR REPLACE FUNCTION public.accept_trainer_invitation(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv trainer_invitations%ROWTYPE;
  v_user_email text;
  v_first text;
  v_rest text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Necesitás una sesión para aceptar la invitación.';
  END IF;

  SELECT * INTO v_inv FROM trainer_invitations WHERE token = p_token FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida.';
  END IF;
  IF v_inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta invitación ya fue usada.';
  END IF;
  IF now() > v_inv.expires_at THEN
    RAISE EXCEPTION 'La invitación expiró.';
  END IF;

  -- El token vale para el email al que se mandó, no para cualquiera que lo
  -- tenga: la cuenta recién logueada tiene que ser la misma.
  SELECT u.email INTO v_user_email FROM auth.users u WHERE u.id = auth.uid();
  IF lower(v_user_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'Esta invitación es para otro email.';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Esta cuenta ya tiene un perfil.';
  END IF;

  -- user_profiles.surname y .phone son NOT NULL pero el form del owner pide
  -- un solo campo "nombre": se parte en la primera palabra + resto, igual de
  -- conservador que el `phone: 0` que ya usa /create-gym.
  v_first := split_part(trim(v_inv.name), ' ', 1);
  v_rest := trim(substring(trim(v_inv.name) from length(v_first) + 1));

  INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname, phone)
    VALUES (auth.uid(), v_inv.organization_id, v_inv.branch_id, 'TRAINER', v_first, v_rest, 0);

  UPDATE trainer_invitations SET used_at = now() WHERE id = v_inv.id;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trainer_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trainer_invitation(uuid) TO authenticated;
