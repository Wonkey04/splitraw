-- Run this in the Supabase SQL editor for this project (no CLI/migration
-- runner is wired up yet, so it isn't applied automatically).
--
-- Pantalla de Perfil para los tres roles (GYM_OWNER, TRAINER, MEMBER):
-- editar nombre, apellido y foto. Dos cosas que hoy no existen:
--   1. dónde guardar la foto -> bucket `avatars` de Storage
--   2. dónde guardar el link -> columna user_profiles.avatar_url

-- ------------------------------------------------------------- columna
-- TEXT y no una FK a storage.objects: lo que la app necesita pintar es una
-- URL, y el bucket es público de lectura (abajo). Si algún día la foto se
-- borra del bucket, acá queda una URL muerta y la UI cae al avatar con
-- iniciales — que es lo mismo que pasa hoy con avatar_url NULL.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ------------------------------------------------------ editar el perfil
-- Hasta ahora nadie hacía UPDATE sobre su propio user_profiles: los perfiles
-- se creaban (create-gym, accept_trainer_invitation) y nunca se tocaban. Sin
-- esta policy, la pantalla de Perfil guarda y no pasa nada.
--
-- El WITH CHECK repite el USING a propósito: sin él, un usuario podría
-- moverse de organización, de sucursal o ascenderse a GYM_OWNER con un
-- UPDATE directo por REST. La fila tiene que seguir siendo suya DESPUÉS del
-- update.
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Y como una policy de UPDATE no puede impedir que se cambien COLUMNAS
-- puntuales, el candado de rol/organización va en un trigger: el perfil es
-- editable por su dueño solo en los campos de datos personales.
CREATE OR REPLACE FUNCTION public.user_profiles_protect_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Los cambios hechos por el service role (Edge Functions, route handlers)
  -- no pasan por acá: auth.uid() es NULL en ese caso.
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'No podés cambiar tu rol, tu organización ni tu sucursal.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_protect_scope_trg ON public.user_profiles;
CREATE TRIGGER user_profiles_protect_scope_trg
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_protect_scope();

-- -------------------------------------------------------------- storage
-- Bucket público de LECTURA: las fotos de perfil se muestran en pantallas
-- donde el que mira no es el dueño de la foto (el owner ve a sus
-- entrenadores, el trainer a sus alumnos). Con un bucket privado habría que
-- firmar una URL por foto y por pantalla; no hay nada sensible en un avatar.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- La ESCRITURA sí es solo del dueño: las fotos se guardan en
-- `avatars/<auth.uid()>/<archivo>`, y las policies comparan la primera
-- carpeta del path contra el uid del que sube. Por eso la app NO puede
-- cambiar esa convención de path sin cambiar estas policies.
DROP POLICY IF EXISTS avatars_read_public ON storage.objects;
CREATE POLICY avatars_read_public
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------- perfil del MEMBER (mobile)
-- El socio de la app mobile puede NO tener fila en user_profiles: el signup
-- mobile crea `members` y no siempre el perfil (es la misma razón por la que
-- los listados hacen LEFT JOIN, ver 0009). Su pantalla de Perfil entonces a
-- veces tiene que CREAR la fila, no solo actualizarla.
--
-- Por qué una función y no una policy `user_profiles_insert_self`: una
-- policy de INSERT sobre user_profiles no puede fijar el `role`. Cualquiera
-- sin perfil podría insertarse uno con role 'GYM_OWNER' y el organization_id
-- de un gimnasio ajeno — y todos los permisos de la app salen justamente de
-- current_profile_role(). Acá el rol se fuerza a 'MEMBER' y la organización
-- y sucursal se copian de la fila de `members` del propio usuario: no hay
-- ningún dato de alcance que venga del cliente.
CREATE OR REPLACE FUNCTION public.save_member_profile(
  p_name text,
  p_surname text,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Necesitás una sesión.';
  END IF;

  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'El nombre es obligatorio.';
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()) THEN
    -- Ya tiene perfil: se tocan SOLO los datos personales. Ni rol, ni
    -- organización, ni sucursal.
    UPDATE user_profiles
       SET name = btrim(p_name),
           surname = btrim(coalesce(p_surname, '')),
           avatar_url = p_avatar_url
     WHERE id = auth.uid();
    RETURN;
  END IF;

  SELECT * INTO v_member FROM members WHERE user_id = auth.uid() LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos tu ficha de socio.';
  END IF;

  -- phone es NOT NULL y la pantalla de perfil no lo pide: mismo 0 que ya
  -- usan /create-gym y accept_trainer_invitation.
  INSERT INTO user_profiles (id, organization_id, branch_id, role, name, surname, phone, avatar_url)
  VALUES (
    auth.uid(),
    v_member.organization_id,
    v_member.branch_id,
    'MEMBER',
    btrim(p_name),
    btrim(coalesce(p_surname, '')),
    0,
    p_avatar_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_member_profile(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_member_profile(text, text, text) TO authenticated;
