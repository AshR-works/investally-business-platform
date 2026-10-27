'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CODES_FILE_NAME, codesFileText } from '../../lib/secret-codes';
import { ConfirmDialog } from '../confirm-dialog';

/**
 * Codes de secours affichés UNE SEULE FOIS (EXD-13), avec copie, fichier texte et impression (« Enregistrer au format
 * PDF »). Partagé par l'activation de la vérification en deux étapes et la page « Mon compte ».
 *
 * - Les codes vivent uniquement en mémoire de la page : jamais dans le stockage du navigateur ni dans l'adresse.
 * - Tant que l'utilisateur n'a pas coché « J'ai conservé ces codes », quitter la page est signalé : fermeture ou
 *   rechargement (avertissement du navigateur) ET clic sur un lien interne (fenêtre de confirmation).
 * - Une fois l'écran quitté, rien ne permet de les revoir : il faut en générer de nouveaux.
 */
export function SecretCodesPanel({ codes, saved, onSavedChange }: { codes: string[]; saved: boolean; onSavedChange: (saved: boolean) => void }) {
  const router = useRouter();
  const [generatedAt] = useState(() => new Date());
  const [notice, setNotice] = useState('');
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const text = codesFileText(codes, generatedAt);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (saved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // `beforeunload` ne voit pas les liens internes de l'application : on les intercepte avant leur navigation.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${link.pathname}${link.search}${link.hash}`);
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', onClick, true);
    };
  }, [saved]);

  function copy() {
    void navigator.clipboard?.writeText(text).then(
      () => setNotice('Codes copiés. L’historique du presse-papiers de votre système peut les conserver : videz-le après les avoir rangés.'),
      () => setNotice('Copie impossible : utilisez le fichier ou l’impression.'),
    );
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = CODES_FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Fichier téléchargé. Rangez-le dans un gestionnaire de mots de passe, puis supprimez-le de vos téléchargements.');
  }

  /** Imprime uniquement le bloc des codes (feuille de style d'impression) ; « Enregistrer au format PDF » produit le PDF. */
  function print() {
    const done = () => {
      delete document.body.dataset.print;
      window.removeEventListener('afterprint', done);
    };
    document.body.dataset.print = 'codes';
    window.addEventListener('afterprint', done);
    window.print();
  }

  return (
    <>
      <div className="codes" role="group" aria-label="Codes de secours">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="row">
        <button type="button" className="secondary" onClick={copy}>Copier</button>
        <button type="button" className="secondary" onClick={download}>Télécharger (.txt)</button>
        <button type="button" className="secondary" onClick={print}>Imprimer ou enregistrer en PDF</button>
      </div>
      <p role="status" className="my-2 min-h-5 text-[length:var(--text-sm)] text-ink-2">{notice}</p>
      <label className="inline" style={{ margin: '1rem 0' }}>
        <input type="checkbox" checked={saved} onChange={(e) => onSavedChange(e.target.checked)} />
        J’ai conservé ces codes en lieu sûr
      </label>

      {pendingHref && (
        <ConfirmDialog
          title="Quitter sans avoir conservé vos codes ?"
          confirmLabel="Quitter quand même"
          cancelLabel="Rester sur cette page"
          onCancel={() => setPendingHref(null)}
          onConfirm={() => {
            const href = pendingHref;
            setPendingHref(null);
            onSavedChange(true);
            router.push(href);
          }}
        >
          <p className="m-0 mb-2"><strong>Ces codes ne seront plus jamais affichés.</strong></p>
          <p className="m-0">Si vous quittez maintenant sans les avoir copiés, téléchargés ou imprimés, vous devrez en générer de nouveaux.</p>
        </ConfirmDialog>
      )}

      {/* Bloc imprimé : porté à la racine du document, invisible à l'écran. Ni nom, ni adresse e-mail. */}
      {mounted && createPortal(
        <div className="codes-print" aria-hidden="true">
          <h1>Investally : codes de secours</h1>
          <p>Générés le {generatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p>Chaque code ne sert qu’une seule fois, si vous perdez votre application d’authentification. Rangez cette feuille en lieu sûr.</p>
          <ol>{codes.map((c) => <li key={c}>{c}</li>)}</ol>
        </div>,
        document.body,
      )}
    </>
  );
}
