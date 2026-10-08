import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseAdminEmails } from '../_shared/admin-auth.ts';

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
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'Sign in before opening admin review.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const admins = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'));
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !admins || admins.length === 0) {
    console.error('Admin review is missing valid Supabase configuration or ADMIN_EMAILS.');
    return jsonResponse({ error: 'Admin review is not configured.' }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'Your sign-in session is invalid or expired.' }, 401);
  const user = authData.user;
  const verifiedEmail = user.email?.trim().toLowerCase();
  if (!user.email_confirmed_at || !verifiedEmail || !admins.includes(verifiedEmail)) {
    return jsonResponse({ error: 'Admin access is required.' }, 403);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: syncError } = await serviceClient.rpc('sync_admin_email_allowlist', { p_emails: admins });
  if (syncError) {
    console.error('Configured admin email allowlist could not be synchronized.', syncError);
    return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
  }
  const { data: profile, error: profileError } = await serviceClient.from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Admin role could not be checked.', profileError);
    return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
  }
  if (profile?.role !== 'admin') return jsonResponse({ error: 'Admin access is required.' }, 403);
  const { data: adminAuthorized, error: authorizationError } = await userClient.rpc('is_admin');
  if (authorizationError) {
    console.error('Admin second-factor authorization could not be checked.', authorizationError);
    return jsonResponse({ error: 'Admin access could not be verified.' }, 500);
  }
  if (adminAuthorized !== true) return jsonResponse({ error: 'Complete admin email verification to continue.' }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'A valid JSON request is required.' }, 400);
  }
  if (!isRecord(body) || (body.action !== 'list' && body.action !== 'document-link')) {
    return jsonResponse({ error: 'Choose a supported admin review action.' }, 400);
  }

  if (body.action === 'document-link') {
    if (typeof body.storagePath !== 'string' || body.storagePath.length > 300) {
      return jsonResponse({ error: 'A valid document reference is required.' }, 400);
    }
    const { data, error } = await serviceClient.storage.from('private-applicant-documents')
      .createSignedUrl(body.storagePath, 60);
    if (error || !data?.signedUrl) {
      console.error('Admin document link could not be created.', error);
      return jsonResponse({ error: 'The secure document link could not be created.' }, 500);
    }
    return jsonResponse({ signedUrl: data.signedUrl });
  }

  const [{ data: applications, error: applicationsError }, { data: documents, error: documentsError }] = await Promise.all([
    serviceClient.from('applications')
      .select('id, user_id, name, goal, city, completion, status, review_status, review_note, updated_at, profile_data')
      .order('updated_at', { ascending: false }),
    serviceClient.from('applicant_documents')
      .select('id, user_id, document_type, storage_path, file_name, mime_type, file_size, ai_analysis, uploaded_at')
      .order('uploaded_at', { ascending: false }),
  ]);
  if (applicationsError || documentsError) {
    console.error('Admin applicant data could not be loaded.', applicationsError ?? documentsError);
    return jsonResponse({ error: 'Applicant review data could not be loaded.' }, 500);
  }
  return jsonResponse({ applications: applications ?? [], documents: documents ?? [] });
});
