-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Elimina el sistema viejo de codigos de invitacion (uno POR MIEMBRO).
-- gym_invitation_codes (0001) ya es la unica fuente de verdad: un codigo
-- permanente por organizacion.

-- 1. Sacar la referencia desde members hacia el sistema viejo.
ALTER TABLE members DROP COLUMN IF EXISTS invitation_code_id;

-- 2. Dropear la tabla vieja, ya no la usa ningun codigo del repo.
DROP TABLE IF EXISTS invitation_codes;
