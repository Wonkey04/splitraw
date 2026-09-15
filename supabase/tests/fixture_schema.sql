-- Réplica local del esquema de producción (volcado del brief) para poder
-- APLICAR y PROBAR las migraciones 0013-0017 antes de tocar Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE);

-- auth.uid() de Supabase, emulado con un GUC de sesión.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Los roles son del cluster, no de la base: idempotentes para poder recrear la db.
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $r$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  created_at timestamp DEFAULT now(), invitation_code_id uuid);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL, address text, created_at timestamp DEFAULT now());

CREATE TABLE roles (id serial PRIMARY KEY, name text, description text, created_at timestamp DEFAULT now());

-- Según el volcado: sin surname/phone/avatar_url. organization_id NOT NULL.
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid REFERENCES branches(id), role text NOT NULL,
  name text, created_at timestamp DEFAULT now());

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid REFERENCES branches(id), email text, phone text,
  date_of_birth date, created_at timestamp DEFAULT now(),
  activated_at timestamp, activation_expires_at timestamp);

CREATE TABLE gym_invitation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL, created_at timestamp DEFAULT now(), deleted_at timestamp);

CREATE TABLE muscle_groups (id serial PRIMARY KEY, name text, description text, created_at timestamp DEFAULT now());
CREATE TABLE exercise_catalog (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text,
  description text, muscle_group_id int REFERENCES muscle_groups(id), created_at timestamp DEFAULT now());

CREATE TABLE routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid REFERENCES branches(id), created_by uuid REFERENCES auth.users(id),
  name text NOT NULL, description text, created_at timestamp DEFAULT now());

CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  name text, description text, day_of_week int, target_sets int, target_reps int,
  target_weight_kg numeric, created_at timestamp DEFAULT now());

CREATE TABLE routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  routine_template_id uuid REFERENCES routine_templates(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(), created_at timestamp DEFAULT now());

CREATE TABLE exercise_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid, routine_id uuid, fecha date, completado boolean, created_at timestamp DEFAULT now());

CREATE TABLE exercise_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid, exercise_id uuid, member_id uuid REFERENCES members(id),
  logged_by uuid, weight_kg numeric, reps int, sets int, notes text,
  logged_at timestamptz DEFAULT now(), created_at timestamp DEFAULT now());

CREATE TABLE body_metrics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id), weight_kg numeric, height_cm numeric,
  body_fat_percentage numeric, measured_at date, created_at timestamp DEFAULT now());

CREATE TABLE trainer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  branch_id uuid NOT NULL REFERENCES branches(id), invited_by uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- Helpers de 0007.
CREATE FUNCTION public.current_profile_org() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ SELECT organization_id FROM user_profiles WHERE id = auth.uid() $$;
CREATE FUNCTION public.current_profile_branch() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ SELECT branch_id FROM user_profiles WHERE id = auth.uid() $$;
CREATE FUNCTION public.current_profile_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$ SELECT role FROM user_profiles WHERE id = auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.current_profile_org(), public.current_profile_branch(),
  public.current_profile_role() TO authenticated;

-- ===================== ESTADO ROTO DE HOY (lo que la 0013 viene a arreglar)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_invitations ENABLE ROW LEVEL SECURITY;
-- RLS activo y CERO policies:
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
-- RLS APAGADO a propósito: gym_invitation_codes (así está en producción).

-- Las cuatro permisivas que rompen el aislamiento.
CREATE POLICY "auth can select organizations" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert organizations" ON organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth can select branches" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can insert branches" ON branches FOR INSERT TO authenticated WITH CHECK (true);
-- Las acotadas que conviven con ellas y hoy no hacen nada (0008:128-141).
CREATE POLICY organizations_select_own ON organizations FOR SELECT TO authenticated USING (id = public.current_profile_org());
CREATE POLICY branches_select_own_org ON branches FOR SELECT TO authenticated USING (organization_id = public.current_profile_org());
-- 0004.
CREATE POLICY gym_invitation_codes_select ON gym_invitation_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY members_insert_self ON members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY members_update_self ON members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Policies del owner sobre sus datos (las que hacen andar el dashboard hoy).
CREATE POLICY members_select_org ON members FOR SELECT TO authenticated USING (organization_id = public.current_profile_org());
CREATE POLICY user_profiles_select_org ON user_profiles FOR SELECT TO authenticated USING (organization_id = public.current_profile_org());
CREATE POLICY rt_all_org ON routine_templates FOR ALL TO authenticated USING (organization_id = public.current_profile_org()) WITH CHECK (organization_id = public.current_profile_org());
CREATE POLICY routines_all_org ON routines FOR ALL TO authenticated USING (organization_id = public.current_profile_org()) WITH CHECK (organization_id = public.current_profile_org());
CREATE POLICY ex_all_org ON exercises FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM routine_templates rt WHERE rt.id = exercises.routine_template_id AND rt.organization_id = public.current_profile_org())) WITH CHECK (true);
CREATE POLICY cat_sel ON exercise_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY mg_sel ON muscle_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY ti_all ON trainer_invitations FOR ALL TO authenticated USING (organization_id = public.current_profile_org()) WITH CHECK (organization_id = public.current_profile_org());
CREATE POLICY el_self ON exercise_log FOR ALL TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
