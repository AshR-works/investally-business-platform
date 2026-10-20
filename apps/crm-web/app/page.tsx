'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface Company {
  id: string;
  name: string;
  status: string;
  sector: string | null;
}

interface Page {
  items: Company[];
  total: number;
}

export default function Home() {
  const [data, setData] = useState<Page>({ items: [], total: 0 });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/companies?pageSize=20');
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch('/api/v1/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const problem = await res.json().catch(() => null);
      setError(typeof problem?.detail === 'string' ? problem.detail : 'Échec de l\'enregistrement');
      return;
    }
    setName('');
    await load();
  }

  return (
    <main>
      <h1>Entreprises cibles</h1>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'entreprise"
          aria-label="Nom de l'entreprise"
          maxLength={200}
          required
          style={{ flex: 1 }}
        />
        <button type="submit">Enregistrer</button>
      </form>
      {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}
      <p>{data.total} entreprise(s)</p>
      <ul>
        {data.items.map((c) => (
          <li key={c.id}>
            {c.name} — {c.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
