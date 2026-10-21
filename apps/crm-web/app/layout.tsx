import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Investally CRM',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Structure HTML commune (langue française) et fournisseur d'authentification de toute l'application. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
