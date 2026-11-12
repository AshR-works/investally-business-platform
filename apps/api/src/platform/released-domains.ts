/**
 * Domaines fonctionnels de l'application, tels que les nomment les permissions (`domaine.ressource.action`). Un domaine non publié est refusé par le
 * serveur (404) et masqué par l'interface : la V1 publie `iam` et `hr`, le reste attend les prochaines mises à jour.
 */
export const KNOWN_DOMAINS = ['iam', 'audit', 'docs', 'bd', 'hr', 'training', 'reporting'] as const;

/** Domaine d'un code de permission (`bd.company.read` → `bd`). */
export const domainOfPermission = (permission: string): string => permission.split('.')[0] ?? '';

/**
 * Lit `RELEASED_DOMAINS` : liste de domaines séparés par des virgules, ou `all`. Absent hors production = tout est publié (développement, tests) ;
 * en production il est OBLIGATOIRE : un oubli ne doit jamais publier des écrans non validés. `iam` est toujours exigé (sans lui, personne ne peut se connecter).
 * Renvoie `null` quand tout est publié.
 */
export function parseReleasedDomains(raw: string | undefined, production: boolean): readonly string[] | null {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    if (production) throw new Error("RELEASED_DOMAINS est obligatoire en production (par exemple « iam,hr » pour la V1, ou « all » pour tout publier)");
    return null;
  }
  if (value === 'all') return null;
  const domains = [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
  for (const domain of domains) {
    if (!(KNOWN_DOMAINS as readonly string[]).includes(domain)) {
      throw new Error(`RELEASED_DOMAINS : domaine inconnu « ${domain} » (valeurs possibles : ${KNOWN_DOMAINS.join(', ')}, ou all)`);
    }
  }
  if (!domains.includes('iam')) throw new Error('RELEASED_DOMAINS doit contenir « iam » : sans lui, personne ne peut se connecter');
  return domains;
}

/** Vrai si le domaine est publié (`null` = tout est publié). */
export const isDomainReleased = (released: readonly string[] | null, domain: string): boolean => released === null || released.includes(domain);
