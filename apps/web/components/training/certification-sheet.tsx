'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../components/data/badge';
import { api, ApiError } from '../../lib/api';
import { CERTIFICATION_KIND_LABEL, CERTIFICATION_PERMISSIONS, CertificationSheet, CertificationSheetRow } from '../../lib/certification';
import { can } from '../../lib/permissions';
import { useAuth } from '../../lib/auth-context';
import { CertificationIssueDialog } from './certification-issue-dialog';
import { CertificationRevokeDialog } from './certification-revoke-dialog';

/**
 * Feuille des délivrances d'une session (S5.3c) : un inscrit CONFIRMÉ par ligne, sa certification si elle existe. Délivrance et
 * révocation réservées au responsable Investudy ; seulement une fois la session clôturée. Un document révoqué reste consultable,
 * jamais supprimé.
 */
export function CertificationSheetTable({ sessionId, refreshKey }: { sessionId: string; refreshKey: number }) {
  const { profile } = useAuth();
  const canRead = can(profile, CERTIFICATION_PERMISSIONS.read);
  const canIssuePermission = can(profile, CERTIFICATION_PERMISSIONS.issue);
  const canRevokePermission = can(profile, CERTIFICATION_PERMISSIONS.revoke);
  const [sheet, setSheet] = useState<CertificationSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<CertificationSheetRow | null>(null);
  const [revoking, setRevoking] = useState<CertificationSheetRow | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setSheet(await api<CertificationSheet>(`/sessions/${sessionId}/certifications`));
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

  return (
    <>
      <h2 className="mt-6">Certificats et attestations</h2>
      {!sheet.canIssue && <p role="status">La session n’est pas clôturée : aucune délivrance n’est possible pour l’instant.</p>}
      {sheet.rows.length === 0 ? (
        <p className="text-ink-2">Aucun inscrit confirmé : la feuille de délivrances apparaît une fois les premières inscriptions confirmées.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <caption className="sr-only">Certificats et attestations délivrés</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left">Apprenant</th>
                <th scope="col" className="p-2 text-left">Délivrance</th>
                <th scope="col" className="p-2 text-left">Référence</th>
                <th scope="col" className="p-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => {
                const c = row.certification;
                return (
                  <tr key={row.enrollmentId} className="border-t border-line">
                    <th scope="row" className="p-2 text-left font-semibold">{row.learnerName}</th>
                    <td className="p-2">
                      {c ? (
                        <Badge tone={c.status === 'REVOKED' ? 'bad' : c.kind === 'CERTIFICATE' ? 'ok' : 'info'}>
                          {c.status === 'REVOKED' ? 'Révoqué' : CERTIFICATION_KIND_LABEL[c.kind]}
                        </Badge>
                      ) : <span className="text-ink-2">Aucune</span>}
                      {c?.status === 'REVOKED' && c.revokeReason && <p className="m-0 mt-1 text-xs text-ink-2">Motif : {c.revokeReason}</p>}
                    </td>
                    <td className="p-2">{c?.referenceNumber ?? <span className="text-ink-2">—</span>}</td>
                    <td className="p-2 text-right">
                      {!c && sheet.canIssue && canIssuePermission && (
                        <button type="button" className="secondary" onClick={() => setIssuing(row)}>
                          Délivrer<span className="sr-only"> à {row.learnerName}</span>
                        </button>
                      )}
                      {c?.status === 'ISSUED' && canRevokePermission && (
                        <button type="button" className="secondary" onClick={() => setRevoking(row)}>
                          Révoquer<span className="sr-only"> la délivrance de {row.learnerName}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {issuing && (
        <CertificationIssueDialog
          sessionId={sessionId}
          learnerName={issuing.learnerName}
          enrollmentId={issuing.enrollmentId}
          onClose={() => setIssuing(null)}
          onDone={async () => { setIssuing(null); await load(); }}
        />
      )}
      {revoking && (
        <CertificationRevokeDialog
          sessionId={sessionId}
          learnerName={revoking.learnerName}
          enrollmentId={revoking.enrollmentId}
          onClose={() => setRevoking(null)}
          onDone={async () => { setRevoking(null); await load(); }}
        />
      )}
    </>
  );
}
