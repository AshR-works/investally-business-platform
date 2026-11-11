'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import { LEAVE_PAGES } from '../../lib/leave';
import { can, canAll } from '../../lib/permissions';

/** Les écrans de l'absence et des congés que le profil peut ouvrir, en barre d'onglets (le serveur re-contrôle chaque requête). */
export function LeaveNav({ current }: { current: (typeof LEAVE_PAGES)[number]['id'] }) {
  const { profile } = useAuth();
  const pages = LEAVE_PAGES.filter((p) => (p.allScope ? canAll(profile, p.permission) : can(profile, p.permission)));
  if (pages.length < 2) return null;
  return (
    <nav aria-label="Absences et congés" className="mb-6">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              href={p.href}
              aria-current={p.id === current ? 'page' : undefined}
              className={`inline-block rounded-full border px-4 py-1.5 text-[length:var(--text-sm)] font-semibold no-underline ${p.id === current ? 'border-transparent bg-brand-soft text-brand-strong' : 'border-transparent text-ink-2 hover:bg-surface-2'}`}
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
