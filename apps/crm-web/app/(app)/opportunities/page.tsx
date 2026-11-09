'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { PageHeader } from '../../../components/data/page-header';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { QuickFilters, SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { OpportunityDialogs, type OpportunityDialogState } from '../../../components/opportunities/opportunity-dialogs';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { CompanyContextBar } from '../../../components/company-context-bar';
import { useCompanyContext } from '../../../lib/company-context';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import { formatAmount } from '../../../lib/offers';
import {
  advanceLabel, groupByStage, OPPORTUNITY_ACTION_LABEL, OPPORTUNITY_FILTERS, OPPORTUNITY_STATUS, type OpportunityAction, type OpportunityFilter, opportunityActions, opportunityListParams,
  type OpportunityRights, sourceLabel, stageLabel, totalAmount,
} from '../../../lib/opportunities';
import { can } from '../../../lib/permissions';
import { statusStyle } from '../../../lib/status';
import type { Company, Opportunity, Page } from '../../../lib/types';

type ViewMode = 'cards' | 'stages';
const VIEWS = [{ value: 'cards', label: 'Cartes' }, { value: 'stages', label: 'Par étape' }] as const;

/** Le pipeline commercial : cartes par lignes de six, ou colonnes par étape (bascule), selon la portée de l'utilisateur. */
export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <OpportunitiesContent />
    </Suspense>
  );
}

function OpportunitiesContent() {
  const { profile } = useAuth();
  const search = useSearchParams();
  const [filter, setFilter] = useState<OpportunityFilter>('open');
  const [view, setView] = useState<ViewMode>('cards');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Page<Opportunity>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpportunityDialogState | null>(null);
  const latest = useRef(0);
  const canRead = can(profile, 'bd.opportunity.read');
  const canCreate = can(profile, 'bd.opportunity.create');
  const rights = useMemo<OpportunityRights>(() => ({
    update: can(profile, 'bd.opportunity.update'), advance: can(profile, 'bd.opportunity.advance'), override: can(profile, 'bd.opportunity.override'),
    closeLost: can(profile, 'bd.opportunity.close_lost'), closeWon: can(profile, 'bd.opportunity.close_won'),
  }), [profile]);

  const ctx = useCompanyContext();
  const load = useCallback(async () => {
    if (!canRead) return;
    // Une réponse qui n'est plus la dernière demandée (filtre changé entre-temps) est ignorée.
    const request = ++latest.current;
    try {
      const page = await api<Page<Opportunity>>(`/opportunities?${opportunityListParams(filter, query, ctx.companyId)}`);
      if (request !== latest.current) return;
      setData(page);
      setLoadError(null);
    } catch (e) {
      if (request === latest.current) setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [canRead, filter, query, ctx.companyId]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Arrivée depuis une entreprise (« Nouvelle opportunité ») : la fenêtre de création s'ouvre avec l'entreprise imposée.
  const companyId = search.get('companyId');
  const createRequested = search.get('new') === '1';
  useEffect(() => {
    if (!createRequested || !companyId || !canCreate) return;
    let cancelled = false;
    api<Company>(`/companies/${companyId}`)
      .then((company) => {
        if (!cancelled) setDialog({ kind: 'create', company: { id: company.id, name: company.name } });
      })
      .catch(() => {
        if (!cancelled) setLoadError('L’entreprise est introuvable.');
      });
    return () => {
      cancelled = true;
    };
  }, [createRequested, companyId, canCreate]);

  const total = totalAmount(data.items);
  const groups = useMemo(() => groupByStage(data.items), [data.items]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Opportunités</PageHeading>
        <p>Votre profil n&apos;a pas accès aux opportunités.</p>
      </>
    );
  }

  const open = (action: OpportunityAction, opportunity: Opportunity) => setDialog({ kind: action, opportunity } as OpportunityDialogState);

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Opportunités"
        description="Le pipeline commercial : de la qualification à l’agrément. Une étape à la fois ; l’accord de principe exige un rendez-vous décideur tenu."
        actions={canCreate && (
          <button type="button" onClick={() => setDialog({ kind: 'create' })} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvelle opportunité
          </button>
        )}
      />
      <CompanyContextBar ctx={ctx} section="Opportunités" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={filter} options={OPPORTUNITY_FILTERS.map((f) => ({ value: f.value, label: f.label }))} onChange={(value) => setFilter(value as OpportunityFilter)} />
          <QuickFilters label="Choisir l’affichage" value={view} options={VIEWS.map((v) => ({ value: v.value, label: v.label }))} onChange={(value) => setView(value as ViewMode)} />
          <SearchField label="Rechercher une opportunité" placeholder="Rechercher par intitulé" onSearch={setQuery} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">
            {loading ? 'Chargement…' : `${data.total} opportunité${data.total > 1 ? 's' : ''}`}{!loading && total ? ` · ${formatAmount(total.amount, total.currency)}` : ''}
          </p>
        </Toolbar>
        {!loading && data.items.length === 0 ? (
          <p className="m-0 p-4 text-ink-2">{filter === 'open' && !query ? 'Aucune opportunité ouverte.' : 'Aucune opportunité ne correspond à ces filtres.'}</p>
        ) : view === 'cards' ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {data.items.map((o) => <li key={o.id}><OpportunityCard opportunity={o} rights={rights} onAction={open} /></li>)}
          </ul>
        ) : (
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[60rem] grid-cols-5 gap-3">
              {groups.map((g) => {
                const sum = totalAmount(g.items);
                return (
                  <section key={g.stage} aria-labelledby={`stage-${g.stage}`} className="rounded-md bg-surface-2 p-2">
                    <h2 id={`stage-${g.stage}`} className="m-0 mb-1 text-[length:var(--text-base)]">{g.label} <span className="text-ink-2">({g.items.length})</span></h2>
                    <p className="m-0 mb-2 text-xs text-ink-2">{sum ? formatAmount(sum.amount, sum.currency) : g.items.length ? 'Devises mêlées' : '—'}</p>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {g.items.map((o) => <li key={o.id}><OpportunityCard opportunity={o} rights={rights} onAction={open} compact /></li>)}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      <OpportunityDialogs dialog={dialog} rights={rights} onOpen={setDialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}

/** Une opportunité en carte : intitulé (ouvre la fiche), entreprise, montant, étape, dernière activité, menu d'actions. */
function OpportunityCard({ opportunity: o, rights, onAction, compact }: { opportunity: Opportunity; rights: OpportunityRights; onAction: (a: OpportunityAction, o: Opportunity) => void; compact?: boolean }) {
  const status = statusStyle(OPPORTUNITY_STATUS, o.status);
  const actions = opportunityActions(o, rights);
  return (
    <article className="flex h-full flex-col gap-2 rounded-md border border-line bg-surface p-3" aria-label={`Opportunité ${o.title}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="secondary min-w-0 flex-1 text-left font-semibold" onClick={() => onAction('details', o)}>{o.title}</button>
        <RowActions label={`Actions pour l’opportunité ${o.title}`}>
          {actions.map((a) => (
            <RowAction key={a} danger={a === 'close-lost'} onClick={() => onAction(a, o)}>{a === 'advance' ? advanceLabel(o.nextStage) : OPPORTUNITY_ACTION_LABEL[a]}</RowAction>
          ))}
        </RowActions>
      </div>
      <Link href={`/companies/${o.companyId}`} className="text-ink no-underline hover:underline">{o.companyName}</Link>
      <p className="m-0 font-semibold">{formatAmount(o.amount, o.currency)}</p>
      <p className="m-0 flex flex-wrap items-center gap-2">
        {!compact && <Badge tone="neutral">{stageLabel(o.stage)}</Badge>}
        {o.status !== 'OPEN' && <Badge tone={status.tone}>{status.label}</Badge>}
        {o.waivedAt && <Badge tone="warn">Dérogation</Badge>}
      </p>
      <p className="m-0 mt-auto text-xs text-ink-2">{compact ? '' : `${sourceLabel(o.source)} · `}Dernière activité le {formatDate(o.lastActivityAt)}</p>
    </article>
  );
}
