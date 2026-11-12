'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { can, canAll } from '../../lib/permissions';

export interface TabPage {
  id: string;
  label: string;
  href: string;
  permission: string;
  allScope: boolean;
}

/** Onglets d'un groupe d'écrans RH (contrats, parcours) : seuls ceux que le profil peut ouvrir sont proposés (le serveur re-contrôle chaque requête). */
export function PageTabs({ label, pages, current }: { label: string; pages: readonly TabPage[]; current: string }) {
  const { profile } = useAuth();
  const visible = pages.filter((p) => (p.allScope ? canAll(profile, p.permission) : can(profile, p.permission)));
  if (visible.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-6">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {visible.map((p) => (
          <li key={p.id}>
            <Link
              href={p.href}
              aria-current={p.id === current ? 'page' : undefined}
              className={`inline-block rounded-full border px-4 py-1.5 text-[length:var(--text-sm)] font-semibold no-underline ${p.id === current ? 'border-transparent bg-brand-soft text-brand-strong' : 'border-line-strong text-ink'}`}
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
