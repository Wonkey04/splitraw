-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Los planes existían como concepto pero no restringían nada: eran
-- decorativos. Acá pasan a tener efecto.
--
--   plan        sucursales   miembros   trainers
--   free                 1         10          3
--   pro                  3        500         10
--   enterprise         ilim.      ilim.      ilim.
--
-- POR QUÉ EN TRIGGERS DE POSTGRES Y NO EN LA UI
--
-- Esta app no tiene backend: el browser tiene la anon key y le escribe DIRECTO
-- a la base (apps/web/lib/supabase.ts:9-14). Un chequeo en el formulario es
-- una sugerencia — se saltea con un curl contra /rest/v1/members. El único
-- lugar donde "backend" existe de verdad es Postgres, así que el límite vive
-- en un trigger BEFORE INSERT y no hay forma de llegar a la tabla sin pasarle
-- por al lado.
--
-- El mensaje se escribe completo acá, en castellano, y viaja tal cual hasta la
-- pantalla: el cliente no tiene que saber los números para poder explicarlos.

BEGIN;

-- ------------------------------------------------------------- plan_limit
-- NULL = ilimitado. Devolver NULL en vez de un número enorme deja que el
-- chequeo sea "IF v_limit IS NOT NULL", sin números mágicos.
CREATE OR REPLACE FUNCTION public.plan_limit(p_plan text, p_resource text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE coalesce(p_plan, 'free')
    WHEN 'free' THEN CASE p_resource
      WHEN 'branches' THEN 1 WHEN 'members' THEN 10 WHEN 'trainers' THEN 3 END
    WHEN 'pro' THEN CASE p_resource
      WHEN 'branches' THEN 3 WHEN 'members' THEN 500 WHEN 'trainers' THEN 10 END
    WHEN 'enterprise' THEN NULL
    ELSE CASE p_resource
      -- Un plan desconocido se trata como free: ante la duda, el más chico.
      WHEN 'branches' THEN 1 WHEN 'members' THEN 10 WHEN 'trainers' THEN 3 END
  END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_limit(text, text) TO authenticated;

-- ------------------------------------------------------- mensaje de error
-- Un solo lugar arma el texto, así que los cuatro triggers dicen lo mismo.
-- Incluye QUÉ límite se alcanzó y QUÉ plan lo levanta, que es lo que el dueño
-- necesita para decidir; "límite alcanzado" a secas no le sirve a nadie.
CREATE OR REPLACE FUNCTION public.plan_limit_message(p_plan text, p_resource text, p_limit int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT format(
    'Límite del plan %s alcanzado: hasta %s %s.%s',
    coalesce(p_plan, 'free'),
    p_limit,
    -- Singular cuando el límite es 1: el plan free permite "1 sucursal",
    -- no "1 sucursales".
    CASE p_resource
      WHEN 'branches' THEN CASE WHEN p_limit = 1 THEN 'sucursal' ELSE 'sucursales' END
      WHEN 'members'  THEN CASE WHEN p_limit = 1 THEN 'miembro' ELSE 'miembros' END
      WHEN 'trainers' THEN CASE WHEN p_limit = 1 THEN 'entrenador' ELSE 'entrenadores' END
      ELSE p_resource END,
    CASE
      WHEN coalesce(p_plan, 'free') = 'free' THEN format(
        ' El plan Pro permite %s.', public.plan_limit('pro', p_resource))
      WHEN p_plan = 'pro' THEN ' El plan Enterprise no tiene límite.'
      ELSE '' END
  );
$$;

-- ------------------------------------------------------- chequeo genérico
-- Levanta P0001, que es el sqlstate que link_member_by_code() (0015) atrapa
-- para devolver status='limit_reached' con este mismo texto.
CREATE OR REPLACE FUNCTION public.assert_plan_limit(
  p_org_id uuid, p_resource text, p_current_count bigint
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan  text;
  v_limit int;
BEGIN
  SELECT o.plan INTO v_plan FROM organizations o WHERE o.id = p_org_id;
  v_limit := public.plan_limit(v_plan, p_resource);

  IF v_limit IS NOT NULL AND p_current_count >= v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = public.plan_limit_message(v_plan, p_resource, v_limit);
  END IF;
END;
$$;

-- =============================================================== branches
CREATE OR REPLACE FUNCTION public.enforce_branch_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_plan_limit(
    NEW.organization_id, 'branches',
    (SELECT count(*) FROM branches b WHERE b.organization_id = NEW.organization_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS branches_plan_limit ON public.branches;
CREATE TRIGGER branches_plan_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_limit();

-- ================================================================ members
CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_plan_limit(
    NEW.organization_id, 'members',
    (SELECT count(*) FROM members m WHERE m.organization_id = NEW.organization_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_plan_limit ON public.members;
CREATE TRIGGER members_plan_limit
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

-- =============================================================== trainers
-- El cupo se cuenta sobre user_profiles con role='TRAINER'. El WHEN del
-- trigger deja pasar sin costo los inserts de GYM_OWNER y MEMBER.
CREATE OR REPLACE FUNCTION public.enforce_trainer_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_plan_limit(
    NEW.organization_id, 'trainers',
    (SELECT count(*) FROM user_profiles up
     WHERE up.organization_id = NEW.organization_id AND up.role = 'TRAINER'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_trainer_plan_limit ON public.user_profiles;
CREATE TRIGGER user_profiles_trainer_plan_limit
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW WHEN (NEW.role = 'TRAINER')
  EXECUTE FUNCTION public.enforce_trainer_limit();

-- ==================================================== trainer_invitations
-- El mismo cupo, chequeado también al INVITAR y no solo al aceptar. Si solo
-- se validara en user_profiles, el owner mandaría el mail, el trainer elegiría
-- contraseña y recién ahí explotaría: el error le llegaría a la persona
-- equivocada, en el peor momento, y con una invitación ya quemada.
--
-- Cuentan los trainers existentes MÁS las invitaciones pendientes (no usadas
-- y no vencidas), que son cupo ya comprometido.
CREATE OR REPLACE FUNCTION public.enforce_trainer_invitation_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_plan_limit(
    NEW.organization_id, 'trainers',
    (SELECT count(*) FROM user_profiles up
      WHERE up.organization_id = NEW.organization_id AND up.role = 'TRAINER')
    + (SELECT count(*) FROM trainer_invitations ti
        WHERE ti.organization_id = NEW.organization_id
          AND ti.used_at IS NULL AND ti.expires_at > now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_invitations_plan_limit ON public.trainer_invitations;
CREATE TRIGGER trainer_invitations_plan_limit
  BEFORE INSERT ON public.trainer_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trainer_invitation_limit();

COMMIT;

-- ---------------------------------------------------------------------------
-- El cambio de plan es manual por ahora, no hay checkout ni pasarela:
--   UPDATE organizations SET plan = 'pro' WHERE id = '<uuid>';
--
-- VERIFICAR con una organización en 'free': la 2ª sucursal, el 11º miembro y
-- el 4º entrenador tienen que fallar con el mensaje completo. Probarlo también
-- por REST directo y no solo por la UI — ahí es donde se prueba que el límite
-- es de backend.
