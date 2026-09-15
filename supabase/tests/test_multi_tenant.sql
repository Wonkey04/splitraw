\set ON_ERROR_STOP on
\pset pager off
CREATE OR REPLACE FUNCTION chk(label text, got anyelement, want anyelement) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF got IS NOT DISTINCT FROM want THEN RAISE NOTICE 'PASS  % (=%)', label, got;
  ELSE RAISE EXCEPTION 'FAIL  %: obtuve % / esperaba %', label, got, want; END IF; END $$;

-- Cuatro usuarios de auth: dos dueños, dos socios.
INSERT INTO auth.users (id, email) VALUES
 ('11111111-1111-1111-1111-111111111111','ownerA@test.com'),
 ('22222222-2222-2222-2222-222222222222','ownerB@test.com'),
 ('33333333-3333-3333-3333-333333333333','socioA@test.com'),
 ('44444444-4444-4444-4444-444444444444','socioB@test.com');

-- ============================================ 1. Alta self-serve de dos gyms
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT set_config('t.codeA', (SELECT invitation_code FROM create_gym_with_owner('Gym A','Río Tercero','Córdoba','Sucursal Centro','Ana')), false);
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT set_config('t.codeB', (SELECT invitation_code FROM create_gym_with_owner('Gym B','Rosario','Santa Fe','Sucursal Norte','Beto')), false);
RESET ROLE;

SELECT chk('códigos de 8 caracteres', length(current_setting('t.codeA')), 8);
SELECT chk('códigos distintos', current_setting('t.codeA') = current_setting('t.codeB'), false);
SELECT chk('sin caracteres ambiguos', current_setting('t.codeA') ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$', true);
SELECT chk('dos organizaciones', (SELECT count(*)::int FROM organizations), 2);
SELECT chk('plan free por defecto', (SELECT count(DISTINCT plan)::int FROM organizations WHERE plan='free'), 1);
SELECT chk('una sucursal por gym', (SELECT count(*)::int FROM branches), 2);
SELECT chk('dos perfiles GYM_OWNER', (SELECT count(*)::int FROM user_profiles WHERE role='GYM_OWNER'), 2);

-- Transaccional: el guard de "ya tiene organización" corta sin dejar nada a medias.
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
DO $$ BEGIN
  PERFORM create_gym_with_owner('Gym A2','x','y','z','Ana');
  RAISE EXCEPTION 'FAIL: dejó crear una segunda organización';
EXCEPTION WHEN sqlstate 'P0001' THEN
  IF SQLERRM LIKE '%ALREADY_HAS_ORG%' THEN RAISE NOTICE 'PASS  guard ALREADY_HAS_ORG';
  ELSE RAISE; END IF; END $$;
RESET ROLE;
SELECT chk('no quedó organización huérfana', (SELECT count(*)::int FROM organizations), 2);

-- ==================================== 2. Aislamiento entre dueños (por REST)
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT chk('owner A ve SOLO su organización', (SELECT count(*)::int FROM organizations), 1);
SELECT chk('owner A ve solo su gym', (SELECT name FROM organizations), 'Gym A');
SELECT chk('owner A ve SOLO sus sucursales', (SELECT count(*)::int FROM branches), 1);
SELECT chk('owner A no ve códigos ajenos', (SELECT count(*)::int FROM organizations WHERE invitation_code = current_setting('t.codeB')), 0);
SELECT chk('owner A no puede insertar organizaciones sueltas',
  (SELECT count(*)::int FROM pg_policies WHERE tablename='organizations' AND cmd='INSERT'), 0);
RESET ROLE;

-- ==================================== 3. Vinculación de socios por código
SET ROLE authenticated; SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SELECT chk('socio A se vincula', (SELECT status FROM link_member_by_code(current_setting('t.codeA'), 'Socio A')), 'linked');
SELECT chk('reintento es idempotente', (SELECT status FROM link_member_by_code(current_setting('t.codeA'), 'Socio A')), 'already_linked');
SELECT chk('my_member_link devuelve el gym', (SELECT organization_name FROM my_member_link()), 'Gym A');
RESET ROLE;

SET ROLE authenticated; SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SELECT chk('código inválido no vincula', (SELECT status FROM link_member_by_code('ZZZZZZZZ','X')), 'invalid');
SELECT chk('sin vínculo, my_member_link vacío', (SELECT count(*)::int FROM my_member_link()), 0);
SELECT chk('socio B se vincula a B', (SELECT organization_name FROM link_member_by_code(current_setting('t.codeB'),'Socio B')), 'Gym B');
RESET ROLE;

SELECT chk('rol forzado a MEMBER', (SELECT count(*)::int FROM user_profiles WHERE role='MEMBER'), 2);
SELECT chk('cada socio en su gym',
  (SELECT count(*)::int FROM members m JOIN organizations o ON o.id=m.organization_id
   WHERE (m.email='socioA@test.com' AND o.name='Gym A') OR (m.email='socioB@test.com' AND o.name='Gym B')), 2);

-- El socio NO puede correrse su propio vencimiento ni mudarse de gimnasio.
SET ROLE authenticated; SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
UPDATE members SET activation_expires_at = now() + interval '999 days' WHERE user_id = auth.uid();
SELECT chk('socio NO puede auto-renovarse', (SELECT count(*)::int FROM members WHERE activation_expires_at IS NOT NULL), 0);
UPDATE members SET organization_id = (SELECT id FROM organizations WHERE name='Gym B') WHERE user_id = auth.uid();
SELECT chk('socio NO puede mudarse de gym', (SELECT organization_name FROM my_member_link()), 'Gym A');
SELECT chk('socio ve su propia fila', (SELECT count(*)::int FROM members), 1);
RESET ROLE;

-- ============================= 4. Rutinas: owner A no ve nada de owner B
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO routine_templates (organization_id, branch_id, created_by, name)
SELECT current_profile_org(), current_profile_branch(), auth.uid(), 'Upper Lower A';
RESET ROLE;
SET ROLE authenticated; SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
INSERT INTO routine_templates (organization_id, branch_id, created_by, name)
SELECT current_profile_org(), current_profile_branch(), auth.uid(), 'Full Body B';
SELECT chk('owner B ve SOLO su rutina', (SELECT count(*)::int FROM routine_templates), 1);
SELECT chk('owner B ve solo Full Body B', (SELECT name FROM routine_templates), 'Full Body B');
SELECT chk('owner B ve SOLO sus miembros', (SELECT count(*)::int FROM members), 1);
SELECT chk('owner B lista solo su socio', (SELECT email FROM members), 'socioB@test.com');
SELECT chk('list_org_members respeta el tenant', (SELECT count(*)::int FROM list_org_members()), 1);
RESET ROLE;

-- ========================================= 5. Límites de plan (en backend)
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
DO $$ BEGIN
  INSERT INTO branches (organization_id, name) VALUES (current_profile_org(), '2da sucursal');
  RAISE EXCEPTION 'FAIL: dejó crear la 2da sucursal en plan free';
EXCEPTION WHEN sqlstate 'P0001' THEN RAISE NOTICE 'PASS  límite sucursales: %', SQLERRM; END $$;
RESET ROLE;

-- 10 miembros es el tope de free: el 11º tiene que rebotar.
INSERT INTO members (user_id, organization_id, branch_id, email)
SELECT NULL, o.id, b.id, 'relleno'||g||'@t.com'
FROM organizations o JOIN branches b ON b.organization_id=o.id, generate_series(1,9) g
WHERE o.name='Gym A';
SELECT chk('Gym A llegó a 10 miembros', (SELECT count(*)::int FROM members m JOIN organizations o ON o.id=m.organization_id WHERE o.name='Gym A'), 10);
SET ROLE authenticated; SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
DO $$ BEGIN
  PERFORM set_config('t.st',(SELECT status FROM link_member_by_code(current_setting('t.codeA'),'X')),false);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
RESET ROLE;

-- Un socio nuevo contra un gym lleno: el trigger lo frena.
INSERT INTO auth.users (id,email) VALUES ('55555555-5555-5555-5555-555555555555','socioC@test.com');
SET ROLE authenticated; SET request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
SELECT chk('11º socio: limit_reached', (SELECT status FROM link_member_by_code(current_setting('t.codeA'),'C')), 'limit_reached');
SELECT chk('el mensaje nombra el límite y el plan que lo levanta',
  (SELECT message LIKE '%hasta 10 miembros%' AND message LIKE '%Pro permite 500%' FROM link_member_by_code(current_setting('t.codeA'),'C')), true);
RESET ROLE;
SELECT chk('no se creó el miembro de más', (SELECT count(*)::int FROM members m JOIN organizations o ON o.id=m.organization_id WHERE o.name='Gym A'), 10);

-- Pro levanta el techo de sucursales sin tocar nada más.
UPDATE organizations SET plan='pro' WHERE name='Gym A';
SET ROLE authenticated; SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO branches (organization_id, name) VALUES (current_profile_org(), '2da sucursal');
SELECT chk('en Pro sí entra la 2da sucursal', (SELECT count(*)::int FROM branches), 2);
RESET ROLE;
UPDATE organizations SET plan='free' WHERE name='Gym A';

-- =============================================== 6. Vencimiento del socio
SET ROLE authenticated; SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT set_config('t.mB',(SELECT m.id::text FROM members m JOIN organizations o ON o.id=m.organization_id WHERE o.name='Gym B'),false);
SELECT chk('renovar deja ~30 días',
  (SELECT round(extract(epoch FROM (renew_member(current_setting('t.mB')::uuid,30) - now()))/86400)::int), 30);
SELECT chk('renovar de nuevo EXTIENDE desde el vencimiento',
  (SELECT round(extract(epoch FROM (renew_member(current_setting('t.mB')::uuid,30) - now()))/86400)::int), 60);
RESET ROLE;

-- Un socio vencido arranca de HOY, no se le regalan los días sin pagar.
UPDATE members SET activation_expires_at = now() - interval '100 days' WHERE id = current_setting('t.mB')::uuid;
SET ROLE authenticated; SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT chk('vencido: renovar arranca de hoy',
  (SELECT round(extract(epoch FROM (renew_member(current_setting('t.mB')::uuid,30) - now()))/86400)::int), 30);
RESET ROLE;

UPDATE members SET activation_expires_at = now() - interval '1 day' WHERE id = current_setting('t.mB')::uuid;
SET ROLE authenticated; SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT chk('filtro vencidos', (SELECT count(*)::int FROM list_org_members(NULL,25,0,'expired')), 1);
SELECT chk('filtro activos', (SELECT count(*)::int FROM list_org_members(NULL,25,0,'active')), 0);
SELECT chk('sin filtro trae todo', (SELECT count(*)::int FROM list_org_members(NULL,25,0,NULL)), 1);
RESET ROLE;
-- El socio vencido NO queda bloqueado: sigue leyendo su vínculo.
SET ROLE authenticated; SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SELECT chk('vencido: is_expired = true', (SELECT is_expired FROM my_member_link()), true);
SELECT chk('vencido: SIGUE entrando', (SELECT organization_name FROM my_member_link()), 'Gym B');
RESET ROLE;

-- NULL no es "vencido", es "sin datos".
SET ROLE authenticated; SET request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SELECT chk('sin fecha NO es vencido', (SELECT is_expired FROM my_member_link()), false);
RESET ROLE;

-- ================================ 7. Ninguna policy abierta sobre tenant
SELECT chk('cero policies con USING/WITH CHECK = true',
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE'
    AND ((qual IS NOT NULL AND btrim(qual)='true') OR (with_check IS NOT NULL AND btrim(with_check)='true'))
    AND tablename NOT IN ('exercise_catalog','muscle_groups','roles','exercises')), 0);
SELECT chk('gym_invitation_codes con RLS activo',
  (SELECT relrowsecurity FROM pg_class WHERE relname='gym_invitation_codes'), true);
SELECT chk('cero tablas con RLS y sin policies',
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)), 0);

SELECT '════════ TODOS LOS CHEQUEOS PASARON ════════' AS resultado;
