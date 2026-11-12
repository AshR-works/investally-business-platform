'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { APPOINTMENT_STATUS, appointmentTypeLabel, timeRange } from '../../lib/appointments';
import { formatDate } from '../../lib/format';
import type { Appointment, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';

/** Fenêtre de lecture : le serveur borne une recherche à 63 jours ; on lit donc deux fenêtres de 60 jours, avant et après aujourd'hui. */
const SPAN_DAYS = 60;
const DAY_MS = 86_400_000;

/**
 * Rendez-vous d'une entreprise, dans sa fiche (vue 360°) : lecture seule, les 60 derniers et les 60 prochains jours. Les actions
 * (planifier, reporter, tenir, annuler) restent dans l'agenda, qui contrôle les droits.
 */
export function AppointmentsPanel({ company }: { company: { id: string; name: string } }) {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const window = (from: number, to: number) =>
      api<Page<Appointment>>(`/appointments?companyId=${company.id}&from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}&pageSize=200`);
    Promise.all([window(now - SPAN_DAYS * DAY_MS, now), window(now, now + SPAN_DAYS * DAY_MS)])
      .then(([past, future]) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged = [...past.items, ...future.items].filter((a) => !seen.has(a.id) && seen.add(a.id));
        setItems(merged.sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Chargement des rendez-vous impossible');
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  return (
    <Card className="mb-8">
      <section aria-labelledby="appointments-title" className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="appointments-title" className="m-0 text-[length:var(--text-md)]">Rendez-vous</h2>
          <Link href={`/agenda?companyId=${company.id}`} className="text-ink">Ouvrir l’agenda de l’entreprise</Link>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        {items === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {items?.length === 0 && <p className="m-0 text-ink-2">Aucun rendez-vous dans les 60 derniers ni les 60 prochains jours.</p>}
        {items && items.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Rendez-vous avec {company.name}, des 60 derniers aux 60 prochains jours</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Horaire</th><th scope="col">Type</th><th scope="col">État</th><th scope="col">Contact</th></tr></thead>
              <tbody>
                {items.map((a) => {
                  const style = APPOINTMENT_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
                  return (
                    <tr key={a.id}>
                      <td>{formatDate(a.startsAt)}</td>
                      <td>{timeRange(a)}</td>
                      <td>{appointmentTypeLabel(a.type)}</td>
                      <td><Badge tone={style.tone}>{a.reportDue ? 'Compte rendu attendu' : style.label}</Badge></td>
                      <td>{a.contactName ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Card>
  );
}
