'use client';

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
      <label>Mot de passe actuel<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" maxLength={256} required /></label>
      <label>Nouveau mot de passe<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" maxLength={256} required /></label>
      {next.length > 0 && hints.map((h) => <p key={h} className="hint bad">{h}</p>)}
      <label>Confirmation<input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" maxLength={256} required /></label>
      {confirmation.length > 0 && confirmation !== next && <p className="hint bad">Les deux mots de passe sont différents</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      <button type="submit" disabled={busy || hints.length > 0 || next !== confirmation || next.length === 0}>Modifier</button>
    </form>
  );
}

/**
 * Génère de nouveaux codes de secours (les anciens cessent de fonctionner) et les affiche une seule fois ; un code
 * MFA récent est demandé si nécessaire.
 */
function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Appelle la régénération et garde les codes en mémoire uniquement, jusqu'à ce que l'utilisateur les masque. */
  async function regenerate() {
    setError(null);
    try {
      const result = await api<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes/regenerate', { method: 'POST' });
      setCodes(result.recoveryCodes);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Régénération impossible');
    }
  }

  return (
    <section className="panel">
      <h2>Codes de secours</h2>
      <p>Générer de nouveaux codes <strong>invalide les précédents</strong>. Une confirmation par code vous sera demandée.</p>
      <button type="button" className="secondary" onClick={() => void regenerate()}>Générer de nouveaux codes</button>
      {error && <p role="alert" className="error">{error}</p>}
      {codes && (
        <>
          <p className="hint">Affichés une seule fois : conservez-les en lieu sûr.</p>
          <div className="codes" aria-label="Nouveaux codes de secours">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <button type="button" className="secondary small" onClick={() => setCodes(null)}>Masquer</button>
        </>
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
