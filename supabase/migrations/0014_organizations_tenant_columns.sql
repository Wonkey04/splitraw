-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- El código de vinculación se muda de gym_invitation_codes a una columna de
-- organizations. Tres razones:
--
--   1. El código es un ATRIBUTO de la organización, no una entidad con vida
--      propia. La tabla aparte ya tenía UNIQUE(organization_id), o sea que
--      nunca hubo más de uno por gimnasio: era una relación 1-a-1 disfrazada.
--   2. El plan Pro pide que el dueño pueda EDITAR su código. Editar una
--      columna es un UPDATE; con la tabla aparte había que decidir si se
--      pisaba la fila o se insertaba otra.
--   3. Arregla un bug real: "Regenerar" hacía soft-delete (deleted_at) e
--      INSERT de una fila nueva para la misma organización, lo que choca
--      contra ese UNIQUE(organization_id) de 0001:5. El insert fallaba con
--      23505, lib/invitationCode.ts lo interpretaba como colisión de código,
--      reintentaba 5 veces y se rendía — dejando al gimnasio SIN código
--      activo, porque el viejo ya había quedado marcado como borrado.
--
-- gym_invitation_codes NO se dropea: queda como respaldo del backfill.
-- organizations.invitation_code_id tampoco se toca.

BEGIN;

-- ------------------------------------------------------------------ plan
-- Los planes existían como concepto de producto pero no como dato. Sin esta
-- columna los límites de 0016 no tienen contra qué validar.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_plan_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_plan_check
      CHECK (plan IN ('free', 'pro', 'enterprise'));
  END IF;
END $$;

-- -------------------------------------------------------------- ubicación
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS province text;

-- --------------------------------------------------------------- código
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invitation_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_invitation_code_key'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_invitation_code_key UNIQUE (invitation_code);
  END IF;
END $$;

-- Formato: mayúsculas y dígitos, SIN caracteres ambiguos (excluidos I, O, 0
-- y 1) porque el código se dicta en voz alta en el mostrador del gimnasio.
--
-- El rango es 6-8, no 8 fijo, a propósito: los códigos de 6 caracteres que ya
-- se repartieron en el gimnasio piloto tienen que seguir funcionando. Los
-- nuevos son de 8. Un CHECK de longitud exacta invalidaría de golpe códigos
-- ya entregados a socios que todavía no se registraron.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_invitation_code_format'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_invitation_code_format
      CHECK (invitation_code IS NULL
             OR invitation_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$');
  END IF;
END $$;

-- ------------------------------------------------------------- generador
-- 8 caracteres con gen_random_bytes, no con random(). El generador viejo
-- (lib/invitationCode.ts:15) usaba Math.random() en el browser: predecible, y
-- el código es el único secreto que separa a un gimnasio de otro.
--
-- El charset tiene exactamente 32 caracteres, así que `byte % 32` reparte
-- uniforme (256 es múltiplo de 32) — sin sesgo de módulo.
CREATE OR REPLACE FUNCTION public.generate_invitation_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charset  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_length   constant int  := 8;
  v_attempts constant int  := 10;
  v_code     text;
  v_bytes    bytea;
  i          int;
  j          int;
BEGIN
  FOR i IN 1..v_attempts LOOP
    v_code := '';
    v_bytes := gen_random_bytes(v_length);
    FOR j IN 0..(v_length - 1) LOOP
      v_code := v_code || substr(v_charset, (get_byte(v_bytes, j) % 32) + 1, 1);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM organizations o WHERE o.invitation_code = v_code
    ) THEN
      RETURN v_code;
    END IF;
  END LOOP;

  -- Con 32^8 (~1.1 billones) combinaciones, 10 colisiones seguidas no es mala
  -- suerte: es un bug. Mejor fallar ruidoso que devolver un código repetido.
  RAISE EXCEPTION 'No se pudo generar un código de vinculación único tras % intentos', v_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invitation_code() FROM PUBLIC;
-- Nadie la llama desde el cliente: la usan create_gym_with_owner() (0015) y
-- el backfill de acá abajo.

-- -------------------------------------------------------------- backfill
-- 1. Traer el código vigente de la tabla vieja. Se prefiere el que no está
--    soft-deleted; si no hay ninguno vigente se toma el más reciente, porque
--    un código repartido y marcado como borrado igual está en manos de socios.
UPDATE public.organizations o
SET invitation_code = src.code
FROM (
  SELECT DISTINCT ON (gic.organization_id)
         gic.organization_id, upper(btrim(gic.code)) AS code
  FROM gym_invitation_codes gic
  WHERE gic.code ~ '^[A-Za-z0-9]{6,8}$'
  ORDER BY gic.organization_id,
           (gic.deleted_at IS NULL) DESC,
           gic.created_at DESC
) src
WHERE src.organization_id = o.id
  AND o.invitation_code IS NULL
  -- Un código viejo con caracteres ambiguos no pasaría el CHECK. En ese caso
  -- se deja NULL y el paso 2 le genera uno nuevo.
  AND src.code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6,8}$';

-- 2. Toda organización sin código se queda con uno generado. Después de esto
--    no puede quedar ninguna en NULL: sin código, nadie puede vincularse.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM organizations WHERE invitation_code IS NULL LOOP
    UPDATE organizations
    SET invitation_code = public.generate_invitation_code()
    WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICAR: no debe devolver ninguna fila.
--   SELECT id, name FROM organizations WHERE invitation_code IS NULL;
