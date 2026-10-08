CREATE TABLE public.admin_login_challenges (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL UNIQUE,
  code_hash text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at timestamptz
);

ALTER TABLE public.admin_login_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'aal' = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.issue_admin_login_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.admin_login_challenges
    WHERE user_id = p_user_id
      AND issued_at > now() - interval '60 seconds'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.admin_login_challenges (
    user_id,
    challenge_id,
    code_hash,
    issued_at,
    expires_at,
    attempts,
    consumed_at
  )
  VALUES (p_user_id, p_challenge_id, p_code_hash, now(), now() + interval '10 minutes', 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
  SET challenge_id = EXCLUDED.challenge_id,
      code_hash = EXCLUDED.code_hash,
      issued_at = EXCLUDED.issued_at,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      consumed_at = NULL;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_login_challenge(
  p_user_id uuid,
  p_challenge_id uuid,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge public.admin_login_challenges%ROWTYPE;
BEGIN
  SELECT *
  INTO challenge
  FROM public.admin_login_challenges
  WHERE user_id = p_user_id
    AND challenge_id = p_challenge_id
  FOR UPDATE;

  IF NOT FOUND
     OR challenge.consumed_at IS NOT NULL
     OR challenge.expires_at <= now()
     OR challenge.attempts >= 5 THEN
    RETURN false;
  END IF;

  IF challenge.code_hash = p_code_hash THEN
    UPDATE public.admin_login_challenges
    SET consumed_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;

  UPDATE public.admin_login_challenges
  SET attempts = attempts + 1
  WHERE user_id = p_user_id;
  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_admin_login_challenge(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_admin_login_challenge(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_admin_login_challenge(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_admin_login_challenge(uuid, uuid, text) TO service_role;
