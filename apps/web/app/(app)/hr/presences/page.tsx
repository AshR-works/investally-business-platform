'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { PresenceDialog } from '../../../../components/hr/presence-dialog';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { type DirectoryEntry, departmentsOf } from '../../../../lib/hr';
import { dayText } from '../../../../lib/leave';
import { can, canAll } from '../../../../lib/permissions';
import {
  addDays, canEditCell, cellOf, dayTotals, isWeekend, MODE_OPTIONS, modeLabel, modeSymbol, type PresenceBoard, type PresenceMode, type PresenceRow, shiftWeek, weekdayName, WEEKDAY_LETTERS,
  weekDays, weekStart,
} from '../../../../lib/presences';
import { todayIso } from '../../../../lib/receipts';

interface Editing {
  row: PresenceRow;
  day: string;
  current: PresenceMode | null;
}

/**
 * Présences déclaratives : qui est sur site, en télétravail ou en déplacement, jour par jour. Chacun déclare sa journée ; la RH peut déclarer pour tous ; un
 * responsable voit sa ligne et celles de ses collaborateurs directs ; la RH et la Direction voient tout le personnel. Les jours d'absence validée sont indiqués.
 * Aucune heure, aucun lieu : le mode est dit par un symbole ET par un texte (jamais le symbole ou la couleur seuls).
 */
export default function PresencesPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.presence.read');
  const seesAll = canAll(profile, 'hr.presence.read');
  const today = todayIso();
  const [start, setStart] = useState(weekStart(today));
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [board, setBoard] = useState<PresenceBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ from: start, to: addDays(start, 6) });
    if (department) params.set('department', department);
    try {
      setBoard(await api<PresenceBoard>(`/hr/presences?${params}`));
      setLoadError(null);
    } catch (e) {
      setBoard(null);
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [canRead, start, department]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!canRead || !seesAll) return;
    api<DirectoryEntry[]>('/hr/org-chart').then((all) => setDepartments(departmentsOf(all))).catch(() => setDepartments([]));
  }, [canRead, seesAll]);

  const days = useMemo(() => weekDays(start), [start]);
  const title = `Semaine du ${dayText(start)} au ${dayText(addDays(start, 6))}`;

  if (!canRead) {
    return (
      <>
        <PageHeading>Présences</PageHeading>
        <p>Votre profil n&apos;a pas accès aux présences.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Présences"
        description="Où chacun travaille, jour par jour : sur site, en télétravail ou en déplacement. Déclaratif : aucune heure ni aucun lieu n’est enregistré."
      />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      {board && board.viewerEmployeeId === null && (
        <p role="status">Aucune fiche employé n’est liée à votre compte : vous ne pouvez pas déclarer votre présence. Demandez à la RH de la relier.</p>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <button type="button" className="secondary" onClick={() => setStart((s) => shiftWeek(s, -1))} aria-label="Semaine précédente">←</button>
          <h2 className="m-0 min-w-64 text-center text-[length:var(--text-md)]" aria-live="polite">{title}</h2>
          <button type="button" className="secondary" onClick={() => setStart((s) => shiftWeek(s, 1))} aria-label="Semaine suivante">→</button>
          <button type="button" className="secondary" onClick={() => setStart(weekStart(today))}>Cette semaine</button>
          {seesAll && (
            <label className="m-0 ml-auto flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
              Service
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
                <option value="">Tous</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <caption className="sr-only">Présences de la {title.toLowerCase()}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-48 bg-surface p-2 text-left">Employé</th>
                {days.map((d, index) => (
                  <th key={d} scope="col" className={`min-w-20 p-2 text-center text-xs font-semibold ${isWeekend(d) ? 'bg-surface-2 text-ink-2' : ''} ${d === today ? 'text-brand-strong underline' : ''}`}>
                    <span aria-hidden="true">{WEEKDAY_LETTERS[index]}<br />{Number(d.slice(8))}</span>
                    <span className="sr-only">{weekdayName(d)} {dayText(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board && board.rows.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-ink-2">Aucun employé à afficher.</td></tr>
              )}
              {board?.rows.map((row) => (
                <tr key={row.employeeId} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-2 text-left font-semibold">
                    {row.employeeName}
                    {row.employeeId === board.viewerEmployeeId && <span className="ml-2 text-xs font-normal text-ink-2">(vous)</span>}
                    <span className="block text-xs font-normal text-ink-2">{row.department}</span>
                  </th>
                  {days.map((d) => {
                    const cell = cellOf(row, d);
                    const editable = canEditCell(board, row, d, today);
                    const content = cell.kind === 'leave'
                      ? (<><span aria-hidden="true">✕</span><span className="sr-only">absent (absence validée)</span></>)
                      : cell.kind === 'mode'
                        ? (<><span aria-hidden="true" className="text-base">{modeSymbol(cell.mode)}</span><span className="sr-only">{modeLabel(cell.mode)}</span></>)
                        : (<><span aria-hidden="true">·</span><span className="sr-only">non déclaré</span></>);
                    return (
                      <td key={d} className={`p-0 text-center ${isWeekend(d) ? 'bg-surface-2' : ''} ${cell.kind === 'mode' ? 'bg-brand-soft text-brand-strong' : ''}`}>
                        {editable ? (
                          <button
                            type="button"
                            className="secondary h-full w-full min-w-11 border-0 bg-transparent p-2"
                            aria-label={`Présence de ${row.employeeName}, ${weekdayName(d)} ${dayText(d)} : ${cell.kind === 'mode' ? modeLabel(cell.mode) : 'non déclaré'}. Modifier`}
                            onClick={() => setEditing({ row, day: d, current: cell.kind === 'mode' ? cell.mode : null })}
                          >
                            <span aria-hidden="true" className="text-base">{cell.kind === 'mode' ? modeSymbol(cell.mode) : '+'}</span>
                          </button>
                        ) : (
                          <span className="block p-2">{content}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {board && board.rows.length > 1 && (
              <tfoot>
                <tr className="border-t border-line-strong">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-2 text-left">Total du jour<span className="block text-xs font-normal text-ink-2">■ sur site · ⌂ télétravail · → déplacement · ✕ absents</span></th>
                  {days.map((d) => {
                    const totals = dayTotals(board.rows, d);
                    return (
                      <td key={d} className="p-1 text-center text-xs text-ink-2">
                        {MODE_OPTIONS.map((m) => (
                          <span key={m.code} className="block"><span aria-hidden="true">{m.symbol} {totals[m.code]}</span><span className="sr-only">{m.label} : {totals[m.code]}</span></span>
                        ))}
                        <span className="block"><span aria-hidden="true">✕ {totals.LEAVE}</span><span className="sr-only">Absents : {totals.LEAVE}</span></span>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="m-0 border-t border-line p-3 text-xs text-ink-2">
          {MODE_OPTIONS.map((m) => `${m.symbol} ${m.label}`).join(' · ')} · ✕ absence validée · · non déclaré · colonnes grisées : week-end. Vous pouvez saisir de 7 jours en arrière à 30 jours en avant (la RH : 90 jours).
        </p>
      </Card>
      {editing && (
        <PresenceDialog
          employeeId={editing.row.employeeId}
          employeeName={editing.row.employeeName}
          self={editing.row.employeeId === board?.viewerEmployeeId}
          day={editing.day}
          current={editing.current}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </>
  );
}
