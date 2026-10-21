'use client';

import { PageHeading } from '../../../../components/page-heading';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Modal } from '../../../../components/modal';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can, roleLabel, STATUS_LABELS } from '../../../../lib/permissions';
import type { Page, RoleView, UserView } from '../../../../lib/types';

const PAGE_SIZE = 20;

type Dialog =
  | { kind: 'invite' }
  | { kind: 'roles'; user: UserView }
  | { kind: 'confirm'; user: UserView; action: 'disable' | 'enable' | 'resetMfa' | 'revokeSessions' | 'resend' | 'resetPassword' };

const CONFIRM_TEXT: Record<'disable' | 'enable' | 'resetMfa' | 'revokeSessions' | 'resend' | 'resetPassword', { title: string; body: string; button: string; danger: boolean }> = {
  disable: { title: 'Désactiver le compte', body: 'La personne ne pourra plus se connecter et ses sessions seront coupées immédiatement.', button: 'Désactiver', danger: true },
  enable: { title: 'Réactiver le compte', body: 'La personne pourra de nouveau se connecter.', button: 'Réactiver', danger: false },
  resetMfa: { title: 'Réinitialiser le second facteur', body: 'La personne devra configurer de nouveau son application d’authentification à sa prochaine connexion.', button: 'Réinitialiser', danger: true },
  revokeSessions: { title: 'Couper toutes les sessions', body: 'La personne sera déconnectée partout, immédiatement.', button: 'Couper les sessions', danger: true },
  resetPassword: { title: 'Envoyer un lien de réinitialisation du mot de passe', body: 'Un lien (valable 48 h, usage unique) est envoyé à l’adresse e-mail de la personne. Son mot de passe actuel reste valable tant qu’elle n’a pas choisi le nouveau ; son second facteur est conservé. L’action est tracée.', button: 'Envoyer le lien', danger: false },
  resend: { title: 'Renvoyer l’invitation', body: 'Un nouveau lien (valable 48 h) est envoyé ; l’ancien cesse de fonctionner.', button: 'Renvoyer', danger: false },
};

/**
 * Page d'administration des utilisateurs : liste, recherche, filtre, pagination et actions (inviter, rôles,
 * désactiver, réinitialiser mot de passe ou MFA, couper les sessions). Chaque bouton dépend des droits ; le serveur
 * re-contrôle tout.
 */
export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Page<UserView>>({ items: [], total: 0 });
  const [roles, setRoles] = useState<RoleView[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canInvite = can(profile, 'iam.user.create');
  const canAssign = can(profile, 'iam.user.assign_role');
  const canDisable = can(profile, 'iam.user.disable');
  const canResetMfa = can(profile, 'iam.user.reset_mfa');
  const canResetPassword = can(profile, 'iam.user.reset_password');
  const canRevokeAll = profile?.permissions.some((g) => g.code === 'iam.session.revoke' && g.scope === 'ALL') ?? false;

  const canRead = can(profile, 'iam.user.read');
  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (status) params.set('status', status);
    try {
      setUsers(await api<Page<UserView>>(`/admin/users?${params.toString()}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [page, query, status, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!can(profile, 'iam.role.read')) return;
    api<RoleView[]>('/admin/roles').then(setRoles).catch(() => setRoles([]));
  }, [profile]);

  const pages = Math.max(1, Math.ceil(users.total / PAGE_SIZE));

  /**
   * Exécute une action d'administration, affiche son résultat (succès ou message du serveur), ferme la fenêtre et
   * recharge la liste.
   */
  async function run(action: () => Promise<unknown>, success: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      setDialog(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action impossible');
      setDialog(null);
    }
  }

  /** Associe chaque action de confirmation à son appel d'API et à son message de succès. */
  function confirmAction(user: UserView, action: 'disable' | 'enable' | 'resetMfa' | 'revokeSessions' | 'resend' | 'resetPassword') {
    const calls = {
      disable: () => api(`/admin/users/${user.id}/disable`, { method: 'POST' }),
      enable: () => api(`/admin/users/${user.id}/enable`, { method: 'POST' }),
      resetMfa: () => api(`/admin/users/${user.id}/mfa/reset`, { method: 'POST' }),
      revokeSessions: () => api(`/admin/users/${user.id}/sessions/revoke`, { method: 'POST' }),
      resend: () => api<{ emailSent: boolean }>(`/admin/users/${user.id}/invitations`, { method: 'POST' }),
      resetPassword: async () => {
        const result = await api<{ emailSent: boolean }>(`/admin/users/${user.id}/password-reset`, { method: 'POST' });
        if (!result.emailSent) throw new ApiError(502, 'EMAIL_NOT_SENT', 'Le lien est créé, mais l’e-mail n’a pas pu partir. Réessayez dans un instant.');
      },
    };
    const done = {
      disable: 'Compte désactivé', enable: 'Compte réactivé', resetMfa: 'Second facteur réinitialisé',
      revokeSessions: 'Sessions coupées', resend: 'Invitation renvoyée', resetPassword: 'Lien de réinitialisation envoyé',
    };
    void run(calls[action], done[action]);
  }

  if (!can(profile, 'iam.user.read')) {
    return (
      <>
        <PageHeading>Utilisateurs</PageHeading>
        <p role="alert">Accès refusé : votre profil ne permet pas d&apos;administrer les utilisateurs.</p>
      </>
    );
  }

  return (
    <>
      <div className="row between">
        <PageHeading>Utilisateurs</PageHeading>
        {canInvite && <button type="button" onClick={() => setDialog({ kind: 'invite' })}>Inviter un utilisateur</button>}
      </div>

      <form
        className="panel row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <label style={{ margin: 0, flex: 1, minWidth: 200 }}>
          Recherche (nom ou e-mail)
          <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} />
        </label>
        <label style={{ margin: 0 }}>
          Statut
          <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className="secondary" style={{ alignSelf: 'flex-end' }}>Rechercher</button>
      </form>

      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Rôles</th><th>Statut</th><th>MFA</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
          <tbody>
            {users.items.map((user) => (
              <tr key={user.id}>
                <td>{user.displayName}<br /><span className="hint">{user.email}</span></td>
                <td>{user.roles.length ? user.roles.map((r) => <span key={r} className="badge">{roleLabel(r)}</span>) : '—'}</td>
                <td><span className={`badge ${user.status === 'ACTIVE' ? 'ok' : user.status === 'PENDING' ? 'warn' : 'bad'}`}>{STATUS_LABELS[user.status]}</span></td>
                <td>{user.mfaEnabled ? 'Activé' : 'Non configuré'}</td>
                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}</td>
                <td>
                  <div className="row">
                    {canAssign && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'roles', user })}>Rôles</button>}
                    {canInvite && user.status === 'PENDING' && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'resend' })}>Renvoyer le lien</button>}
                    {canDisable && user.status !== 'DISABLED' && user.id !== profile?.userId && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'disable' })}>Désactiver</button>}
                    {canDisable && user.status === 'DISABLED' && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'enable' })}>Réactiver</button>}
                    {canResetPassword && (user.status === 'ACTIVE' || user.status === 'LOCKED') && user.id !== profile?.userId && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'resetPassword' })}>Réinitialiser le mot de passe</button>}
                    {canResetMfa && user.mfaEnabled && user.id !== profile?.userId && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'resetMfa' })}>Réinitialiser le MFA</button>}
                    {canRevokeAll && user.id !== profile?.userId && <button type="button" className="secondary small" onClick={() => setDialog({ kind: 'confirm', user, action: 'revokeSessions' })}>Couper les sessions</button>}
                  </div>
                </td>
              </tr>
            ))}
            {users.items.length === 0 && <tr><td colSpan={6}>Aucun utilisateur</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="row between" style={{ marginTop: '1rem' }}>
        <span className="hint">{users.total} utilisateur(s) — page {page} sur {pages}</span>
        <div className="row">
          <button type="button" className="secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <button type="button" className="secondary small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      </div>

      {dialog?.kind === 'invite' && (
        <InviteDialog
          roles={roles}
          managers={users.items.filter((u) => u.status === 'ACTIVE')}
          onClose={() => setDialog(null)}
          onSubmit={(body) => run(async () => {
            const result = await api<{ emailSent: boolean }>('/admin/users', { method: 'POST', body });
            if (!result.emailSent) throw new ApiError(502, 'EMAIL_NOT_SENT', 'Compte créé, mais l’e-mail n’a pas pu partir. Utilisez « Renvoyer le lien ».');
          }, 'Invitation envoyée')}
        />
      )}
      {dialog?.kind === 'roles' && (
        <RolesDialog
          user={dialog.user}
          roles={roles}
          onClose={() => setDialog(null)}
          onSubmit={(codes) => run(() => api(`/admin/users/${dialog.user.id}/roles`, { method: 'PUT', body: { roles: codes } }), 'Rôles mis à jour')}
        />
      )}
      {dialog?.kind === 'confirm' && (
        <Modal title={CONFIRM_TEXT[dialog.action].title} onClose={() => setDialog(null)}>
          <p><strong>{dialog.user.displayName}</strong> ({dialog.user.email})</p>
          <p>{CONFIRM_TEXT[dialog.action].body}</p>
          <div className="row end">
            <button type="button" className="secondary" onClick={() => setDialog(null)}>Annuler</button>
            <button type="button" className={CONFIRM_TEXT[dialog.action].danger ? 'danger' : ''} onClick={() => confirmAction(dialog.user, dialog.action)}>{CONFIRM_TEXT[dialog.action].button}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Cases à cocher des rôles, avec leur description. */
function RoleChoices({ roles, selected, onToggle }: { roles: RoleView[]; selected: string[]; onToggle: (code: string) => void }) {
  return (
    <fieldset>
      <legend>Rôles</legend>
      {roles.map((role) => (
        <label key={role.code} className="inline" style={{ marginBottom: '.4rem' }}>
          <input type="checkbox" checked={selected.includes(role.code)} onChange={() => onToggle(role.code)} />
          <span><strong>{roleLabel(role.code)}</strong><br /><span className="hint">{role.description}</span></span>
        </label>
      ))}
    </fieldset>
  );
}

/** Ajoute le code à la liste s'il n'y est pas, le retire sinon (sans modifier la liste d'origine). */
function toggle(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
}

/** Fenêtre d'invitation : adresse, nom, rôles et responsable facultatif. */
function InviteDialog({ roles, managers, onClose, onSubmit }: {
  roles: RoleView[];
  managers: UserView[];
  onClose: () => void;
  onSubmit: (body: { email: string; displayName: string; roles: string[]; managerId?: string }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [managerId, setManagerId] = useState('');
  const [busy, setBusy] = useState(false);

  /** Envoie l'invitation avec les rôles cochés (au moins un). */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await onSubmit({ email: email.trim(), displayName: displayName.trim(), roles: selected, ...(managerId ? { managerId } : {}) });
    setBusy(false);
  }

  return (
    <Modal title="Inviter un utilisateur" onClose={onClose}>
      <form onSubmit={submit}>
        <label>Adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required /></label>
        <label>Nom affiché<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={200} required /></label>
        <RoleChoices roles={roles} selected={selected} onToggle={(code) => setSelected(toggle(selected, code))} />
        <label>
          Responsable direct (facultatif)
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Aucun</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
          </select>
        </label>
        <p className="hint">La personne reçoit un lien valable 48 h pour choisir son mot de passe, puis configure son second facteur.</p>
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy || selected.length === 0}>Envoyer l’invitation</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Fenêtre de modification des rôles d'un utilisateur ; le changement s'applique immédiatement, y compris aux sessions
 * ouvertes.
 */
function RolesDialog({ user, roles, onClose, onSubmit }: {
  user: UserView;
  roles: RoleView[];
  onClose: () => void;
  onSubmit: (codes: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>(user.roles);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Rôles de ${user.displayName}`} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSubmit(selected);
          setBusy(false);
        }}
      >
        <RoleChoices roles={roles} selected={selected} onToggle={(code) => setSelected(toggle(selected, code))} />
        <p className="hint">Le changement s’applique immédiatement, y compris aux sessions déjà ouvertes.</p>
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy || selected.length === 0}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}
