'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { can } from '../../lib/permissions';
import type { Company, Page } from '../../lib/types';

export default function CompaniesPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Company>>({ items: [], total: 0 });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.company.read');
  const canCreate = can(profile, 'bd.company.create');

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setData(await api<Page<Company>>('/companies?pageSize=20'));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/companies', { method: 'POST', body: { name: name.trim() } });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  if (!canRead) {
    return (
      <>
        <h1>Bienvenue</h1>
        <p>Votre profil n&apos;a pas accès au module commercial pour le moment.</p>
      </>
    );
  }

  return (
    <>
      <h1>Entreprises cibles</h1>
      {canCreate && (
        <form onSubmit={submit} className="panel row">
          <label style={{ flex: 1, margin: 0, minWidth: 220 }}>
            Nouvelle entreprise
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
          </label>
          <button type="submit" style={{ alignSelf: 'flex-end' }}>Enregistrer</button>
        </form>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <p>{data.total} entreprise(s) visible(s) selon votre périmètre</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Statut</th><th>Secteur</th></tr></thead>
          <tbody>
            {data.items.map((company) => (
              <tr key={company.id}><td>{company.name}</td><td>{company.status}</td><td>{company.sector ?? '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
