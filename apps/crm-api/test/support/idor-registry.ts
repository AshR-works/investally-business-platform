/**
 * Registre du contrat anti-IDOR. TOUTE route qui désigne un objet (paramètre `:id`) ou qui reçoit un identifiant d'objet
 * dans sa requête doit être classée ici, sinon `idor-contract.spec.ts` échoue.
 *
 * - `objet` : l'accès dépend de l'objet visé (propriétaire, équipe). Un acteur qui a la permission mais pas la portée doit
 *   recevoir EXACTEMENT la même réponse que pour un objet inexistant (404). Chaque route de cette catégorie DOIT avoir une
 *   sonde dans `idor-contract.integration.spec.ts`.
 * - `admin` : réservée aux détenteurs d'une permission `iam.user.*`, accordée au seul Super administrateur (portée Tous) ;
 *   le test vérifie que personne d'autre ne la détient.
 * - `portee-tous` : agit sur n'importe quel utilisateur avec une permission que d'autres rôles détiennent en portée « propre »
 *   (ex. `iam.session.revoke`) ; la garde doit alors exiger la portée Tous (`minScope: 'ALL'`).
 */
export type IdorClass = 'objet' | 'admin' | 'portee-tous';

export const IDOR_ROUTES: Record<string, IdorClass> = {
  'GET /companies/:id': 'objet',
  'GET /facilitators/:id': 'objet',
  'GET /companies/:id/export': 'objet',
  'PUT /companies/:id': 'objet',
  'GET /documents': 'objet',
  'POST /documents': 'objet',
  'GET /documents/:id': 'objet',
  'GET /documents/:id/download': 'objet',
  'POST /documents/:id/versions': 'objet',
  'POST /documents/:id/archive': 'objet',
  'DELETE /auth/sessions/:id': 'objet',

  'GET /admin/users/:id': 'admin',
  'PATCH /admin/users/:id': 'admin',
  'POST /admin/users/:id/invitations': 'admin',
  'POST /admin/users/:id/disable': 'admin',
  'POST /admin/users/:id/enable': 'admin',
  'PUT /admin/users/:id/roles': 'admin',
  'POST /admin/users/:id/mfa/reset': 'admin',
  'POST /admin/users/:id/password-reset': 'admin',
  'POST /admin/users/:id/sessions/revoke': 'portee-tous',
};

/** Routes qui reçoivent un identifiant d'objet dans la requête sans le mettre dans le chemin (`?ownerId=`). */
export const OBJECT_ID_IN_QUERY = ['GET /documents', 'POST /documents'];
