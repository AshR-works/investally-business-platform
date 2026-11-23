'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/data/badge';
import { api, ApiError } from '../../lib/api';
import { EligibilitySuggestion, EvaluationSheet, EvaluationSheetRow, EVALUATION_PERMISSIONS, SUGGESTION_LABEL, scoreText } from '../../lib/evaluation';
import { can } from '../../lib/permissions';
import { useAuth } from '../../lib/auth-context';
import { EvaluationDialog } from './evaluation-dialog';

const SUGGESTION_TONE: Record<EligibilitySuggestion, 'ok' | 'info' | 'neutral'> = { CERTIFICATE: 'ok', ATTESTATION: 'info', NONE: 'neutral' };

/**
 * Feuille d'évaluation d'une session (S5.3b) : un inscrit CONFIRMÉ par ligne, sa note, son taux de présence et la suggestion
 * d'éligibilité calculée (certificat, attestation, aucune) — jamais délivrée ici (lot c). Saisie réservée au responsable Investudy ;
 * figée dès que la session est clôturée.
 */
export function EvaluationSheetTable({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const { profile } = useAuth();
  const canRead = can(profile, EVALUATION_PERMISSIONS.read);
  const canRecord = can(profile, EVALUATION_PERMISSIONS.record);
  const [sheet, setSheet] = useState<EvaluationSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EvaluationSheetRow | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setSheet(await api<EvaluationSheet>(`/sessions/${sessionId}/evaluations`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [canRead, sessionId]);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!canRead) return null;
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!sheet) return <p aria-live="polite">Chargement…</p>;

  const editable = canRecord && sheet.canRecord;
  return (
    <>
      <h2 className="mt-6">Évaluations</h2>
      {!sheet.canRecord && <p role="status">La session est clôturée : les évaluations sont figées. Un responsable Investudy peut la rouvrir pour corriger.</p>}
      {sheet.rows.length === 0 ? (
        <p className="text-ink-2">Aucun inscrit confirmé : la feuille d’évaluation apparaît une fois les premières inscriptions confirmées.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <caption className="sr-only">Évaluations des inscrits</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left">Apprenant</th>
                <th scope="col" className="p-2 text-left">Note</th>
                <th scope="col" className="p-2 text-left">Présence</th>
                <th scope="col" className="p-2 text-left">Suggestion</th>
                {editable && <th scope="col" className="p-2 text-right"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.enrollmentId} className="border-t border-line">
                  <th scope="row" className="p-2 text-left font-semibold">{row.learnerName}</th>
                  <td className="p-2">{scoreText(row.score)}</td>
                  <td className="p-2">{row.attendanceRatePercent} %</td>
                  <td className="p-2"><Badge tone={SUGGESTION_TONE[row.suggestion]}>{SUGGESTION_LABEL[row.suggestion]}</Badge></td>
                  {editable && (
                    <td className="p-2 text-right">
                      <button type="button" className="secondary" onClick={() => setEditing(row)}>
                        {row.score === null ? 'Saisir' : 'Corriger'}<span className="sr-only"> la note de {row.learnerName}</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EvaluationDialog
          sessionId={sessionId}
          learnerName={editing.learnerName}
          enrollmentId={editing.enrollmentId}
          current={editing.score}
          onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); await load(); }}
        />
      )}
    </>
  );
}
