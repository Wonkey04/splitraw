-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Bug real encontrado en producción al probar la baja de gimnasio (0023):
-- delete_organization_cascade() fallaba siempre con
-- "No podés cambiar tu rol, tu organización ni tu sucursal." al llegar al
-- UPDATE de user_profiles.
--
-- Causa: user_profiles_protect_scope() (0012) bloquea cualquier UPDATE que
-- cambie organization_id/branch_id/role cuando auth.uid() = OLD.id — pensado
-- para que un socio no se mude de gimnasio o se ascienda a sí mismo por
-- REST directo. El comentario original asumía que todo cambio legítimo de
-- scope vendría del service role (auth.uid() NULL, Edge Functions). Pero
-- delete_organization_cascade() SÍ corre con el auth.uid() del dueño (lo
-- necesita para validar que es SU organización) y su propia fila de
-- user_profiles es una de las que tiene que desvincular — auth.uid() = OLD.id
-- en ese preciso UPDATE, así que el trigger la frenaba a ella también.
--
-- Fix: un GUC de sesión que solo una función de servidor puede setear antes
-- de su propio UPDATE (un cliente por REST no puede mandar `SET LOCAL`
-- arbitrario en su request), y que el trigger chequea para dejar pasar ESE
-- UPDATE puntual sin abrir la puerta a nada más.

BEGIN;

CREATE OR REPLACE FUNCTION public.user_profiles_protect_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Los cambios hechos por el service role (Edge Functions, route handlers)
  -- no pasan por acá: auth.uid() es NULL en ese caso.
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RETURN NEW;
  END IF;

  -- delete_organization_cascade() desvincula al dueño de su PROPIA org como
  -- parte de la baja del gimnasio — el único caso legítimo en el que
  -- auth.uid() = OLD.id y el scope cambia a propósito.
  IF current_setting('app.bypass_scope_guard', true) = 'delete_organization_cascade' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'No podés cambiar tu rol, tu organización ni tu sucursal.';
  END IF;

  RETURN NEW;
END;
$$;

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

  DELETE FROM exercise_logs
  WHERE routine_id IN (SELECT id FROM routines WHERE organization_id = p_org_id);

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

  UPDATE members SET organization_id = NULL, branch_id = NULL WHERE organization_id = p_org_id;

  -- SET LOCAL: vive solo dentro de esta transacción, se limpia solo al
  -- terminar. user_profiles_protect_scope() lo lee para dejar pasar
  -- justamente este UPDATE, incluida la fila del propio dueño que llama.
  PERFORM set_config('app.bypass_scope_guard', 'delete_organization_cascade', true);
  UPDATE user_profiles SET organization_id = NULL, branch_id = NULL WHERE organization_id = p_org_id;
  PERFORM set_config('app.bypass_scope_guard', '', true);

  DELETE FROM branches WHERE organization_id = p_org_id;

  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_organization_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) TO authenticated;

COMMIT;
