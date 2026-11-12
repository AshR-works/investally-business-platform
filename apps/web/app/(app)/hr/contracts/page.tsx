'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { type Column, DataTable } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { QuickFilters, Toolbar } from '../../../../components/data/toolbar';
import { EntityLink } from '../../../../components/entity-link';
import { AdjustContractDialog, ContractDialog, ContractTypeDialog, EndContractDialog } from '../../../../components/hr/contract-dialogs';
import { PageTabs } from '../../../../components/hr/page-tabs';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { CONTRACT_PAGES, CONTRACT_STATE_FILTERS, type Contract, contractActions, type ContractType, statusLabel, statusTone } from '../../../../lib/contracts';
import { formatDate } from '../../../../lib/format';
import { can, canAll } from '../../../../lib/permissions';
import type { Page } from '../../../../lib/types';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;
const day = (iso: string | null) => (iso ? formatDate(`${iso}T00:00:00Z`) : dash);

type Dialog = { kind: 'new' } | { kind: 'adjust' | 'end'; contract: Contract };

/**
 * Contrats du personnel. La RH et le Super administrateur voient et gèrent tout ; la Direction lit tout ; chaque employé lit le sien ; les responsables et les collègues ne
 * voient rien. Aucun salaire, aucun document : un type, des dates, une fin de période d'essai et, à la fin, un motif choisi dans une liste (D67). Un seul contrat est en
 * cours par employé ; un contrat terminé est conservé.
 */
export default function ContractsPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.contract.read');
  const seesAll = canAll(profile, 'hr.contract.read');
  const canManage = canAll(profile, 'hr.contract.manage');
  const [data, setData] = useState<Page<Contract>>({ items: [], total: 0 });
  const [types, setTypes] = useState<ContractType[]>([]);
  const [page, setPage] = useState(1);
  const [state, setState] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [typeDialog, setTypeDialog] = useState<{ type?: ContractType } | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (state) params.set('status', state);
    try {
      setData(await api<Page<Contract>>(`/hr/contracts?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, state]);
  useEffect(() => { void load(); }, [load]);

  const loadTypes = useCallback(() => (canRead ? api<ContractType[]>(`/hr/contracts/types${canManage ? '?includeInactive=true' : ''}`).then(setTypes).catch(() => setTypes([])) : Promise.resolve()), [canRead, canManage]);
  useEffect(() => { void loadTypes(); }, [loadTypes]);

  const columns = useMemo<Column<Contract>[]>(() => [
    ...(seesAll ? [{ id: 'employee', weight: 3, header: 'Employé', cell: (c: Contract) => <EntityLink kind="employee" id={c.employeeId} label={c.employeeName}>{c.employeeName}</EntityLink> }] : []),
    { id: 'type', weight: 2.6, header: 'Type', cell: (c) => c.contractTypeLabel },
    { id: 'start', weight: 1.6, header: 'Début', cell: (c) => day(c.start) },
    { id: 'end', weight: 1.6, header: 'Fin', cell: (c) => (c.endedOn ? day(c.endedOn) : c.fixedTerm ? day(c.end) : <span className="text-ink-2">Durée indéterminée</span>) },
    { id: 'probation', weight: 1.8, header: 'Fin d’essai', cell: (c) => day(c.probationEnd) },
    { id: 'status', weight: 1.6, header: 'État', cell: (c) => <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge> },
    { id: 'reason', weight: 2.4, header: 'Motif de fin', cell: (c) => c.endReasonLabel ?? dash },
    {
      id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (c) => {
        const actions = contractActions(c, canManage);
        if (actions.length === 0) return <span className="sr-only">Aucune action</span>;
        return (
          <RowActions label={`Actions pour le contrat de ${c.employeeName}`}>
            {actions.map((a) => a === 'adjust'
              ? <RowAction key={a} onClick={() => setDialog({ kind: 'adjust', contract: c })}>Ajuster (fin, essai)</RowAction>
              : <RowAction key={a} danger onClick={() => setDialog({ kind: 'end', contract: c })}>Mettre fin au contrat</RowAction>)}
          </RowActions>
        );
      },
    },
  ], [seesAll, canManage]);

  const typeColumns = useMemo<Column<ContractType>[]>(() => [
    { id: 'label', weight: 3, header: 'Type', cell: (t) => <><strong>{t.label}</strong> <span className="text-ink-2">({t.code})</span></> },
    { id: 'term', weight: 2, header: 'Durée', cell: (t) => (t.fixedTerm ? 'Déterminée (fin obligatoire)' : 'Indéterminée') },
    { id: 'active', weight: 1.4, header: 'État', cell: (t) => (t.active ? <Badge tone="ok">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>) },
    { id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right', cell: (t) => <RowActions label={`Actions pour ${t.label}`}><RowAction onClick={() => setTypeDialog({ type: t })}>Modifier</RowAction></RowActions> },
  ], []);

  if (!canRead) {
    return (
      <>
        <PageHeading>Contrats</PageHeading>
        <p>Votre profil n&apos;a pas accès aux contrats.</p>
      </>
    );
  }

  const done = async (message: string) => { setDialog(null); setNotice(message); await load(); };

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title={seesAll ? 'Contrats' : 'Mon contrat'}
        description={seesAll
          ? 'Les contrats du personnel : type, dates, fin de période d’essai et motif de fin. Un seul contrat est en cours par employé ; un contrat terminé est conservé. Ni salaire ni document.'
          : 'Votre contrat : son type, ses dates et la fin de votre période d’essai. Pour toute question, adressez-vous à la RH.'}
        actions={canManage && (
          <button type="button" onClick={() => setDialog({ kind: 'new' })} className="inline-flex items-center gap-2"><Icon name="plus" className="size-4" />Nouveau contrat</button>
        )}
      />
      <PageTabs label="Contrats" pages={CONTRACT_PAGES} current="contracts" />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card className="mb-8">
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={state} options={[...CONTRACT_STATE_FILTERS]} onChange={(value) => { setPage(1); setState(value); }} />
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} contrat${data.total > 1 ? 's' : ''}`}</p>
        </Toolbar>
        <DataTable
          caption="Contrats"
          columns={columns}
          rows={data.items}
          rowId={(c) => c.id}
          rowLabel={(c) => `${c.employeeName}, ${c.contractTypeLabel}`}
          busy={loading}
          empty={state === 'ACTIVE' ? 'Aucun contrat en cours.' : 'Aucun contrat pour ces critères.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>

      {canManage && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0">Types de contrat</h2>
            <button type="button" onClick={() => setTypeDialog({})} className="inline-flex items-center gap-2"><Icon name="plus" className="size-4" />Nouveau type</button>
          </div>
          <Card className="mb-8">
            <DataTable caption="Types de contrat" columns={typeColumns} rows={types} rowId={(t) => t.id} rowLabel={(t) => t.label} empty="Aucun type de contrat." />
          </Card>
        </>
      )}

      {dialog?.kind === 'new' && <ContractDialog types={types} onClose={() => setDialog(null)} onDone={() => done('Le contrat est enregistré.')} />}
      {dialog?.kind === 'adjust' && <AdjustContractDialog contract={dialog.contract} onClose={() => setDialog(null)} onDone={() => done('Le contrat est ajusté.')} />}
      {dialog?.kind === 'end' && <EndContractDialog contract={dialog.contract} onClose={() => setDialog(null)} onDone={() => done('Le contrat est terminé.')} />}
      {typeDialog && <ContractTypeDialog type={typeDialog.type} onClose={() => setTypeDialog(null)} onDone={async () => { setTypeDialog(null); setNotice('Le type de contrat est enregistré.'); await loadTypes(); }} />}
    </>
  );
}
