'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { type Column, DataTable } from '../../../../../components/data/data-table';
import { PageHeader } from '../../../../../components/data/page-header';
import { RowAction, RowActions } from '../../../../../components/data/row-actions';
import { FormField, fieldProps } from '../../../../../components/form-field';
import { HolidayDialog, LeaveTypeDialog } from '../../../../../components/hr/leave-dialogs';
import { LeaveNav } from '../../../../../components/hr/leave-nav';
import { Icon } from '../../../../../components/icon';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { dayText, daysText, type Holiday, type LeaveSettings, type LeaveType, parseDays, type SettingsForm, settingsForm, validateSettings, weekdayName } from '../../../../../lib/leave';
import { canAll } from '../../../../../lib/permissions';
import { todayIso } from '../../../../../lib/receipts';

const SETTINGS = 'leave-settings';

/**
 * Paramètres RH : les règles (jours acquis par mois, samedi, demi-journées, solde négatif), les types d'absence et les jours fériés. Ce sont des paramètres, pas du code :
 * la RH les change ici, chaque changement est audité. Les valeurs de départ sont « à confirmer » (D64) : le total annuel est affiché pour vérifier le règlement.
 */
export default function LeaveSettingsPage() {
  const { profile } = useAuth();
  const isHr = canAll(profile, 'hr.leave.manage');
  const thisYear = Number(todayIso().slice(0, 4));
  const [settings, setSettings] = useState<LeaveSettings | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [year, setYear] = useState(thisYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [typeDialog, setTypeDialog] = useState<{ type?: LeaveType } | null>(null);
  const [holidayDialog, setHolidayDialog] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!isHr) return;
    try {
      const s = await api<LeaveSettings>('/hr/leave/settings');
      setSettings(s);
      setForm(settingsForm(s));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [isHr]);
  const loadTypes = useCallback(() => (isHr ? api<LeaveType[]>('/hr/leave/types?includeInactive=true').then(setTypes).catch(() => setTypes([])) : Promise.resolve()), [isHr]);
  const loadHolidays = useCallback(() => (isHr ? api<Holiday[]>(`/hr/leave/holidays?year=${year}`).then(setHolidays).catch(() => setHolidays([])) : Promise.resolve()), [isHr, year]);
  useEffect(() => { void loadSettings(); void loadTypes(); }, [loadSettings, loadTypes]);
  useEffect(() => { void loadHolidays(); }, [loadHolidays]);

  const problems = form ? validateSettings(form) : {};
  const shown = submitted ? problems : {};
  const yearly = form && !problems.accrualDaysPerMonth ? parseDays(form.accrualDaysPerMonth) * 12 : null;

  async function save() {
    if (!form || !settings) return;
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api<LeaveSettings>('/hr/leave/settings', {
        method: 'PUT',
        body: { version: settings.version, accrualDaysPerMonth: parseDays(form.accrualDaysPerMonth), countsSaturday: form.countsSaturday, allowHalfDays: form.allowHalfDays, allowNegativeBalance: form.allowNegativeBalance },
      });
      setSettings(saved);
      setForm(settingsForm(saved));
      setSubmitted(false);
      setNotice('Les règles sont enregistrées.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(h: Holiday) {
    setError(null);
    try {
      await api(`/hr/leave/holidays/${h.id}`, { method: 'DELETE' });
      setNotice(`« ${h.label} » est retiré.`);
      await loadHolidays();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Suppression impossible');
    }
  }

  const typeColumns = useMemo<Column<LeaveType>[]>(() => [
    { id: 'label', weight: 3, header: 'Type', cell: (t) => <><strong>{t.label}</strong> <span className="text-ink-2">({t.code})</span></> },
    { id: 'deducts', weight: 1.8, header: 'Solde', cell: (t) => (t.deductsBalance ? 'Décompté' : 'Non décompté') },
    { id: 'approval', weight: 1.8, header: 'Validation', cell: (t) => (t.requiresApproval ? 'Requise' : 'Aucune') },
    { id: 'max', weight: 1.8, header: 'Plafond', cell: (t) => (t.maxDaysPerRequest === null ? <span className="text-ink-2">Aucun</span> : daysText(t.maxDaysPerRequest)) },
    { id: 'active', weight: 1.4, header: 'État', cell: (t) => (t.active ? <Badge tone="ok">Actif</Badge> : <Badge tone="neutral">Désactivé</Badge>) },
    { id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right', cell: (t) => <RowActions label={`Actions pour ${t.label}`}><RowAction onClick={() => setTypeDialog({ type: t })}>Modifier</RowAction></RowActions> },
  ], []);

  if (!isHr) {
    return (
      <>
        <PageHeading>Paramètres RH</PageHeading>
        <p>Les règles des absences et congés sont réservées à la RH.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Ressources humaines" title="Paramètres RH" description="Les règles des congés, les types d’absence et les jours fériés. Les valeurs de départ sont à confirmer avec votre règlement intérieur ; chaque changement est enregistré dans l’audit." />
      <LeaveNav current="settings" />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}

      <h2 className="mt-2">Règles</h2>
      <Card className="mb-8">
        {form && (
          <div className="p-5">
            <FormField prefix={SETTINGS} name="accrual" label="Jours acquis par mois de service" error={shown.accrualDaysPerMonth}>
              <input {...fieldProps(SETTINGS, 'accrual', shown.accrualDaysPerMonth)} inputMode="decimal" value={form.accrualDaysPerMonth} onChange={(e) => setForm({ ...form, accrualDaysPerMonth: e.target.value })} style={{ maxWidth: '10rem' }} />
            </FormField>
            {yearly !== null && <p className="m-0 mb-3 text-ink-2">Soit {daysText(Math.round(yearly * 100) / 100)} par an pour une année complète de service.</p>}
            <label className="mb-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.countsSaturday} onChange={(e) => setForm({ ...form, countsSaturday: e.target.checked })} style={{ width: 'auto', margin: 0 }} />Le samedi compte comme jour d’absence (jours ouvrables ; sinon jours ouvrés du lundi au vendredi)</label>
            <label className="mb-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.allowHalfDays} onChange={(e) => setForm({ ...form, allowHalfDays: e.target.checked })} style={{ width: 'auto', margin: 0 }} />Les demi-journées sont autorisées</label>
            <label className="mb-4 flex items-center gap-2 font-normal"><input type="checkbox" checked={form.allowNegativeBalance} onChange={(e) => setForm({ ...form, allowNegativeBalance: e.target.checked })} style={{ width: 'auto', margin: 0 }} />Un solde négatif est autorisé (par défaut : interdit)</label>
            <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer les règles</button>
          </div>
        )}
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0">Types d’absence</h2>
        <button type="button" onClick={() => setTypeDialog({})} className="inline-flex items-center gap-2"><Icon name="plus" className="size-4" />Nouveau type</button>
      </div>
      <Card className="mb-8">
        <DataTable caption="Types d’absence" columns={typeColumns} rows={types} rowId={(t) => t.id} rowLabel={(t) => t.label} empty="Aucun type d’absence." />
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0">Jours fériés</h2>
        <div className="flex items-center gap-2">
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Année
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto', marginTop: 0 }}>
              {[thisYear + 1, thisYear, thisYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setHolidayDialog(true)} className="inline-flex items-center gap-2"><Icon name="plus" className="size-4" />Ajouter</button>
        </div>
      </div>
      <Card className="mb-8">
        {holidays.length === 0
          ? <p className="m-0 p-5 text-ink-2">Aucun jour férié saisi pour {year}. La liste est à votre charge : tant qu’elle est vide, seuls les week-ends ne sont pas décomptés.</p>
          : (
            <ul className="m-0 list-none p-0">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-2 last:border-0">
                  <span><strong>{h.label}</strong> <span className="text-ink-2">: {weekdayName(h.day)} {dayText(h.day)}</span></span>
                  <button type="button" className="secondary" onClick={() => void removeHoliday(h)} aria-label={`Retirer ${h.label}`}>Retirer</button>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {typeDialog && <LeaveTypeDialog type={typeDialog.type} onClose={() => setTypeDialog(null)} onDone={async () => { setTypeDialog(null); setNotice('Le type d’absence est enregistré.'); await loadTypes(); }} />}
      {holidayDialog && <HolidayDialog year={year} onClose={() => setHolidayDialog(false)} onDone={async () => { setHolidayDialog(false); setNotice('Le jour férié est ajouté.'); await loadHolidays(); }} />}
    </>
  );
}
