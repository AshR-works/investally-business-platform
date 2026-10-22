'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { DataTable, type Column } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Modal } from '../../../../components/modal';
import { api, ApiError } from '../../../../lib/api';
import { deviceLabel } from '../../../../lib/device';
import { describeLoginEvent, formatDateTime } from '../../../../lib/login-events';
import { SESSION_RISK, statusStyle } from '../../../../lib/status';
import type { LoginEvent, LoginHistoryPage, SessionView } from '../../../../lib/types';

/** Ce que la fenêtre de confirmation s'apprête à faire. */
type Pending = { kind: 'one'; session: SessionView } | { kind: 'others'; count: number };

/**
 * Sessions et connexions (S01 à S03) : mes sessions actives, avec révocation confirmée (une seule, ou toutes les autres
 * d'un coup, avec un MFA récent demandé par l'interface si besoin), et l'historique de mes connexions sur 90 jours. Les
 * données sont toujours les MIENNES : l'API prend l'identité dans le jeton, jamais dans la requête.
 */
export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api<SessionView[]>('/auth/sessions'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement des sessions impossible');
    }
  }, []);

  const loadHistory = useCallback(async (before?: string) => {
    const params = new URLSearchParams({ limit: '25' });
    if (before) params.set('before', before);
    try {
      const page = await api<LoginHistoryPage>(`/auth/sessions/history?${params}`);
      setHistory((current) => (before ? [...current, ...page.items] : page.items));
      setNextBefore(page.nextBefore);
      setWindowDays(page.windowDays);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Chargement de l'historique impossible");
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    void loadHistory();
  }, [loadSessions, loadHistory]);

  /** Exécute la révocation confirmée, annonce le résultat puis recharge les deux listes (la révocation est tracée dans le journal). */
  async function confirm() {
    if (!pending) return;
    const action = pending;
    setPending(null);
    setError(null);
    setNotice(null);
    try {
      if (action.kind === 'one') {
        await api(`/auth/sessions/${action.session.id}`, { method: 'DELETE' });
        setNotice(`Session « ${deviceLabel(action.session.device)} » révoquée.`);
      } else {
        const result = await api<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' });
        setNotice(result.revoked === 0 ? 'Aucune autre session n’était ouverte.' : `${result.revoked} autre${result.revoked > 1 ? 's' : ''} session${result.revoked > 1 ? 's' : ''} révoquée${result.revoked > 1 ? 's' : ''}.`);
      }
      await Promise.all([loadSessions(), loadHistory()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Révocation impossible');
    }
  }

  const others = sessions.filter((s) => !s.current);

  const sessionColumns: Column<SessionView>[] = [
    {
      id: 'device',
      header: 'Appareil',
      cell: (s) => (
        <span title={s.device} className="flex flex-wrap items-center gap-2">
          <strong>{deviceLabel(s.device)}</strong>
          {s.current && <Badge tone="ok">Cette session</Badge>}
        </span>
      ),
    },
    { id: 'ip', header: 'Adresse IP', cell: (s) => s.ipAddress },
    { id: 'risk', header: 'Risque', cell: (s) => { const risk = statusStyle(SESSION_RISK, s.riskLevel); return <Badge tone={risk.tone}>{risk.label}</Badge>; } },
    { id: 'in', header: 'Connexion', cell: (s) => formatDateTime(s.loggedInAt) },
    { id: 'seen', header: 'Dernière activité', cell: (s) => formatDateTime(s.lastSeenAt) },
    {
      id: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      cell: (s) => (!s.current ? <button type="button" className="secondary small" onClick={() => setPending({ kind: 'one', session: s })}>Révoquer</button> : null),
    },
  ];

  const historyColumns: Column<LoginEvent>[] = [
    { id: 'at', header: 'Date', cell: (e) => formatDateTime(e.at) },
    {
      id: 'result',
      header: 'Résultat',
      cell: (e) => {
        const d = describeLoginEvent(e);
        return (
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={d.tone}>{d.label}</Badge>
            {d.detail && <span className="text-xs text-ink-2">{d.detail}</span>}
          </span>
        );
      },
    },
    { id: 'ip', header: 'Adresse IP', cell: (e) => e.ipAddress },
    { id: 'device', header: 'Appareil', cell: (e) => <span title={e.device}>{deviceLabel(e.device)}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Mon compte"
        title="Sessions et connexions"
        description="Les appareils connectés à votre compte et l’historique de vos connexions. Si vous ne reconnaissez pas l’un d’eux, révoquez-le puis changez votre mot de passe."
      />

      {error && <p role="alert" className="error">{error}</p>}
      <p role="status" className="min-h-5 text-ok">{notice}</p>

      <section aria-labelledby="sessions-actives" className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="sessions-actives" className="m-0">Sessions actives</h2>
          <button type="button" className="secondary" disabled={others.length === 0} onClick={() => setPending({ kind: 'others', count: others.length })}>
            Déconnecter tous mes autres appareils
          </button>
        </div>
        <Card>
          <DataTable caption="Mes sessions actives" columns={sessionColumns} rows={sessions} rowId={(s) => s.id} rowLabel={(s) => deviceLabel(s.device)} empty="Aucune session." />
        </Card>
      </section>

      <section aria-labelledby="historique">
        <h2 id="historique" className="mb-1">Historique des connexions</h2>
        <p className="mb-3 mt-0 text-ink-2">Les {windowDays} derniers jours, réussies et échouées. Visible par vous seul.</p>
        <Card>
          <DataTable caption="Historique de mes connexions" columns={historyColumns} rows={history} rowId={(e) => e.id} rowLabel={(e) => formatDateTime(e.at)} empty="Aucune connexion sur la période." />
          {nextBefore && (
            <div className="border-t border-line px-4 py-3 text-center">
              <button
                type="button"
                className="secondary small"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void loadHistory(nextBefore).finally(() => setLoadingMore(false));
                }}
              >
                Voir les connexions plus anciennes
              </button>
            </div>
          )}
        </Card>
      </section>

      {pending && (
        <Modal title={pending.kind === 'one' ? 'Révoquer cette session' : 'Déconnecter tous mes autres appareils'} onClose={() => setPending(null)}>
          {pending.kind === 'one' ? (
            <p><strong>{deviceLabel(pending.session.device)}</strong> ({pending.session.ipAddress}) sera déconnecté immédiatement.</p>
          ) : (
            <p>{pending.count === 1 ? 'Votre autre session sera fermée' : `Vos ${pending.count} autres sessions seront fermées`} immédiatement. Cette session-ci reste ouverte. Un code de votre application d’authentification peut vous être demandé.</p>
          )}
          <div className="row end">
            <button type="button" className="secondary" onClick={() => setPending(null)}>Annuler</button>
            <button type="button" className="danger" onClick={() => void confirm()}>{pending.kind === 'one' ? 'Révoquer' : 'Tout déconnecter'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
