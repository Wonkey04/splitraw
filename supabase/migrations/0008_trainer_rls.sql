-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Permisos del rol TRAINER (dashboard nuevo en /trainer). Hasta ahora
-- TRAINER existía solo como fila en `roles`, sin ninguna policy propia: un
-- trainer logueado no veía absolutamente nada.
--
-- Regla del brief, y por qué el filtro va acá y no solo en el cliente:
--   * organization_id: todo lo que ve/crea es de su gimnasio.
--   * branch_id: los MIEMBROS los ve SOLO de su sucursal asignada.
--   * NO puede invitar trainers, cambiar roles ni ver facturación.
--
-- Todas las policies de acá son ADITIVAS (se agregan a las que ya existen
-- para GYM_OWNER, que no se tocan: las policies se evalúan con OR).
-- Depende de los helpers current_profile_org()/branch()/role() de 0007.

-- ---------------------------------------------------------------- rutinas
DROP POLICY IF EXISTS routine_templates_select_trainer ON public.routine_templates;
CREATE POLICY routine_templates_select_trainer
  ON public.routine_templates
  FOR SELECT
  TO authenticated
  USING (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
  );

DROP POLICY IF EXISTS routine_templates_insert_trainer ON public.routine_templates;
CREATE POLICY routine_templates_insert_trainer
  ON public.routine_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
  );

-- Los ejercicios cuelgan del template: se validan contra la org del template
-- padre, no contra una columna propia (la tabla `exercises` no tiene
-- organization_id).
DROP POLICY IF EXISTS exercises_select_trainer ON public.exercises;
CREATE POLICY exercises_select_trainer
  ON public.exercises
  FOR SELECT
  TO authenticated
  USING (
    public.current_profile_role() = 'TRAINER'
    AND EXISTS (
      SELECT 1 FROM routine_templates rt
      WHERE rt.id = exercises.routine_template_id
        AND rt.organization_id = public.current_profile_org()
    )
  );

DROP POLICY IF EXISTS exercises_insert_trainer ON public.exercises;
CREATE POLICY exercises_insert_trainer
  ON public.exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_profile_role() = 'TRAINER'
    AND EXISTS (
      SELECT 1 FROM routine_templates rt
      WHERE rt.id = exercises.routine_template_id
        AND rt.organization_id = public.current_profile_org()
    )
  );

-- --------------------------------------------------------------- miembros
-- El filtro por sucursal vive acá: aunque el cliente pidiera todos los
-- members de la organización, la base le devuelve solo los de su branch.
DROP POLICY IF EXISTS members_select_trainer_branch ON public.members;
CREATE POLICY members_select_trainer_branch
  ON public.members
  FOR SELECT
  TO authenticated
  USING (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
    AND branch_id = public.current_profile_branch()
  );

-- Para mostrar el nombre del member: `members` no tiene nombre (se verificó
-- contra la base real), vive en user_profiles ligado por members.user_id.
DROP POLICY IF EXISTS user_profiles_select_trainer_branch ON public.user_profiles;
CREATE POLICY user_profiles_select_trainer_branch
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
    AND branch_id = public.current_profile_branch()
  );

-- ------------------------------------------------------------ asignación
DROP POLICY IF EXISTS routines_select_trainer ON public.routines;
CREATE POLICY routines_select_trainer
  ON public.routines
  FOR SELECT
  TO authenticated
  USING (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = routines.member_id
        AND m.branch_id = public.current_profile_branch()
    )
  );

DROP POLICY IF EXISTS routines_insert_trainer ON public.routines;
CREATE POLICY routines_insert_trainer
  ON public.routines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_profile_role() = 'TRAINER'
    AND organization_id = public.current_profile_org()
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = routines.member_id
        AND m.branch_id = public.current_profile_branch()
    )
  );

-- ------------------------------------------------- contexto de pantalla
-- Nombre del gimnasio en el header y sucursales del selector.
DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (id = public.current_profile_org());

DROP POLICY IF EXISTS branches_select_own_org ON public.branches;
CREATE POLICY branches_select_own_org
  ON public.branches
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_profile_org());

-- Catálogo global de ejercicios (no tiene organization_id: es compartido).
-- Sin esto la cascada Grupo Muscular -> Ejercicio le vendría vacía al trainer.
DROP POLICY IF EXISTS exercise_catalog_select_authenticated ON public.exercise_catalog;
CREATE POLICY exercise_catalog_select_authenticated
  ON public.exercise_catalog
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS muscle_groups_select_authenticated ON public.muscle_groups;
CREATE POLICY muscle_groups_select_authenticated
  ON public.muscle_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- NO se agrega ninguna policy que le permita a TRAINER:
--   * INSERT en trainer_invitations (0007 la limita a GYM_OWNER/ADMIN)
--   * UPDATE de user_profiles (no puede cambiar roles, ni el suyo)
--   * ver otra sucursal, ni datos de facturación/pricing.
