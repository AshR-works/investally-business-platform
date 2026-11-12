'use client';

import { useState } from 'react';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { DEFAULT_PERIOD, downloadExport, type ExportKind, EXPORTS, PERIODS } from '../../../../lib/exports';
import { canAll } from '../../../../lib/permissions';

/**
 * Exports pour les audits : utilisateurs, droits et sessions en CSV. Réservé au Super administrateur. Le second facteur récent est redemandé au clic ; chaque export est
 * tracé dans l'audit avant d'être remis ; le fichier ne contient aucun secret (jamais de mot de passe, de secret du second facteur, de code de secours ni de jeton).
 */
export default function ExportsPage() {
  const { profile } = useAuth();
  const allowed = canAll(profile, 'iam.export.read');
  const [days, setDays] = useState<number>(DEFAULT_PERIOD);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!allowed) {
    return (
      <>
        <PageHeading>Exports</PageHeading>
        <p>Les exports d’administration sont réservés au Super administrateur.</p>
      </>
    );
  }

  async function run(kind: ExportKind) {
    setBusy(kind);
    setDone(null);
    setError(null);
    try {
      const fileName = await downloadExport(kind, days);
      setDone(`Le fichier « ${fileName} » est enregistré. Cet export est tracé dans l’audit.`);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Exports"
        description="Utilisateurs, droits et sessions en fichier CSV, pour les audits. Votre identité est confirmée par un code du second facteur ; chaque export est enregistré dans l’audit."
      />
      <div className="mb-6 rounded-panel border border-line-strong bg-surface p-5">
        <h2 className="m-0 text-[length:var(--text-md)]">À savoir avant d’exporter</h2>
        <ul className="m-0 mt-2 pl-5 text-ink-2">
          <li>Les fichiers contiennent des <strong>données personnelles</strong> (noms, e-mails, adresses IP, appareils) : conservez-les dans un espace protégé et supprimez-les quand l’audit est terminé.</li>
          <li><strong>Aucun secret</strong> n’y figure : ni mot de passe, ni secret du second facteur, ni code de secours, ni jeton de session.</li>
          <li>Le fichier s’ouvre dans Excel ou LibreOffice (séparateur « ; », accents lisibles). Un texte qui ressemblerait à une formule est neutralisé.</li>
          <li>Un export trop volumineux est refusé plutôt que tronqué : réduisez alors la période des sessions.</li>
        </ul>
      </div>
      {done && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{done}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {EXPORTS.map((item) => (
          <Card key={item.kind} className="flex flex-col">
            <div className="flex flex-1 flex-col p-5">
              <h2 className="m-0 text-[length:var(--text-md)]">{item.title}</h2>
              <p className="mb-2 mt-1 text-ink-2">{item.description}</p>
              <p className="m-0 text-xs text-ink-2"><strong>Colonnes :</strong> {item.columns}</p>
              {item.hasPeriod && (
                <label className="m-0 mt-3 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
                  Période
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto', marginTop: 0 }}>
                    {PERIODS.map((p) => <option key={p.days} value={p.days}>{p.label}</option>)}
                  </select>
                </label>
              )}
              <div className="mt-auto pt-4">
                <button type="button" disabled={busy !== null} onClick={() => void run(item.kind)} className="inline-flex items-center gap-2">
                  <Icon name="doc" className="size-4" />{busy === item.kind ? 'Export en cours…' : 'Télécharger (CSV)'}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
