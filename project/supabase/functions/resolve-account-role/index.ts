import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getVerifiedSessionClaims, parseAdminEmails } from '../_shared/admin-auth.ts';

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
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Sign in with the emailed code first.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminEmails = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'));
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails) {
    console.error('Account-role resolution requires valid Supabase credentials and ADMIN_EMAILS configuration.');
    return jsonResponse({ error: 'Account access is not configured. Please contact support.' }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  if (!user.email || !user.email_confirmed_at) {
    return jsonResponse({ error: 'Verify your email before accessing your account.' }, 403);
  }
  const verifiedEmail = user.email.trim().toLowerCase();
  const isConfiguredAdmin = adminEmails.includes(verifiedEmail);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: syncError } = await serviceClient.rpc('sync_admin_email_allowlist', { p_emails: adminEmails });
  if (syncError) {
    console.error('Configured admin email allowlist could not be synchronized.', syncError);
    return jsonResponse({ error: 'Account access could not be resolved. Please try again.' }, 500);
  }

  let role: 'admin' | 'applicant' = 'applicant';
  if (isConfiguredAdmin) {
    const claims = getVerifiedSessionClaims(authorization, user.id);
    if (!claims) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
    if (!claims.hasPasswordMethod) {
      return jsonResponse({ error: 'Admin access requires your password and email verification code.', adminOtpRequired: true }, 403);
    }
    const { data: verifiedSession, error: verifiedSessionError } = await serviceClient
      .from('verified_admin_sessions')
      .select('session_id')
      .eq('session_id', claims.sessionId)
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (verifiedSessionError) {
      console.error('Admin second-factor session could not be checked.', verifiedSessionError);
      return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
    }
    if (!verifiedSession) {
      return jsonResponse({ error: 'Complete email verification to access the admin workspace.', adminOtpRequired: true }, 403);
    }
    role = 'admin';
  }

  const { error: profileError } = await serviceClient.from('profiles')
    .upsert({
      id: user.id,
      display_name: typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : '',
      role,
    }, { onConflict: 'id' });
  if (profileError) {
    console.error('Verified account role could not be saved.', profileError);
    return jsonResponse({ error: 'Account access could not be saved. Please try again.' }, 500);
  }

  return jsonResponse({ role });
});
