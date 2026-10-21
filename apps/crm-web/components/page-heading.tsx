'use client';

import { useEffect } from 'react';

/**
 * Titre de page (`h1`) qui renseigne aussi le titre du document : le lecteur d'écran l'annonce à chaque changement
 * de page (WCAG 2.4.2) et l'onglet du navigateur dit où l'on se trouve. `title` remplace le texte du `h1` dans le
 * titre du document quand celui-ci ne suffit pas (ex. « Investally CRM » sur la page de connexion).
 */
export function PageHeading({ children, title }: { children: string; title?: string }) {
  const documentTitle = `${title ?? children} — Investally CRM`;
  useEffect(() => {
    document.title = documentTitle;
    // Après une navigation interne, Next.js remet son titre par défaut : on le rétablit s'il est remplacé.
    const observer = new MutationObserver(() => {
      if (document.title !== documentTitle) document.title = documentTitle;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [documentTitle]);
  return <h1>{children}</h1>;
}
