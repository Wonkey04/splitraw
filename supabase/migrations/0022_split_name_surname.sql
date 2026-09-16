-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- "Nombre y Apellido separados en todos los formularios": hasta acá había
-- tres altas que pedían un solo campo "Nombre" y lo partían (o ni eso) del
-- lado del servidor:
--
--   1. create_gym_with_owner() -> user_profiles.surname quedaba SIEMPRE NULL
--      para el GYM_OWNER (0015): el owner nunca tuvo apellido guardado.
--   2. accept_trainer_invitation() -> partía trainer_invitations.name con
--      split_part(nombre, ' ', 1) + el resto como apellido (0007:196-203),
--      un hack ya señalado como tal en el propio comentario del momento.
--   3. link_member_by_code() -> user_profiles.surname quedaba NULL para el
--      MEMBER en el alta inicial (0015): se corrige recién si el socio abre
--      /profile a mano.
--
-- Esta migración le da a cada una un apellido real de origen: columna nueva
-- en trainer_invitations, y parámetros nuevos (con DEFAULT, no rompen a
-- quien ya llamaba a las tres funciones) en las otras dos.

BEGIN;

ALTER TABLE public.trainer_invitations ADD COLUMN IF NOT EXISTS surname TEXT;

-- ===================================================== create_gym_with_owner
DROP FUNCTION IF EXISTS public.create_gym_with_owner(text, text, text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.create_gym_with_owner(
  p_gym_name       text,
  p_city           text,
  p_province       text,
  p_branch_name    text,
  p_owner_name     text,
  p_ciudad_id      uuid DEFAULT NULL,
  p_branch_address text DEFAULT NULL,
  p_owner_surname  text DEFAULT NULL
)
RETURNS TABLE(organization_id uuid, invitation_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_code   text;
  v_provincia_id uuid;
  v_ciudad_nombre text;
  v_provincia_nombre text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid) THEN
    RAISE EXCEPTION 'ALREADY_HAS_ORG';
  END IF;

  IF btrim(coalesce(p_gym_name, '')) = '' THEN
    RAISE EXCEPTION 'GYM_NAME_REQUIRED';
  END IF;
  IF btrim(coalesce(p_branch_name, '')) = '' THEN
    RAISE EXCEPTION 'BRANCH_NAME_REQUIRED';
  END IF;

  IF p_ciudad_id IS NOT NULL THEN
    SELECT c.nombre, c.provincia_id, p.nombre
      INTO v_ciudad_nombre, v_provincia_id, v_provincia_nombre
    FROM ciudades c JOIN provincias p ON p.id = c.provincia_id
    WHERE c.id = p_ciudad_id;

    IF v_ciudad_nombre IS NULL THEN
      RAISE EXCEPTION 'CIUDAD_INVALIDA';
    END IF;
  END IF;

  v_code := public.generate_invitation_code();

  INSERT INTO organizations (name, city, province, provincia_id, ciudad_id, plan, invitation_code)
  VALUES (
    btrim(p_gym_name),
    coalesce(v_ciudad_nombre, nullif(btrim(coalesce(p_city, '')), '')),
    coalesce(v_provincia_nombre, nullif(btrim(coalesce(p_province, '')), '')),
    v_provincia_id,
    p_ciudad_id,
    'free',
    v_code
  )
  RETURNING id INTO v_org_id;

  INSERT INTO branches (organization_id, name, address)
  VALUES (v_org_id, btrim(p_branch_name), nullif(btrim(coalesce(p_branch_address, '')), ''))
  RETURNING id INTO v_branch_id;

  INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname)
  VALUES (v_uid, v_org_id, v_branch_id, 'GYM_OWNER', btrim(coalesce(p_owner_name, '')),
          nullif(btrim(coalesce(p_owner_surname, '')), ''));

  RETURN QUERY SELECT v_org_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gym_with_owner(text, text, text, text, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_gym_with_owner(text, text, text, text, text, uuid, text, text) TO authenticated;

-- ================================================= accept_trainer_invitation
-- Se saca el split_part(nombre, ' ', 1): ahora trainer_invitations tiene
-- surname propio (llenado por /api/trainer-invitations), así que no hay que
-- adivinar dónde termina el nombre y empieza el apellido.
CREATE OR REPLACE FUNCTION public.accept_trainer_invitation(p_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv trainer_invitations%ROWTYPE;
  v_user_email text;
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

  SELECT u.email INTO v_user_email FROM auth.users u WHERE u.id = auth.uid();
  IF lower(v_user_email) <> lower(v_inv.email) THEN
    RAISE EXCEPTION 'Esta invitación es para otro email.';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Esta cuenta ya tiene un perfil.';
  END IF;

  INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname, phone)
    VALUES (auth.uid(), v_inv.organization_id, v_inv.branch_id, 'TRAINER',
            btrim(coalesce(v_inv.name, '')), nullif(btrim(coalesce(v_inv.surname, '')), ''), 0);

  UPDATE trainer_invitations SET used_at = now() WHERE id = v_inv.id;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trainer_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trainer_invitation(uuid) TO authenticated;

-- ======================================================= link_member_by_code
DROP FUNCTION IF EXISTS public.link_member_by_code(text, text);

CREATE OR REPLACE FUNCTION public.link_member_by_code(
  p_code text,
  p_name text DEFAULT NULL,
  p_surname text DEFAULT NULL
)
RETURNS TABLE(status text, organization_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_email     text;
  v_org_id    uuid;
  v_org_name  text;
  v_branch_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT o.id, o.name INTO v_org_id, v_org_name
  FROM members m JOIN organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY SELECT 'already_linked'::text, v_org_name, NULL::text;
    RETURN;
  END IF;

  SELECT o.id, o.name INTO v_org_id, v_org_name
  FROM organizations o
  WHERE o.invitation_code = upper(btrim(coalesce(p_code, '')));

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT b.id INTO v_branch_id
  FROM branches b WHERE b.organization_id = v_org_id
  ORDER BY b.created_at ASC LIMIT 1;

  IF v_branch_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text,
                        'Ese gimnasio todavía no tiene sucursales.'::text;
    RETURN;
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  BEGIN
    INSERT INTO members (user_id, organization_id, branch_id, email, activated_at)
    VALUES (v_uid, v_org_id, v_branch_id, v_email, now());

    INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname)
    VALUES (v_uid, v_org_id, v_branch_id, 'MEMBER',
            btrim(coalesce(p_name, split_part(coalesce(v_email, ''), '@', 1))),
            nullif(btrim(coalesce(p_surname, '')), ''))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      RETURN QUERY SELECT 'limit_reached'::text, v_org_name, SQLERRM::text;
      RETURN;
  END;

  RETURN QUERY SELECT 'linked'::text, v_org_name, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.link_member_by_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_member_by_code(text, text, text) TO authenticated;

COMMIT;
