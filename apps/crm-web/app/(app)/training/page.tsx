'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { QuickFilters, SearchField, Toolbar } from '../../../components/data/toolbar';
import { PageHeading } from '../../../components/page-heading';
import { CatalogueDialogs, type CatalogueDialogState } from '../../../components/training/catalogue-dialogs';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import {
  ARCHIVE_LABEL, ARCHIVE_PERMISSION, ROOM_KIND_LABEL, CATALOGUE_SECTIONS, CATALOGUE_STATUS, CATALOGUE_STATUS_OPTIONS, catalogueHref, type CatalogueSection, sectionFromQuery, type CourseModule, type Program, pricingText,
  type Rhythm, type Room, seatsText, slotsText, type Trainer, type Training, UPDATE_PERMISSION, weeksText,
} from '../../../lib/catalogue';
import { can } from '../../../lib/permissions';
import type { Page } from '../../../lib/types';
import { MailLink } from '../../../components/mail-link';

const PAGE_SIZE = 20;

type Row = Program | Training | CourseModule | Room | Trainer;
type Listed = Exclude<CatalogueSection, 'rhythms'>;

const StatusBadge = ({ status }: { status: keyof typeof CATALOGUE_STATUS }) => <Badge tone={CATALOGUE_STATUS[status].tone}>{CATALOGUE_STATUS[status].label}</Badge>;
const dash = <span className="text-ink-2">—</span>;
const clip = (value: string | null) => (value ? <span className="line-clamp-2">{value}</span> : dash);
const NOUN: Record<CatalogueSection, string> = { programs: 'programme', trainings: 'certificat', modules: 'module', rooms: 'salle', trainers: 'formateur', rhythms: 'rythme' };
const NEW_LABEL: Record<Listed, string> = { programs: 'Nouveau programme', trainings: 'Nouveau certificat', modules: 'Nouveau module', rooms: 'Nouvelle salle', trainers: 'Nouveau formateur' };

/**
 * Catalogue Investudy (S5.1) : programmes, certificats (avec leurs modules ordonnés et leurs tarifs), modules partagés, salles, formateurs et
 * rythmes de session. Référentiel partagé, sans propriétaire : la permission du module décide de ce qu'on voit et de ce qu'on peut faire (le
 * serveur re-contrôle chaque requête). Un élément s'archive (ou se désactive) et se réactive ; il ne se supprime jamais.
 */
export default function TrainingCatalogPage() {
  const { profile } = useAuth();
  const sections = CATALOGUE_SECTIONS.filter((s) => can(profile, s.read));
  const router = useRouter();
  // La rubrique est portée par l'adresse (`?rubrique=`) : un lien peut ouvrir directement les salles ou les formateurs.
  const current = sectionFromQuery(useSearchParams().get('rubrique'), sections);
  const [status, setStatus] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [programId, setProgramId] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [data, setData] = useState<Page<Row>>({ items: [], total: 0 });
  const [rhythms, setRhythms] = useState<Rhythm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CatalogueDialogState | null>(null);
  const active = current?.id;

  const load = useCallback(async () => {
    if (!active) return;
    try {
      if (active === 'rhythms') {
        setRhythms(await api<Rhythm[]>('/rhythms'));
      } else {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        if (active === 'trainings' && programId) params.set('programId', programId);
        setData(await api<Page<Row>>(`/${active}?${params}`));
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [active, page, status, search, programId]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);
  useEffect(() => {
    if (active !== 'trainings' || !can(profile, 'training.program.read')) return;
    api<Page<Program>>('/programs?pageSize=100').then((p) => setPrograms(p.items)).catch(() => setPrograms([]));
  }, [active, profile]);

  if (!current || !active) {
    return (
      <>
        <PageHeading>Formation</PageHeading>
        <p>Votre profil n&apos;a pas accès au catalogue de formation.</p>
      </>
    );
  }

  const listed = active === 'rhythms' ? null : active;
  const canWrite = Boolean(current.write && can(profile, current.write));
  const canEdit = listed ? can(profile, UPDATE_PERMISSION[listed] ?? '') : false;
  const canArchive = listed ? can(profile, ARCHIVE_PERMISSION[listed] ?? '') : false;

  const actionsFor = <T extends { id: string; version: number; status: 'ACTIVE' | 'ARCHIVED' }>(item: T, name: string, edit: () => void) => {
    if (!listed) return null;
    const flip = item.status === 'ACTIVE' ? 'archive' : 'reactivate';
    if (!(canEdit && item.status === 'ACTIVE') && !canArchive) return <span className="sr-only">Aucune action</span>;
    return (
      <RowActions label={`Actions pour ${name}`}>
        {canEdit && item.status === 'ACTIVE' && <RowAction onClick={edit}>Modifier</RowAction>}
        {canArchive && (
          <RowAction danger={flip === 'archive'} onClick={() => setDialog({ kind: 'status', section: listed, id: item.id, name, version: item.version, action: flip })}>
            {ARCHIVE_LABEL[listed][flip]}
          </RowAction>
        )}
      </RowActions>
    );
  };
  const statusColumn = { id: 'status', weight: 1.4, header: 'État' } as const;
  const actionsColumn = { id: 'actions', weight: 1, header: 'Actions', srOnlyHeader: true, align: 'right' } as const;
  const cols = (columns: unknown) => columns as Column<Row>[];

  const columns: Column<Row>[] =
    active === 'programs'
      ? cols([
          { id: 'name', weight: 3, header: 'Programme', cell: (p: Program) => <strong>{p.name}</strong> },
          { id: 'audience', weight: 3, header: 'Public visé', cell: (p: Program) => clip(p.audience) },
          { id: 'count', weight: 1.6, header: 'Certificats actifs', align: 'right', cell: (p: Program) => p.activeTrainings },
          { ...statusColumn, cell: (p: Program) => <StatusBadge status={p.status} /> },
          { ...actionsColumn, cell: (p: Program) => actionsFor(p, p.name, () => setDialog({ kind: 'program', program: p })) },
        ])
      : active === 'trainings'
        ? cols([
            { id: 'title', weight: 3.2, header: 'Certificat', cell: (t: Training) => <strong>{t.title}</strong> },
            { id: 'program', weight: 2, header: 'Programme', cell: (t: Training) => t.programName },
            { id: 'modules', weight: 1.4, header: 'Modules', align: 'right', cell: (t: Training) => t.modules.length },
            { id: 'price', weight: 3, header: 'Tarifs', cell: (t: Training) => pricingText(t.pricing) },
            { ...statusColumn, cell: (t: Training) => <StatusBadge status={t.status} /> },
            { ...actionsColumn, cell: (t: Training) => actionsFor(t, t.title, () => setDialog({ kind: 'training', training: t })) },
          ])
        : active === 'modules'
          ? cols([
              { id: 'title', weight: 4, header: 'Module', cell: (m: CourseModule) => <strong>{m.title}</strong> },
              { id: 'kind', weight: 2, header: 'Nature', cell: (m: CourseModule) => (m.requiresWorkstations ? 'Pratique sur poste' : 'Magistral') },
              { id: 'description', weight: 4, header: 'Description', cell: (m: CourseModule) => clip(m.description) },
              { ...statusColumn, cell: (m: CourseModule) => <StatusBadge status={m.status} /> },
              { ...actionsColumn, cell: (m: CourseModule) => actionsFor(m, m.title, () => setDialog({ kind: 'module', module: m })) },
            ])
          : active === 'rooms'
            ? cols([
                { id: 'name', weight: 3, header: 'Salle', cell: (r: Room) => <strong>{r.name}</strong> },
                { id: 'kind', weight: 2.2, header: 'Type', cell: (r: Room) => ROOM_KIND_LABEL[r.kind] },
                { id: 'seats', weight: 3.4, header: 'Places', cell: (r: Room) => seatsText(r) },
                { id: 'trainer', weight: 1.6, header: 'Poste formateur', align: 'right', cell: (r: Room) => r.trainerSeats },
                { id: 'equipment', weight: 3, header: 'Équipements', cell: (r: Room) => clip(r.equipment) },
                { ...statusColumn, cell: (r: Room) => <StatusBadge status={r.status} /> },
                { ...actionsColumn, cell: (r: Room) => actionsFor(r, r.name, () => setDialog({ kind: 'room', room: r })) },
              ])
            : cols([
                { id: 'name', weight: 3, header: 'Formateur', cell: (t: Trainer) => <strong>{t.firstName} {t.lastName}</strong> },
                { id: 'kind', weight: 1.6, header: 'Type', cell: (t: Trainer) => (t.internal ? 'Interne' : 'Externe') },
                { id: 'specialties', weight: 3, header: 'Spécialités', cell: (t: Trainer) => clip(t.specialties) },
                { id: 'contact', weight: 3, header: 'Contact', cell: (t: Trainer) => (t.email || t.phone ? <>{t.email ? <MailLink email={t.email} /> : null}{t.email && t.phone ? <br /> : null}{t.phone}</> : dash) },
                { ...statusColumn, cell: (t: Trainer) => <StatusBadge status={t.status} /> },
                { ...actionsColumn, cell: (t: Trainer) => actionsFor(t, `${t.firstName} ${t.lastName}`, () => setDialog({ kind: 'trainer', trainer: t })) },
              ]);

  const rhythmColumns: Column<Rhythm>[] = [
    { id: 'label', weight: 3, header: 'Rythme', cell: (r) => <strong>{r.label}</strong> },
    { id: 'duration', weight: 2, header: 'Durée', cell: (r) => weeksText(r.weeks) },
    { id: 'slots', weight: 3.2, header: 'Horaires d’un jour de cours', cell: (r) => slotsText(r.slots) },
    { id: 'hours', weight: 2, header: 'Volume', align: 'right', cell: (r) => `${r.totalHours} h` },
    { id: 'open', weight: 2.4, header: 'Ouverture', cell: (r) => <Badge tone={r.open ? 'ok' : 'warn'}>{r.open ? 'Ouvert' : 'En préparation'}</Badge> },
  ];

  const newDialog = (): CatalogueDialogState =>
    active === 'programs' ? { kind: 'program' }
      : active === 'trainings' ? { kind: 'training', programId: programId || undefined }
        : active === 'modules' ? { kind: 'module' }
          : active === 'rooms' ? { kind: 'room' } : { kind: 'trainer' };
  const noun = NOUN[active];
  const rowName = (row: Row) => ('name' in row ? row.name : 'title' in row ? row.title : `${row.firstName} ${row.lastName}`);

  return (
    <>
      <PageHeader
        eyebrow="Investudy"
        title="Catalogue de formation"
        description="Programmes, certificats, modules, salles, formateurs et rythmes de session. Un élément s’archive (ou se désactive) et se réactive ; il ne se supprime jamais."
        actions={canWrite && listed ? <button type="button" onClick={() => setDialog(newDialog())}>{NEW_LABEL[listed]}</button> : undefined}
      />
      {can(profile, 'training.session.read') && <p className="m-0 mb-3"><Link href="/training/sessions">Sessions de formation →</Link></p>}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Rubrique du catalogue" value={current.id} options={sections.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => { router.replace(catalogueHref(v as CatalogueSection)); setPage(1); setSearch(''); setProgramId(''); setData({ items: [], total: 0 }); }} />
          {listed && <SearchField key={current.id} label={`Rechercher un ${noun}`} onSearch={(v) => { setPage(1); setSearch(v); }} />}
        </Toolbar>
        {listed ? (
          <>
            <Toolbar>
              <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} résultat${data.total > 1 ? 's' : ''}`}</p>
              <QuickFilters label="État" value={status} options={[...CATALOGUE_STATUS_OPTIONS, { value: '', label: 'Tous' }]} onChange={(v) => { setPage(1); setStatus(v); }} />
              {listed === 'trainings' && programs.length > 0 && (
                <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
                  Programme
                  <select value={programId} onChange={(e) => { setPage(1); setProgramId(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
                    <option value="">Tous</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
            </Toolbar>
            <DataTable
              key={current.id}
              caption={`Catalogue : ${current.label.toLowerCase()}`}
              columns={columns}
              rows={data.items}
              rowId={(row) => row.id}
              rowLabel={(row) => `${noun} ${rowName(row)}`}
              busy={loading}
              empty={search || status !== 'ACTIVE' ? `Aucun ${noun} ne correspond à ces critères.` : `Aucun ${noun} pour le moment.`}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </>
        ) : (
          <>
            <p className="m-0 px-4 py-3 text-ink-2">Valeurs de référence : une session choisit l’un de ces rythmes, qui fixe sa durée et ses horaires. Le rythme du soir n’est pas encore ouvert aux nouvelles sessions.</p>
            <DataTable key="rhythms" caption="Rythmes de session" columns={rhythmColumns} rows={rhythms} rowId={(r) => r.code} rowLabel={(r) => `le rythme ${r.label}`} busy={loading} empty="Aucun rythme." />
          </>
        )}
      </Card>
      <CatalogueDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}
