'use client';

import { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';
import { Gate } from '../../components/gate';

/**
 * Cadre de toutes les pages connectées : n'affiche rien tant que l'utilisateur n'est pas authentifié avec son second
 * facteur, puis place la page dans la coque (navigation, barre supérieure, panneau principal centré).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Gate allow={['ready']}>
      <AppShell>{children}</AppShell>
    </Gate>
  );
}
