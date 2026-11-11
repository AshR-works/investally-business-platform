'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ENTITY_NOUN, type EntityKind } from '../lib/entity-links';
import { Card } from './data/card';
import { PageHeader } from './data/page-header';
import { PageHeading } from './page-heading';

/** Charge une entité par son identifiant d'adresse. Hors portée ou inconnue : « introuvable » (le serveur ne distingue pas les deux). */
export function useEntity<T>(path: string): { entity: T | null; error: string | null; reload: () => Promise<void> } {
  const { id } = useParams<{ id: string }>();
  const [entity, setEntity] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(
    () => api<T>(`/${path}/${encodeURIComponent(id)}`).then((e) => { setEntity(e); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible')),
    [path, id],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  return { entity, error, reload };
}

/** Une ligne « libellé : valeur » de la fiche. */
export interface Fact {
  label: string;
  value: ReactNode;
}

/**
 * Coque commune des fiches détaillées : en-tête, fil d'Ariane vers la liste, grille de faits, puis les blocs liés.
 * Les fiches sont en lecture ; les actions de cycle de vie restent dans les listes (une seule voie de modification).
 */
export function EntitySheet({ eyebrow, title, description, listHref, listLabel, facts, actions, children }: {
  eyebrow: string;
  title: string;
  description?: string;
  listHref: string;
  listLabel: string;
  facts: Fact[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} stacked />
      <p className="m-0 mb-4 text-[length:var(--text-sm)]"><Link href={listHref}>← {listLabel}</Link></p>
      <Card className="mb-8">
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6 p-5">
          {facts.map((f) => (
            <div key={f.label}><dt className="text-xs font-semibold text-ink-2">{f.label}</dt><dd className="m-0 mt-1">{f.value}</dd></div>
          ))}
        </dl>
      </Card>
      {children}
    </>
  );
}

/** État « introuvable » ou erreur de chargement d'une fiche ; `null` pendant le chargement. */
export function SheetState({ kind, error, loaded, listHref, listLabel }: { kind: EntityKind; error: string | null; loaded: boolean; listHref: string; listLabel: string }) {
  if (error) {
    return (
      <>
        <PageHeading title={`Fiche introuvable`}>Fiche introuvable</PageHeading>
        <p role="alert" className="error">{error}</p>
        <p><Link href={listHref}>← {listLabel}</Link></p>
      </>
    );
  }
  if (!loaded) return <p role="status">Chargement de la fiche de {ENTITY_NOUN[kind]}…</p>;
  return null;
}
