import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Role } from '../types';

export default function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useAuth();
  const loginPath = role === 'OWNER' ? '/owner/login' : '/login';
  if (!session || session.user.role !== role) {
    return <Navigate to={loginPath} replace />;
  }
  return <>{children}</>;
}
