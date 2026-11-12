'use client';

import { PasswordField } from '../../../components/auth/password-field';
import { SecretCodesPanel } from '../../../components/auth/secret-codes-panel';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { PageHeading } from '../../../components/page-heading';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { passwordHints } from '../../../lib/password';
import { roleLabel } from '../../../lib/permissions';

/**
 * Page « Mon compte » : profil, changement de mot de passe, nouveaux codes de secours et accès aux sessions et à
 * l'historique des connexions de l'utilisateur connecté.
 */
export default function AccountPage() {
  const { profile } = useAuth();
  return (
    <>
      <PageHeading>Mon compte</PageHeading>
      <section className="panel">
        <h2>Profil</h2>
        <p><strong>{profile?.displayName}</strong><br />{profile?.email}</p>
        <p>{profile?.roles.map((r) => <span key={r} className="badge">{roleLabel(r)}</span>)}</p>
      </section>
      <PasswordForm email={profile?.email ?? ''} />
      <RecoveryCodes />
      <SessionsLink />
    </>
  );
}

/**
 * Formulaire de changement de mot de passe : indications en direct, confirmation obligatoire, message d'erreur du
 * serveur affiché tel quel.
 */
function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hints = passwordHints(next, email);

  /**
   * Envoie l'ancien et le nouveau mot de passe ; les champs sont vidés après succès (le serveur coupe les autres
   * sessions).
   */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setCurrent('');
      setNext('');
      setConfirmation('');
      setNotice('Mot de passe modifié.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Modification impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Changer le mot de passe</h2>
      <PasswordField label="Mot de passe actuel" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} autoComplete="new-password" />
      {next.length > 0 && hints.map((h) => <p key={h} className="hint bad">{h}</p>)}
      <PasswordField label="Confirmation" value={confirmation} onChange={setConfirmation} autoComplete="new-password" invalid={confirmation.length > 0 && confirmation !== next} />
      {confirmation.length > 0 && confirmation !== next && <p className="hint bad">Les deux mots de passe sont différents</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      <button type="submit" disabled={busy || hints.length > 0 || next !== confirmation || next.length === 0}>Modifier</button>
    </form>
  );
}

/**
 * Régénération des codes de secours : confirmation explicite d'abord (action irréversible), puis code MFA récent si
 * nécessaire, puis affichage UNIQUE des nouveaux codes (copie, fichier, impression). Une fois l'écran quitté, ils ne
 * peuvent plus être revus.
 */
function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Appelle la régénération et garde les codes en mémoire uniquement, jusqu'à ce que l'utilisateur ait terminé. */
  async function regenerate() {
    setConfirming(false);
    setError(null);
    setBusy(true);
    try {
      const result = await api<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes/regenerate', { method: 'POST' });
      setSaved(false);
      setCodes(result.recoveryCodes);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Régénération impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Codes de secours</h2>
      <p>Les codes de secours vous permettent de vous connecter si vous perdez votre application d’authentification. Chacun ne sert qu’une fois.</p>
      {!codes && <button type="button" className="secondary" disabled={busy} onClick={() => setConfirming(true)}>Générer de nouveaux codes</button>}
      {error && <p role="alert" className="error">{error}</p>}
      {codes && (
        <>
          <p className="hint"><strong>Affichés une seule fois</strong> : copiez-les, téléchargez-les ou imprimez-les avant de quitter cette page.</p>
          <SecretCodesPanel codes={codes} saved={saved} onSavedChange={setSaved} />
          <button type="button" disabled={!saved} onClick={() => { setCodes(null); setSaved(false); }}>Terminer</button>
        </>
      )}
      {confirming && (
        <ConfirmDialog title="Remplacer vos codes de secours ?" confirmLabel="Remplacer mes codes" onCancel={() => setConfirming(false)} onConfirm={() => void regenerate()}>
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            <li>Vos codes actuels seront <strong>invalidés immédiatement</strong> et ne fonctionneront plus.</li>
            <li>Cette action est <strong>irréversible</strong>.</li>
            <li>Les nouveaux codes ne seront affichés <strong>qu’une seule fois</strong> : enregistrez-les avant de quitter la page.</li>
          </ul>
          <p className="hint mb-0">Un code de votre application d’authentification peut vous être demandé.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

/** Lien vers la page « Sessions et connexions » (sessions actives, révocation, historique des connexions). */
function SessionsLink() {
  return (
    <section className="panel">
      <h2>Sessions et connexions</h2>
      <p className="hint">Consultez les appareils connectés à votre compte, déconnectez-en un ou tous les autres, et relisez l&apos;historique de vos connexions.</p>
      <Link href="/account/sessions">Voir mes sessions et mon historique</Link>
    </section>
  );
}
