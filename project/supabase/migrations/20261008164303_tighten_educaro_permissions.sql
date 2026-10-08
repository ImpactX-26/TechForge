/*
# Tighten Educaro database permissions

1. Changes
- Removes anonymous API access from private applicant tables.
- Removes direct API execution of the account-created trigger function.
- Keeps the signed-in reviewer check available for protected RLS policies.

2. Security
- Applicant and profile data can only be reached by authenticated users through RLS.
- The trigger helper is callable only by the database trigger path.
*/

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.applications FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;