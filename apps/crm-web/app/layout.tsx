import type { ReactNode } from 'react';

export const metadata = { title: 'Investally CRM' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem auto', maxWidth: 720, padding: '0 1rem' }}>
        {children}
      </body>
    </html>
  );
}
