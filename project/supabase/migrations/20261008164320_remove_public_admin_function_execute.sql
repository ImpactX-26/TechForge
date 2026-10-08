/*
# Remove public execution of reviewer helper

1. Security
- Revokes the default PUBLIC execute grant from the reviewer role helper.
- Grants execution only to signed-in users because protected RLS policies call it.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;