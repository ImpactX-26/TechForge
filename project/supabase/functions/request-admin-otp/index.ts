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
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Sign in before requesting admin verification.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminEmails = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'));
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('EDUCARO_FROM_EMAIL');
  const pepper = Deno.env.get('ADMIN_OTP_PEPPER');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails || adminEmails.length === 0 || !resendApiKey || !fromEmail || !pepper || pepper.length < 32) {
    console.error('Admin OTP is missing valid server-side configuration.');
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
    return jsonResponse({ error: 'Verify the account password before requesting the admin email code.' }, 403);
  }

  const codeBytes = crypto.getRandomValues(new Uint32Array(1));
  const code = String(codeBytes[0] % 1_000_000).padStart(6, '0');
  const codeHash = await hashAdminCode(claims.sessionId, code, pepper);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: issued, error: issueError } = await serviceClient.rpc('issue_admin_login_challenge', {
    p_session_id: claims.sessionId,
    p_user_id: user.id,
    p_code_hash: codeHash,
  });
  if (issueError) {
    console.error('Admin OTP challenge could not be issued.', issueError);
    return jsonResponse({ error: 'Admin verification could not be started.' }, 500);
  }
  if (issued !== true) return jsonResponse({ error: 'Wait one minute before requesting another admin code.' }, 429);

  let mailResponse: Response;
  try {
    mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Your Educaro admin verification code',
        text: `Your Educaro admin verification code is ${code}. It expires in 10 minutes. If you did not request this code, secure your account immediately.`,
      }),
    });
  } catch (error) {
    console.error('Admin OTP email request could not reach Resend.', error);
    return jsonResponse({ error: 'The verification email could not be sent. Wait one minute before retrying.' }, 502);
  }
  if (!mailResponse.ok) {
    console.error('Resend rejected the admin OTP email.', mailResponse.status);
    return jsonResponse({ error: 'The verification email could not be sent. Wait one minute before retrying.' }, 502);
  }
  return jsonResponse({ codeSent: true });
});
