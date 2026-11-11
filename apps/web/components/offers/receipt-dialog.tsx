'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { formatDate, precheckFile } from '../../lib/format';
import { can } from '../../lib/permissions';
import { buildReceiptBody, EMPTY_RECEIPT_FORM, type ReceiptField, type ReceiptForm, todayIso, validateReceiptFields } from '../../lib/receipts';
import type { Offer, Receipt, UploadRules } from '../../lib/types';
import { Badge } from '../data/badge';
import { DocumentsPanel } from '../documents/documents-panel';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'receipt';

/**
 * Décharge signée d'une offre : consulter (avec son fichier), enregistrer (offre déposée) ou annuler (motif obligatoire). Le
 * fichier signé est un document rattaché à la décharge : il est envoyé juste après l'enregistrement ; si l'envoi échoue, la décharge
 * reste enregistrée et le fichier peut être ajouté depuis le panneau des documents.
 */
export function ReceiptDialog({ offer, onClose, onChanged }: { offer: Offer; onClose: () => void; onChanged: () => Promise<void> }) {
  const { profile } = useAuth();
  const canCreate = can(profile, 'bd.receipt.create');
  const canCancel = can(profile, 'bd.receipt.update');
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [state, setState] = useState<Offer>(offer);
  const [rules, setRules] = useState<UploadRules | null>(null);
  const [form, setForm] = useState<ReceiptForm>(() => EMPTY_RECEIPT_FORM());
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonTried, setReasonTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([api<Receipt[]>(`/receipts?offerId=${offer.id}`), api<Offer>(`/offers/${offer.id}`)]);
      setReceipts(list);
      setState(current);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement de la décharge impossible');
    }
  }, [offer.id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    api<UploadRules>('/documents/meta').then(setRules).catch(() => setRules(null));
  }, []);

  const valid = receipts?.find((r) => r.status === 'VALID') ?? null;
  const history = receipts?.filter((r) => r.status !== 'VALID') ?? [];
  const submittedOn = state.submittedAt ? state.submittedAt.slice(0, 10) : null;
  const errors = submitted ? validateReceiptFields(form, { today: todayIso(), submittedOn }) : {};
  const fileProblem = submitted ? (file ? (rules ? precheckFile(file, rules) : null) : 'Joignez la décharge signée (PDF, image ou document).') : null;
  const props = (name: ReceiptField) => fieldProps(PREFIX, name, errors[name]);
  const set = <K extends keyof ReceiptForm>(key: K, value: ReceiptForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function register(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const problems = validateReceiptFields(form, { today: todayIso(), submittedOn });
    const first = Object.keys(problems)[0];
    const noFile = !file || (rules ? precheckFile(file, rules) : null);
    if (first || noFile) {
      setTimeout(() => document.getElementById(first ? `${PREFIX}-${first}` : `${PREFIX}-file`)?.focus(), 0);
      return;
    }
    setBusy(true);
    let created: Receipt;
    try {
      created = await api<Receipt>('/receipts', { method: 'POST', body: buildReceiptBody(offer.id, form) });
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
      return;
    }
    try {
      const params = new URLSearchParams({ ownerType: 'receipt', ownerId: created.id, title: `Décharge ${offer.reference}`, category: 'DECHARGE', fileName: file.name });
      await api(`/documents?${params}`, { method: 'POST', raw: { type: 'application/octet-stream', data: file } });
      setNotice('Décharge enregistrée et fichier joint.');
    } catch (e) {
      setError(`La décharge est enregistrée, mais le fichier n’a pas été envoyé (${e instanceof ApiError ? e.message : 'échec de l’envoi'}). Ajoutez-le depuis la liste des documents ci-dessous.`);
    }
    setBusy(false);
    await load();
    await onChanged();
  }

  async function cancel() {
    setReasonTried(true);
    if (!valid) return;
    if (reason.trim().length < 3) {
      document.getElementById(`${PREFIX}-cancel-reason`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/receipts/${valid.id}/cancel`, { method: 'POST', body: { version: valid.version, reason: reason.trim() } });
      setCancelling(false);
      setReason('');
      setReasonTried(false);
      setNotice('Décharge annulée : l’offre attend de nouveau sa décharge.');
      await load();
      await onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'annulation");
    } finally {
      setBusy(false);
    }
  }

  const reasonInvalid = reasonTried && reason.trim().length < 3;
  const problems = Object.values(errors);
  return (
    <Modal title={`Décharge de l’offre ${offer.reference}`} onClose={onClose} size="wide">
      <p className="m-0 mb-3 text-ink-2">{offer.companyName} · {offer.subject}</p>
      {notice && <p role="status" className="m-0 mb-3 text-ok">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {receipts === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}

      {valid && (
        <section aria-labelledby="receipt-valid-title" className="mb-4">
          <h3 id="receipt-valid-title" className="mt-0 flex items-center gap-2 text-[length:var(--text-md)]">Décharge reçue <Badge tone="ok">Valide</Badge></h3>
          <p className="m-0">Reçue le <strong>{formatDate(valid.receivedOn)}</strong> · remise par <strong>{valid.receivedBy}</strong></p>
          <DocumentsPanel ownerType="receipt" ownerId={valid.id} />
          {canCancel && state.status === 'RECEIPT_RECEIVED' && !cancelling && (
            <div className="row end"><button type="button" className="secondary" onClick={() => setCancelling(true)}>Annuler la décharge</button></div>
          )}
          {cancelling && (
            <div className="field">
              <label htmlFor={`${PREFIX}-cancel-reason`}>Motif de l’annulation</label>
              <textarea
                id={`${PREFIX}-cancel-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                required
                aria-required="true"
                aria-invalid={reasonInvalid ? true : undefined}
                aria-describedby={reasonInvalid ? `${PREFIX}-cancel-reason-error` : undefined}
              />
              {reasonInvalid && <p id={`${PREFIX}-cancel-reason-error`} className="field-error">Le motif de l’annulation est obligatoire (3 caractères au moins).</p>}
              <div className="row end">
                <button type="button" className="secondary" onClick={() => { setCancelling(false); setReasonTried(false); }}>Garder la décharge</button>
                <button type="button" className="danger" disabled={busy} onClick={() => void cancel()}>Annuler la décharge</button>
              </div>
            </div>
          )}
        </section>
      )}

      {receipts !== null && !valid && state.status === 'SUBMITTED' && canCreate && (
        <form onSubmit={(e) => void register(e)} noValidate>
          <fieldset>
            <legend>Enregistrer la décharge signée</legend>
            <FormField prefix={PREFIX} name="receivedOn" label="Date de réception" error={errors.receivedOn}>
              <input {...props('receivedOn')} type="date" value={form.receivedOn} min={submittedOn ?? undefined} max={todayIso()} onChange={(e) => set('receivedOn', e.target.value)} required aria-required="true" />
            </FormField>
            <FormField prefix={PREFIX} name="receivedBy" label="Remise par" error={errors.receivedBy}>
              <input {...props('receivedBy')} value={form.receivedBy} onChange={(e) => set('receivedBy', e.target.value)} maxLength={150} required aria-required="true" autoComplete="off" placeholder="Nom de la personne de l’entreprise" />
            </FormField>
            <FormField prefix={PREFIX} name="file" label="Décharge signée (fichier)" error={fileProblem ?? undefined}>
              <input id={`${PREFIX}-file`} type="file" aria-required="true" aria-invalid={fileProblem ? true : undefined} aria-describedby={fileProblem ? `${PREFIX}-file-error` : undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </FormField>
          </fieldset>
          {(problems.length > 0 || fileProblem) && (
            <div role="alert" className="error">
              <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
              <ul className="m-0 pl-5">{[...problems, ...(fileProblem ? [fileProblem] : [])].map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          <div className="row end">
            <button type="button" className="secondary" onClick={onClose}>Annuler</button>
            <button type="submit" disabled={busy}>Enregistrer la décharge</button>
          </div>
        </form>
      )}

      {receipts !== null && !valid && state.status !== 'SUBMITTED' && <p className="m-0 text-ink-2">Aucune décharge valide pour cette offre.</p>}
      {receipts !== null && !valid && state.status === 'SUBMITTED' && !canCreate && <p className="m-0 text-ink-2">Aucune décharge pour cette offre pour le moment.</p>}

      {history.length > 0 && (
        <section aria-labelledby="receipt-history-title" className="mt-4">
          <h3 id="receipt-history-title" className="text-[length:var(--text-md)]">Décharges annulées</h3>
          <ul className="m-0 pl-5">
            {history.map((r) => <li key={r.id}>Reçue le {formatDate(r.receivedOn)} (remise par {r.receivedBy}), annulée le {formatDate(r.cancelledAt)} : {r.cancelledReason}</li>)}
          </ul>
        </section>
      )}
    </Modal>
  );
}
