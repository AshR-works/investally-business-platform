import { randomBytes } from 'node:crypto';
import { RoleCode } from '../modules/iam/domain/roles';

/** Compte de démonstration : adresse (domaine .test réservé, jamais joignable), nom fictif, rôle et responsable. */
export interface DemoUser {
  email: string;
  name: string;
  role: RoleCode;
  /** Adresse du responsable hiérarchique (sert aux portées « équipe »), à créer avant. */
  managerEmail?: string;
}

const domain = 'demo.investally.test';

/**
 * Un compte par rôle, plus un second chargé de compte : il permet de vérifier qu'un commercial ne voit pas les
 * entreprises d'un autre (portée « propres objets »). Le SuperAdmin est le compte créé au démarrage (admin:create).
 * Ordre : les responsables avant leurs équipes.
 */
export const DEMO_USERS: readonly DemoUser[] = [
  { email: `direction@${domain}`, name: 'Diane Direction', role: RoleCode.Direction },
  { email: `commercial@${domain}`, name: 'Hugo Responsable Commercial', role: RoleCode.HeadOfSales },
  { email: `compte1@${domain}`, name: 'Camille Chargée de Compte', role: RoleCode.AccountManager, managerEmail: `commercial@${domain}` },
  { email: `compte2@${domain}`, name: 'Karim Chargé de Compte', role: RoleCode.AccountManager, managerEmail: `commercial@${domain}` },
  { email: `investudy@${domain}`, name: 'Inès Responsable Investudy', role: RoleCode.TrainingManager },
  { email: `formateur@${domain}`, name: 'Franck Formateur', role: RoleCode.Trainer, managerEmail: `investudy@${domain}` },
  { email: `support@${domain}`, name: 'Sonia Support', role: RoleCode.Support },
  { email: `finance@${domain}`, name: 'Félix Finance', role: RoleCode.Finance },
  { email: `rh@${domain}`, name: 'Rita Ressources Humaines', role: RoleCode.Hr },
  { email: `fiscalite@${domain}`, name: 'Théo Fiscalité', role: RoleCode.Tax },
];

/** Mot de passe aléatoire propre à chaque compte (jamais un mot de passe commun ni prévisible). */
export function generateDemoPassword(random: (size: number) => Buffer = randomBytes): string {
  return [0, 1, 2].map(() => random(6).toString('hex')).join('-');
}

/** Refuse toute exécution en production : ces comptes sont réservés au développement et à la recette. */
export function assertNotProduction(env: NodeJS.ProcessEnv = process.env): void {
  if ((env.NODE_ENV ?? 'development') === 'production') {
    throw new Error('Les comptes de démonstration sont interdits en production');
  }
}
