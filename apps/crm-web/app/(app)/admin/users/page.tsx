'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { DataTable, type Column } from '../../../../components/data/data-table';
import { EntityCell } from '../../../../components/data/entity-cell';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { SelectionBar } from '../../../../components/data/selection-bar';
import { QuickFilters, SearchField, Toolbar } from '../../../../components/data/toolbar';
import { Icon } from '../../../../components/icon';
import { Modal } from '../../../../components/modal';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can, roleLabel } from '../../../../lib/permissions';
import { statusStyle, USER_STATUS } from '../../../../lib/status';
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  /** Actions possibles sur un compte, selon les droits de l'utilisateur connecté (le serveur re-contrôle tout). */
  function rowActions(user: UserView) {
    const other = user.id !== profile?.userId;
    const items: { key: string; label: string; danger?: boolean; run: () => void }[] = [];
    if (canAssign) items.push({ key: 'roles', label: 'Modifier les rôles', run: () => setDialog({ kind: 'roles', user }) });
    if (canInvite && user.status === 'PENDING') items.push({ key: 'resend', label: 'Renvoyer le lien', run: () => setDialog({ kind: 'confirm', user, action: 'resend' }) });
    if (canResetPassword && other && (user.status === 'ACTIVE' || user.status === 'LOCKED')) items.push({ key: 'resetPassword', label: 'Réinitialiser le mot de passe', run: () => setDialog({ kind: 'confirm', user, action: 'resetPassword' }) });
    if (canResetMfa && other && user.mfaEnabled) items.push({ key: 'resetMfa', label: 'Réinitialiser le MFA', run: () => setDialog({ kind: 'confirm', user, action: 'resetMfa' }) });
    if (canRevokeAll && other) items.push({ key: 'revokeSessions', label: 'Couper les sessions', danger: true, run: () => setDialog({ kind: 'confirm', user, action: 'revokeSessions' }) });
    if (canDisable && other && user.status !== 'DISABLED') items.push({ key: 'disable', label: 'Désactiver', danger: true, run: () => setDialog({ kind: 'confirm', user, action: 'disable' }) });
    if (canDisable && user.status === 'DISABLED') items.push({ key: 'enable', label: 'Réactiver', run: () => setDialog({ kind: 'confirm', user, action: 'enable' }) });
    if (items.length === 0) return null;
    return (
      <RowActions label={`Actions pour ${user.displayName}`}>
        {items.map((item) => <RowAction key={item.key} danger={item.danger} onClick={item.run}>{item.label}</RowAction>)}
      </RowActions>
    );
  }

  const columns: Column<UserView>[] = [
    { id: 'user', header: 'Utilisateur', cell: (u) => <EntityCell name={u.displayName} subtitle={u.email} round /> },
    { id: 'roles', header: 'Rôles', cell: (u) => (u.roles.length ? <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r}>{roleLabel(r)}</Badge>)}</div> : <span className="text-ink-2">—</span>) },
    { id: 'status', header: 'Statut', cell: (u) => { const st = statusStyle(USER_STATUS, u.status); return <Badge tone={st.tone}>{st.label}</Badge>; } },
    { id: 'mfa', header: 'MFA', cell: (u) => <Badge tone={u.mfaEnabled ? 'ok' : 'warn'}>{u.mfaEnabled ? 'Activé' : 'Non configuré'}</Badge> },
    { id: 'last', header: 'Dernière connexion', cell: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : 'Jamais') },
    { id: 'actions', header: 'Actions', srOnlyHeader: true, align: 'right', cell: rowActions },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Gouvernance"
        title="Utilisateurs"
        description="Comptes, rôles et sessions : invitez, attribuez des rôles, désactivez ou réinitialisez un accès."
        actions={
          canInvite && (
            <button type="button" onClick={() => setDialog({ kind: 'invite' })} className="inline-flex items-center gap-2">
              <Icon name="plus" className="size-4" />Inviter un utilisateur
            </button>
          )
        }
      />

      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />

      <Card>
        <Toolbar>
          <QuickFilters
            label="Filtrer par statut"
            value={status}
            onChange={(value) => { setPage(1); setStatus(value); }}
            options={[{ value: '', label: 'Tous' }, ...Object.entries(USER_STATUS).map(([value, st]) => ({ value, label: st.label }))]}
          />
          <SearchField label="Rechercher un utilisateur (nom ou e-mail)" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Utilisateurs"
          columns={columns}
          rows={users.items}
          rowId={(u) => u.id}
          rowLabel={(u) => u.displayName}
          selection={{ selected, onChange: setSelected }}
          empty="Aucun utilisateur ne correspond."
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={users.total} onPage={setPage} />
      </Card>

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
