'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { APPROVAL_STATUS, approvalActions, APPROVAL_ACTION_LABEL, coverageText, payerText } from '../../lib/approvals';
import { formatDate } from '../../lib/format';
import { can } from '../../lib/permissions';
import type { Approval, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';
import { EntityLink } from '../entity-link';
import { RowAction, RowActions } from '../data/row-actions';
import { ApprovalDialogs, type ApprovalDialogState } from './approval-dialogs';

/**
 * Agréments d'une entreprise, dans sa fiche : liste, enregistrement (opportunité à l'accord de principe, document signé), document,
 * déclarer reçu (agrément demandé), honorer (la finance), déclarer expiré, annuler. Chaque bouton n'apparaît que si l'état de l'agrément ET les droits le permettent ; le serveur
 * re-contrôle chaque requête, et la portée est celle de l'entreprise. `onChanged` recharge la fiche (l'entreprise devient « Cliente »).
 */
export function ApprovalsPanel({ company, archived, onChanged }: { company: { id: string; name: string }; archived: boolean; onChanged: () => Promise<void> }) {
  const { profile } = useAuth();
  const rights = { honor: can(profile, 'bd.approval.honor') && !archived, cancel: can(profile, 'bd.approval.cancel') && !archived, receive: can(profile, 'bd.approval.create') && !archived };
  const canRegister = can(profile, 'bd.approval.create') && !archived;
  const [items, setItems] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ApprovalDialogState | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Approval>>(`/approvals?companyId=${company.id}&pageSize=100`);
      setItems(page.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement des agréments impossible');
    }
  }, [company.id]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="mb-8">
      <section aria-labelledby="approvals-title" className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="approvals-title" className="m-0 text-[length:var(--text-md)]">Agréments</h2>
          <Link href={`/approvals?companyId=${company.id}`} className="text-ink">Ouvrir les agréments de l’entreprise</Link>
          {canRegister && <button type="button" className="secondary" onClick={() => setDialog({ kind: 'register', company })}>Enregistrer un agrément</button>}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        {items === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {items?.length === 0 && <p className="m-0 text-ink-2">Aucun agrément pour cette entreprise{canRegister ? ' : enregistrez-le une fois l’accord de principe obtenu.' : '.'}</p>}
        {items && items.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Agréments de {company.name}</caption>
              <thead><tr><th scope="col">Opportunité</th><th scope="col">Couvre</th><th scope="col">Payeur</th><th scope="col">Reçu le</th><th scope="col">Valide jusqu’au</th><th scope="col">État</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {items.map((a) => {
                  const style = APPROVAL_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
                  const actions = approvalActions(a, rights);
                  return (
                    <tr key={a.id}>
                      <td><EntityLink kind="approval" id={a.id} label={a.opportunityTitle}><strong>{a.opportunityTitle}</strong></EntityLink>{a.closedReason && <span className="block text-[length:var(--text-sm)] text-ink-2">Motif : {a.closedReason}</span>}</td>
                      <td>{coverageText(a)}</td>
                      <td>{payerText(a)}</td>
                      <td>{a.receivedOn ? formatDate(`${a.receivedOn}T00:00:00Z`) : '—'}</td>
                      <td>{a.validUntil ? formatDate(`${a.validUntil}T00:00:00Z`) : '—'}{a.pastValidity && <> <Badge tone="warn">Validité dépassée</Badge></>}</td>
                      <td><Badge tone={style.tone}>{style.label}</Badge></td>
                      <td>
                        <RowActions label={`Actions pour l’agrément ${a.opportunityTitle}`}>
                          <RowAction onClick={() => setDialog({ kind: 'document', approval: a })}>Document signé</RowAction>
                          {actions.map((action) => (
                            <RowAction key={action} danger={action === 'cancel'} onClick={() => setDialog({ kind: action, approval: a })}>{APPROVAL_ACTION_LABEL[action]}</RowAction>
                          ))}
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ApprovalDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); await onChanged(); }} />
    </Card>
  );
}
