import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'entreprise accepte exactement les transitions que l'interface propose.
import { Company } from '../../api/src/modules/business-development/domain/company';
import { CompanyStatus, MANUAL_STATUS_TRANSITIONS } from '../../api/src/modules/business-development/domain/company-status';
import { COMPANY_COLUMNS, DEFAULT_COLUMNS } from '../lib/company-table';
import { type OwnerCandidate, otherOwners, STATUS_STEPS, statusActions } from '../lib/company-lifecycle';
import { COMPANY_STATUS } from '../lib/status';

const now = new Date('2026-11-05T10:00:00Z');

describe('statut d’une entreprise : actions proposées (CU-C-05)', () => {
  it('Cible : seulement « Marquer comme contactée »', () => {
    expect(statusActions('TARGET')).toEqual([{ to: 'CONTACTED', label: 'Marquer comme contactée', backward: false }]);
  });
  it('Contactée : revenir à « Cible » ou qualifier', () => {
    expect(statusActions('CONTACTED')).toEqual([
      { to: 'TARGET', label: 'Revenir à « Cible »', backward: true },
      { to: 'QUALIFIED', label: 'Qualifier l’entreprise', backward: false },
    ]);
  });
  it('Qualifiée : seulement le retour à « Contactée »', () => {
    expect(statusActions('QUALIFIED')).toEqual([{ to: 'CONTACTED', label: 'Revenir à « Contactée »', backward: true }]);
  });
  it('Cliente, Archivée et un statut inconnu : aucune action manuelle', () => {
    expect(statusActions('CLIENT')).toEqual([]);
    expect(statusActions('ARCHIVED')).toEqual([]);
    expect(statusActions('INCONNU')).toEqual([]);
  });
  it('chaque statut du domaine a ses transitions déclarées et un libellé', () => {
    for (const status of Object.values(CompanyStatus)) {
      expect(STATUS_STEPS).toHaveProperty(status);
      expect(COMPANY_STATUS).toHaveProperty(status);
    }
  });
});

describe('cohérence avec le domaine réel du serveur', () => {
  it('les transitions de l’interface sont exactement celles du domaine', () => {
    for (const status of Object.values(CompanyStatus)) {
      expect([...STATUS_STEPS[status]!].sort()).toEqual([...MANUAL_STATUS_TRANSITIONS[status]].sort());
    }
  });

  it('chaque action proposée est acceptée par le domaine (avec un contact), et les autres refusées', () => {
    const at = (status: CompanyStatus) => {
      const c = Company.register({ id: 'c1', name: 'Acme', ownerUserId: 'u1', now });
      const path = [CompanyStatus.Contacted, CompanyStatus.Qualified];
      for (const step of path) {
        if (c.status === status) break;
        c.changeStatus(step, { contactCount: 1 });
      }
      return c;
    };
    for (const status of [CompanyStatus.Target, CompanyStatus.Contacted, CompanyStatus.Qualified]) {
      const offered = statusActions(status).map((a) => a.to);
      for (const to of Object.values(CompanyStatus)) {
        const attempt = () => at(status).changeStatus(to, { contactCount: 1 });
        if (offered.includes(to)) expect(attempt).not.toThrow();
        else expect(attempt).toThrow();
      }
    }
  });
});

describe('changer de responsable (D17)', () => {
  const people: OwnerCandidate[] = [{ id: 'a', name: 'Anne' }, { id: 'm', name: 'Marie' }];
  it('exclut le responsable actuel de la liste', () => {
    expect(otherOwners(people, 'm')).toEqual([{ id: 'a', name: 'Anne' }]);
  });
  it('sans responsable actuel, tout le monde reste proposé', () => {
    expect(otherOwners(people, null)).toEqual(people);
    expect(otherOwners(people, undefined)).toEqual(people);
  });
});

describe('colonne « Responsable » du tableau des entreprises', () => {
  it('est proposée et visible par défaut, après le pays', () => {
    expect(COMPANY_COLUMNS.map((c) => c.id)).toContain('owner');
    expect(DEFAULT_COLUMNS.indexOf('owner')).toBe(DEFAULT_COLUMNS.indexOf('country') + 1);
  });
});
