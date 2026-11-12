'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../../../components/data/card';
import { PageHeader } from '../../../../../components/data/page-header';
import { PageTabs } from '../../../../../components/hr/page-tabs';
import { Icon } from '../../../../../components/icon';
import { IconButton } from '../../../../../components/icon-button';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import {
  emptyRow, JOURNEY_PAGES, type RowErrors, type JourneyTemplate, KIND_LABEL, MAX_TEMPLATE_TASKS, moveRow, offsetText, OWNER_OPTIONS, rowsOf, rowsValid, type TaskOwner, type TemplateRow,
  templateBody, validateRows,
} from '../../../../../lib/journeys';
import { canAll } from '../../../../../lib/permissions';

/**
 * Modèles de parcours : un par nature (intégration, départ). La RH remplace la liste des tâches : titre court, responsable (une étiquette, pas un droit) et échéance en jours
 * avant ou après la date de référence. Modifier un modèle ne change pas les parcours déjà lancés. Lisibles par la RH, la Direction et le Super administrateur ; modifiables
 * par la RH et le Super administrateur (D68).
 */
export default function JourneyTemplatesPage() {
  const { profile } = useAuth();
  const canReadAll = canAll(profile, 'hr.journey.read');
  const canManage = canAll(profile, 'hr.journey.manage');
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => (canReadAll ? api<JourneyTemplate[]>('/hr/journeys/templates').then((t) => { setTemplates(t); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible')) : Promise.resolve()),
    [canReadAll],
  );
  useEffect(() => { void load(); }, [load]);

  if (!canReadAll) {
    return (
      <>
        <PageHeading>Modèles de parcours</PageHeading>
        <p>Les modèles de parcours sont réservés à la RH et à la Direction.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Modèles de parcours"
        description="Les tâches de chaque parcours. Modifier un modèle ne change pas les parcours déjà lancés : seuls les prochains reprennent la nouvelle liste. Les valeurs de départ sont à confirmer avec la RH."
      />
      <PageTabs label="Parcours" pages={JOURNEY_PAGES} current="templates" />
      {error && <p role="alert" className="error">{error}</p>}
      {templates.map((template) => (
        <TemplateEditor key={`${template.kind}-${template.version}`} template={template} canManage={canManage} onSaved={load} />
      ))}
    </>
  );
}

function TemplateEditor({ template, canManage, onSaved }: { template: JourneyTemplate; canManage: boolean; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<TemplateRow[]>(() => rowsOf(template));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const validation = validateRows(rows);
  const shown: ReturnType<typeof validateRows> = submitted ? validation : { rows: rows.map((): RowErrors => ({})), list: undefined };
  const change = (key: string, patch: Partial<TemplateRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const prefix = `template-${template.kind}`;

  async function save() {
    setSubmitted(true);
    if (!rowsValid(rows)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/hr/journeys/templates/${template.kind}`, { method: 'PUT', body: templateBody(rows, template.version) });
      await onSaved();
      setNotice('Le modèle est enregistré.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${prefix}-title`} className="mb-8">
      <h2 id={`${prefix}-title`} className="mb-2">{KIND_LABEL[template.kind]}</h2>
      <Card>
        {!canManage ? (
          <ol className="m-0 list-none p-0">
            {template.tasks.map((t, i) => (
              <li key={i} className="border-b border-line px-5 py-3 last:border-0">
                <strong>{t.title}</strong>
                <p className="m-0 text-[length:var(--text-sm)] text-ink-2">{t.ownerLabel} · {offsetText(t.dueOffsetDays, template.kind)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="p-5">
            {shown.list && <p role="alert" className="field-error"><Icon name="alert" className="size-4" />{shown.list}</p>}
            <ol className="m-0 mb-4 list-none p-0">
              {rows.map((row, i) => (
                <li key={row.key} className="mb-4 grid gap-x-3 gap-y-1 border-b border-line pb-4 last:border-0 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1.4fr)_auto]">
                  <div className="field m-0">
                    <label htmlFor={`${prefix}-title-${row.key}`}>Tâche {i + 1}</label>
                    <input id={`${prefix}-title-${row.key}`} value={row.title} maxLength={150} aria-invalid={shown.rows[i]?.title ? true : undefined} aria-describedby={shown.rows[i]?.title ? `${prefix}-title-${row.key}-error` : undefined} onChange={(e) => change(row.key, { title: e.target.value })} />
                    {shown.rows[i]?.title && <p id={`${prefix}-title-${row.key}-error`} className="field-error"><Icon name="alert" className="size-4" />{shown.rows[i].title}</p>}
                  </div>
                  <div className="field m-0">
                    <label htmlFor={`${prefix}-owner-${row.key}`}>Responsable</label>
                    <select id={`${prefix}-owner-${row.key}`} value={row.owner} onChange={(e) => change(row.key, { owner: e.target.value as TaskOwner })}>
                      {OWNER_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="field m-0">
                    <label htmlFor={`${prefix}-offset-${row.key}`}>Échéance (jours)</label>
                    <input id={`${prefix}-offset-${row.key}`} inputMode="numeric" value={row.offset} aria-invalid={shown.rows[i]?.offset ? true : undefined} aria-describedby={shown.rows[i]?.offset ? `${prefix}-offset-${row.key}-error` : undefined} onChange={(e) => change(row.key, { offset: e.target.value })} />
                    {shown.rows[i]?.offset
                      ? <p id={`${prefix}-offset-${row.key}-error`} className="field-error"><Icon name="alert" className="size-4" />{shown.rows[i].offset}</p>
                      : !validation.rows[i]?.offset && <p className="m-0 mt-1 text-xs text-ink-2">{offsetText(Number(row.offset), template.kind)}</p>}
                  </div>
                  <div className="flex items-start gap-1 pt-6">
                    <IconButton icon="sort-asc" label={`Monter la tâche ${i + 1}`} outlined disabled={i === 0} onClick={() => setRows((all) => moveRow(all, i, -1))} />
                    <IconButton icon="sort-desc" label={`Descendre la tâche ${i + 1}`} outlined disabled={i === rows.length - 1} onClick={() => setRows((all) => moveRow(all, i, 1))} />
                    <IconButton icon="close" label={`Retirer la tâche ${i + 1}`} outlined onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))} />
                  </div>
                </li>
              ))}
            </ol>
            {notice && <p role="status" className="mb-3 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
            {error && <p role="alert" className="error">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="secondary inline-flex items-center gap-2" disabled={rows.length >= MAX_TEMPLATE_TASKS} onClick={() => setRows((all) => [...all, emptyRow()])}>
                <Icon name="plus" className="size-4" />Ajouter une tâche
              </button>
              <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer le modèle</button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
