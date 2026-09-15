-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- ⚠️ DESPLIEGUE ACOPLADO — LEER ANTES DE APLICAR ⚠️
-- Esta migración dropea `members_insert_self` y `members_update_self`, que son
-- las policies que sostienen el signup mobile ACTUAL. A partir de acá el alta
-- del socio pasa exclusivamente por link_member_by_code() (0015). Esta
-- migración y el build nuevo de apps/mobile tienen que salir JUNTOS, o el
-- registro de socios queda roto en el medio.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ ESTA MIGRACIÓN VA PRIMERA
--
-- En Postgres, varias policies PERMISSIVE sobre la misma tabla y el mismo
-- comando se combinan con OR. La más permisiva gana SIEMPRE. La base tiene
-- policies viejas con USING (true) sobre organizations y branches conviviendo
-- con organizations_select_own y branches_select_own_org (0008:128-141), que
-- están correctamente escritas y hoy NO HACEN NADA.
--
-- Efecto real hoy, verificado contra el volcado de producción:
--   organizations         -> cualquier autenticado lista TODAS las organizaciones
--   organizations         -> cualquier autenticado CREA organizaciones
--   branches              -> cualquier autenticado ve TODAS las sucursales
--   branches              -> cualquier autenticado inserta sucursales en cualquier org
--   gym_invitation_codes  -> RLS APAGADO: los códigos de todos los gimnasios
--                            quedan expuestos incluso SIN estar autenticado
--
-- Mientras esto siga así, el criterio de aceptación ("dos gimnasios no se ven
-- entre sí") es imposible de cumplir por más flujo nuevo que se construya
-- encima. Por eso va antes que todo lo demás.
--
-- Los helpers current_profile_org() / _branch() / _role() son los de 0007:39-67.

BEGIN;

-- =========================================================== organizations
-- Las dos permisivas que anulan a organizations_select_own.
DROP POLICY IF EXISTS "auth can select organizations" ON public.organizations;
DROP POLICY IF EXISTS "auth can insert organizations" ON public.organizations;

-- El INSERT de organizations queda SIN policy a propósito: crear un gimnasio
-- pasa a ser exclusivamente create_gym_with_owner() (0015), que es SECURITY
-- DEFINER y valida que el caller no tenga ya una organización. Un INSERT
-- suelto por REST no tiene por qué existir.

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = public.current_profile_org());

-- El owner edita su propia organización (nombre, ciudad, y el código en Pro).
DROP POLICY IF EXISTS organizations_update_owner ON public.organizations;
CREATE POLICY organizations_update_owner
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  )
  WITH CHECK (
    id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  );

-- ================================================================ branches
DROP POLICY IF EXISTS "auth can select branches" ON public.branches;
DROP POLICY IF EXISTS "auth can insert branches" ON public.branches;

DROP POLICY IF EXISTS branches_select_own_org ON public.branches;
CREATE POLICY branches_select_own_org
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_profile_org());

-- Al dropear la permisiva de INSERT el owner se quedaba sin poder crear
-- sucursales. Se repone acotado a su organización y a su rol.
DROP POLICY IF EXISTS branches_insert_owner ON public.branches;
CREATE POLICY branches_insert_owner
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  );

DROP POLICY IF EXISTS branches_update_owner ON public.branches;
CREATE POLICY branches_update_owner
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  )
  WITH CHECK (
    organization_id = public.current_profile_org()
    AND public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
  );

-- ==================================================== gym_invitation_codes
-- RLS estaba APAGADO. La policy gym_invitation_codes_select de 0004:21-26
-- existía pero era decorativa: sin RLS, la tabla se lee entera con la anon key.
ALTER TABLE public.gym_invitation_codes ENABLE ROW LEVEL SECURITY;

-- USING (true) -> acotada a la propia organización. Esta tabla queda en
-- desuso a partir de 0014 (el código se muda a organizations.invitation_code)
-- pero se conserva como respaldo del backfill, así que igual se protege.
DROP POLICY IF EXISTS gym_invitation_codes_select ON public.gym_invitation_codes;
CREATE POLICY gym_invitation_codes_select
  ON public.gym_invitation_codes
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_profile_org());

-- ================================================================= members
-- members_update_self (0004:39-45) dejaba que un socio reescribiera por REST
-- su propio organization_id, branch_id y activation_expires_at. O sea:
-- mudarse solo a cualquier gimnasio, y renovarse el vencimiento a sí mismo.
-- Un vencimiento que el socio puede editar no es un vencimiento.
DROP POLICY IF EXISTS members_update_self ON public.members;

-- members_insert_self (0004:29-34): crear el member pasa a ser exclusivo de
-- link_member_by_code() (0015), que valida el código, el límite del plan y
-- fuerza el rol. Un INSERT suelto se saltea las tres cosas.
DROP POLICY IF EXISTS members_insert_self ON public.members;

-- El socio necesita leer su propia fila (vencimiento, sucursal, organización).
DROP POLICY IF EXISTS members_select_self ON public.members;
CREATE POLICY members_select_self
  ON public.members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =================================================================== roles
-- Tenía RLS activo y CERO policies: nadie leía nada. Es catálogo global, no
-- lleva organization_id.
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================ body_metrics
-- RLS activo y cero policies: inaccesible. body_metrics.member_id apunta a
-- members.id (NO a auth.uid()), así que todo pasa por un EXISTS sobre members.
DROP POLICY IF EXISTS body_metrics_select_self ON public.body_metrics;
CREATE POLICY body_metrics_select_self
  ON public.body_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = body_metrics.member_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS body_metrics_insert_self ON public.body_metrics;
CREATE POLICY body_metrics_insert_self
  ON public.body_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = body_metrics.member_id AND m.user_id = auth.uid()
    )
  );

-- El staff ve las métricas de los socios de su organización. El trainer,
-- además, solo las de su sucursal — mismo criterio que members en 0008:70-80.
DROP POLICY IF EXISTS body_metrics_select_staff ON public.body_metrics;
CREATE POLICY body_metrics_select_staff
  ON public.body_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = body_metrics.member_id
        AND m.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND m.branch_id = public.current_profile_branch()
          )
        )
    )
  );

-- =========================================================== exercise_logs
-- OJO: hay DOS tablas de log conviviendo, y `member_id` significa cosas
-- distintas en cada una (ver docs/decisions.md):
--   exercise_log  (singular) -> member_id guarda auth.uid(); es la canónica,
--                               es la que usa la app hoy (0006). No se toca.
--   exercise_logs (plural)   -> member_id apunta a members.id; quedó con RLS
--                               activo y cero policies, o sea inaccesible.
-- Acá solo se le escriben policies a la plural, consistentes con SU semántica.
-- No se unifica ni se dropea nada en este bloque.
DROP POLICY IF EXISTS exercise_logs_select_self ON public.exercise_logs;
CREATE POLICY exercise_logs_select_self
  ON public.exercise_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS exercise_logs_insert_self ON public.exercise_logs;
CREATE POLICY exercise_logs_insert_self
  ON public.exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id AND m.user_id = auth.uid()
    )
  );

-- `logged_by` existe justamente porque el trainer puede cargar el registro
-- por el socio (el socio dicta el peso, el trainer lo anota).
DROP POLICY IF EXISTS exercise_logs_select_staff ON public.exercise_logs;
CREATE POLICY exercise_logs_select_staff
  ON public.exercise_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id
        AND m.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND m.branch_id = public.current_profile_branch()
          )
        )
    )
  );

DROP POLICY IF EXISTS exercise_logs_insert_staff ON public.exercise_logs;
CREATE POLICY exercise_logs_insert_staff
  ON public.exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    logged_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = exercise_logs.member_id
        AND m.organization_id = public.current_profile_org()
        AND (
          public.current_profile_role() IN ('GYM_OWNER', 'ADMIN')
          OR (
            public.current_profile_role() = 'TRAINER'
            AND m.branch_id = public.current_profile_branch()
          )
        )
    )
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICAR DESPUÉS DE APLICAR:
--   supabase/audit/tenant_isolation_audit.sql, chequeos 2 y 3.
-- El chequeo 3 no debe devolver ninguna fila: ya excluye exercise_catalog y
-- muscle_groups, que son catálogos globales abiertos a propósito (0008:143-158).
