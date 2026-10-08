import { createContext, ReactNode, useContext, useState } from 'react';
import { api, clearSession, getSession, saveSession, Session } from './api';
import type { AuthUser } from './types';

interface AuthCtx {
  session: Session | null;
  signIn: (path: string, body: Record<string, string>) => Promise<AuthUser>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(getSession());

  async function signIn(path: string, body: Record<string, string>) {
    const r = await api.post<{ accessToken: string; user: AuthUser }>(path, body);
    const s: Session = { token: r.accessToken, user: r.user };
    saveSession(s);
    setSession(s);
    return s.user;
  }

  function signOut() {
    clearSession();
    setSession(null);
  }

  return <Ctx.Provider value={{ session, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
