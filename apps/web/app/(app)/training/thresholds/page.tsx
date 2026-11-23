'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { FormField, fieldProps } from '../../../../components/form-field';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { parseScoreInput, type TrainingThresholds } from '../../../../lib/evaluation';
import { canAll } from '../../../../lib/permissions';

const FIELD = 'training-thresholds';

/** Taux de présence saisi : texte en entrée, nombre validé en sortie (0-100, deux décimales au plus). `null` si vide ou invalide. */
function parsePercentInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

/**
 * Seuils d'éligibilité à un certificat ou une attestation (S5.3b, D31) : une seule ligne, paramétrable, valeurs de départ « à
 * confirmer ». Ce sont des réglages, pas du code : le responsable Investudy les change ici, chaque changement est audité.
 */
export default function TrainingThresholdsPage() {
  const { profile } = useAuth();
  const canManage = canAll(profile, 'training.evaluation.manage');
  const [thresholds, setThresholds] = useState<TrainingThresholds | null>(null);
  const [attendance, setAttendance] = useState('');
  const [score, setScore] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    try {
      const t = await api<TrainingThresholds>('/training/thresholds');
      setThresholds(t);
      setAttendance(String(t.attendanceThresholdPercent));
      setScore(String(t.scoreThreshold));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [canManage]);
  useEffect(() => { void load(); }, [load]);

  const attendanceValue = parsePercentInput(attendance);
  const scoreValue = parseScoreInput(score);
  const problems: { attendance?: string; score?: string } = {
    attendance: attendanceValue === null ? 'Indiquez un taux entre 0 et 100 (deux décimales au plus).' : undefined,
    score: scoreValue === null ? 'Indiquez une note entre 0 et 20 (deux décimales au plus).' : undefined,
  };
  const shown: { attendance?: string; score?: string } = submitted ? problems : {};

  async function save() {
    setSubmitted(true);
    if (!thresholds || attendanceValue === null || scoreValue === null) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api<TrainingThresholds>('/training/thresholds', {
        method: 'PUT',
        body: { version: thresholds.version, attendanceThresholdPercent: attendanceValue, scoreThreshold: scoreValue },
      });
      setThresholds(saved);
      setAttendance(String(saved.attendanceThresholdPercent));
      setScore(String(saved.scoreThreshold));
      setSubmitted(false);
      setNotice('Les seuils sont enregistrés.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <>
        <PageHeading>Seuils d’éligibilité</PageHeading>
        <p>Les seuils de certificat et d’attestation sont réservés au responsable Investudy et au Super administrateur.</p>
      </>
    );
  }

  if (error) return (<><PageHeading>Seuils d’éligibilité</PageHeading><p role="alert" className="error">{error}</p></>);
  if (!thresholds) return (<><PageHeading>Seuils d’éligibilité</PageHeading><p aria-live="polite">Chargement…</p></>);

  return (
    <>
      <PageHeader
        eyebrow="Investudy"
        title="Seuils d’éligibilité"
        description="Taux de présence et note minimale pour qu’une session suggère un certificat ou une attestation (jamais délivrée automatiquement). Valeurs de départ à confirmer ; chaque changement est enregistré dans l’audit."
      />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      <Card>
        <div className="p-5">
          <FormField prefix={FIELD} name="attendance" label="Taux de présence minimal (%)" error={shown.attendance}>
            <input {...fieldProps(FIELD, 'attendance', shown.attendance)} inputMode="decimal" value={attendance} onChange={(e) => setAttendance(e.target.value)} style={{ maxWidth: '10rem' }} />
          </FormField>
          <FormField prefix={FIELD} name="score" label="Note minimale pour un certificat (sur 20)" error={shown.score}>
            <input {...fieldProps(FIELD, 'score', shown.score)} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} style={{ maxWidth: '10rem' }} />
          </FormField>
          <p className="m-0 mb-3 text-ink-2">En dessous du taux de présence : aucune suggestion. Le taux atteint, note absente ou insuffisante : attestation. Les deux atteints : certificat.</p>
          <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer les seuils</button>
        </div>
      </Card>
    </>
  );
}
