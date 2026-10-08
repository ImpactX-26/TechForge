import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseAnonKey !== 'sb_publishable_'
);

export const supabase = createClient(
  supabaseUrl || 'https://demo-project.supabase.co',
  supabaseAnonKey || 'demo-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type LocalAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'applicant' | 'admin';
  createdAt: string;
};

const localAccountsKey = 'educaro-local-accounts';
const localSessionKey = 'educaro-local-session';

export function getLocalAccounts(): LocalAccount[] {
  try {
    const raw = localStorage.getItem(localAccountsKey);
    return raw ? (JSON.parse(raw) as LocalAccount[]) : [];
  } catch {
    return [];
  }
}

export function setLocalAccounts(accounts: LocalAccount[]) {
  localStorage.setItem(localAccountsKey, JSON.stringify(accounts));
}

export function getLocalSession(): Session | null {
  try {
    const raw = localStorage.getItem(localSessionKey);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Session>;
    if (!saved?.user?.email) return null;
    return saved as Session;
  } catch {
    return null;
  }
}

export function setLocalSession(session: Session | null) {
  if (!session) {
    localStorage.removeItem(localSessionKey);
    return;
  }

  localStorage.setItem(localSessionKey, JSON.stringify(session));
}

export function createLocalSession(account: LocalAccount): Session {
  const session: Session = {
    access_token: `local-token-${account.id}`,
    refresh_token: `local-refresh-${account.id}`,
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365),
    token_type: 'bearer',
    user: {
      id: account.id,
      email: account.email,
      created_at: account.createdAt,
      updated_at: account.createdAt,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: { provider: 'local', role: account.role },
      user_metadata: { display_name: account.name },
      identities: [],
      factors: [],
    },
  } as Session;

  setLocalSession(session);
  return session;
}

export async function signUpLocalAccount({ email, password, name }: { email: string; password: string; name: string }) {
  const accounts = getLocalAccounts();
  const existing = accounts.find((account) => account.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    return { error: { message: 'This email is already registered. Please sign in instead.' } };
  }

  const account: LocalAccount = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    role: 'applicant',
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  setLocalAccounts(accounts);
  return { data: { session: createLocalSession(account) }, error: null };
}

export async function signInLocalAccount({ email, password }: { email: string; password: string }) {
  const account = getLocalAccounts().find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!account) {
    return { data: { user: null, session: null }, error: { message: 'Incorrect email or password.' } };
  }

  return { data: { user: createLocalSession(account).user, session: createLocalSession(account) }, error: null };
}

export async function signOutLocalAccount() {
  setLocalSession(null);
  return { error: null };
}
