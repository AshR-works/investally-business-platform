'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  buildFollowupBody, EMPTY_FOLLOWUP_FORM, FOLLOWUP_CHANNELS, type FollowupField, type FollowupForm, formFromFollowup, validateClosingText, validateFollowupFields,
} from '../../lib/followups';
import { todayIso } from '../../lib/receipts';
import type { Followup, Offer, Page } from '../../lib/types';
import { formatAmount } from '../../lib/offers';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'followup';

/** Fenêtre ouverte sur une relance, ou pour en planifier une (éventuellement sur une offre imposée). */
export type FollowupDialogState =
  | { kind: 'plan'; offer?: { id: string; reference: string; companyName: string } }
  | { kind: 'edit'; followup: Followup }
  | { kind: 'complete'; followup: Followup }
  | { kind: 'cancel'; followup: Followup };

/**
 * Toutes les fenêtres du cycle d'une relance (planifier, modifier, terminer, annuler), rendues UNE fois par l'écran hôte, hors des
 * lignes d'un tableau (un clic dans une fenêtre ne doit pas basculer la sélection d'une ligne).
 */
export function FollowupDialogs({ dialog, onClose, onDone }: { dialog: FollowupDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  if (dialog.kind === 'plan') return <FollowupFormDialog offer={dialog.offer} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'edit') return <FollowupFormDialog followup={dialog.followup} onClose={onClose} onDone={onDone} />;
  return <ClosingDialog followup={dialog.followup} closing={dialog.kind} onClose={onClose} onDone={onDone} />;
}

/** Planification (offre imposée, ou choisie parmi les offres en cours de sa portée) et modification d'une relance à faire. */
function FollowupFormDialog({ followup, offer, onClose, onDone }: {
  followup?: Followup;
  offer?: { id: string; reference: string; companyName: string };
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState<FollowupForm>(() => (followup ? formFromFollowup(followup) : EMPTY_FOLLOWUP_FORM(offer?.id ?? '')));
  const [offers, setOffers] = useState<Offer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsOffer = !followup && !offer;
  const context = { today: todayIso(), keepDueOn: followup?.dueOn, needsOffer };
  const errors = submitted ? validateFollowupFields(form, context) : {};
  const props = (name: FollowupField) => fieldProps(PREFIX, name, errors[name]);
  const set = <K extends keyof FollowupForm>(key: K, value: FollowupForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!needsOffer) return;
    Promise.all([api<Page<Offer>>('/offers?status=SUBMITTED&pageSize=100'), api<Page<Offer>>('/offers?status=RECEIPT_RECEIVED&pageSize=100')])
      .then(([a, b]) => setOffers([...a.items, ...b.items]))
      .catch(() => setError('La liste des offres est indisponible.'));
  }, [needsOffer]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateFollowupFields(form, context))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      if (followup) await api(`/followups/${followup.id}`, { method: 'PUT', body: buildFollowupBody(form, { version: followup.version }) });
      else await api('/followups', { method: 'POST', body: buildFollowupBody(form) });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  return (
    <Modal title={followup ? `Modifier la relance de l’offre ${followup.offerReference}` : 'Nouvelle relance'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset>
          <legend>La relance</legend>
          {followup ? (
            <p className="m-0 mb-3 text-ink-2">Offre : <strong>{followup.offerReference}</strong> · {followup.companyName}</p>
          ) : offer ? (
            <p className="m-0 mb-3 text-ink-2">Offre : <strong>{offer.reference}</strong> · {offer.companyName}</p>
          ) : (
            <FormField prefix={PREFIX} name="offerId" label="Offre" error={errors.offerId}>
              <select {...props('offerId')} value={form.offerId} onChange={(e) => set('offerId', e.target.value)} required aria-required="true">
                <option value="">— Choisir —</option>
                {offers.map((o) => <option key={o.id} value={o.id}>{o.reference} · {o.companyName} · {formatAmount(o.amount, o.currency)}</option>)}
              </select>
            </FormField>
          )}
          <FormField prefix={PREFIX} name="dueOn" label="Échéance" error={errors.dueOn}>
            <input {...props('dueOn')} type="date" value={form.dueOn} min={followup && followup.dueOn < todayIso() ? followup.dueOn : todayIso()} onChange={(e) => set('dueOn', e.target.value)} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="channel" label="Canal" error={errors.channel}>
            <select {...props('channel')} value={form.channel} onChange={(e) => set('channel', e.target.value)}>
              {FOLLOWUP_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField prefix={PREFIX} name="note" label="Note" error={errors.note}>
            <textarea {...props('note')} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} rows={3} placeholder="Ce qu’il faut dire ou demander" />
          </FormField>
        </fieldset>
        {problems.length > 0 && (
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

/** Terminer (résultat obligatoire) ou annuler (motif obligatoire) une relance à faire. */
function ClosingDialog({ followup, closing, onClose, onDone }: { followup: Followup; closing: 'complete' | 'cancel'; onClose: () => void; onDone: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = closing === 'complete';
  const max = complete ? 1000 : 500;
  const problem = tried ? validateClosingText(text, max) : null;
  async function confirm() {
    setTried(true);
    if (validateClosingText(text, max)) {
      document.getElementById(`${PREFIX}-closing-text`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/followups/${followup.id}/${closing}`, { method: 'POST', body: { version: followup.version, text: text.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title={complete ? 'Terminer la relance' : 'Annuler la relance'} onClose={onClose}>
      <p className="m-0 mb-3">Relance de l’offre <strong>{followup.offerReference}</strong> ({followup.companyName}) prévue le <strong>{new Date(`${followup.dueOn}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</strong>. Cette action est définitive et enregistrée dans l’audit.</p>
      <div className="field">
        <label htmlFor={`${PREFIX}-closing-text`}>{complete ? 'Résultat de la relance' : 'Motif de l’annulation'}</label>
        <textarea
          id={`${PREFIX}-closing-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={max}
          rows={4}
          required
          aria-required="true"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${PREFIX}-closing-text-error` : undefined}
          placeholder={complete ? 'Ce qui s’est dit ou décidé' : 'Pourquoi cette relance n’a plus lieu'}
        />
        {problem && <p id={`${PREFIX}-closing-text-error`} className="field-error">{problem}</p>}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" className={complete ? undefined : 'danger'} disabled={busy} onClick={() => void confirm()}>{complete ? 'Terminer la relance' : 'Annuler la relance'}</button>
      </div>
    </Modal>
  );
}
