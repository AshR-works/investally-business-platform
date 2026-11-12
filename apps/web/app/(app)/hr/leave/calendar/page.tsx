'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../../../components/data/card';
import { PageHeader } from '../../../../../components/data/page-header';
import { LeaveNav } from '../../../../../components/hr/leave-nav';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { type DirectoryEntry, departmentsOf } from '../../../../../lib/hr';
import { calendarRows, dayText, daysInMonth, type DayMark, markOn, monthBounds, monthName, shiftMonth, type TeamCalendar, weekdayOf } from '../../../../../lib/leave';
import { can, canAll } from '../../../../../lib/permissions';
import { todayIso } from '../../../../../lib/receipts';

const LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MARK_TEXT: Record<Exclude<DayMark, null>, string> = { full: 'absent', morning: 'absent le matin', afternoon: 'absent l’après-midi' };
const MARK_CLASS: Record<Exclude<DayMark, null>, string> = {
  full: 'bg-brand-soft text-brand-strong',
  morning: 'bg-brand-soft text-brand-strong',
  afternoon: 'bg-brand-soft text-brand-strong',
};
const MARK_SYMBOL: Record<Exclude<DayMark, null>, string> = { full: '●', morning: '◐', afternoon: '◑' };

/**
 * Calendrier d'équipe : une ligne par personne absente du mois, une colonne par jour. Un collègue y voit seulement « absent » (ni le type, ni le motif) ; la RH et la
 * Direction voient aussi le type. Week-ends et jours fériés sont grisés. La demi-journée est dite par le symbole ET par le texte (jamais la couleur seule).
 */
export default function LeaveCalendarPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.leave.read');
  const seesAll = canAll(profile, 'hr.leave.read');
  const today = todayIso();
  const [cursor, setCursor] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<TeamCalendar | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const { from, to } = monthBounds(cursor.year, cursor.month);
    const params = new URLSearchParams({ from, to });
    if (department) params.set('department', department);
    try {
      setCalendar(await api<TeamCalendar>(`/hr/leave/calendar?${params}`));
      setLoadError(null);
    } catch (e) {
      setCalendar(null);
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [canRead, cursor, department]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!canRead || !seesAll) return;
    api<DirectoryEntry[]>('/hr/org-chart').then((all) => setDepartments(departmentsOf(all))).catch(() => setDepartments([]));
  }, [canRead, seesAll]);

  const total = daysInMonth(cursor.year, cursor.month);
  const days = useMemo(() => Array.from({ length: total }, (_, i) => `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`), [cursor, total]);
  const holidays = useMemo(() => new Map((calendar?.holidays ?? []).map((h) => [h.day, h.label])), [calendar]);
  const rows = useMemo(() => calendarRows(calendar?.entries ?? []), [calendar]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Calendrier d’équipe</PageHeading>
        <p>Votre profil n&apos;a pas accès au calendrier des absences.</p>
      </>
    );
  }

  const monthTitle = `${monthName(cursor.month)} ${cursor.year}`;
  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Calendrier d’équipe"
        description="Qui est absent, jour par jour. Les collègues voient seulement « absent » : ni le type, ni le motif."
      />
      <LeaveNav current="calendar" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <button type="button" className="secondary" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))} aria-label="Mois précédent">←</button>
          <h2 className="m-0 min-w-40 text-center text-[length:var(--text-md)] capitalize" aria-live="polite">{monthTitle}</h2>
          <button type="button" className="secondary" onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))} aria-label="Mois suivant">→</button>
          <button type="button" className="secondary" onClick={() => setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })}>Aujourd’hui</button>
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
            <caption className="sr-only">Absences de {monthTitle}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-48 bg-surface p-2 text-left">Employé</th>
                {days.map((d) => {
                  const off = weekdayOf(d) === 0 || weekdayOf(d) === 6;
                  const holiday = holidays.get(d);
                  return (
                    <th key={d} scope="col" title={holiday ? `${dayText(d)} : ${holiday}` : dayText(d)} className={`min-w-8 p-1 text-center text-xs font-semibold ${off || holiday ? 'bg-surface-2 text-ink-2' : ''} ${d === today ? 'text-brand-strong underline' : ''}`}>
                      <span aria-hidden="true">{LETTERS[weekdayOf(d)]}<br />{Number(d.slice(8))}</span>
                      <span className="sr-only">{dayText(d)}{holiday ? `, jour férié : ${holiday}` : ''}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={total + 1} className="p-4 text-center text-ink-2">Aucune absence validée en {monthTitle}.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.employeeId} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-2 text-left font-semibold">
                    {row.employeeName}
                    <span className="block text-xs font-normal text-ink-2">{row.department}{row.entries[0]?.leaveTypeLabel ? ` · ${[...new Set(row.entries.map((e) => e.leaveTypeLabel))].join(', ')}` : ''}</span>
                  </th>
                  {days.map((d) => {
                    // Un week-end ou un jour férié au milieu d'une absence n'est pas une journée d'absence : la case reste grisée, sans marque.
                    const off = weekdayOf(d) === 0 || weekdayOf(d) === 6 || holidays.has(d);
                    const mark = off ? null : row.entries.map((e) => markOn(e, d)).find((m) => m !== null) ?? null;
                    return (
                      <td key={d} className={`p-0 text-center ${off ? 'bg-surface-2' : ''} ${mark ? MARK_CLASS[mark] : ''}`}>
                        {mark && (<><span aria-hidden="true">{MARK_SYMBOL[mark]}</span><span className="sr-only">{MARK_TEXT[mark]}</span></>)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 border-t border-line p-3 text-xs text-ink-2">● journée entière · ◐ matinée seule · ◑ après-midi seul · colonnes grisées : week-end ou jour férié.</p>
      </Card>
    </>
  );
}
