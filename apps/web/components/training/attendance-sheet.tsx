'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { type AttendanceSheet, type AttendanceStatus, entryOf, statusLabel, statusSymbol } from '../../lib/attendance';
import { can } from '../../lib/permissions';
import { dateText } from '../../lib/sessions';
import { useAuth } from '../../lib/auth-context';
import { AttendanceDialog } from './attendance-dialog';

interface Editing { enrollmentId: string; learnerName: string; day: string; current: AttendanceStatus | null }

const FR_WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const weekdayName = (iso: string): string => FR_WEEKDAY.format(new Date(`${iso}T00:00:00.000Z`));

/**
 * Feuille de présence d'une session (S5.3a) : un inscrit CONFIRMÉ par ligne, une séance (jour de cours) par colonne. Saisie réservée au
 * responsable Investudy (le formateur, externe, n'a pas de compte) ; figée dès que la session est clôturée.
 */
export function AttendanceSheetTable({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const { profile } = useAuth();
  const canRead = can(profile, 'training.attendance.read');
  const canRecord = can(profile, 'training.attendance.record');
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setSheet(await api<AttendanceSheet>(`/sessions/${sessionId}/attendance`));
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
      <h2 className="mt-6">Présences aux séances</h2>
      {!sheet.canRecord && <p role="status">La session est clôturée : les présences sont figées. Un responsable Investudy peut la rouvrir pour corriger.</p>}
      {sheet.rows.length === 0 ? (
        <p className="text-ink-2">Aucun inscrit confirmé : la feuille de présence apparaît une fois les premières inscriptions confirmées.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <caption className="sr-only">Présences par séance</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-48 bg-surface p-2 text-left">Apprenant</th>
                {sheet.days.map((d) => (
                  <th key={d} scope="col" className="min-w-16 p-2 text-center text-xs font-semibold">
                    <span aria-hidden="true">{weekdayName(d)}<br />{Number(d.slice(8))}</span>
                    <span className="sr-only">{dateText(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.enrollmentId} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-2 text-left font-semibold">{row.learnerName}</th>
                  {sheet.days.map((d) => {
                    const status = entryOf(row, d);
                    const label = status ? statusLabel(status) : 'non saisi';
                    return (
                      <td key={d} className={`p-0 text-center ${status ? 'bg-brand-soft text-brand-strong' : ''}`}>
                        {editable ? (
                          <button
                            type="button"
                            className="secondary h-full w-full min-w-11 border-0 bg-transparent p-2"
                            aria-label={`Présence de ${row.learnerName}, ${dateText(d)} : ${label}. Modifier`}
                            onClick={() => setEditing({ enrollmentId: row.enrollmentId, learnerName: row.learnerName, day: d, current: status })}
                          >
                            <span aria-hidden="true" className="text-base">{status ? statusSymbol(status) : '+'}</span>
                          </button>
                        ) : (
                          <span className="block p-2"><span aria-hidden="true" className="text-base">{status ? statusSymbol(status) : '·'}</span><span className="sr-only">{label}</span></span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 mt-2 text-xs text-ink-2">{STATUS_LEGEND}</p>
      {editing && (
        <AttendanceDialog
          sessionId={sessionId}
          learnerName={editing.learnerName}
          enrollmentId={editing.enrollmentId}
          day={editing.day}
          current={editing.current}
          onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); await load(); }}
        />
      )}
    </>
  );
}

const STATUS_LEGEND = '✓ Présent · ⏱ En retard · ✕ Absent · · non saisi';
