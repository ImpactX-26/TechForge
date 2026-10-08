import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getVerifiedSessionClaims, hashAdminCode, parseAdminEmails } from '../_shared/admin-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Sign in before verifying admin access.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminEmails = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'));
  const pepper = Deno.env.get('ADMIN_OTP_PEPPER');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails || adminEmails.length === 0 || !pepper || pepper.length < 32) {
    console.error('Admin OTP verification is missing valid server-side configuration.');
    return jsonResponse({ error: 'Admin verification is not configured.' }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  const user = authData.user;
  const email = user.email?.trim().toLowerCase();
  if (!user.email_confirmed_at || !email || !adminEmails.includes(email)) {
    return jsonResponse({ error: 'Admin access is restricted to verified, configured admin accounts.' }, 403);
  }
  const claims = getVerifiedSessionClaims(authorization, user.id);
  if (!claims) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  if (!claims.hasPasswordMethod) {
    return jsonResponse({ error: 'Admin verification requires the account password first.' }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'A valid JSON request is required.' }, 400);
  }
  if (typeof body !== 'object' || body === null || !('code' in body)
      || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
    return jsonResponse({ error: 'Enter the six-digit verification code.' }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: syncError } = await serviceClient.rpc('sync_admin_email_allowlist', { p_emails: adminEmails });
  if (syncError) {
    console.error('Configured admin email allowlist could not be synchronized.', syncError);
    return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
  }
  const codeHash = await hashAdminCode(claims.sessionId, body.code, pepper);
  const { data: verified, error: verifyError } = await serviceClient.rpc('consume_admin_login_challenge', {
    p_session_id: claims.sessionId,
    p_user_id: user.id,
    p_code_hash: codeHash,
  });
  if (verifyError) {
    console.error('Admin verification code could not be checked.', verifyError);
    return jsonResponse({ error: 'Admin verification could not be completed.' }, 500);
  }
  if (verified !== true) return jsonResponse({ error: 'The code is invalid, expired, or already used.' }, 401);
  return jsonResponse({ role: 'admin' });
});
