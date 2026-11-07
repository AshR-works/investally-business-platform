'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  ARCHIVE_LABEL, type CatalogueSection, type CourseModule, EMPTY_MODULE_FORM, EMPTY_PROGRAM_FORM, EMPTY_ROOM_FORM, EMPTY_TRAINER_FORM, EMPTY_TRAINING_FORM, formFromModule,
  formFromProgram, formFromRoom, formFromTrainer, formFromTraining, MAX_MODULES_PER_TRAINING, moduleBody, type ModuleForm, moveModule, type Program, programBody, type ProgramForm,
  type Room, ROOM_KIND_OPTIONS, type RoomKind, roomBody, type RoomForm, seatWord, type Trainer, trainerBody, type TrainerForm, type Training, trainingBody, type TrainingForm, validateModule, validateProgram, validateRoom,
  validateTrainer, validateTraining,
} from '../../lib/catalogue';
import { PHONE_HINT } from '../../lib/phone';
import type { Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

/** Ce que la page hôte peut ouvrir : un formulaire (création ou modification) ou la confirmation d'un archivage / d'une réactivation. */
export type CatalogueDialogState =
  | { kind: 'program'; program?: Program }
  | { kind: 'training'; training?: Training; programId?: string }
  | { kind: 'module'; module?: CourseModule }
  | { kind: 'room'; room?: Room }
  | { kind: 'trainer'; trainer?: Trainer }
  | { kind: 'status'; section: Exclude<CatalogueSection, 'rhythms'>; id: string; name: string; version: number; action: 'archive' | 'reactivate' };

const ROUTE: Record<Exclude<CatalogueSection, 'rhythms'>, string> = { programs: '/programs', trainings: '/trainings', modules: '/modules', rooms: '/rooms', trainers: '/trainers' };

/** Toutes les fenêtres du catalogue, rendues UNE fois par la page hôte, hors des tableaux. */
export function CatalogueDialogs({ dialog, onClose, onDone }: { dialog: CatalogueDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'program': return <ProgramDialog program={dialog.program} onClose={onClose} onDone={onDone} />;
    case 'training': return <TrainingDialog training={dialog.training} programId={dialog.programId} onClose={onClose} onDone={onDone} />;
    case 'module': return <ModuleDialog module={dialog.module} onClose={onClose} onDone={onDone} />;
    case 'room': return <RoomDialog room={dialog.room} onClose={onClose} onDone={onDone} />;
    case 'trainer': return <TrainerDialog trainer={dialog.trainer} onClose={onClose} onDone={onDone} />;
    case 'status': return <StatusDialog state={dialog} onClose={onClose} onDone={onDone} />;
  }
}

/** Squelette commun : validation à la première tentative d'envoi, premier champ fautif pris en focus, erreur serveur annoncée. */
export function FormDialog<F extends Record<string, string>>({ title, intro, errors, submit, onClose, children }: {
  title: string; intro: string; errors: Partial<Record<keyof F, string>>; submit: () => Promise<void>; onClose: () => void; children: (props: { submitted: boolean }) => ReactNode;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = Object.values(errors).filter(Boolean) as string[];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      setTimeout(() => document.getElementById(`catalogue-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      await submit();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <p className="m-0 mb-3 text-ink-2">{intro}</p>
        {children({ submitted })}
        {submitted && problems.length > 0 && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
            <ul className="m-0 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

const PREFIX = 'catalogue';

function ProgramDialog({ program, onClose, onDone }: { program?: Program; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<ProgramForm>(() => (program ? formFromProgram(program) : EMPTY_PROGRAM_FORM()));
  const set = (key: keyof ProgramForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateProgram(form);
  return (
    <FormDialog
      title={program ? 'Modifier le programme' : 'Nouveau programme'}
      intro="Un programme regroupe des formations. Il s’archive, il ne se supprime pas."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        if (program) await api(`/programs/${program.id}`, { method: 'PUT', body: programBody(form, program.version) });
        else await api('/programs', { method: 'POST', body: programBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof ProgramForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>Le programme</legend>
            <FormField prefix={PREFIX} name="name" label="Nom" error={shown('name')}>
              <input {...fieldProps(PREFIX, 'name', shown('name'))} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={150} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="audience" label="Public visé (facultatif)" error={shown('audience')}>
              <input {...fieldProps(PREFIX, 'audience', shown('audience'))} value={form.audience} onChange={(e) => set('audience', e.target.value)} maxLength={500} />
            </FormField>
            <FormField prefix={PREFIX} name="description" label="Description (facultatif)" error={shown('description')}>
              <textarea {...fieldProps(PREFIX, 'description', shown('description'))} value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={2000} />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function TrainingDialog({ training, programId, onClose, onDone }: { training?: Training; programId?: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<TrainingForm>(() => (training ? formFromTraining(training) : EMPTY_TRAINING_FORM(programId)));
  const [programs, setPrograms] = useState<Program[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const set = (key: Exclude<keyof TrainingForm, 'moduleIds'>, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateTraining(form, { creating: !training });
  useEffect(() => {
    if (!training) api<Page<Program>>('/programs?pageSize=100&status=ACTIVE').then((page) => setPrograms(page.items)).catch(() => setLoadError('La liste des programmes est indisponible.'));
    api<Page<CourseModule>>('/modules?pageSize=100').then((page) => setModules(page.items)).catch(() => setLoadError('La liste des modules est indisponible.'));
  }, [training]);

  // Les modules déjà présents (même archivés) restent affichés ; seuls les modules actifs peuvent s'ajouter.
  const known = new Map<string, { title: string; archived: boolean }>(modules.map((m) => [m.id, { title: m.title, archived: m.status === 'ARCHIVED' }]));
  for (const m of training?.modules ?? []) if (!known.has(m.id)) known.set(m.id, { title: m.title, archived: m.status === 'ARCHIVED' });
  const addable = modules.filter((m) => m.status === 'ACTIVE' && !form.moduleIds.includes(m.id));
  const setIds = (moduleIds: string[]) => setForm((f) => ({ ...f, moduleIds }));

  return (
    <FormDialog
      title={training ? 'Modifier le certificat' : 'Nouveau certificat'}
      intro={training ? `Certificat du programme « ${training.programName} » (le programme ne change pas).` : 'Un certificat est la formation que l’on vend et que l’on planifie. Il appartient à un seul programme actif ; son titre y est unique.'}
      errors={errors}
      onClose={onClose}
      submit={async () => {
        if (training) await api(`/trainings/${training.id}`, { method: 'PUT', body: trainingBody(form, training.version) });
        else await api('/trainings', { method: 'POST', body: trainingBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: Exclude<keyof TrainingForm, 'moduleIds'>) => (submitted ? errors[name] : undefined);
        return (
          <>
            <fieldset>
              <legend>Le certificat</legend>
              {!training && (
                <FormField prefix={PREFIX} name="programId" label="Programme" error={shown('programId')}>
                  <select {...fieldProps(PREFIX, 'programId', shown('programId'))} value={form.programId} onChange={(e) => set('programId', e.target.value)} required aria-required="true">
                    <option value="">— Choisir —</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FormField>
              )}
              {loadError && <p role="alert" className="error">{loadError}</p>}
              <FormField prefix={PREFIX} name="title" label="Titre" error={shown('title')}>
                <input {...fieldProps(PREFIX, 'title', shown('title'))} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={150} required aria-required="true" />
              </FormField>
              <FormField prefix={PREFIX} name="objectives" label="Objectifs (facultatif)" error={shown('objectives')}>
                <textarea {...fieldProps(PREFIX, 'objectives', shown('objectives'))} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} rows={3} maxLength={2000} />
              </FormField>
              <FormField prefix={PREFIX} name="prerequisites" label="Prérequis (facultatif)" error={shown('prerequisites')}>
                <textarea {...fieldProps(PREFIX, 'prerequisites', shown('prerequisites'))} value={form.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} rows={2} maxLength={1000} />
              </FormField>
            </fieldset>
            <fieldset>
              <legend>Tarifs (facultatifs)</legend>
              <FormField prefix={PREFIX} name="priceAmount" label="Prix du certificat complet" error={shown('priceAmount')}>
                <input {...fieldProps(PREFIX, 'priceAmount', shown('priceAmount'))} inputMode="decimal" value={form.priceAmount} onChange={(e) => set('priceAmount', e.target.value)} maxLength={15} autoComplete="off" />
              </FormField>
              <FormField prefix={PREFIX} name="modulePriceAmount" label="Prix de chaque module" error={shown('modulePriceAmount')}>
                <input {...fieldProps(PREFIX, 'modulePriceAmount', shown('modulePriceAmount'))} inputMode="decimal" value={form.modulePriceAmount} onChange={(e) => set('modulePriceAmount', e.target.value)} maxLength={15} autoComplete="off" />
              </FormField>
              <FormField prefix={PREFIX} name="priceCurrency" label="Devise" error={shown('priceCurrency')}>
                <input {...fieldProps(PREFIX, 'priceCurrency', shown('priceCurrency'))} value={form.priceCurrency} onChange={(e) => set('priceCurrency', e.target.value)} maxLength={3} autoComplete="off" />
              </FormField>
            </fieldset>
            <fieldset>
              <legend>Modules, dans l’ordre</legend>
              {form.moduleIds.length === 0 ? <p className="m-0 mb-3 text-ink-2">Aucun module pour le moment.</p> : (
                <ol className="m-0 mb-3 list-decimal pl-6">
                  {form.moduleIds.map((id, index) => {
                    const info = known.get(id);
                    const title = info?.title ?? 'Module';
                    return (
                      <li key={id} className="mb-1">
                        <span className="mr-2">{title}{info?.archived ? ' (archivé)' : ''}</span>
                        <button type="button" className="secondary" disabled={index === 0} aria-label={`Monter ${title}`} onClick={() => setIds(moveModule(form.moduleIds, index, -1))}>↑</button>{' '}
                        <button type="button" className="secondary" disabled={index === form.moduleIds.length - 1} aria-label={`Descendre ${title}`} onClick={() => setIds(moveModule(form.moduleIds, index, 1))}>↓</button>{' '}
                        <button type="button" className="secondary" aria-label={`Retirer ${title}`} onClick={() => setIds(form.moduleIds.filter((m) => m !== id))}>Retirer</button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {form.moduleIds.length < MAX_MODULES_PER_TRAINING && (
                <label className="m-0 flex items-center gap-2 font-normal">
                  Ajouter un module
                  <select value="" onChange={(e) => e.target.value && setIds([...form.moduleIds, e.target.value])} style={{ width: 'auto', marginTop: 0 }}>
                    <option value="">— Choisir —</option>
                    {addable.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </label>
              )}
            </fieldset>
          </>
        );
      }}
    </FormDialog>
  );
}

function ModuleDialog({ module, onClose, onDone }: { module?: CourseModule; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<ModuleForm>(() => (module ? formFromModule(module) : EMPTY_MODULE_FORM()));
  const set = (key: 'title' | 'description', value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateModule(form);
  return (
    <FormDialog
      title={module ? 'Modifier le module' : 'Nouveau module'}
      intro="Un module est un chapitre que plusieurs certificats peuvent partager. Il n’a ni durée ni prix : ils viennent du certificat et du rythme de la session."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        if (module) await api(`/modules/${module.id}`, { method: 'PUT', body: moduleBody(form, module.version) });
        else await api('/modules', { method: 'POST', body: moduleBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: 'title' | 'description') => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>Le module</legend>
            <FormField prefix={PREFIX} name="title" label="Titre" error={shown('title')}>
              <input {...fieldProps(PREFIX, 'title', shown('title'))} value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={150} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="description" label="Description (facultatif)" error={shown('description')}>
              <textarea {...fieldProps(PREFIX, 'description', shown('description'))} value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={1000} />
            </FormField>
            <div className="field">
              <label className="flex items-center gap-2 font-normal">
                <input type="checkbox" checked={form.requiresWorkstations} onChange={(e) => setForm((f) => ({ ...f, requiresWorkstations: e.target.checked }))} style={{ width: 'auto', marginTop: 0 }} />
                Pratique sur poste de travail (ne se donne pas dans une salle de cours)
              </label>
            </div>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function RoomDialog({ room, onClose, onDone }: { room?: Room; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<RoomForm>(() => (room ? formFromRoom(room) : EMPTY_ROOM_FORM()));
  const set = (key: Exclude<keyof RoomForm, 'kind'>, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateRoom(form);
  const word = seatWord(form.kind);
  const usable = Number(form.learnerSeats) - Number(form.unavailableSeats);
  return (
    <FormDialog
      title={room ? 'Modifier la salle' : 'Nouvelle salle'}
      intro="Les places utiles pour les apprenants sont les postes apprenants moins ceux hors service. Une salle désactivée n’est plus proposée pour de nouvelles sessions, mais reste visible sur les sessions passées."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        if (room) await api(`/rooms/${room.id}`, { method: 'PUT', body: roomBody(form, room.version) });
        else await api('/rooms', { method: 'POST', body: roomBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: Exclude<keyof RoomForm, 'kind'>) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>La salle</legend>
            <FormField prefix={PREFIX} name="name" label="Nom" error={shown('name')}>
              <input {...fieldProps(PREFIX, 'name', shown('name'))} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="kind" label="Type de salle">
              <select id={`${PREFIX}-kind`} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as RoomKind }))}>
                {ROOM_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="learnerSeats" label={`${word === 'places' ? 'Places' : 'Postes'} apprenants`} error={shown('learnerSeats')}>
              <input {...fieldProps(PREFIX, 'learnerSeats', shown('learnerSeats'))} type="number" inputMode="numeric" min={1} max={1000} value={form.learnerSeats} onChange={(e) => set('learnerSeats', e.target.value)} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="unavailableSeats" label={`Dont ${word} hors service (en panne)`} error={shown('unavailableSeats')}>
              <input {...fieldProps(PREFIX, 'unavailableSeats', shown('unavailableSeats'))} type="number" inputMode="numeric" min={0} max={1000} value={form.unavailableSeats} onChange={(e) => set('unavailableSeats', e.target.value)} />
            </FormField>
            <FormField prefix={PREFIX} name="trainerSeats" label="Postes formateur (0 s’il n’y en a pas)" error={shown('trainerSeats')}>
              <input {...fieldProps(PREFIX, 'trainerSeats', shown('trainerSeats'))} type="number" inputMode="numeric" min={0} max={10} value={form.trainerSeats} onChange={(e) => set('trainerSeats', e.target.value)} />
            </FormField>
            {Number.isFinite(usable) && usable >= 0 && form.learnerSeats !== '' && <p className="m-0 mb-3 text-ink-2" aria-live="polite">Places utiles pour les apprenants : <strong>{usable}</strong></p>}
            <FormField prefix={PREFIX} name="equipment" label="Équipements (facultatif)" error={shown('equipment')}>
              <textarea {...fieldProps(PREFIX, 'equipment', shown('equipment'))} value={form.equipment} onChange={(e) => set('equipment', e.target.value)} rows={3} maxLength={1000} />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function TrainerDialog({ trainer, onClose, onDone }: { trainer?: Trainer; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<TrainerForm>(() => (trainer ? formFromTrainer(trainer) : EMPTY_TRAINER_FORM()));
  const set = (key: keyof TrainerForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validateTrainer(form);
  return (
    <FormDialog
      title={trainer ? 'Modifier le formateur' : 'Nouveau formateur'}
      intro="Un formateur externe n’a pas de compte sur la plateforme ; le lien avec un compte interne se fait à part."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        if (trainer) await api(`/trainers/${trainer.id}`, { method: 'PUT', body: trainerBody(form, trainer.version) });
        else await api('/trainers', { method: 'POST', body: trainerBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof TrainerForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>Le formateur</legend>
            <FormField prefix={PREFIX} name="lastName" label="Nom" error={shown('lastName')}>
              <input {...fieldProps(PREFIX, 'lastName', shown('lastName'))} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="firstName" label="Prénom" error={shown('firstName')}>
              <input {...fieldProps(PREFIX, 'firstName', shown('firstName'))} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="specialties" label="Spécialités (facultatif)" error={shown('specialties')}>
              <input {...fieldProps(PREFIX, 'specialties', shown('specialties'))} value={form.specialties} onChange={(e) => set('specialties', e.target.value)} maxLength={500} />
            </FormField>
            <FormField prefix={PREFIX} name="email" label="E-mail (facultatif)" error={shown('email')}>
              <input {...fieldProps(PREFIX, 'email', shown('email'))} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={200} autoComplete="off" />
            </FormField>
            <FormField prefix={PREFIX} name="phone" label={`Téléphone (facultatif, ${PHONE_HINT})`} error={shown('phone')}>
              <input {...fieldProps(PREFIX, 'phone', shown('phone'))} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="off" />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

/** Archiver ou réactiver : réversible, donc une simple confirmation (pas de motif). */
function StatusDialog({ state, onClose, onDone }: { state: Extract<CatalogueDialogState, { kind: 'status' }>; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = ARCHIVE_LABEL[state.section][state.action];
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`${ROUTE[state.section]}/${state.id}/status`, { method: 'POST', body: { version: state.version, action: state.action } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title={label} onClose={onClose}>
      <p className="m-0 mb-3">
        « {state.name} » {state.action === 'archive'
          ? 'ne sera plus proposé pour de nouvelles sessions, mais restera visible sur l’existant. Vous pourrez le réactiver à tout moment.'
          : 'sera de nouveau proposé pour de nouvelles sessions.'}
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{label}</button>
      </div>
    </Modal>
  );
}
