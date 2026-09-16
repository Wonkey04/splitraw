-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Baja de gimnasio: para que el GYM_OWNER pueda eliminar su cuenta (Apple/
-- Google exigen que cualquier tipo de cuenta se pueda dar de baja desde la
-- app), hace falta decidir qué pasa con el resto del gimnasio. La decisión:
--
--   - Se borra TODO lo que es DEL gimnasio: sucursales, rutinas (templates y
--     asignadas), historial de cargas, invitaciones, código, la organización
--     misma.
--   - Los USUARIOS (entrenadores y socios) NO se borran: nadie pidió que se
--     borre su cuenta más que el dueño. Quedan con organization_id/branch_id
--     en NULL — la cuenta sigue viva, sin gimnasio.
--
-- Eso implica que organization_id deja de poder ser NOT NULL en members y en
-- user_profiles (hoy lo es en las dos). branch_id en user_profiles ya es
-- nullable; en members no.

BEGIN;

ALTER TABLE public.members ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.members ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE public.user_profiles ALTER COLUMN organization_id DROP NOT NULL;

-- organizations.invitation_code_id apunta a gym_invitation_codes(id) sin
-- ON DELETE: si delete_organization_cascade() borra la fila de
-- gym_invitation_codes antes que la de organizations, esta FK (en el sentido
-- contrario) lo bloquea. SET NULL porque la organización que la tenía
-- también se está borrando en la misma transacción — no hay nada que
-- preservar ahí.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_invitation_code_id_fkey,
  ADD CONSTRAINT organizations_invitation_code_id_fkey
    FOREIGN KEY (invitation_code_id) REFERENCES public.gym_invitation_codes(id)
    ON DELETE SET NULL;

-- ================================================ delete_organization_cascade
-- Solo lo puede correr el GYM_OWNER (o SUPER_ADMIN) DE ESA organización — se
-- valida con auth.uid() adentro de la función, no con lo que mande el
-- cliente. ADMIN queda afuera a propósito: dar de baja el gimnasio entero es
-- una decisión que le corresponde al dueño, no a cualquiera con ese rol.
--
-- Orden de borrado (de lo que depende de la organización hacia la
-- organización misma), respetando FKs:
--   exercise_logs -> exercise_log -> body_metrics -> routines -> exercises ->
--   routine_templates -> trainer_invitations -> gym_invitation_codes ->
--   (members/user_profiles: UPDATE, no DELETE) -> branches -> organizations
CREATE OR REPLACE FUNCTION public.delete_organization_cascade(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF public.current_profile_role() NOT IN ('GYM_OWNER', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'SOLO_OWNER_PUEDE_BORRAR';
  END IF;

  IF public.current_profile_org() IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'ORG_AJENA';
  END IF;

  -- exercise_logs (plural): member_id -> members.id.
  DELETE FROM exercise_logs
  WHERE routine_id IN (SELECT id FROM routines WHERE organization_id = p_org_id);

  -- exercise_log (singular): member_id -> user_profiles.id, no members.id
  -- (dos tablas de log, misma columna, dos significados — ver
  -- docs/decisions.md). Se borra por routine_id, que sí es inequívoco.
  DELETE FROM exercise_log
  WHERE routine_id IN (SELECT id FROM routines WHERE organization_id = p_org_id);

  DELETE FROM body_metrics
  WHERE member_id IN (SELECT id FROM members WHERE organization_id = p_org_id);

  DELETE FROM routines WHERE organization_id = p_org_id;

  DELETE FROM exercises
  WHERE routine_template_id IN (SELECT id FROM routine_templates WHERE organization_id = p_org_id);

  DELETE FROM routine_templates WHERE organization_id = p_org_id;

  DELETE FROM trainer_invitations WHERE organization_id = p_org_id;

  DELETE FROM gym_invitation_codes WHERE organization_id = p_org_id;

  -- Desvincular, no borrar: la cuenta de auth y el perfil personal (nombre,
  -- foto) de cada entrenador y socio siguen existiendo.
  UPDATE members SET organization_id = NULL, branch_id = NULL WHERE organization_id = p_org_id;
  UPDATE user_profiles SET organization_id = NULL, branch_id = NULL WHERE organization_id = p_org_id;

  DELETE FROM branches WHERE organization_id = p_org_id;

  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO authenticated;

-- ======================================================= link_member_by_code
-- Ahora que un socio puede quedar con organization_id NULL (en vez de
-- borrado) cuando su gimnasio se da de baja, tiene que poder VOLVER a
-- vincularse a uno nuevo. El INSERT ciego de antes no contemplaba esto:
--   - members.email es UNIQUE: insertar una fila nueva para el mismo user_id
--     violaba esa unicidad (la fila vieja, con organization_id NULL, seguía
--     ahí).
--   - user_profiles usaba ON CONFLICT (id) DO NOTHING: si el perfil ya
--     existía (con organization_id NULL), el re-vínculo no hacía nada — el
--     socio quedaba viendo /link-gym para siempre por más códigos que
--     cargara.
-- Se pasa a UPDATE-si-existe / INSERT-si-no, para members y para
-- user_profiles.
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
    IF EXISTS (SELECT 1 FROM members WHERE user_id = v_uid) THEN
      -- members_plan_limit (0016) es BEFORE INSERT: un UPDATE no lo dispara.
      -- Sin este chequeo manual, un socio que vuelve a vincularse (su
      -- gimnasio anterior se dio de baja) se colaría sin contar contra el
      -- límite del plan del gimnasio nuevo.
      PERFORM public.assert_plan_limit(
        v_org_id, 'members',
        (SELECT count(*) FROM members m WHERE m.organization_id = v_org_id));

      UPDATE members
      SET organization_id = v_org_id, branch_id = v_branch_id,
          activated_at = now(), activation_expires_at = NULL
      WHERE user_id = v_uid;
    ELSE
      INSERT INTO members (user_id, organization_id, branch_id, email, activated_at)
      VALUES (v_uid, v_org_id, v_branch_id, v_email, now());
    END IF;

    IF EXISTS (SELECT 1 FROM user_profiles WHERE id = v_uid) THEN
      UPDATE user_profiles
      SET organization_id = v_org_id, branch_id = v_branch_id, role = 'MEMBER'
      WHERE id = v_uid;
    ELSE
      INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname)
      VALUES (v_uid, v_org_id, v_branch_id, 'MEMBER',
              btrim(coalesce(p_name, split_part(coalesce(v_email, ''), '@', 1))),
              nullif(btrim(coalesce(p_surname, '')), ''));
    END IF;
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
