'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { contactRoleLabel } from '../../lib/contacts';
import { can } from '../../lib/permissions';
import type { Contact, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';
import { RowActions } from '../data/row-actions';
import { ConfirmDialog } from '../confirm-dialog';
import { ContactDialog } from './contact-dialog';

/**
 * Contacts d'une entreprise, dans sa fiche : liste, création, modification, suppression (avec confirmation). Chaque bouton
 * n'apparaît que si l'utilisateur a la permission ; le serveur re-contrôle chaque requête, et la portée est celle de l'entreprise.
 */
export function ContactsPanel({ company }: { company: { id: string; name: string } }) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: 'create' } | { kind: 'edit'; contact: Contact } | { kind: 'delete'; contact: Contact } | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = can(profile, 'bd.contact.create');
  const canUpdate = can(profile, 'bd.contact.update');
  const canDelete = can(profile, 'bd.contact.delete');

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Contact>>(`/contacts?companyId=${company.id}&pageSize=100`);
      setContacts(page.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement des contacts impossible');
    }
  }, [company.id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function remove(contact: Contact) {
    setBusy(true);
    try {
      await api(`/contacts/${contact.id}`, { method: 'DELETE' });
      setDialog(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Suppression impossible');
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8">
      <section aria-labelledby="contacts-title" className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="contacts-title" className="m-0 text-[length:var(--text-md)]">Contacts</h2>
          {canCreate && <button type="button" className="secondary" onClick={() => setDialog({ kind: 'create' })}>Nouveau contact</button>}
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        {contacts === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {contacts?.length === 0 && <p className="m-0 text-ink-2">Aucun contact pour cette entreprise{canCreate ? ' : ajoutez le DAF ou le décideur.' : '.'}</p>}
        {contacts && contacts.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Contacts de {company.name}</caption>
              <thead><tr><th scope="col">Contact</th><th scope="col">Fonction</th><th scope="col">E-mail</th><th scope="col">Téléphone</th>{(canUpdate || canDelete) && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.firstName} {c.lastName}</strong></td>
                    <td><Badge tone="neutral">{contactRoleLabel(c.role)}</Badge></td>
                    <td>{c.email ?? '—'}</td>
                    <td>{c.phone ?? '—'}</td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <RowActions label={`Actions pour ${c.firstName} ${c.lastName}`}>
                          {canUpdate && <button type="button" onClick={() => setDialog({ kind: 'edit', contact: c })}>Modifier</button>}
                          {canDelete && <button type="button" onClick={() => setDialog({ kind: 'delete', contact: c })}>Supprimer</button>}
                        </RowActions>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {dialog?.kind === 'create' && <ContactDialog company={company} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />}
      {dialog?.kind === 'edit' && <ContactDialog contact={dialog.contact} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog title="Supprimer ce contact" confirmLabel="Supprimer" busy={busy} onConfirm={() => void remove(dialog.contact)} onCancel={() => setDialog(null)}>
          <p className="m-0">Supprimer <strong>{dialog.contact.firstName} {dialog.contact.lastName}</strong> de {company.name} ? Cette action est enregistrée dans l’audit.</p>
        </ConfirmDialog>
      )}
    </Card>
  );
}
