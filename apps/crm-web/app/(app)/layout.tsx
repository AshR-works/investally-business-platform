'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Gate } from '../../components/gate';
import { useAuth } from '../../lib/auth-context';
import { can, roleLabel } from '../../lib/permissions';

/**
 * Cadre de toutes les pages connectées : n'affiche rien tant que l'utilisateur n'est pas authentifié avec son second
 * facteur.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Gate allow={['ready']}>
      <Shell>{children}</Shell>
    </Gate>
  );
}

/** Barre latérale (menus selon les droits, identité, déconnexion) et zone de contenu. */
function Shell({ children }: { children: ReactNode }) {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const links = [
    can(profile, 'bd.company.read') && { href: '/', label: 'Entreprises' },
    can(profile, 'iam.user.read') && { href: '/admin/users', label: 'Utilisateurs' },
    { href: '/account', label: 'Mon compte' },
  ].filter((link): link is { href: string; label: string } => !!link);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Investally CRM</div>
        <nav aria-label="Navigation principale">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>
          ))}
        </nav>
        <div className="who">
          <div>{profile?.displayName}</div>
          <div>{profile?.roles.map(roleLabel).join(', ')}</div>
          <button type="button" className="secondary small" style={{ marginTop: '.6rem' }} onClick={() => void logout()}>Se déconnecter</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
