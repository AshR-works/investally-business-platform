'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppointmentDialogs, type AppointmentDialogState } from '../../../components/appointments/appointment-dialogs';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { PageHeader } from '../../../components/data/page-header';
import { QuickFilters, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import {
  AGENDA_MODES, type AgendaMode, type AgendaRights, agendaParams, agendaTitle, agendaWindow, APPOINTMENT_STATUS, APPOINTMENT_TYPES, appointmentTypeLabel, dayHeading, groupByDay,
  localDay, plannableTypes, shiftAnchor, timeRange,
} from '../../../lib/appointments';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import { statusStyle } from '../../../lib/status';
import type { Appointment, Company, Offer, Page } from '../../../lib/types';

/** L'agenda : rendez-vous et visites visibles selon la portée de l'utilisateur, en vue jour, semaine ou mois. */
export default function AgendaPage() {
  return (
    <Suspense fallback={null}>
      <AgendaContent />
    </Suspense>
  );
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const MONTH_CELL_LIMIT = 3;

function AgendaContent() {
  const { profile } = useAuth();
  const search = useSearchParams();
  const [mode, setMode] = useState<AgendaMode>('week');
  const [anchor, setAnchor] = useState(() => localDay(new Date()));
  const [type, setType] = useState('');
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AppointmentDialogState | null>(null);
  const latest = useRef(0);
  const canRead = can(profile, 'bd.appointment.read');
  const rights = useMemo<AgendaRights>(() => ({
    create: can(profile, 'bd.appointment.create'), update: can(profile, 'bd.appointment.update'), cancel: can(profile, 'bd.appointment.cancel'),
    visitCreate: can(profile, 'bd.visit.create'), visitUpdate: can(profile, 'bd.visit.update'),
  }), [profile]);
  const canPlanAny = plannableTypes(rights).length > 0;
  const window = useMemo(() => agendaWindow(mode, anchor), [mode, anchor]);
  const today = localDay(new Date());

  const load = useCallback(async () => {
    if (!canRead) return;
    // Une réponse qui n'est plus la dernière demandée (l'utilisateur a changé de période entre-temps) est ignorée.
    const request = ++latest.current;
    try {
      const page = await api<Page<Appointment>>(`/appointments?${agendaParams(window, type)}`);
      if (request !== latest.current) return;
      setItems(page.items);
      setLoadError(null);
    } catch (e) {
      if (request === latest.current) setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [canRead, window, type]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Arrivée depuis une entreprise ou une offre (« Planifier ») : la fenêtre de planification s'ouvre avec le lien prérempli.
  const companyId = search.get('companyId');
  const offerId = search.get('offerId');
  const planRequested = search.get('plan') === '1';
  useEffect(() => {
    if (!planRequested || !companyId || !canPlanAny) return;
    let cancelled = false;
    Promise.all([api<Company>(`/companies/${companyId}`), offerId ? api<Offer>(`/offers/${offerId}`) : Promise.resolve(null)])
      .then(([company, offer]) => {
        if (!cancelled) setDialog({ kind: 'plan', defaults: { companyId: company.id, companyName: company.name, ...(offer ? { offerId: offer.id, offerReference: offer.reference } : {}) } });
      })
      .catch(() => {
        if (!cancelled) setLoadError('L’entreprise à planifier est introuvable.');
      });
    return () => {
      cancelled = true;
    };
  }, [planRequested, companyId, offerId, canPlanAny]);

  const byDay = useMemo(() => groupByDay(items), [items]);
  const title = agendaTitle(mode, anchor);
  const open = (appointment: Appointment) => setDialog({ kind: 'detail', appointment });

  if (!canRead) {
    return (
      <>
        <PageHeading>Agenda</PageHeading>
        <p>Votre profil n&apos;a pas accès à l&apos;agenda.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Agenda"
        description="Vos rendez-vous avec les DAF et les décideurs, et les visites des entreprises chez Investally."
        actions={canPlanAny && (
          <button type="button" onClick={() => setDialog({ kind: 'plan', defaults: anchor > today ? { date: anchor } : {} })} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouveau rendez-vous
          </button>
        )}
      />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Choisir la vue de l’agenda" value={mode} options={AGENDA_MODES.map((m) => ({ value: m.value, label: m.label }))} onChange={(value) => setMode(value as AgendaMode)} />
          <QuickFilters
            label="Filtrer par type de rendez-vous"
            value={type}
            options={[{ value: '', label: 'Tous les types' }, ...APPOINTMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
            onChange={setType}
          />
        </Toolbar>
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="secondary" onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))}>← Précédent</button>
            <button type="button" className="secondary" onClick={() => setAnchor(today)}>Aujourd’hui</button>
            <button type="button" className="secondary" onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))}>Suivant →</button>
          </div>
          <h2 className="m-0 text-[length:var(--text-lg)] capitalize" aria-live="polite">{title}</h2>
          <p className="m-0 ml-auto text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${items.length} rendez-vous`}</p>
        </Toolbar>
        {mode === 'month' ? (
          <MonthGrid anchor={anchor} days={window.days} byDay={byDay} today={today} title={title} onOpen={open} onDay={(day) => { setAnchor(day); setMode('day'); }} />
        ) : (
          <div className="grid gap-4 p-4">
            {window.days.map((day) => (
              <DaySection key={day} day={day} items={byDay.get(day) ?? []} today={today} onOpen={open} />
            ))}
          </div>
        )}
      </Card>
      <AppointmentDialogs
        dialog={dialog}
        rights={rights}
        onOpen={setDialog}
        onClose={() => setDialog(null)}
        onDone={async () => { setDialog(null); await load(); }}
      />
    </>
  );
}

/** Un rendez-vous dans une liste : heure, type, entreprise, état ; ouvre sa fiche. */
function AppointmentButton({ appointment: a, compact, onOpen }: { appointment: Appointment; compact?: boolean; onOpen: (a: Appointment) => void }) {
  const status = statusStyle(APPOINTMENT_STATUS, a.status);
  const range = timeRange(a);
  return (
    <button
      type="button"
      className="secondary flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left"
      onClick={() => onOpen(a)}
      aria-label={`${appointmentTypeLabel(a.type)} avec ${a.companyName}, ${range}, ${status.label}${a.reportDue ? ', compte rendu attendu' : ''}`}
    >
      <strong>{range}</strong>
      <span>{compact ? a.companyName : `${appointmentTypeLabel(a.type)} · ${a.companyName}`}</span>
      {!compact && <Badge tone={status.tone}>{status.label}</Badge>}
      {a.reportDue && <Badge tone="warn">{compact ? 'CR attendu' : 'Compte rendu attendu'}</Badge>}
    </button>
  );
}

/** Un jour d'une vue jour ou semaine. */
function DaySection({ day, items, today, onOpen }: { day: string; items: Appointment[]; today: string; onOpen: (a: Appointment) => void }) {
  const headingId = `agenda-day-${day}`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="m-0 mb-2 text-[length:var(--text-base)] capitalize" aria-current={day === today ? 'date' : undefined}>
        {dayHeading(day)}{day === today ? ' · aujourd’hui' : ''}
      </h3>
      {items.length === 0 ? (
        <p className="m-0 text-ink-2">Aucun rendez-vous.</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {items.map((a) => <li key={a.id}><AppointmentButton appointment={a} onOpen={onOpen} /></li>)}
        </ul>
      )}
    </section>
  );
}

/** Grille du mois : une ligne par semaine (du lundi au dimanche), les rendez-vous du jour en liste compacte. */
function MonthGrid({ anchor, days, byDay, today, title, onOpen, onDay }: {
  anchor: string; days: string[]; byDay: Map<string, Appointment[]>; today: string; title: string; onOpen: (a: Appointment) => void; onDay: (day: string) => void;
}) {
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[44rem] table-fixed border-collapse">
        <caption className="sr-only">{`Agenda du mois : ${title}`}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => <th key={d} scope="col" className="border border-line p-2 text-left text-xs uppercase text-ink-2"><abbr title={WEEKDAY_NAMES[i]}>{d}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const dayItems = byDay.get(day) ?? [];
                const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
                return (
                  <td key={day} className={`h-28 border border-line p-1 align-top ${inMonth ? '' : 'bg-surface-2 text-ink-2'}`}>
                    <p className="m-0 mb-1 flex items-center justify-between text-xs font-semibold">
                      <span aria-current={day === today ? 'date' : undefined} className={day === today ? 'rounded-full bg-brand-soft px-2 py-0.5 text-brand-strong' : ''}>
                        <span className="sr-only">{dayHeading(day)}</span><span aria-hidden="true">{Number(day.slice(8, 10))}</span>
                      </span>
                    </p>
                    <ul className="m-0 grid list-none gap-1 p-0">
                      {dayItems.slice(0, MONTH_CELL_LIMIT).map((a) => <li key={a.id}><AppointmentButton appointment={a} compact onOpen={onOpen} /></li>)}
                      {dayItems.length > MONTH_CELL_LIMIT && (
                        <li>
                          <button type="button" className="secondary w-full" onClick={() => onDay(day)}>
                            + {dayItems.length - MONTH_CELL_LIMIT} autre{dayItems.length - MONTH_CELL_LIMIT > 1 ? 's' : ''}<span className="sr-only"> le {dayHeading(day)}</span>
                          </button>
                        </li>
                      )}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
