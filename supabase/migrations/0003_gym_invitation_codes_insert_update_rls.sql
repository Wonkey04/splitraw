-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Sintoma: al tocar "Generar código" salta
--   "new row violates row-level security policy for table gym_invitation_codes"
-- El SELECT ya funciona (se puede leer el codigo), pero falta permitir el
-- INSERT (y el UPDATE, que usa el boton "Regenerar" para el soft-delete).
--
-- Regla: el usuario logueado solo puede crear/modificar el codigo de SU
-- propia organizacion. "Su" org = la que figura en su user_profiles
-- (user_profiles.id = auth.uid()).

-- INSERT: crear el codigo de la propia organizacion.
-- El UNIQUE(organization_id) ya evita que haya mas de un codigo por gym.
DROP POLICY IF EXISTS gym_invitation_codes_insert ON public.gym_invitation_codes;
CREATE POLICY gym_invitation_codes_insert
  ON public.gym_invitation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: necesario para "Regenerar" (setea deleted_at en el codigo viejo).
DROP POLICY IF EXISTS gym_invitation_codes_update ON public.gym_invitation_codes;
CREATE POLICY gym_invitation_codes_update
  ON public.gym_invitation_codes
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
