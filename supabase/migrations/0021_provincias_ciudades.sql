-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Brief 1 (registro de gimnasio): organizations.city/province son texto
-- libre desde 0014, sin catálogo ni validación — cualquiera podía escribir
-- cualquier cosa. Se agrega el catálogo real (provincias/ciudades) con FK
-- desde organizations (no desde branches: la ciudad/provincia del gimnasio
-- vive en organizations, ver 0014_organizations_tenant_columns.sql; branches
-- solo tiene name/address).
--
-- Seed inicial: Córdoba -> Río Tercero, que es la única combinación
-- habilitada en el selector por ahora (el resto se muestra deshabilitado
-- con "Próximamente" en el cliente, no hace falta cargarlo acá).
--
-- Las columnas de texto city/province NO se tocan: siguen existiendo y
-- create_gym_with_owner las sigue llenando (derivadas del catálogo cuando
-- se manda p_ciudad_id), para no romper nada que ya las lea (el subtítulo
-- del dashboard, por ejemplo).

BEGIN;

CREATE TABLE IF NOT EXISTS public.provincias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ciudades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provincia_id UUID NOT NULL REFERENCES public.provincias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ciudades_provincia_nombre_key UNIQUE (provincia_id, nombre)
);

CREATE INDEX IF NOT EXISTS ciudades_provincia_id ON public.ciudades (provincia_id);

INSERT INTO public.provincias (nombre) VALUES ('Córdoba')
  ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.ciudades (provincia_id, nombre)
  SELECT p.id, 'Río Tercero' FROM public.provincias p WHERE p.nombre = 'Córdoba'
  ON CONFLICT (provincia_id, nombre) DO NOTHING;

-- Catálogo de solo lectura para cualquier autenticado: no tiene datos de
-- ningún gimnasio, es la misma lista para todos (igual que muscle_groups).
ALTER TABLE public.provincias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciudades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provincias_select_all ON public.provincias;
CREATE POLICY provincias_select_all ON public.provincias FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS ciudades_select_all ON public.ciudades;
CREATE POLICY ciudades_select_all ON public.ciudades FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON public.provincias TO authenticated, anon;
GRANT SELECT ON public.ciudades TO authenticated, anon;

-- organizations: FK opcional al catálogo. Nullable y sin backfill de las
-- filas existentes (su city/province de texto libre no necesariamente
-- matchea un nombre del catálogo) — no se inventa a qué ciudad pertenecían.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS provincia_id UUID REFERENCES public.provincias(id),
  ADD COLUMN IF NOT EXISTS ciudad_id UUID REFERENCES public.ciudades(id);

-- ===================================================== create_gym_with_owner
-- Suma p_ciudad_id y p_branch_address. Los p_city/p_province de texto se
-- mantienen (compatibilidad y fallback), pero si viene p_ciudad_id se
-- derivan de ahí y pisan lo que se haya mandado a mano: la fuente de verdad
-- pasa a ser el catálogo, no lo que el cliente tipeó.
DROP FUNCTION IF EXISTS public.create_gym_with_owner(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_gym_with_owner(
  p_gym_name       text,
  p_city           text,
  p_province       text,
  p_branch_name    text,
  p_owner_name     text,
  p_ciudad_id      uuid DEFAULT NULL,
  p_branch_address text DEFAULT NULL
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

  INSERT INTO user_profiles (id, organization_id, branch_id, role, name)
  VALUES (v_uid, v_org_id, v_branch_id, 'GYM_OWNER', btrim(coalesce(p_owner_name, '')));

  RETURN QUERY SELECT v_org_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gym_with_owner(text, text, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_gym_with_owner(text, text, text, text, text, uuid, text) TO authenticated;

COMMIT;
