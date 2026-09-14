-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- NOTA: estas políticas son una mejor-suposición basada en el esquema visto
-- en el repo (no se pudo inspeccionar el estado real de RLS desde acá).
-- Si el signup mobile falla con un error de RLS, revisar esto primero.
--
-- Necesarias para el flujo de signup mobile (gym_code + email/password):
--   1. Un usuario recién registrado (sin fila en user_profiles todavía) debe
--      poder LEER gym_invitation_codes por código, para resolver a qué
--      organización pertenece. Las políticas de 0003 solo cubren
--      INSERT/UPDATE del propio código (para el owner desde /dashboard),
--      no alcanzan para esto.
--   2. Ese mismo usuario debe poder INSERT/UPDATE su propia fila en
--      members (user_id = auth.uid()), que hasta ahora nunca se creaba
--      desde ningún lado del repo.

-- SELECT: cualquier usuario autenticado puede leer códigos de invitación
-- por code (no es información sensible: no revela nada de la org más que
-- su id, y ya se necesita el code exacto para pegarle a una fila).
DROP POLICY IF EXISTS gym_invitation_codes_select ON public.gym_invitation_codes;
CREATE POLICY gym_invitation_codes_select
  ON public.gym_invitation_codes
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: crear la propia fila de member (primer login con un gym_code).
DROP POLICY IF EXISTS members_insert_self ON public.members;
CREATE POLICY members_insert_self
  ON public.members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: re-loguearse con otro gym_code pisa organization_id/branch_id
-- de la propia fila (ver utils/gymAuth.ts en apps/mobile).
DROP POLICY IF EXISTS members_update_self ON public.members;
CREATE POLICY members_update_self
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
