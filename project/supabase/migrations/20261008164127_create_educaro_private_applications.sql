/*
# Create secure Educaro applicant storage

1. New Tables
- `profiles`: one row per signed-in user; stores display name and server-controlled role.
- `applications`: private applicant journey data owned by the signed-in user.

2. Storage
- Creates the private `private-applicant-media` bucket for introduction videos.

3. Security
- Enables RLS on both tables.
- Applicants can only read and update their own application.
- Authorised reviewers with the `admin` role can review applicant records.
- Roles are created as `applicant` by a database trigger and are not client-writable.
- Video files are private and scoped to the signed-in user's folder.

4. Important Notes
- Admin access is determined by the server-side `profiles.role`, not by a browser value.
- The first reviewer account must be promoted to `admin` by an operator in the database after signup.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT 'Berlin',
  focus text NOT NULL DEFAULT 'Study',
  completion integer NOT NULL DEFAULT 0 CHECK (completion BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'Profile in progress',
  video_path text,
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND role = 'applicant');

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = 'applicant');

DROP POLICY IF EXISTS "profiles_delete_self" ON public.profiles;
CREATE POLICY "profiles_delete_self" ON public.profiles FOR DELETE TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "applications_select_owner_or_admin" ON public.applications;
CREATE POLICY "applications_select_owner_or_admin" ON public.applications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "applications_insert_owner" ON public.applications;
CREATE POLICY "applications_insert_owner" ON public.applications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "applications_update_owner_or_admin" ON public.applications;
CREATE POLICY "applications_update_owner_or_admin" ON public.applications FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "applications_delete_owner_or_admin" ON public.applications;
CREATE POLICY "applications_delete_owner_or_admin" ON public.applications FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

REVOKE UPDATE (role) ON public.profiles FROM authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('private-applicant-media', 'private-applicant-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "media_select_owner_or_admin" ON storage.objects;
CREATE POLICY "media_select_owner_or_admin" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'private-applicant-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "media_insert_owner" ON storage.objects;
CREATE POLICY "media_insert_owner" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'private-applicant-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "media_update_owner_or_admin" ON storage.objects;
CREATE POLICY "media_update_owner_or_admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'private-applicant-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()))
WITH CHECK (bucket_id = 'private-applicant-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

DROP POLICY IF EXISTS "media_delete_owner_or_admin" ON storage.objects;
CREATE POLICY "media_delete_owner_or_admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'private-applicant-media' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));