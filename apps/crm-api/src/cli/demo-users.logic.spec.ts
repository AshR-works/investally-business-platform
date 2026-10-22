import { checkPasswordPolicy } from '../modules/iam/domain/password-policy';
import { RoleCode } from '../modules/iam/domain/roles';
import { assertNotProduction, DEMO_USERS, generateDemoPassword } from './demo-users.logic';

describe('comptes de démonstration', () => {
  it('couvre tous les rôles sauf SuperAdmin (créé par admin:create)', () => {
    const covered = new Set(DEMO_USERS.map((u) => u.role));
    for (const role of Object.values(RoleCode)) {
      expect(covered.has(role)).toBe(role !== RoleCode.SuperAdmin);
    }
  });

  it('utilise des adresses uniques du domaine réservé .test', () => {
    const emails = DEMO_USERS.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) expect(email.endsWith('.test')).toBe(true);
  });

  it('crée chaque responsable avant son équipe', () => {
    DEMO_USERS.forEach((user, index) => {
      if (!user.managerEmail) return;
      expect(DEMO_USERS.findIndex((u) => u.email === user.managerEmail)).toBeGreaterThanOrEqual(0);
      expect(DEMO_USERS.findIndex((u) => u.email === user.managerEmail)).toBeLessThan(index);
    });
  });

  it('génère des mots de passe différents et conformes à la politique', () => {
    const a = generateDemoPassword();
    const b = generateDemoPassword();
    expect(a).not.toBe(b);
    for (const user of DEMO_USERS) {
      expect(checkPasswordPolicy(generateDemoPassword(), { email: user.email, displayName: user.name })).toEqual([]);
    }
  });

  it('est interdit en production', () => {
    expect(() => assertNotProduction({ NODE_ENV: 'production' })).toThrow('interdits en production');
    expect(() => assertNotProduction({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
  });
});
