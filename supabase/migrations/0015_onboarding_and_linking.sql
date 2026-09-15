-- Correr en el SQL editor de Supabase (no hay migration runner todavía).
--
-- Las dos altas self-serve del producto, cada una en UNA transacción:
--   create_gym_with_owner() -> el dueño crea su gimnasio desde /create-gym
--   link_member_by_code()   -> el socio se vincula desde /link-gym (mobile)
--
-- Por qué RPC y no inserts desde el cliente:
--
-- El alta del gimnasio eran CUATRO inserts secuenciales desde el browser
-- (create-gym/page.tsx:61,80,93,107). Si fallaba el tercero o el cuarto
-- quedaban un usuario de auth y una organización huérfanos, sin sucursal ni
-- perfil, y el segundo intento con el mismo email fallaba en signUp: el dueño
-- quedaba trabado sin forma de salir. Una función plpgsql YA ES una
-- transacción, así que no hace falta nada más que mover los inserts adentro.
--
-- Límite honesto: auth.signUp() no corre dentro de Postgres. El alta del
-- usuario de auth queda necesariamente fuera de la transacción. Todo lo demás
-- (organización + sucursal + perfil + código) es atómico.

BEGIN;

-- ---------------------------------------------------------------------------
-- Preparación: user_profiles se crea desde funciones que solo conocen el
-- nombre. El volcado de producción dice que la tabla es
-- (id, organization_id, branch_id, role, name, created_at), pero varias
-- migraciones aplicadas (0007:202, 0009:48, 0010:50, 0011:50, 0012:15)
-- escriben o leen surname / phone / avatar_url. Las dos cosas no pueden ser
-- ciertas a la vez — es la contradicción anotada en docs/decisions.md.
--
-- En vez de apostar a una de las dos lecturas: si esas columnas existen Y son
-- NOT NULL, se les relaja el NOT NULL. Así los INSERT de abajo funcionan en
-- los dos escenarios. Es no destructivo (no se borra ninguna columna ni dato)
-- y reversible. organization_id NO se toca: sigue NOT NULL, que es lo que
-- hace que un usuario sin vincular simplemente no tenga fila.
DO $$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['surname', 'phone'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_profiles'
        AND column_name = c AND is_nullable = 'NO'
    ) THEN
      EXECUTE format('ALTER TABLE public.user_profiles ALTER COLUMN %I DROP NOT NULL', c);
      RAISE NOTICE 'user_profiles.% pasó a nullable (existía y era NOT NULL)', c;
    END IF;
  END LOOP;
END $$;

-- ===================================================== create_gym_with_owner
-- Devuelve la organización creada y su código ya generado, para que el
-- dashboard pueda mostrarlo sin una segunda consulta.
CREATE OR REPLACE FUNCTION public.create_gym_with_owner(
  p_gym_name    text,
  p_city        text,
  p_province    text,
  p_branch_name text,
  p_owner_name  text
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- El guard va PRIMERO. Quien ya tiene organización no vuelve a ver esta
  -- pantalla nunca: user_profiles.organization_id es NOT NULL, así que la sola
  -- existencia de la fila alcanza como prueba de que ya está adentro de un
  -- gimnasio. Sin esto, un owner logueado que vuelve a /create-gym se crea una
  -- segunda organización y pierde la primera de vista.
  IF EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_uid) THEN
    RAISE EXCEPTION 'ALREADY_HAS_ORG';
  END IF;

  IF btrim(coalesce(p_gym_name, '')) = '' THEN
    RAISE EXCEPTION 'GYM_NAME_REQUIRED';
  END IF;
  IF btrim(coalesce(p_branch_name, '')) = '' THEN
    RAISE EXCEPTION 'BRANCH_NAME_REQUIRED';
  END IF;

  v_code := public.generate_invitation_code();

  INSERT INTO organizations (name, city, province, plan, invitation_code)
  VALUES (
    btrim(p_gym_name),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_province, '')), ''),
    'free',
    v_code
  )
  RETURNING id INTO v_org_id;

  -- La sucursal principal es la primera por created_at, y eso no es un
  -- detalle: link_member_by_code() y resolve_gym_code() eligen la sucursal
  -- del socio justamente así.
  INSERT INTO branches (organization_id, name)
  VALUES (v_org_id, btrim(p_branch_name))
  RETURNING id INTO v_branch_id;

  INSERT INTO user_profiles (id, organization_id, branch_id, role, name)
  VALUES (v_uid, v_org_id, v_branch_id, 'GYM_OWNER', btrim(coalesce(p_owner_name, '')));

  RETURN QUERY SELECT v_org_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gym_with_owner(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_gym_with_owner(text, text, text, text, text) TO authenticated;

-- ======================================================= link_member_by_code
-- El evento de vinculación, UNA sola vez en la vida del usuario. Hasta ahora
-- el código se pedía en cada login (apps/mobile/app/login.tsx:94-105) y, peor,
-- no se validaba contra nada: se resolvía, se cacheaba en AsyncStorage y nunca
-- se comparaba contra members.organization_id. A partir de acá el vínculo vive
-- en la base y el código no se vuelve a pedir.
--
-- `status` distingue los casos que la pantalla necesita separar:
--   'invalid'        -> código inexistente. Error en pantalla, sin salir.
--   'already_linked' -> idempotente: reintentar no duplica nada.
--   'limit_reached'  -> el gimnasio llegó al tope de su plan (trigger de 0016).
--   'linked'         -> adentro.
CREATE OR REPLACE FUNCTION public.link_member_by_code(
  p_code text,
  p_name text DEFAULT NULL
)
RETURNS TABLE(status text, organization_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_email     text;
  v_org_id    uuid;
  v_org_name  text;
  v_branch_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- Idempotente antes que nada: si ya hay vínculo, no se toca nada.
  SELECT o.id, o.name INTO v_org_id, v_org_name
  FROM members m JOIN organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN QUERY SELECT 'already_linked'::text, v_org_name, NULL::text;
    RETURN;
  END IF;

  SELECT o.id, o.name INTO v_org_id, v_org_name
  FROM organizations o
  WHERE o.invitation_code = upper(btrim(coalesce(p_code, '')));

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT b.id INTO v_branch_id
  FROM branches b WHERE b.organization_id = v_org_id
  ORDER BY b.created_at ASC LIMIT 1;

  IF v_branch_id IS NULL THEN
    -- Una organización sin sucursales no debería existir (create_gym_with_owner
    -- crea siempre una), pero si existe el socio no tiene dónde entrar.
    RETURN QUERY SELECT 'invalid'::text, NULL::text,
                        'Ese gimnasio todavía no tiene sucursales.'::text;
    RETURN;
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  BEGIN
    -- activated_at = ahora; activation_expires_at queda NULL a propósito.
    -- El vencimiento lo pone el dueño cuando cobra, con renew_member() (0017).
    -- NULL se lee como "sin datos", no como vencido: SplitRaw refleja el
    -- estado del pago, no lo decide.
    INSERT INTO members (user_id, organization_id, branch_id, email, activated_at)
    VALUES (v_uid, v_org_id, v_branch_id, v_email, now());

    -- El rol se FUERZA a 'MEMBER'; nunca sale de un parámetro. Si viniera por
    -- parámetro, cualquiera se insertaría un perfil GYM_OWNER en un gimnasio
    -- ajeno con solo conocer su código. Mismo criterio que save_member_profile
    -- en 0012.
    INSERT INTO user_profiles (id, organization_id, branch_id, role, name)
    VALUES (v_uid, v_org_id, v_branch_id, 'MEMBER',
            btrim(coalesce(p_name, split_part(coalesce(v_email, ''), '@', 1))))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN sqlstate 'P0001' THEN
      -- Lo levanta el trigger de límite de plan (0016). Se devuelve como
      -- estado y no como excepción para que la pantalla muestre el mensaje
      -- real ("hasta 10 miembros...") en vez de un error genérico.
      RETURN QUERY SELECT 'limit_reached'::text, v_org_name, SQLERRM::text;
      RETURN;
  END;

  -- Sin aprobación manual, a propósito: el código ya es el secreto compartido
  -- y el dueño ve al socio nuevo en su lista y puede darlo de baja. Confiar
  -- primero, moderar después — una cola de aprobación en el arranque frena
  -- al socio el día que se anota, que es el único día que tiene ganas.
  RETURN QUERY SELECT 'linked'::text, v_org_name, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.link_member_by_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_member_by_code(text, text) TO authenticated;

-- ============================================================ my_member_link
-- La ÚNICA consulta que necesita la bifurcación de arranque de la app móvil:
-- ¿este usuario tiene un vínculo de socio? Cero filas = mandarlo a /link-gym.
--
-- Es una función y no un select desde el cliente porque junta datos de tres
-- tablas (members, organizations, branches) que el socio no debería poder
-- recorrer sueltas, y porque devuelve exactamente lo que la pantalla necesita.
CREATE OR REPLACE FUNCTION public.my_member_link()
RETURNS TABLE(
  member_id             uuid,
  organization_id       uuid,
  organization_name     text,
  branch_id             uuid,
  branch_name           text,
  email                 text,
  activation_expires_at timestamp,
  is_expired            boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.organization_id, o.name, m.branch_id, b.name, m.email,
         m.activation_expires_at,
         -- El estado se CALCULA. No hay booleano que alguien tenga que
         -- acordarse de togglear: una fecha vencida es información objetiva,
         -- un flag manual es un recordatorio que nadie cumple.
         (m.activation_expires_at IS NOT NULL AND m.activation_expires_at < now())
  FROM members m
  JOIN organizations o ON o.id = m.organization_id
  LEFT JOIN branches b ON b.id = m.branch_id
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.my_member_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_member_link() TO authenticated;

-- ======================================================= email_is_registered
-- Estaba mal apuntada: 0005:52-62 consulta `members`, o sea "¿este email ya
-- está vinculado a un gimnasio?". Con el flujo viejo daba igual, porque no se
-- podía tener cuenta sin estar vinculado. Con el flujo nuevo ese estado es el
-- NORMAL — uno se registra y recién después se vincula — y la app le decía
-- "Email no registrado" a alguien que sí tenía cuenta, dejándolo afuera sin
-- forma de entrar. Pasa a consultar auth.users, que es la pregunta real.
CREATE OR REPLACE FUNCTION public.email_is_registered(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(btrim(check_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_is_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_registered(text) TO anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- resolve_gym_code() (0005) queda viva pero sin usuarios: el signup mobile ya
-- no pide código. No se dropea todavía — si alguna build vieja de la app sigue
-- en un teléfono, seguirla respondiendo es más barato que romperla.
