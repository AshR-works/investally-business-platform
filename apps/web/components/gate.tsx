'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { AuthStatus, useAuth } from '../lib/auth-context';

const HOME_OF: Record<Exclude<AuthStatus, 'loading'>, string> = {
  anonymous: '/login',
  'mfa-enroll': '/mfa',
  'mfa-verify': '/mfa',
  ready: '/',
};

/** Laisse passer uniquement les états attendus ; sinon redirige vers l'écran qui correspond à l'état réel. Rien n'est rendu avant. */
export function Gate({ allow, children }: { allow: readonly Exclude<AuthStatus, 'loading'>[]; children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const allowed = status !== 'loading' && allow.includes(status);

  useEffect(() => {
    if (status !== 'loading' && !allowed) router.replace(HOME_OF[status]);
  }, [status, allowed, router]);

  if (status === 'loading') return <div className="center"><p role="status">Chargement…</p></div>;
  return allowed ? <>{children}</> : null;
}
