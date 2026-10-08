CREATE TABLE public.admin_email_allowlist (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)))
);

ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_email_allowlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_allowlist TO service_role;

CREATE OR REPLACE FUNCTION public.sync_admin_email_allowlist(p_emails text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_email_allowlist
  WHERE NOT (email = ANY(p_emails));

  INSERT INTO public.admin_email_allowlist (email)
  SELECT DISTINCT lower(btrim(email))
  FROM unnest(p_emails) AS configured(email)
  WHERE btrim(email) <> ''
  ON CONFLICT (email) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_admin_email_allowlist(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_admin_email_allowlist(text[]) TO service_role;

DROP FUNCTION IF EXISTS public.issue_admin_login_challenge(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.consume_admin_login_challenge(uuid, uuid, text);
DROP TABLE IF EXISTS public.admin_login_challenges;

CREATE TABLE public.admin_login_challenges (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz
);

CREATE TABLE public.verified_admin_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.admin_login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_challenges, public.verified_admin_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_challenges, public.verified_admin_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.issue_admin_login_challenge(
  p_session_id uuid,
  p_user_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  DELETE FROM public.admin_login_challenges WHERE expires_at <= now();
  DELETE FROM public.verified_admin_sessions WHERE expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.admin_login_challenges
    WHERE user_id = p_user_id AND issued_at > now() - interval '60 seconds'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_login_challenges (session_id, user_id, code_hash, expires_at)
  VALUES (p_session_id, p_user_id, p_code_hash, now() + interval '10 minutes')
  ON CONFLICT (session_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      code_hash = EXCLUDED.code_hash,
      issued_at = now(),
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      consumed_at = NULL;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_login_challenge(
  p_session_id uuid,
  p_user_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge public.admin_login_challenges%ROWTYPE;
  account_email text;
BEGIN
  SELECT * INTO challenge
  FROM public.admin_login_challenges
  WHERE session_id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR challenge.consumed_at IS NOT NULL
     OR challenge.expires_at <= now()
     OR challenge.attempts >= 5 THEN
    RETURN false;
  END IF;

  IF challenge.code_hash <> p_code_hash THEN
    UPDATE public.admin_login_challenges
    SET attempts = attempts + 1
    WHERE session_id = p_session_id;
    RETURN false;
  END IF;

  SELECT lower(btrim(email)) INTO account_email
  FROM auth.users
  WHERE id = p_user_id AND email_confirmed_at IS NOT NULL;

  IF account_email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_email_allowlist WHERE email = account_email
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.admin_login_challenges
  SET consumed_at = now()
  WHERE session_id = p_session_id;

  INSERT INTO public.verified_admin_sessions (session_id, user_id, expires_at)
  VALUES (p_session_id, p_user_id, now() + interval '8 hours')
  ON CONFLICT (session_id) DO UPDATE
  SET user_id = EXCLUDED.user_id, verified_at = now(), expires_at = EXCLUDED.expires_at;

  INSERT INTO public.profiles (id, display_name, role)
  SELECT id, COALESCE(raw_user_meta_data ->> 'display_name', ''), 'admin'
  FROM auth.users
  WHERE id = p_user_id
  ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = now();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_admin_login_challenge(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_admin_login_challenge(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_admin_login_challenge(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_admin_login_challenge(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN auth.users AS account ON account.id = profile.id
      JOIN public.admin_email_allowlist AS allowlist
        ON allowlist.email = lower(btrim(account.email))
      JOIN public.verified_admin_sessions AS verified
        ON verified.user_id = profile.id
       AND verified.session_id::text = auth.jwt() ->> 'session_id'
      WHERE profile.id = auth.uid()
        AND profile.role = 'admin'
        AND account.email_confirmed_at IS NOT NULL
        AND verified.expires_at > now()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = 'applicant');
