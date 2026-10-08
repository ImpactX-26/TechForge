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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Reviewer sign-in is required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminEmails = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'));
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('EDUCARO_FROM_EMAIL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !adminEmails || adminEmails.length === 0) {
    console.error('Application review is missing required Supabase server-side secrets.');
    return jsonResponse({ error: 'Application review is not configured.' }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  const reviewerId = authData.user.id;
  const reviewerEmail = authData.user.email?.trim().toLowerCase();
  if (!authData.user.email_confirmed_at || !reviewerEmail || !adminEmails.includes(reviewerEmail)) {
    return jsonResponse({ error: 'Admin access is required.' }, 403);
  }
  if (!getVerifiedSessionClaims(authorization, reviewerId)) {
    return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: syncError } = await adminClient.rpc('sync_admin_email_allowlist', { p_emails: adminEmails });
  if (syncError) {
    console.error('Configured admin email allowlist could not be synchronized.', syncError);
    return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
  }
  const { data: reviewerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', reviewerId)
    .maybeSingle();
  if (profileError) {
    console.error('Reviewer role could not be checked.', profileError);
    return jsonResponse({ error: 'Reviewer access could not be verified.' }, 500);
  }
  if (reviewerProfile?.role !== 'admin') return jsonResponse({ error: 'Reviewer access is required.' }, 403);
  const { data: adminAuthorized, error: authorizationError } = await userClient.rpc('is_admin');
  if (authorizationError) {
    console.error('Reviewer second-factor authorization could not be checked.', authorizationError);
    return jsonResponse({ error: 'Reviewer access could not be verified.' }, 500);
  }
  if (adminAuthorized !== true) return jsonResponse({ error: 'Complete admin email verification to continue.' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'A valid JSON request is required.' }, 400);
  }
  if (!isRecord(body)
      || typeof body.applicationId !== 'string'
      || !['accepted', 'rejected'].includes(String(body.decision))
      || typeof body.note !== 'string'
      || body.note.trim().length < 5
      || body.note.trim().length > 2000) {
    return jsonResponse({ error: 'Choose an outcome and add a decision message of 5 to 2,000 characters.' }, 400);
  }

  const { data: application, error: applicationError } = await adminClient
    .from('applications')
    .select('id, user_id, name, goal, city')
    .eq('id', body.applicationId)
    .maybeSingle();
  if (applicationError || !application) {
    console.error('Application for reviewer decision could not be loaded.', applicationError);
    return jsonResponse({ error: 'The application could not be loaded.' }, 404);
  }

  const { error: saveError } = await adminClient
    .from('applications')
    .update({
      review_status: body.decision,
      review_note: body.note.trim(),
      status: body.decision === 'accepted' ? 'Accepted by reviewer' : 'Not accepted by reviewer',
      updated_at: new Date().toISOString(),
    })
    .eq('id', application.id);
  if (saveError) {
    console.error('Reviewer decision could not be saved.', saveError);
    return jsonResponse({ error: 'The decision could not be saved.' }, 500);
  }

  if (!resendApiKey || !fromEmail) {
    console.error('Decision saved, but Resend credentials are missing.');
    return jsonResponse({
      reviewStatus: body.decision,
      emailSent: false,
      message: 'The decision was saved, but email delivery is not configured. Add the Resend secrets and retry this decision to send the notice.',
    });
  }
  const { data: applicantResult, error: applicantError } = await adminClient.auth.admin.getUserById(application.user_id);
  const applicantEmail = applicantResult.user?.email;
  if (applicantError || !applicantEmail) {
    console.error('Decision saved, but applicant email address is unavailable.', applicantError);
    return jsonResponse({
      reviewStatus: body.decision,
      emailSent: false,
      message: 'The decision was saved, but the applicant email address could not be retrieved.',
    });
  }

  const decisionWord = body.decision === 'accepted' ? 'accepted' : 'not accepted';
  let emailResponse: Response;
  try {
    emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [applicantEmail],
        subject: `An update on your Educaro application`,
        text: `Hello ${application.name || 'applicant'},\n\nYour Educaro application has been ${decisionWord}.\n\nMessage from the reviewer:\n${body.note.trim()}\n\nThis decision relates to your Educaro application review. For next steps or questions, reply to this email.\n\nEducaro`,
      }),
    });
  } catch (error) {
    console.error('Decision email request could not reach Resend.', error);
    return jsonResponse({
      reviewStatus: body.decision,
      emailSent: false,
      message: 'The decision was saved, but the email could not be sent. Retry notification from this review card.',
    });
  }
  if (!emailResponse.ok) {
    console.error('Resend rejected the decision email.', emailResponse.status);
    return jsonResponse({
      reviewStatus: body.decision,
      emailSent: false,
      message: 'The decision was saved, but the email provider rejected the message. Retry notification from this review card.',
    });
  }
  return jsonResponse({ reviewStatus: body.decision, emailSent: true });
});
