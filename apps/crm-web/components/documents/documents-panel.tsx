'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { extensionOf, formatBytes, formatDate, precheckFile } from '../../lib/format';
import { can } from '../../lib/permissions';
import type { DocumentDetailView, DocumentView, UploadRules } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';
import { DataTable, type Column } from '../data/data-table';
import { RowAction, RowActions } from '../data/row-actions';
import { Icon } from '../icon';
import { Modal } from '../modal';

/** Ce que la fenêtre ouverte est en train de faire. */
type Dialog =
  | { kind: 'add' }
  | { kind: 'version'; document: DocumentView }
  | { kind: 'history'; document: DocumentView }
  | { kind: 'archive'; document: DocumentView };

/** Teinte et texte de l'état d'analyse antivirus : tant que le service n'existe pas, le fichier est « non analysé ». */
function scanBadge(scan: string) {
  if (scan === 'CLEAN') return <Badge tone="ok">Analysé</Badge>;
  if (scan === 'INFECTED') return <Badge tone="bad">Infecté</Badge>;
  return <Badge tone="warn">Non analysé</Badge>;
}

/** Télécharge une version : le fichier est demandé avec le jeton (jamais d'adresse directe), puis proposé à l'enregistrement. */
async function downloadVersion(documentId: string, fileName: string, versionNumber?: number): Promise<void> {
  const blob = await api<Blob>(`/documents/${documentId}/download${versionNumber ? `?version=${versionNumber}` : ''}`, { blob: true });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Panneau « Documents » d'un objet (une entreprise aujourd'hui, offres et opportunités ensuite) : liste, envoi, nouvelle
 * version, historique des versions, téléchargement et archivage. Les boutons dépendent des droits ; l'API re-contrôle
 * tout (un document n'est jamais plus accessible que son objet).
 */
export function DocumentsPanel({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  const { profile } = useAuth();
  const [rules, setRules] = useState<UploadRules | null>(null);
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canCreate = can(profile, 'docs.document.create');
  const canDownload = can(profile, 'docs.document.download');
  const canDelete = can(profile, 'docs.document.delete');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ ownerType, ownerId, includeArchived: String(showArchived) });
      setDocuments(await api<DocumentView[]>(`/documents?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement des documents impossible');
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<UploadRules>('/documents/meta').then(setRules).catch(() => setRules(null));
  }, []);

  /** Télécharge et signale une erreur sans casser la page. */
  async function download(document: DocumentView, versionNumber?: number) {
    setError(null);
    try {
      await downloadVersion(document.id, document.current.fileName, versionNumber);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Téléchargement impossible');
    }
  }

  async function done(message: string) {
    setDialog(null);
    setNotice(message);
    await load();
  }

  const columns: Column<DocumentView>[] = [
    {
      id: 'title',
      header: 'Document',
      cell: (d) => (
        <div className="min-w-0">
          <strong className="block truncate">{d.title}</strong>
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            {d.category && rules?.categories.find((c) => c.code === d.category)?.label}
            {d.status === 'ARCHIVED' && <Badge>Archivé</Badge>}
          </span>
        </div>
      ),
    },
    {
      id: 'file',
      header: 'Fichier',
      cell: (d) => (
        <span title={d.current.sha256}>
          {d.current.fileName}
          <span className="block text-xs text-ink-2">{formatBytes(d.current.sizeBytes)} · version {d.current.number}</span>
        </span>
      ),
    },
    { id: 'added', header: 'Version du', cell: (d) => formatDate(d.current.uploadedAt) },
    { id: 'scan', header: 'Antivirus', cell: (d) => scanBadge(d.current.scanStatus) },
    {
      id: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      cell: (d) => (
        <div className="flex items-center justify-end gap-1">
          {canDownload && <button type="button" className="secondary small" onClick={() => void download(d)}>Télécharger</button>}
          <RowActions label={`Actions pour ${d.title}`}>
            <RowAction onClick={() => setDialog({ kind: 'history', document: d })}>Historique des versions</RowAction>
            {canCreate && d.status !== 'ARCHIVED' && <RowAction onClick={() => setDialog({ kind: 'version', document: d })}>Ajouter une nouvelle version</RowAction>}
            {canDelete && d.status !== 'ARCHIVED' && <RowAction danger onClick={() => setDialog({ kind: 'archive', document: d })}>Archiver</RowAction>}
          </RowActions>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="documents-titre">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="documents-titre" className="m-0">Documents</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline m-0 text-[length:var(--text-sm)]">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Afficher les documents archivés
          </label>
          {canCreate && (
            <button type="button" className="inline-flex items-center gap-2" onClick={() => setDialog({ kind: 'add' })} disabled={!rules}>
              <Icon name="plus" className="size-4" />Ajouter un document
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      <p role="status" className="min-h-5 text-ok">{notice}</p>

      <Card>
        <DataTable caption="Documents" columns={columns} rows={documents} rowId={(d) => d.id} rowLabel={(d) => d.title} busy={loading} empty="Aucun document pour le moment." />
      </Card>
      <p className="mt-3 text-[length:var(--text-sm)] text-ink-2">
        Les fichiers ne sont pas encore analysés par un antivirus (service prévu avant la mise en production) : n’ouvrez que des documents dont vous connaissez l’origine.
      </p>

      {dialog?.kind === 'add' && rules && <UploadDialog rules={rules} title="Ajouter un document" ownerType={ownerType} ownerId={ownerId} onClose={() => setDialog(null)} onDone={() => done('Document ajouté.')} />}
      {dialog?.kind === 'version' && rules && <UploadDialog rules={rules} title="Nouvelle version" existing={dialog.document} onClose={() => setDialog(null)} onDone={() => done('Nouvelle version ajoutée.')} />}
      {dialog?.kind === 'history' && <HistoryDialog document={dialog.document} canDownload={canDownload} onClose={() => setDialog(null)} onError={setError} />}
      {dialog?.kind === 'archive' && (
        <Modal title="Archiver ce document" onClose={() => setDialog(null)}>
          <p><strong>{dialog.document.title}</strong> n’apparaîtra plus par défaut et n’acceptera plus de nouvelle version. Ses versions et ses fichiers sont conservés.</p>
          <div className="row end">
            <button type="button" className="secondary" onClick={() => setDialog(null)}>Annuler</button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                const target = dialog.document;
                api(`/documents/${target.id}/archive`, { method: 'POST' })
                  .then(() => done('Document archivé.'))
                  .catch((e) => { setDialog(null); setError(e instanceof ApiError ? e.message : 'Archivage impossible'); });
              }}
            >
              Archiver
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

/**
 * Fenêtre d'envoi d'un fichier : nouveau document (titre, catégorie) ou nouvelle version d'un document existant. Un
 * contrôle de confort précède l'envoi (taille, extension) ; le serveur reste seul juge, il reconnaît le format par le
 * contenu du fichier.
 */
function UploadDialog({ rules, title, ownerType, ownerId, existing, onClose, onDone }: {
  rules: UploadRules;
  title: string;
  ownerType?: string;
  ownerId?: string;
  existing?: DocumentView;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [docTitle, setDocTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Envoie le fichier en corps binaire ; le message du serveur s'affiche tel quel en cas de refus. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const problem = precheckFile(file, rules);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const raw = { type: 'application/octet-stream', data: file };
      if (existing) {
        await api(`/documents/${existing.id}/versions?${new URLSearchParams({ fileName: file.name })}`, { method: 'POST', raw });
      } else {
        const params = new URLSearchParams({ ownerType: ownerType!, ownerId: ownerId!, title: docTitle.trim(), fileName: file.name });
        if (category) params.set('category', category);
        await api(`/documents?${params}`, { method: 'POST', raw });
      }
      await onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Échec de l'envoi");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {existing ? (
          <p>Document : <strong>{existing.title}</strong> (version actuelle : {existing.current.number}). Les versions précédentes sont conservées.</p>
        ) : (
          <>
            <label>
              Titre du document
              <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} maxLength={300} required />
            </label>
            <label>
              Catégorie
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Non précisée</option>
                {rules.categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
          </>
        )}
        <label>
          Fichier
          <input
            type="file"
            accept={rules.formats.map((f) => `.${f}`).join(',')}
            required
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              setFile(picked);
              setError(null);
              if (picked && !existing && docTitle.trim() === '') setDocTitle(picked.name.replace(/\.[^.]+$/, ''));
            }}
          />
        </label>
        <p className="hint">Formats : {rules.formats.map((f) => f.toUpperCase()).join(', ')} · {formatBytes(rules.maxBytes)} au plus.{file ? ` Choisi : ${file.name} (${formatBytes(file.size)}, .${extensionOf(file.name)}).` : ''}</p>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy || !file || (!existing && docTitle.trim().length === 0)}>{busy ? 'Envoi…' : 'Envoyer'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Historique des versions d'un document : chaque version reste téléchargeable, avec son empreinte SHA-256. */
function HistoryDialog({ document, canDownload, onClose, onError }: { document: DocumentView; canDownload: boolean; onClose: () => void; onError: (message: string) => void }) {
  const [detail, setDetail] = useState<DocumentDetailView | null>(null);

  useEffect(() => {
    api<DocumentDetailView>(`/documents/${document.id}`).then(setDetail).catch((e) => onError(e instanceof ApiError ? e.message : 'Historique indisponible'));
  }, [document.id, onError]);

  return (
    <Modal title={`Versions de « ${document.title} »`} onClose={onClose}>
      {!detail ? (
        <p role="status">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <caption className="sr-only">Versions du document</caption>
            <thead><tr><th scope="col">Version</th><th scope="col">Fichier</th><th scope="col">Ajoutée le</th><th scope="col">Empreinte SHA-256</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {detail.versions.map((v) => (
                <tr key={v.number}>
                  <td>{v.number}</td>
                  <td>{v.fileName}<span className="block text-xs text-ink-2">{formatBytes(v.sizeBytes)}</span></td>
                  <td>{formatDate(v.uploadedAt)}</td>
                  <td><code title={v.sha256}>{v.sha256.slice(0, 12)}…</code></td>
                  <td>{canDownload && <button type="button" className="secondary small" onClick={() => void downloadVersion(document.id, v.fileName, v.number).catch((e) => onError(e instanceof ApiError ? e.message : 'Téléchargement impossible'))}>Télécharger</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row end" style={{ marginTop: '1rem' }}>
        <button type="button" className="secondary" onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  );
}
