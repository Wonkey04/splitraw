-- Auditoría de aislamiento multi-tenant — SOLO LECTURA.
--
-- Correr en el SQL editor de Supabase ANTES y DESPUÉS de aplicar las
-- migraciones 0013-0017. Ninguna consulta de acá escribe nada.
--
-- Existe porque el repo no tiene baseline de esquema: las migraciones
-- arrancan en 0001 asumiendo tablas creadas a mano, así que el estado real
-- de RLS no se puede deducir leyendo el repo. Ver docs/decisions.md.


-- ---------------------------------------------------------------- 0. Paso 0
-- Resuelve la contradicción entre el volcado y el repo: ¿user_profiles tiene
-- surname / phone / avatar_url, y son NOT NULL? De esto depende si el alta
-- del dueño puede dejar de mandar esas columnas.
SELECT '0. columnas de user_profiles' AS chequeo;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles'
ORDER BY ordinal_position;


-- ------------------------------------------------------- 1. RLS por tabla
-- rowsecurity = false es una tabla abierta a cualquiera con la anon key.
SELECT '1. RLS activo por tabla' AS chequeo;
SELECT c.relname AS tabla,
       c.relrowsecurity AS rls_activo,
       count(p.policyname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;


-- ------------------------------ 2. RLS activo y CERO policies = inaccesible
-- Con RLS prendido y sin una sola policy, nadie lee ni escribe nada. No es
-- "seguro": es una tabla muerta, y el síntoma se confunde con un bug de app.
SELECT '2. RLS activo y cero policies (tabla inaccesible)' AS chequeo;
SELECT c.relname AS tabla
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;


-- ------------------------------------------- 3. Policies permisivas abiertas
-- EL CHEQUEO CENTRAL. Varias policies PERMISSIVE sobre la misma tabla y el
-- mismo comando se combinan con OR: una sola con USING (true) anula a todas
-- las acotadas por organización que convivan con ella.
--
-- Esperado DESPUÉS de 0013: solo exercise_catalog y muscle_groups, que son
-- catálogos globales y están abiertos a propósito.
SELECT '3. Policies abiertas (qual/with_check = true)' AS chequeo;
SELECT tablename, policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
  -- Se compara solo la cláusula que APLICA a cada comando. Un policy de
  -- SELECT tiene with_check NULL y uno de INSERT tiene qual NULL: tratar ese
  -- NULL como "true" marcaría abierta toda policy bien acotada.
  AND ((qual IS NOT NULL AND btrim(qual) = 'true')
       OR (with_check IS NOT NULL AND btrim(with_check) = 'true'))
  -- Catálogos globales, abiertos a autenticados a propósito (0008:143-158).
  AND tablename NOT IN ('exercise_catalog', 'muscle_groups', 'roles')
ORDER BY tablename, cmd, policyname;


-- ------------------------------------------- 4. Tablas sin organization_id
-- Toda tabla con datos de gimnasio debería poder filtrarse por organización,
-- sea con columna propia o a través de su padre. Las que no tienen columna
-- quedan listadas acá con su FK de acceso, para decidir caso por caso:
--   exercises        -> cuelga de routine_templates.organization_id
--   exercise_log     -> cuelga de members / routines
--   exercise_logs    -> cuelga de members / routines
--   body_metrics     -> cuelga de members.organization_id
--   exercise_catalog -> global a propósito
--   muscle_groups    -> global a propósito
--   roles            -> global a propósito
SELECT '4. Tablas sin columna organization_id' AS chequeo;
SELECT c.relname AS tabla
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.table_name = c.relname
      AND col.column_name = 'organization_id'
  )
ORDER BY c.relname;


-- --------------------------- 5. organization_id que admite NULL
-- Una fila con organization_id NULL no matchea ninguna policy de tenant y
-- queda invisible para todos, incluido su propio dueño.
SELECT '5. organization_id nullable' AS chequeo;
SELECT table_name AS tabla, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'organization_id'
  AND is_nullable = 'YES'
ORDER BY table_name;


-- ------------------------------------------------- 6. Inventario de policies
SELECT '6. Inventario completo de policies' AS chequeo;
SELECT tablename, policyname, cmd, permissive, roles::text, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- ------------------------------------- 7. Estado del código de vinculación
-- Después de 0014 toda organización debería tener invitation_code. Antes,
-- esta consulta muestra de dónde sale el backfill.
SELECT '7. Códigos por organización' AS chequeo;
SELECT o.id, o.name,
       gic.code AS codigo_tabla_vieja,
       gic.deleted_at,
       to_regclass('public.organizations') IS NOT NULL AS ok
FROM organizations o
LEFT JOIN gym_invitation_codes gic ON gic.organization_id = o.id
ORDER BY o.created_at;
